"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, CheckCircle2, Target } from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import { db, listQuestions, type QuestionRecord, type QuestionStatRecord } from "@/lib/db";
import { getDailyTrend, type DayStat } from "@/lib/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { QUESTION_TYPE_LABELS } from "@/types/question-bank";

interface ChapterMastery {
  subjectName: string;
  chapter: string;
  count: number;
  answered: number;
  correct: number;
}

export default function AnalyticsPage() {
  const { banks, activeBankId } = useBankStore();
  const bankId = activeBankId ?? "";
  const bank = banks.find((item) => item.id === bankId);

  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [stats, setStats] = useState<QuestionStatRecord[]>([]);
  const [trend, setTrend] = useState<DayStat[]>([]);

  const refresh = useCallback(async () => {
    if (!bankId) return;
    const [questionList, statList, trendData] = await Promise.all([
      listQuestions(bankId),
      db.questionStats.where("bankId").equals(bankId).toArray(),
      getDailyTrend(bankId),
    ]);
    setQuestions(questionList);
    setStats(statList);
    setTrend(trendData);
  }, [bankId]);

  useEffect(() => {
    // 从 IndexedDB 加载统计概览数据（外部数据源）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const summary = useMemo(() => {
    const statMap = new Map(stats.map((stat) => [stat.questionId, stat]));
    const total = questions.length;
    let answeredCount = 0;
    let correctCount = 0;
    let subjectiveDone = 0;
    const typeMap = new Map<string, { done: number; correct: number }>();

    for (const question of questions) {
      const stat = statMap.get(question.originalId);
      if (!stat || stat.attemptCount === 0) continue;
      answeredCount += 1;
      if (question.type === "short_answer" || question.type === "comprehensive" || question.type === "calculation_analysis") {
        subjectiveDone += 1;
      } else {
        correctCount += stat.correctCount;
      }
      const entry = typeMap.get(question.type) ?? { done: 0, correct: 0 };
      entry.done += 1;
      entry.correct += stat.correctCount;
      typeMap.set(question.type, entry);
    }

    const objectiveAnswered = answeredCount - subjectiveDone;
    const accuracy = objectiveAnswered > 0 ? Math.round((correctCount / objectiveAnswered) * 100) : 0;
    return { total, answeredCount, subjectiveDone, accuracy, typeProgress: typeMap };
  }, [questions, stats]);

  const chapterMastery = useMemo<ChapterMastery[]>(() => {
    const statMap = new Map(stats.map((stat) => [stat.questionId, stat]));
    const map = new Map<string, ChapterMastery>();

    for (const question of questions) {
      const stat = statMap.get(question.originalId);
      if (!stat || stat.attemptCount === 0) continue;
      const subjectName = bank?.subjects.find((subject) => subject.id === question.subjectId)?.name ?? question.subjectId;
      const key = `${question.subjectId}:${question.chapter}`;
      const entry = map.get(key) ?? {
        subjectName,
        chapter: question.chapter,
        count: 0,
        answered: 0,
        correct: 0,
      };
      entry.count += 1;
      entry.answered += 1;
      entry.correct += stat.correctCount;
      map.set(key, entry);
    }

    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [questions, stats, bank]);

  const maxTrend = Math.max(1, ...trend.map((day) => day.count));

  return (
    <div className="safe-top">
      <PageHeader title="学习数据" onBack={() => window.history.back()} />

      <div className="px-4 pt-4">
        {/* 总览 */}
        <div className="mb-3 grid grid-cols-3 gap-3">
          <OverviewCard icon={<BookOpen className="h-4 w-4 text-ios-blue" />} label="总题数" value={summary.total} />
          <OverviewCard icon={<Target className="h-4 w-4 text-ios-orange" />} label="已做题" value={summary.answeredCount} />
          <OverviewCard icon={<CheckCircle2 className="h-4 w-4 text-ios-green" />} label="客观正确率" value={`${summary.accuracy}%`} />
        </div>

        <Card className="mb-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">总体进度</span>
            <span className="text-[13px] tabular-nums text-ios-label-secondary">
              {summary.answeredCount}/{summary.total}
            </span>
          </div>
          <Progress className="mt-3" value={(summary.answeredCount / Math.max(1, summary.total)) * 100} />
          <p className="mt-2 text-[12px] text-ios-label-secondary">
            主观题完成 {summary.subjectiveDone} 道（计入已做题，不计入正确率）
          </p>
        </Card>

        {/* 7 天趋势 */}
        <Card className="mb-3">
          <div className="flex items-center gap-2 px-4 pt-4">
            <BarChart3 className="h-4 w-4 text-ios-blue" />
            <span className="text-[15px] font-semibold">近 7 天做题量</span>
          </div>
          <div className="flex h-28 items-end justify-between gap-2 px-4 pb-4 pt-3">
            {trend.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[11px] font-medium tabular-nums text-ios-label-secondary">
                  {day.count > 0 ? day.count : ""}
                </span>
                <div
                  className={cn("w-full rounded-md", day.count > 0 ? "bg-ios-blue" : "bg-ios-surface-tertiary")}
                  style={{ height: `${Math.max(6, (day.count / maxTrend) * 100)}%` }}
                />
                <span className="text-[10px] text-ios-label-tertiary">{day.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* 题型分布 */}
        <Card className="mb-3">
          <p className="px-4 pt-4 text-[15px] font-semibold">题型掌握情况</p>
          <div className="space-y-3 p-4">
            {QUESTION_TYPE_ORDER.map((type) => {
              const entry = summary.typeProgress.get(type);
              if (!entry) return null;
              const total = questions.filter((question) => question.type === type).length;
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-[13px] text-ios-label-secondary">
                    {QUESTION_TYPE_LABELS[type]}
                  </span>
                  <div className="flex-1">
                    <Progress
                      value={total > 0 ? (entry.done / total) * 100 : 0}
                      indicatorClassName={cn(entry.done > 0 && entry.done === total && "bg-ios-green")}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-[12px] tabular-nums text-ios-label-secondary">
                    {entry.done}/{total}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 章节掌握度 */}
        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ios-label-secondary">
          章节掌握度
        </h2>
        <Card className="overflow-hidden">
          {chapterMastery.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-ios-label-tertiary">
              完成练习后这里会展示各章节的掌握情况
            </div>
          ) : (
            chapterMastery.slice(0, 20).map((item, index) => {
              const accuracy = item.answered > 0 ? Math.round((item.correct / item.answered) * 100) : 0;
              return (
                <div
                  key={`${item.subjectName}:${item.chapter}`}
                  className={cn("px-4 py-3", index > 0 && "border-t border-ios-separator/50")}
                >
                  <div className="flex items-center justify-between">
                    <p className="truncate text-[14px] font-medium">{item.chapter}</p>
                    <span className="ml-2 shrink-0 text-[12px] tabular-nums text-ios-label-secondary">
                      已做 {item.answered}/{item.count} · 正确率 {accuracy}%
                    </span>
                  </div>
                  <p className="mb-1.5 mt-0.5 text-[11px] text-ios-label-tertiary">{item.subjectName}</p>
                  <Progress value={accuracy} indicatorClassName={cn(accuracy >= 80 && "bg-ios-green", accuracy < 60 && "bg-ios-orange")} />
                </div>
              );
            })
          )}
        </Card>

        <div className="h-6" />
      </div>
    </div>
  );
}

const QUESTION_TYPE_ORDER = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "short_answer",
  "calculation_analysis",
  "comprehensive",
] as const;

function OverviewCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="flex flex-col items-center gap-1.5 py-3.5">
      <div className="flex items-center gap-1">
        {icon}
        <span className="text-[12px] text-ios-label-secondary">{label}</span>
      </div>
      <p className="text-[22px] font-bold tabular-nums leading-none">{value}</p>
    </Card>
  );
}
