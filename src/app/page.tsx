"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  ChevronRight,
  Flame,
  Library,
  Loader2,
  Play,
  Repeat,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import { getActiveSession, getDueCount, resetRandomProgress, type PracticeSessionRecord } from "@/lib/db";
import { createPracticeSession } from "@/lib/session-utils";
import { getDailyTrend, getTodayStats, type DayStat } from "@/lib/queries";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [allMasteredOpen, setAllMasteredOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeBankId) return;
    // 多题库混练时副题库的做题也会统计进来：按会话实际参与的 bankIds 聚合
    const session = await getActiveSession();
    const statsBankIds = session?.config.bankIds?.length
      ? session.config.bankIds
      : [activeBankId];
    const [dueCountValue, today, trendData] = await Promise.all([
      getDueCount(statsBankIds),
      getTodayStats(statsBankIds),
      getDailyTrend(statsBankIds),
    ]);
    setActiveSession(session ?? null);
    setDueCount(dueCountValue);
    setTodayStats(today);
    setTrend(trendData);
  }, [activeBankId]);

  useEffect(() => {
    // 从 IndexedDB 加载首页概览数据
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const startRandomPractice = async () => {
    if (loadingQuick) return;
    if (!activeBankId) {
      toast.info("请先选择或导入题库");
      router.push("/banks");
      return;
    }
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
    } catch (err) {
      if (err instanceof Error && err.message === "ALL_MASTERED") {
        setAllMasteredOpen(true);
      } else {
        toast.error(err instanceof Error ? err.message : "创建练习失败");
      }
      setLoadingQuick(false);
    }
  };

  const handleResetRandomProgress = async () => {
    if (!activeBankId || resetting) return;
    setResetting(true);
    try {
      const count = await resetRandomProgress(activeBankId);
      setAllMasteredOpen(false);
      toast.success(count > 0 ? `已重置 ${count} 道题的刷题记录，可重新随机挑战` : "暂无可重置的刷题记录");
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "重置失败");
    } finally {
      setResetting(false);
    }
  };

  const maxTrend = Math.max(1, ...trend.map((day) => day.count));

  return (
    <div className="px-4 pt-4 lg:px-8 lg:pt-8 safe-top">
      {/* 顶部问候栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-ios-blue uppercase tracking-wider">
            {new Date().toLocaleDateString("zh-CN", {
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
          <h1 className="mt-0.5 text-[26px] font-extrabold tracking-tight text-ios-label sm:text-[32px]">
            今日刷题空间
          </h1>
        </div>

        {/* 移动端 Logo 徽章 */}
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-ios-blue to-ios-indigo shadow-lg shadow-ios-blue/25 lg:hidden">
          <span className="text-[20px] font-bold text-white">题</span>
        </div>
      </div>

      {/* 响应式 Bento Grid 布局 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* 左栏 (8列)：主行动卡片与快捷入口 */}
        <div className="space-y-5 lg:col-span-8">
          {/* 继续练习 Hero 卡片 */}
          {activeSession ? (
            <Card className="relative overflow-hidden border-ios-blue/30 bg-gradient-to-br from-ios-blue/8 via-ios-surface to-ios-surface p-6 shadow-lg shadow-ios-blue/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ios-blue text-white shadow-sm shadow-ios-blue/30">
                      <Play className="h-4 w-4" fill="currentColor" />
                    </span>
                    <span className="text-[14px] font-bold text-ios-blue">正在进行的练习</span>
                  </div>
                  <h2 className="text-[20px] font-extrabold text-ios-label">
                    {activeSession.title}
                  </h2>
                  <p className="text-[13px] text-ios-label-secondary">
                    已完成进度 {activeSession.currentIndex} / {activeSession.questionRefs.length} 题
                  </p>
                </div>

                <Link href={`/practice/${activeSession.id}`}>
                  <Button size="lg" className="w-full sm:w-auto shadow-md">
                    继续刷题
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="mt-5">
                <Progress
                  value={
                    (activeSession.currentIndex /
                      Math.max(1, activeSession.questionRefs.length)) *
                    100
                  }
                  size="default"
                />
              </div>
            </Card>
          ) : (
            <Card className="relative overflow-hidden bg-gradient-to-br from-ios-blue/5 via-ios-surface to-ios-surface p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <Badge color="blue">开始学习</Badge>
                  <h2 className="text-[20px] font-extrabold text-ios-label">
                    开启今天的练习计划
                  </h2>
                  <p className="text-[13px] text-ios-label-secondary">
                    {activeBank
                      ? `当前题库：${activeBank.name}（共 ${activeBank.questionCount} 题）`
                      : "暂无激活题库，请先导入题库"}
                  </p>
                </div>

                <Link href={activeBankId ? `/banks/${activeBankId}` : "/banks"}>
                  <Button size="lg" className="w-full sm:w-auto shadow-md">
                    <Sparkles className="h-4 w-4" />
                    进入章节刷题
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {/* 快捷入口四宫格 */}
          <div>
            <h3 className="mb-3 px-1 text-[15px] font-bold text-ios-label">核心刷题模式</h3>
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              <Link href={activeBankId ? `/banks/${activeBankId}` : "/banks"} className="block">
                <QuickActionCard
                  icon={Library}
                  color="blue"
                  title="章节练习"
                  subtitle="按章系统攻关"
                />
              </Link>
              <button
                onClick={startRandomPractice}
                disabled={loadingQuick}
                className="block text-left w-full cursor-pointer"
              >
                <QuickActionCard
                  icon={Sparkles}
                  color="purple"
                  title="随机热身"
                  subtitle={loadingQuick ? "正在出题跳转…" : "10 题随机练习"}
                  loading={loadingQuick}
                />
              </button>
              <Link href="/review?tab=wrong" className="block">
                <QuickActionCard
                  icon={XCircle}
                  color="red"
                  title="错题攻坚"
                  subtitle="自动收录错题"
                />
              </Link>
              <Link href="/review?tab=favorite" className="block">
                <QuickActionCard
                  icon={Bookmark}
                  color="orange"
                  title="重点收藏"
                  subtitle="标记关键考点"
                />
              </Link>
            </div>
          </div>
        </div>

        {/* 右栏 (4列)：数据指标与趋势 */}
        <div className="space-y-5 lg:col-span-4">
          {/* 今日做题 & 待复习 */}
          <div className="grid grid-cols-2 gap-3.5">
            <Card className="p-4">
              <div className="flex items-center gap-1.5 text-ios-orange">
                <Flame className="h-4 w-4" />
                <span className="text-[12px] font-semibold">今日做题</span>
              </div>
              <p className="mt-2 text-[26px] font-extrabold tabular-nums text-ios-label">
                {todayStats.answered}
                <span className="ml-1 text-[13px] font-medium text-ios-label-secondary">题</span>
              </p>
              <p className="mt-0.5 text-[11px] text-ios-label-tertiary">
                正确 {todayStats.correct} 题
              </p>
            </Card>

            <Link href="/review?tab=due" className="block">
              <Card className="p-4 hover:border-ios-purple/30 transition-all">
                <div className="flex items-center gap-1.5 text-ios-purple">
                  <Repeat className="h-4 w-4" />
                  <span className="text-[12px] font-semibold">待复习</span>
                </div>
                <p className="mt-2 text-[26px] font-extrabold tabular-nums text-ios-label">
                  {dueCount}
                  <span className="ml-1 text-[13px] font-medium text-ios-label-secondary">题</span>
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-ios-blue flex items-center gap-0.5">
                  去复习 <ChevronRight className="h-3 w-3" />
                </p>
              </Card>
            </Link>
          </div>

          {/* 当前题库详情 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[15px]">当前激活题库</CardTitle>
              <Link href="/banks" className="flex items-center text-[12px] font-semibold text-ios-blue">
                管理 <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent>
              {activeBank ? (
                <div className="space-y-2.5">
                  <div className="rounded-2xl border border-ios-blue/20 bg-ios-blue/8 p-3">
                    <p className="text-[14px] font-bold text-ios-blue">{activeBank.name}</p>
                    <p className="mt-0.5 text-[11px] text-ios-label-tertiary">
                      共收录 {activeBank.questionCount} 道题
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeBank.subjects.map((sub) => (
                      <span
                        key={sub.id}
                        className="rounded-lg bg-ios-surface-secondary px-2 py-0.5 text-[11px] font-medium text-ios-label-secondary"
                      >
                        {sub.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <Link href="/banks" className="text-[13px] text-ios-blue">
                  前往导入或选择题库 →
                </Link>
              )}
            </CardContent>
          </Card>

          {/* 近 7 天趋势柱状图 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-[15px]">
                <TrendingUp className="h-4 w-4 text-ios-blue" />
                7 天做题趋势
              </CardTitle>
              <Link href="/analytics" className="text-[12px] font-semibold text-ios-blue">
                详情
              </Link>
            </CardHeader>
            <CardContent>
              <div className="flex h-28 items-end justify-between gap-2 pt-2">
                {trend.map((day) => (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[10px] font-bold tabular-nums text-ios-label-secondary">
                      {day.count > 0 ? day.count : ""}
                    </span>
                    <div
                      className={cn(
                        "w-full rounded-full transition-all duration-500",
                        day.count > 0
                          ? "bg-gradient-to-t from-ios-blue to-ios-indigo"
                          : "bg-ios-surface-tertiary/60",
                      )}
                      style={{ height: `${Math.max(8, (day.count / maxTrend) * 100)}%` }}
                    />
                    <span className="text-[10px] text-ios-label-tertiary">{day.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 随机池已刷完：提示 + 重置当前题库做题记录 */}
      <Sheet
        open={allMasteredOpen}
        onClose={() => setAllMasteredOpen(false)}
        title="随机挑战已全部通关"
        description={`当前题库${activeBank ? `《${activeBank.name}》` : ""}中未做错的题目已全部答对，随机池暂无可抽题目`}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-ios-green/30 bg-ios-green/8 p-4 text-[13px] leading-relaxed text-ios-label">
            做对的题目不会再重复出现，答错的题目仍会回到随机池并标记“错过 N
            次”。想从头再刷一遍，可重置该题库的做题记录（收藏与笔记会保留）。
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1 justify-center"
              onClick={() => setAllMasteredOpen(false)}
            >
              稍后再说
            </Button>
            <Button
              size="lg"
              className="flex-1 justify-center"
              variant="danger"
              loading={resetting}
              loadingText="正在重置…"
              onClick={() => void handleResetRandomProgress()}
            >
              重置该题库记录
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function QuickActionCard({
  icon: Icon,
  color,
  title,
  subtitle,
  loading = false,
}: {
  icon: typeof Library;
  color: "blue" | "purple" | "red" | "orange";
  title: string;
  subtitle: string;
  loading?: boolean;
}) {
  const colorMap = {
    blue: "bg-ios-blue/10 text-ios-blue border-ios-blue/20",
    purple: "bg-ios-purple/10 text-ios-purple border-ios-purple/20",
    red: "bg-ios-red/10 text-ios-red border-ios-red/20",
    orange: "bg-ios-orange/10 text-ios-orange border-ios-orange/20",
  };

  return (
    <Card
      variant="interactive"
      className={cn(
        "flex h-[112px] flex-col justify-between p-4 transition-all duration-200",
        loading && "ring-2 ring-ios-purple/40 bg-ios-purple/5 opacity-90",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-2xl border shadow-xs transition-all",
          colorMap[color],
        )}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </span>
      <div>
        <p className="text-[14px] font-bold text-ios-label flex items-center gap-1.5">
          {title}
          {loading && <span className="inline-block h-1.5 w-1.5 rounded-full bg-ios-purple animate-ping" />}
        </p>
        <p className={cn("text-[11px] transition-colors", loading ? "text-ios-purple font-medium" : "text-ios-label-secondary")}>
          {subtitle}
        </p>
      </div>
    </Card>
  );
}
