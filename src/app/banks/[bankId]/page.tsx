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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

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
      setStats(new Map(statList.map((s) => [s.questionId, s])));
    })();
    return () => {
      cancelled = true;
    };
  }, [bankId]);

  const grouped = useMemo(() => {
    const unitQuestions = questions.filter((q) => q.unit === unit);
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
      subjectName: bank?.subjects.find((s) => s.id === subjectId)?.name ?? subjectId,
      chapters: chapters.sort(
        (a, b) =>
          (unitQuestions.find((q) => q.subjectId === subjectId && q.chapter === a.chapter)
            ?.globalIndex ?? 0) -
          (unitQuestions.find((q) => q.subjectId === subjectId && q.chapter === b.chapter)
            ?.globalIndex ?? 0),
      ),
    }));
  }, [questions, unit, stats, bank]);

  if (!bank) {
    return (
      <div className="safe-top">
        <PageHeader title="题库详情" onBack={() => router.push("/banks")} />
        <div className="px-4 pt-12 text-center text-[15px] text-ios-label-secondary">
          题库不存在或已删除
        </div>
      </div>
    );
  }

  const unitCounts = {
    chapter_practice: questions.filter((q) => q.unit === "chapter_practice").length,
    mock_exam: questions.filter((q) => q.unit === "mock_exam").length,
    advanced_subjective: questions.filter((q) => q.unit === "advanced_subjective").length,
  };

  return (
    <div className="min-h-dvh safe-top">
      <PageHeader title={bank.name} onBack={() => router.push("/banks")} />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* 顶部总览卡片 */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-ios-blue to-ios-indigo text-white shadow-lg shadow-ios-blue/25">
                <Layers className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-[20px] font-extrabold text-ios-label">{bank.name}</h1>
                <p className="text-[13px] text-ios-label-secondary">
                  共计收录 {bank.questionCount} 道精选题目
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {bank.subjects.map((sub) => (
                <Badge key={sub.id} color="blue">
                  {sub.name}
                </Badge>
              ))}
            </div>
          </div>
        </Card>

        {/* 练习单元切换 */}
        <div className="py-5">
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
          <div className="py-20 text-center text-[14px] text-ios-label-tertiary">
            该单元暂无题目收录
          </div>
        )}

        {/* 章节列表 */}
        <div className="space-y-6">
          {grouped.map(({ subjectId, subjectName, chapters }) => (
            <div key={subjectId} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className="h-3 w-1 rounded-full bg-ios-blue" />
                <h2 className="text-[15px] font-bold text-ios-label">{subjectName}</h2>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {chapters.map((chapter) => {
                  const Icon = UNIT_ICONS[unit];
                  const progress =
                    chapter.count > 0 ? (chapter.answered / chapter.count) * 100 : 0;
                  return (
                    <Link
                      key={chapter.chapter}
                      href={`/practice/setup?bankId=${bankId}&unit=${unit}&chapter=${encodeURIComponent(
                        chapter.chapter,
                      )}`}
                      className="group"
                    >
                      <Card
                        variant="interactive"
                        className="flex items-center gap-4 p-4 transition-all"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ios-surface-secondary text-ios-label-secondary group-hover:bg-ios-blue group-hover:text-white transition-colors">
                          <Icon className="h-5 w-5" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="truncate text-[14px] font-bold text-ios-label group-hover:text-ios-blue transition-colors">
                              {chapter.chapter}
                            </p>
                            <span className="ml-2 shrink-0 text-[12px] font-semibold tabular-nums text-ios-label-secondary">
                              {chapter.answered} / {chapter.count}
                            </span>
                          </div>

                          <div className="mt-2">
                            <Progress value={progress} size="sm" />
                          </div>
                        </div>

                        <ChevronRight className="h-4 w-4 shrink-0 text-ios-label-tertiary transition-transform group-hover:translate-x-0.5" />
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
