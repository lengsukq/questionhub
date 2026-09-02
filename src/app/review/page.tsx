"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  ChevronRight,
  Loader2,
  Play,
  Repeat,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import {
  db,
  getQuestion,
  type PracticeSessionRecord,
  type QuestionStatRecord,
} from "@/lib/db";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/types/question-bank";

type ReviewTab = "wrong" | "favorite" | "due";

const TAB_LABELS: Record<ReviewTab, string> = {
  wrong: "错题攻坚本",
  favorite: "重点收藏夹",
  due: "艾宾浩斯到期复习",
};

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-ios-surface-tertiary border-t-ios-blue" />
        </div>
      }
    >
      <ReviewPageInner />
    </Suspense>
  );
}

function ReviewPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeBankId } = useBankStore();
  const bankId = activeBankId ?? "";

  const [tab, setTab] = useState<ReviewTab>(() => {
    const value = searchParams.get("tab");
    return value === "favorite" || value === "due" || value === "wrong" ? value : "wrong";
  });

  const [stats, setStats] = useState<QuestionStatRecord[]>([]);
  const [dueCutoff, setDueCutoff] = useState(0);
  const [loading, setLoading] = useState(false);
  const [startingAll, setStartingAll] = useState(false);

  const refresh = useCallback(async () => {
    if (!bankId) return;
    setLoading(true);
    setDueCutoff(Date.now());
    try {
      const allStats = await db.questionStats.where("bankId").equals(bankId).toArray();
      setStats(allStats);
    } finally {
      setLoading(false);
    }
  }, [bankId]);

  useEffect(() => {
    // 从 IndexedDB 加载复习数据
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const items = useMemo(() => {
    switch (tab) {
      case "wrong":
        return stats.filter((stat) => stat.isWrongBook);
      case "favorite":
        return stats.filter((stat) => stat.isFavorite);
      case "due":
        return stats.filter((stat) => stat.nextReviewAt !== null && stat.nextReviewAt <= dueCutoff);
    }
  }, [stats, tab, dueCutoff]);

  const startReview = async () => {
    if (!bankId || items.length === 0 || startingAll) return;
    setStartingAll(true);
    try {
      const mode = tab === "wrong" ? "wrong" : tab === "favorite" ? "favorite" : "due";
      const config = {
        bankId,
        mode: mode as PracticeSessionRecord["mode"],
        title: TAB_LABELS[tab],
        count: items.length,
        order: "source" as const,
      };
      const questionIds = new Set(items.map((item) => item.questionId));
      const allQuestions = await db.questions.where("bankId").equals(bankId).toArray();
      const matched = allQuestions.filter((q) => questionIds.has(q.originalId));
      const session = await createPracticeSessionWithRefs(
        config,
        matched.map((q) => ({ bankId, questionId: q.originalId })),
      );
      router.push(`/practice/${session.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "开始复习失败");
      setStartingAll(false);
    }
  };

  return (
    <div className="min-h-dvh safe-top">
      <PageHeader title="复习与攻坚中心" subtitle="根据艾宾浩斯遗忘曲线与错题本针对性巩固" />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* 分段控制器 */}
        <div className="mb-5">
          <Segmented<ReviewTab>
            value={tab}
            onChange={setTab}
            options={[
              {
                value: "wrong",
                label: "错题本",
                count: stats.filter((s) => s.isWrongBook).length,
              },
              {
                value: "favorite",
                label: "我的收藏",
                count: stats.filter((s) => s.isFavorite).length,
              },
              {
                value: "due",
                label: "到期复习",
                count: stats.filter((s) => s.nextReviewAt !== null && s.nextReviewAt <= dueCutoff)
                  .length,
              },
            ]}
          />
        </div>

        {/* 顶部开始大按钮卡片 */}
        {items.length > 0 && (
          <Card className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-ios-blue/5 to-transparent">
            <div>
              <h2 className="text-[16px] font-bold text-ios-label">{TAB_LABELS[tab]}</h2>
              <p className="text-[12px] text-ios-label-secondary">
                当前筛选共有 {items.length} 道题目待巩固练习
              </p>
            </div>
            <Button
              size="lg"
              className="w-full sm:w-auto shadow-md"
              onClick={startReview}
              loading={startingAll}
              loadingText={`正在组卷 (${items.length} 题)…`}
              disabled={loading}
            >
              <Play className="h-4 w-4" fill="currentColor" />
              一键开始练习（{items.length} 题）
            </Button>
          </Card>
        )}

        {/* 列表渲染 */}
        {loading && items.length === 0 ? (
          <div className="py-24 text-center text-[14px] text-ios-label-tertiary">
            正在检索题目数据…
          </div>
        ) : items.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {items.map((stat, idx) => (
              <ReviewCardItem
                key={stat.questionId}
                stat={stat}
                bankId={bankId}
                tab={tab}
                index={idx}
                onStart={(session) => router.push(`/practice/${session.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewCardItem({
  stat,
  bankId,
  tab,
  onStart,
}: {
  stat: QuestionStatRecord;
  bankId: string;
  tab: ReviewTab;
  index?: number;
  onStart: (session: PracticeSessionRecord) => void;
}) {
  const [stem, setStem] = useState("");
  const [type, setType] = useState<QuestionType>("single_choice");
  const [chapter, setChapter] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getQuestion(bankId, stat.questionId).then((question) => {
      if (cancelled || !question) return;
      setStem(question.stem);
      setType(question.type);
      setChapter(question.chapter);
    });
    return () => {
      cancelled = true;
    };
  }, [bankId, stat.questionId]);

  const startSingle = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const session = await createPracticeSessionWithRefs(
        {
          bankId,
          mode: tab === "favorite" ? "favorite" : "wrong",
          title: tab === "favorite" ? "收藏题单练" : "错题单练",
          count: 1,
          order: "source",
        },
        [{ bankId, questionId: stat.questionId }],
      );
      onStart(session);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "开始单题练习失败");
      setStarting(false);
    }
  };

  return (
    <Card
      variant="interactive"
      onClick={startSingle}
      className={cn(
        "flex items-start gap-3.5 p-4.5 transition-all cursor-pointer",
        starting && "ring-2 ring-ios-blue/40 bg-ios-blue/5 opacity-80",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all",
          tab === "wrong" && "border-ios-red/20 bg-ios-red/10 text-ios-red",
          tab === "favorite" && "border-ios-orange/20 bg-ios-orange/10 text-ios-orange",
          tab === "due" && "border-ios-purple/20 bg-ios-purple/10 text-ios-purple",
        )}
      >
        {starting ? (
          <Loader2 className="h-5 w-5 animate-spin text-ios-blue" />
        ) : tab === "wrong" ? (
          <XCircle className="h-5 w-5" />
        ) : tab === "favorite" ? (
          <Bookmark className="h-5 w-5" fill="currentColor" />
        ) : (
          <Repeat className="h-5 w-5" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[14px] font-bold text-ios-label leading-relaxed">
          {stem || "加载题干内容中…"}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ios-label-tertiary">
          <Badge color={tab === "wrong" ? "red" : tab === "favorite" ? "orange" : "purple"}>
            {QUESTION_TYPE_LABELS[type]}
          </Badge>
          {chapter && (
            <span className="truncate max-w-[140px] rounded-md bg-ios-surface-secondary px-1.5 py-0.5 font-medium text-ios-label-secondary">
              {chapter}
            </span>
          )}
          {tab === "wrong" && stat.wrongCount > 0 && (
            <span className="text-ios-red font-semibold">答错 {stat.wrongCount} 次</span>
          )}
        </div>
      </div>

      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ios-label-tertiary" />
    </Card>
  );
}

function EmptyState({ tab }: { tab: ReviewTab }) {
  return (
    <Card className="flex flex-col items-center justify-center p-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-ios-surface-tertiary/70 text-ios-label-secondary">
        <Sparkles className="h-8 w-8 text-ios-blue" />
      </div>
      <h3 className="mt-4 text-[16px] font-bold text-ios-label">
        {tab === "wrong" && "目前没有错题，太棒了！"}
        {tab === "favorite" && "尚未收藏任何题目"}
        {tab === "due" && "暂无到期的艾宾浩斯复习任务"}
      </h3>
      <p className="mt-1 max-w-sm text-[13px] text-ios-label-secondary">
        {tab === "wrong" && "在练习中答错的客观题将自动汇集于此，随时攻坚"}
        {tab === "favorite" && "做题时点击左下角的收藏图标，即可将题目加入收藏夹"}
        {tab === "due" && "系统会根据记忆曲线自动安排智能复习计划"}
      </p>
    </Card>
  );
}

async function createPracticeSessionWithRefs(
  config: {
    bankId: string;
    mode: PracticeSessionRecord["mode"];
    title: string;
    count: number;
    order: "source";
  },
  refs: Array<{ bankId: string; questionId: string }>,
): Promise<PracticeSessionRecord> {
  const session: PracticeSessionRecord = {
    id: crypto.randomUUID().slice(0, 12),
    bankId: config.bankId,
    title: config.title,
    mode: config.mode,
    config: { bankId: config.bankId, count: refs.length, order: config.order },
    questionRefs: refs,
    currentIndex: 0,
    status: "active",
    startedAt: Date.now(),
  };
  await db.sessions.add(session);
  return session;
}
