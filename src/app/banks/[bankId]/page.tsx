"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BookOpen, ChevronRight, Layers, PenLine, Timer } from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import { db, listQuestions, type QuestionRecord, type QuestionStatRecord } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

type UnitKey = "chapter_practice" | "mock_exam" | "advanced_subjective";

const UNIT_ICONS = {
  chapter_practice: BookOpen,
  mock_exam: Timer,
  advanced_subjective: PenLine,
} as const;

export default function BankDetailPage() {
  const params = useParams<{ bankId: string }>();
  const router = useRouter();
  const bankId = params.bankId;
  const { banks } = useBankStore();
  const bank = banks.find((item) => item.id === bankId);

  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [stats, setStats] = useState<Map<string, QuestionStatRecord>>(new Map());
  const [unit, setUnit] = useState<UnitKey>("chapter_practice");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [questionList, statList] = await Promise.all([
        listQuestions(bankId),
        db.questionStats.where("bankId").equals(bankId).toArray(),
      ]);
      if (cancelled) return;
      setQuestions(questionList);
      setStats(new Map(statList.map((stat) => [stat.questionId, stat])));
    })();
    return () => {
      cancelled = true;
    };
  }, [bankId]);

  const grouped = useMemo(() => {
    const unitQuestions = questions.filter((question) => question.unit === unit);
    const subjectMap = new Map<
      string,
      Array<{ chapter: string; count: number; answered: number }>
    >();

    for (const question of unitQuestions) {
      const chapters = subjectMap.get(question.subjectId) ?? [];
      let chapterEntry = chapters.find((entry) => entry.chapter === question.chapter);
      if (!chapterEntry) {
        chapterEntry = { chapter: question.chapter, count: 0, answered: 0 };
        chapters.push(chapterEntry);
        subjectMap.set(question.subjectId, chapters);
      }
      chapterEntry.count += 1;
      if ((stats.get(question.originalId)?.attemptCount ?? 0) > 0) {
        chapterEntry.answered += 1;
      }
    }

    return [...subjectMap.entries()].map(([subjectId, chapters]) => ({
      subjectId,
      subjectName: bank?.subjects.find((subject) => subject.id === subjectId)?.name ?? subjectId,
      chapters: chapters.sort(
        (a, b) =>
          (unitQuestions.find((question) => question.subjectId === subjectId && question.chapter === a.chapter)
            ?.globalIndex ?? 0) -
          (unitQuestions.find((question) => question.subjectId === subjectId && question.chapter === b.chapter)
            ?.globalIndex ?? 0),
      ),
    }));
  }, [questions, unit, stats, bank]);

  if (!bank) {
    return (
      <div className="safe-top">
        <PageHeader title="题库" onBack={() => router.push("/banks")} />
        <div className="px-4 pt-8 text-center text-[15px] text-ios-label-secondary">题库不存在</div>
      </div>
    );
  }

  const unitCounts = {
    chapter_practice: questions.filter((question) => question.unit === "chapter_practice").length,
    mock_exam: questions.filter((question) => question.unit === "mock_exam").length,
    advanced_subjective: questions.filter((question) => question.unit === "advanced_subjective").length,
  };

  return (
    <div className="safe-top">
      <PageHeader title={bank.name} onBack={() => router.push("/banks")} />

      <div className="px-4 pt-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ios-blue/10">
              <Layers className="h-6 w-6 text-ios-blue" />
            </div>
            <div>
              <p className="text-[17px] font-semibold">{bank.questionCount} 道题</p>
              <p className="text-[13px] text-ios-label-secondary">
                {bank.subjects.map((subject) => subject.name).join(" · ")}
              </p>
            </div>
          </div>
        </Card>

        <div className="py-4">
          <Segmented<UnitKey>
            value={unit}
            onChange={setUnit}
            options={[
              { value: "chapter_practice", label: "章节练习", count: unitCounts.chapter_practice },
              { value: "mock_exam", label: "模拟套卷", count: unitCounts.mock_exam },
              { value: "advanced_subjective", label: "主观题专项", count: unitCounts.advanced_subjective },
            ]}
          />
        </div>

        {grouped.length === 0 && (
          <div className="py-16 text-center text-[14px] text-ios-label-tertiary">
            该单元暂无题目
          </div>
        )}

        <div className="space-y-4">
          {grouped.map(({ subjectId, subjectName, chapters }) => (
            <div key={subjectId}>
              <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ios-label-secondary">
                {subjectName}
              </h2>
              <Card className="overflow-hidden">
                {chapters.map((chapter, index) => {
                  const Icon = UNIT_ICONS[unit];
                  const progress = chapter.count > 0 ? (chapter.answered / chapter.count) * 100 : 0;
                  return (
                    <Link
                      key={chapter.chapter}
                      href={`/practice/setup?bankId=${bankId}&unit=${unit}&chapter=${encodeURIComponent(chapter.chapter)}`}
                      className={cn(
                        "row-active flex items-center gap-3 px-4 py-3.5",
                        index > 0 && "border-t border-ios-separator/50",
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ios-surface-secondary dark:bg-ios-surface-tertiary">
                        <Icon className="h-4 w-4 text-ios-label-secondary" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-[15px] font-medium">{chapter.chapter}</p>
                          <span className="ml-2 shrink-0 text-[13px] tabular-nums text-ios-label-secondary">
                            {chapter.answered}/{chapter.count}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ios-surface-tertiary">
                          <div
                            className="h-full rounded-full bg-ios-blue transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ios-label-tertiary" />
                    </Link>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
