"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, ChevronRight, Play, Repeat, XCircle } from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import {
  db,
  getQuestion,
  type PracticeSessionRecord,
  type QuestionStatRecord,
} from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/types/question-bank";

type ReviewTab = "wrong" | "favorite" | "due";

const TAB_LABELS: Record<ReviewTab, string> = {
  wrong: "错题本",
  favorite: "收藏",
  due: "到期复习",
};

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
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
    // 从 IndexedDB 加载复习数据（外部数据源）
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
    if (!bankId || items.length === 0) return;
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
    const matched = allQuestions.filter((question) => questionIds.has(question.originalId));
    const session = await createPracticeSessionWithRefs(config, matched.map((question) => ({ bankId, questionId: question.originalId })));
    router.push(`/practice/${session.id}`);
  };

  return (
    <div className="safe-top">
      <PageHeader title="复习" onBack={() => router.push("/")} />

      <div className="px-4 pt-4">
        <Segmented<ReviewTab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "wrong", label: "错题本", count: stats.filter((s) => s.isWrongBook).length },
            { value: "favorite", label: "收藏", count: stats.filter((s) => s.isFavorite).length },
            {
              value: "due",
              label: "到期",
              count: stats.filter((s) => s.nextReviewAt !== null && s.nextReviewAt <= dueCutoff).length,
            },
          ]}
        />

        <div className="py-4">
          <Button className="w-full" onClick={startReview} disabled={items.length === 0 || loading}>
            <Play className="h-5 w-5" fill="currentColor" />
            开始练习（{items.length} 题）
          </Button>
        </div>

        {loading && items.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-ios-label-tertiary">加载中…</div>
        ) : items.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <Card className="overflow-hidden">
            {items.map((stat, index) => (
              <ReviewRow
                key={stat.questionId}
                stat={stat}
                index={index}
                bankId={bankId}
                tab={tab}
                onStart={(session) => router.push(`/practice/${session.id}`)}
              />
            ))}
          </Card>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}

function ReviewRow({
  stat,
  index,
  bankId,
  tab,
  onStart,
}: {
  stat: QuestionStatRecord;
  index: number;
  bankId: string;
  tab: ReviewTab;
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
          title: tab === "favorite" ? "收藏题" : "错题重做",
          count: 1,
          order: "source",
        },
        [{ bankId, questionId: stat.questionId }],
      );
      onStart(session);
    } finally {
      setStarting(false);
    }
  };

  return (
    <button
      onClick={startSingle}
      disabled={starting}
      className={cn(
        "row-active flex w-full items-center gap-3 px-4 py-3.5 text-left",
        index > 0 && "border-t border-ios-separator/50",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          tab === "wrong" && "bg-ios-red/10 text-ios-red",
          tab === "favorite" && "bg-ios-orange/10 text-ios-orange",
          tab === "due" && "bg-ios-purple/10 text-ios-purple",
        )}
      >
        {tab === "wrong" ? (
          <XCircle className="h-5 w-5" />
        ) : tab === "favorite" ? (
          <Bookmark className="h-5 w-5" fill="currentColor" />
        ) : (
          <Repeat className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{stem}</p>
        <p className="mt-0.5 text-[12px] text-ios-label-tertiary">
          {QUESTION_TYPE_LABELS[type]} · {chapter}
          {tab === "wrong" && ` · 答错 ${stat.wrongCount} 次`}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ios-label-tertiary" />
    </button>
  );
}

function EmptyState({ tab }: { tab: ReviewTab }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <span className="text-[13px] text-ios-label-tertiary">
        {tab === "wrong" && "太棒了，当前没有错题"}
        {tab === "favorite" && "还没有收藏任何题目"}
        {tab === "due" && "当前没有到期的复习题"}
      </span>
    </div>
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
