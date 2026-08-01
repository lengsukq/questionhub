"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  Flame,
  Library,
  Play,
  Repeat,
  Sparkles,
  Bookmark,
  XCircle,
} from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import { getActiveSession, getDueStats, type PracticeSessionRecord } from "@/lib/db";
import { createPracticeSession } from "@/lib/session-utils";
import { getDailyTrend, getTodayStats, type DayStat } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const router = useRouter();
  const { banks, activeBankId } = useBankStore();
  const activeBank = banks.find((bank) => bank.id === activeBankId);

  const [activeSession, setActiveSession] = useState<PracticeSessionRecord | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [todayStats, setTodayStats] = useState({ answered: 0, correct: 0 });
  const [trend, setTrend] = useState<DayStat[]>([]);
  const [loadingQuick, setLoadingQuick] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeBankId) return;
    const [session, due, today, trendData] = await Promise.all([
      getActiveSession(),
      getDueStats(activeBankId),
      getTodayStats(activeBankId),
      getDailyTrend(activeBankId),
    ]);
    setActiveSession(session ?? null);
    setDueCount(due.length);
    setTodayStats(today);
    setTrend(trendData);
  }, [activeBankId]);

  useEffect(() => {
    // 从 IndexedDB 加载首页概览数据（外部数据源）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const startRandomPractice = async () => {
    if (!activeBankId || loadingQuick) return;
    setLoadingQuick(true);
    try {
      const session = await createPracticeSession({
        bankId: activeBankId,
        mode: "random",
        title: "随机练习",
        count: 10,
        order: "random",
      });
      router.push(`/practice/${session.id}`);
    } finally {
      setLoadingQuick(false);
    }
  };

  const maxTrend = Math.max(1, ...trend.map((day) => day.count));

  return (
    <div className="px-4 pt-4 safe-top">
      {/* 顶部问候 */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[15px] font-medium text-ios-label-secondary">
            {new Date().toLocaleDateString("zh-CN", {
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
          <h1 className="mt-0.5 text-[28px] font-bold tracking-tight">题集</h1>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ios-blue shadow-md shadow-ios-blue/30">
          <span className="text-[18px] font-bold text-white">题</span>
        </div>
      </div>

      {/* 继续练习 */}
      {activeSession && (
        <Card className="mb-3 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ios-blue/10">
                <Play className="h-4 w-4 text-ios-blue" fill="currentColor" />
              </span>
              <span className="text-[15px] font-semibold">继续练习</span>
            </div>
            <Link
              href={`/practice/${activeSession.id}`}
              className="flex items-center gap-0.5 text-[14px] font-medium text-ios-blue"
            >
              继续 <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="px-4 pb-4 pt-3">
            <p className="mb-2 text-[14px] text-ios-label-secondary">
              {activeSession.title} · 已完成 {activeSession.currentIndex}/{activeSession.questionRefs.length} 题
            </p>
            <Progress value={(activeSession.currentIndex / Math.max(1, activeSession.questionRefs.length)) * 100} />
          </div>
        </Card>
      )}

      {/* 今日状态 */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-ios-label-secondary">
            <Flame className="h-4 w-4 text-ios-orange" />
            <span className="text-[13px]">今日做题</span>
          </div>
          <p className="mt-2 text-[26px] font-bold tabular-nums">
            {todayStats.answered}
            <span className="ml-1 text-[13px] font-medium text-ios-label-secondary">题</span>
          </p>
          <p className="mt-0.5 text-[12px] text-ios-label-secondary">
            正确 {todayStats.correct} 题
          </p>
        </Card>
        <Link href="/review?tab=due">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-ios-label-secondary">
              <Repeat className="h-4 w-4 text-ios-purple" />
              <span className="text-[13px]">待复习</span>
            </div>
            <p className="mt-2 text-[26px] font-bold tabular-nums">
              {dueCount}
              <span className="ml-1 text-[13px] font-medium text-ios-label-secondary">题</span>
            </p>
            <p className="mt-0.5 text-[12px] text-ios-blue">去复习 →</p>
          </Card>
        </Link>
      </div>

      {/* 当前题库 */}
      <Card className="mb-3">
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="text-[15px] font-semibold">当前题库</span>
          <Link href="/banks" className="flex items-center text-[13px] text-ios-blue">
            切换 <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="px-4 pb-4 pt-3">
          {activeBank ? (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-xl bg-ios-blue/10 px-3 py-2 text-[14px] font-semibold text-ios-blue">
                {activeBank.name}
              </span>
              {activeBank.subjects.map((subject) => (
                <span
                  key={subject.id}
                  className="rounded-xl bg-ios-surface-secondary px-3 py-2 text-[13px] text-ios-label-secondary dark:bg-ios-surface-tertiary"
                >
                  {subject.name}
                </span>
              ))}
            </div>
          ) : (
            <Link href="/banks" className="text-[14px] text-ios-blue">
              前往导入题库
            </Link>
          )}
        </div>
      </Card>

      {/* 快捷入口 */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Link href={activeBankId ? `/banks/${activeBankId}` : "/banks"}>
          <QuickActionCard icon={Library} color="blue" title="章节练习" subtitle="按章节系统刷题" />
        </Link>
        <button onClick={startRandomPractice} disabled={loadingQuick} className="text-left">
          <QuickActionCard icon={Sparkles} color="purple" title="随机练习" subtitle={loadingQuick ? "出题中…" : "10 题随机热身"} />
        </button>
        <Link href="/review?tab=wrong">
          <QuickActionCard icon={XCircle} color="red" title="错题本" subtitle="重点攻克错题" />
        </Link>
        <Link href="/review?tab=favorite">
          <QuickActionCard icon={Bookmark} color="orange" title="收藏" subtitle="标记重要题目" />
        </Link>
      </div>

      {/* 7 天趋势 */}
      <Card className="mb-3">
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="text-[15px] font-semibold">近 7 天做题趋势</span>
          <Link href="/analytics" className="flex items-center text-[13px] text-ios-blue">
            数据 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="flex h-24 items-end justify-between gap-2 px-4 pb-4 pt-3">
          {trend.map((day) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[11px] font-medium tabular-nums text-ios-label-secondary">
                {day.count > 0 ? day.count : ""}
              </span>
              <div
                className={cn(
                  "w-full rounded-md transition-all",
                  day.count > 0
                    ? "bg-ios-blue"
                    : "bg-ios-surface-tertiary",
                )}
                style={{ height: `${Math.max(6, (day.count / maxTrend) * 100)}%` }}
              />
              <span className="text-[10px] text-ios-label-tertiary">{day.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="h-4" />
    </div>
  );
}

function QuickActionCard({
  icon: Icon,
  color,
  title,
  subtitle,
}: {
  icon: typeof Library;
  color: "blue" | "purple" | "red" | "orange";
  title: string;
  subtitle: string;
}) {
  const colorClasses = {
    blue: "bg-ios-blue/10 text-ios-blue",
    purple: "bg-ios-purple/10 text-ios-purple",
    red: "bg-ios-red/10 text-ios-red",
    orange: "bg-ios-orange/10 text-ios-orange",
  } as const;

  return (
    <Card className="row-active flex h-[92px] flex-col justify-between p-4">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", colorClasses[color])}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="text-[12px] text-ios-label-secondary">{subtitle}</p>
      </div>
    </Card>
  );
}
