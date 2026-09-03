"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, CheckCircle2, Target } from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import { db, listQuestions, type QuestionRecord, type QuestionStatRecord } from "@/lib/db";
import { getDailyTrend, type DayStat } from "@/lib/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
    // 从 IndexedDB 加载统计数据
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const summary = useMemo(() => {
    const statMap = new Map(stats.map((s) => [s.questionId, s]));
    const total = questions.length;
    let answeredCount = 0;
    let correctCount = 0;
    let subjectiveDone = 0;
    const typeMap = new Map<string, { done: number; correct: number }>();

    for (const q of questions) {
      const stat = statMap.get(q.originalId);
      if (!stat || stat.attemptCount === 0) continue;
      answeredCount += 1;
      // 按题去重：以最近一次作答是否答对判定当前掌握状态，
      // 避免用累计答对次数（correctCount）导致正确率超过 100%
      const isMastered = stat.lastCorrectness === "correct";
      if (
        q.type === "short_answer" ||
        q.type === "comprehensive" ||
        q.type === "calculation_analysis"
      ) {
        subjectiveDone += 1;
      } else if (isMastered) {
        correctCount += 1;
      }
      const entry = typeMap.get(q.type) ?? { done: 0, correct: 0 };
      entry.done += 1;
      if (isMastered) entry.correct += 1;
      typeMap.set(q.type, entry);
    }

    const objectiveAnswered = answeredCount - subjectiveDone;
    const accuracy = objectiveAnswered > 0 ? Math.round((correctCount / objectiveAnswered) * 100) : 0;
    return { total, answeredCount, subjectiveDone, accuracy, typeProgress: typeMap };
  }, [questions, stats]);

  const chapterMastery = useMemo<ChapterMastery[]>(() => {
    const statMap = new Map(stats.map((s) => [s.questionId, s]));
    const map = new Map<string, ChapterMastery>();

    for (const q of questions) {
      const subjectName =
        bank?.subjects.find((s) => s.id === q.subjectId)?.name ?? q.subjectId;
      const key = `${q.subjectId}:${q.chapter}`;
      const entry = map.get(key) ?? {
        subjectName,
        chapter: q.chapter,
        count: 0,
        answered: 0,
        correct: 0,
      };
      entry.count += 1;
      const stat = statMap.get(q.originalId);
      if (stat && stat.attemptCount > 0) {
        entry.answered += 1;
        // 按题去重：以最近一次作答判定，避免累计答对次数撑大分子
        if (stat.lastCorrectness === "correct") entry.correct += 1;
      }
      map.set(key, entry);
    }

    return [...map.values()]
      .filter((entry) => entry.answered > 0)
      .sort((a, b) => b.count - a.count);
  }, [questions, stats, bank]);

  const maxTrend = Math.max(1, ...trend.map((day) => day.count));

  return (
    <div className="min-h-dvh safe-top">
      <PageHeader title="学习数据分析" subtitle="多维度追踪刷题进度、掌握度与历史趋势" />

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* 顶部三大核心指标卡 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <OverviewCard
            icon={<BookOpen className="h-5 w-5 text-ios-blue" />}
            label="收录总题量"
            value={summary.total}
            unit="题"
            color="blue"
          />
          <OverviewCard
            icon={<Target className="h-5 w-5 text-ios-orange" />}
            label="累计已做题"
            value={summary.answeredCount}
            unit="题"
            color="orange"
          />
          <OverviewCard
            icon={<CheckCircle2 className="h-5 w-5 text-ios-green" />}
            label="客观题正确率"
            value={summary.accuracy}
            unit="%"
            color="green"
          />
        </div>

        {/* 总体进度卡片 */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[16px] font-bold text-ios-label">题库总体刷题进度</h3>
              <p className="mt-0.5 text-[12px] text-ios-label-secondary">
                主观题完成 {summary.subjectiveDone} 道（计入已做，自评统计）
              </p>
            </div>
            <span className="text-[18px] font-extrabold tabular-nums text-ios-blue">
              {summary.answeredCount} / {summary.total}
            </span>
          </div>
          <div className="mt-4">
            <Progress
              value={(summary.answeredCount / Math.max(1, summary.total)) * 100}
              size="default"
            />
          </div>
        </Card>

        {/* 双栏网格：7天趋势与题型掌握 */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 近 7 天做题量柱状图 */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[15px] font-bold text-ios-label">
                <BarChart3 className="h-5 w-5 text-ios-blue" />
                近 7 天做题动态
              </h3>
            </div>
            <div className="flex h-36 items-end justify-between gap-3 pt-4">
              {trend.map((day) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[11px] font-bold tabular-nums text-ios-label-secondary">
                    {day.count > 0 ? day.count : ""}
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-full transition-all duration-500",
                      day.count > 0
                        ? "bg-gradient-to-t from-ios-blue to-ios-indigo shadow-xs"
                        : "bg-ios-surface-tertiary/60",
                    )}
                    style={{ height: `${Math.max(10, (day.count / maxTrend) * 100)}%` }}
                  />
                  <span className="text-[11px] text-ios-label-tertiary">{day.label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* 题型掌握度 */}
          <Card className="p-6">
            <h3 className="mb-4 text-[15px] font-bold text-ios-label">题型完成分布</h3>
            <div className="space-y-4">
              {QUESTION_TYPE_ORDER.map((type) => {
                const entry = summary.typeProgress.get(type);
                if (!entry) return null;
                const typeTotal = questions.filter((q) => q.type === type).length;
                const percent = typeTotal > 0 ? (entry.done / typeTotal) * 100 : 0;

                return (
                  <div key={type} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-semibold text-ios-label">
                        {QUESTION_TYPE_LABELS[type]}
                      </span>
                      <span className="text-[12px] tabular-nums text-ios-label-secondary">
                        {entry.done} / {typeTotal} 题 ({Math.round(percent)}%)
                      </span>
                    </div>
                    <Progress value={percent} size="sm" />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* 章节掌握度排行榜 */}
        <div>
          <h3 className="mb-3 px-1 text-[16px] font-bold text-ios-label">章节掌握度追踪</h3>
          <Card className="overflow-hidden p-2">
            {chapterMastery.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-ios-label-tertiary">
                完成章节练习后将在此展示各章节的答题正确率与掌握度分析
              </div>
            ) : (
              <div className="divide-y divide-ios-separator/50">
                {chapterMastery.slice(0, 25).map((item) => {
                  const accuracy =
                    item.answered > 0 ? Math.round((item.correct / item.answered) * 100) : 0;
                  return (
                    <div key={`${item.subjectName}:${item.chapter}`} className="p-4 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div>
                          <p className="text-[14px] font-bold text-ios-label">{item.chapter}</p>
                          <p className="text-[11px] text-ios-label-tertiary">{item.subjectName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] tabular-nums text-ios-label-secondary">
                            已做 {item.answered}/{item.count} 题
                          </span>
                          <Badge
                            color={accuracy >= 80 ? "green" : accuracy >= 60 ? "blue" : "orange"}
                          >
                            正确率 {accuracy}%
                          </Badge>
                        </div>
                      </div>
                      <Progress
                        value={accuracy}
                        size="sm"
                        indicatorClassName={cn(
                          accuracy >= 80 && "bg-ios-green",
                          accuracy < 60 && "bg-ios-orange",
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
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
  unit,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit: string;
  color: "blue" | "orange" | "green";
}) {
  const borderMap = {
    blue: "border-ios-blue/20 bg-ios-blue/5",
    orange: "border-ios-orange/20 bg-ios-orange/5",
    green: "border-ios-green/20 bg-ios-green/5",
  };

  return (
    <Card className={cn("flex items-center gap-4 p-5", borderMap[color])}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ios-surface shadow-sm">
        {icon}
      </span>
      <div>
        <p className="text-[12px] font-semibold text-ios-label-secondary">{label}</p>
        <p className="mt-0.5 text-[26px] font-extrabold tabular-nums text-ios-label">
          {value}
          <span className="ml-1 text-[13px] font-medium text-ios-label-secondary">{unit}</span>
        </p>
      </div>
    </Card>
  );
}
