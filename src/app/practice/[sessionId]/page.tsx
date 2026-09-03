"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Keyboard,
  Send,
} from "lucide-react";
import {
  db,
  getQuestionsByIds,
  getStat,
  getStatsByRefs,
  questionKey,
  type AttemptRecord,
  type PracticeSessionRecord,
  type QuestionRecord,
} from "@/lib/db";
import {
  completeSession,
  getAttemptsForSession,
  selfRateSubjective,
  setNote,
  submitAnswer,
  toggleFavorite,
} from "@/lib/session-utils";
import { isSubjectiveType, type UserAnswer } from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { SelfRating } from "@/types/question-bank";

import { PracticeHeader } from "@/components/practice/practice-header";
import { QuestionCard } from "@/components/practice/question-card";
import { OptionList } from "@/components/practice/option-list";
import { SubjectivePanel } from "@/components/practice/subjective-panel";
import { ExplanationCard } from "@/components/practice/explanation-card";
import { QuestionNavigator } from "@/components/practice/question-navigator";
import { FloatingCalculator } from "@/components/practice/floating-calculator";
import { usePracticeKeyboard } from "@/components/practice/use-practice-keyboard";

export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-ios-surface-tertiary border-t-ios-blue" />
        </div>
      }
    >
      <PracticePageInner />
    </Suspense>
  );
}

function PracticePageInner() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<PracticeSessionRecord | null>(null);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [attempts, setAttempts] = useState<Map<string, AttemptRecord>>(new Map());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [index, setIndex] = useState(0);
  const [selection, setSelection] = useState<UserAnswer>(null);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [navSheetOpen, setNavSheetOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  const questionStartRef = useRef(0);
  /** 跳题进度持久化节流：合并 800ms 内的多次跳转，只写最后一次 */
  const persistIndexTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistCurrentIndex = useCallback(
    (sessionIdToSave: string, nextIndex: number) => {
      if (persistIndexTimerRef.current) clearTimeout(persistIndexTimerRef.current);
      persistIndexTimerRef.current = setTimeout(() => {
        void db.sessions.update(sessionIdToSave, { currentIndex: nextIndex });
      }, 800);
    },
    [],
  );

  // 卸载时刷掉最后一次节流写入，避免进度丢失
  useEffect(() => {
    return () => {
      if (persistIndexTimerRef.current) clearTimeout(persistIndexTimerRef.current);
    };
  }, []);

  // 初始化会话与题目
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sessionRecord = await db.sessions.get(sessionId);
      if (cancelled || !sessionRecord) return;

      // 收藏状态按本次会话题目懒加载：只 bulkGet refs，避免大题库全量 toArray
      const [attemptList, statList] = await Promise.all([
        getAttemptsForSession(sessionId),
        getStatsByRefs(sessionRecord.questionRefs),
      ]);
      const questionList = await getQuestionsByIds(sessionRecord.questionRefs);
      if (cancelled) return;

      const viewValue = searchParams.get("view");
      const fallbackStart = Math.min(
        sessionRecord.currentIndex,
        Math.max(0, questionList.length - 1),
      );
      const startIndex =
        viewValue !== null
          ? Math.min(Number(viewValue) || 0, Math.max(0, questionList.length - 1))
          : fallbackStart;

      setSession(sessionRecord);
      setQuestions(questionList);
      setAttempts(
        new Map(
          attemptList.map((a) => [questionKey(a.bankId, a.questionId), a]),
        ),
      );
      setFavorites(
        new Set(
          statList
            .filter((stat) => stat.isFavorite)
            .map((stat) => questionKey(stat.bankId, stat.questionId)),
        ),
      );
      setIndex(startIndex);
      questionStartRef.current = Date.now();
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, searchParams]);

  const currentQuestion = questions[index];
  const currentAttempt = currentQuestion
    ? attempts.get(questionKey(currentQuestion.bankId, currentQuestion.originalId))
    : undefined;
  const isSubjective = currentQuestion ? isSubjectiveType(currentQuestion.type) : false;
  const hasAnswered = Boolean(currentAttempt);

  const handleSelect = useCallback((value: UserAnswer) => {
    if (hasAnswered) return;
    setSelection(value);
  }, [hasAnswered]);

  const handleSubmit = useCallback(async () => {
    if (!session || !currentQuestion || submitting || hasAnswered) return;
    if (!isSubjective && selection === null) return;

    setSubmitting(true);
    try {
      const durationMs = Date.now() - questionStartRef.current;
      const bankId = currentQuestion.bankId;
      const result = await submitAnswer(
        session,
        currentQuestion,
        bankId,
        selection,
        durationMs,
      );
      const key = questionKey(bankId, currentQuestion.originalId);
      setAttempts((map) => {
        const next = new Map(map);
        next.set(key, {
          id: `${session.id}:${bankId}:${currentQuestion.originalId}`,
          sessionId: session.id,
          bankId,
          questionId: currentQuestion.originalId,
          userAnswer: selection,
          correctness: result.correctness,
          durationMs,
          submittedAt: Date.now(),
        });
        return next;
      });
    } finally {
      setSubmitting(false);
    }
  }, [session, currentQuestion, submitting, hasAnswered, isSubjective, selection]);

  const handleNext = useCallback(async () => {
    if (!session || finishing) return;
    const nextIndex = index + 1;
    if (nextIndex >= questions.length) {
      setFinishing(true);
      try {
        await completeSession(session.id);
        router.replace(`/practice/${session.id}/result`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "结算练习失败");
        setFinishing(false);
      }
      return;
    }
    // 进度写入节流：快速连点只持久化最后一次，结算/提交时由事务保证
    persistCurrentIndex(session.id, nextIndex);
    setIndex(nextIndex);
    setSelection(null);
    setRevealed(false);
    questionStartRef.current = Date.now();
  }, [session, finishing, index, questions.length, router, persistCurrentIndex]);

  const handlePrev = useCallback(() => {
    if (index === 0 || !session) return;
    const prevIndex = index - 1;
    persistCurrentIndex(session.id, prevIndex);
    setIndex(prevIndex);
    setSelection(null);
    setRevealed(false);
    questionStartRef.current = Date.now();
  }, [index, session, persistCurrentIndex]);

  const handleSelfRate = async (rating: SelfRating) => {
    if (!session || !currentQuestion || submitting) return;
    setSubmitting(true);
    try {
      const durationMs = Date.now() - questionStartRef.current;
      const bankId = currentQuestion.bankId;
      await selfRateSubjective(session, currentQuestion, bankId, rating, durationMs);
      const key = questionKey(bankId, currentQuestion.originalId);
      setAttempts((map) => {
        const next = new Map(map);
        next.set(key, {
          id: `${session.id}:${bankId}:${currentQuestion.originalId}`,
          sessionId: session.id,
          bankId,
          questionId: currentQuestion.originalId,
          userAnswer: null,
          correctness: "ungraded",
          selfRating: rating,
          durationMs,
          submittedAt: Date.now(),
        });
        return next;
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleJumpToIndex = (newIndex: number) => {
    if (!session || newIndex < 0 || newIndex >= questions.length) return;
    setIndex(newIndex);
    setSelection(null);
    setRevealed(false);
    setNavSheetOpen(false);
    questionStartRef.current = Date.now();
    persistCurrentIndex(session.id, newIndex);
  };

  const handleToggleFavorite = async () => {
    if (!currentQuestion) return;
    const bankId = currentQuestion.bankId;
    const fav = await toggleFavorite(bankId, currentQuestion.originalId);
    const key = questionKey(bankId, currentQuestion.originalId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (fav) next.add(key);
      else next.delete(key);
      return next;
    });
    if (fav) {
      toast.success("已加入重点收藏夹");
    } else {
      toast.info("已从收藏夹移除");
    }
  };

  const openNote = () => {
    if (!currentQuestion) return;
    setNoteText("");
    void getStat(currentQuestion.bankId, currentQuestion.originalId).then((stat) => {
      setNoteText(stat?.note ?? "");
    });
    setNoteOpen(true);
  };

  const saveNote = async () => {
    if (!currentQuestion || savingNote) return;
    setSavingNote(true);
    try {
      await setNote(currentQuestion.bankId, currentQuestion.originalId, noteText);
      toast.success("笔记已保存");
      setNoteOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存笔记失败");
    } finally {
      setSavingNote(false);
    }
  };

  // 绑定键盘快捷键
  usePracticeKeyboard({
    question: currentQuestion,
    hasAnswered,
    selection,
    onSelect: handleSelect,
    onSubmit: () => void handleSubmit(),
    onNext: () => void handleNext(),
    onPrev: () => void handlePrev(),
    isNoteOpen: noteOpen,
    isCalcOpen: calcOpen,
  });

  if (!session || !currentQuestion) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-ios-surface-tertiary border-t-ios-blue" />
      </div>
    );
  }

  const isFavorite = favorites.has(
    questionKey(currentQuestion.bankId, currentQuestion.originalId),
  );
  const isLast = index === questions.length - 1;

  return (
    <div className="flex min-h-dvh flex-col bg-ios-background">
      {/* 顶部导航 */}
      <PracticeHeader
        currentIndex={index}
        total={questions.length}
        startedAt={session.startedAt}
        title={session.title}
        onOpenNavigator={() => setNavSheetOpen(true)}
      />

      {/* 主体响应式双栏工作区 */}
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 lg:py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* 左侧主答题区 */}
          <div className="space-y-4 lg:col-span-8">
            <QuestionCard question={currentQuestion} />

            {!isSubjective && (
              <OptionList
                question={currentQuestion}
                selection={selection}
                hasAnswered={hasAnswered}
                userAnswer={currentAttempt?.userAnswer}
                onSelect={handleSelect}
              />
            )}

            {isSubjective && (
              <SubjectivePanel
                hasAnswered={hasAnswered}
                revealed={revealed}
                submitting={submitting}
                selfRating={currentAttempt?.selfRating}
                onReveal={() => setRevealed(true)}
                onRate={(rating) => void handleSelfRate(rating)}
              />
            )}

            {/* 解析卡片 */}
            {(hasAnswered || (isSubjective && revealed)) && (
              <ExplanationCard
                question={currentQuestion}
                attempt={currentAttempt}
                revealed={revealed}
              />
            )}

            {/* 移动端留白 */}
            <div className="h-20 lg:hidden" />
          </div>

          {/* 右侧桌面 Studio 辅助面板 (PC/Tablet 专享) */}
          <div className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-20 space-y-4">
              {/* 答题卡总览 */}
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[15px] font-bold text-ios-label">答题卡总览</h3>
                  <span className="text-[12px] text-ios-label-secondary">
                    已答 {attempts.size} / {questions.length}
                  </span>
                </div>
                <QuestionNavigator
                  questions={questions}
                  attempts={attempts}
                  currentIndex={index}
                  onSelectIndex={handleJumpToIndex}
                />
              </Card>

              {/* 快捷操作与快捷键提示 */}
              <Card className="p-5">
                <h4 className="flex items-center gap-1.5 text-[14px] font-bold text-ios-label">
                  <Keyboard className="h-4 w-4 text-ios-blue" />
                  键盘极速刷题
                </h4>
                <div className="mt-3 space-y-2 text-[12px] text-ios-label-secondary">
                  <div className="flex items-center justify-between">
                    <span>选择选项</span>
                    <kbd className="rounded-lg bg-ios-surface-tertiary px-2 py-0.5 font-mono font-bold text-ios-label">
                      A / B / C / D
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>提交 / 下一题</span>
                    <kbd className="rounded-lg bg-ios-surface-tertiary px-2 py-0.5 font-mono font-bold text-ios-label">
                      Enter ↵
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>切换上一题 / 下一题</span>
                    <kbd className="rounded-lg bg-ios-surface-tertiary px-2 py-0.5 font-mono font-bold text-ios-label">
                      ← / →
                    </kbd>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* 底部悬浮/吸底操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-ios-separator/60 bg-ios-surface/90 backdrop-blur-2xl safe-bottom">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          {/* 左侧收藏与笔记小工具 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFavorite}
              aria-label="收藏题目"
              className={cn(
                "squircle-press flex h-11 w-11 items-center justify-center rounded-2xl border transition-all",
                isFavorite
                  ? "border-ios-orange/40 bg-ios-orange/15 text-ios-orange shadow-sm"
                  : "border-white/60 bg-ios-surface/80 text-ios-label-secondary hover:text-ios-label dark:border-white/10 dark:bg-ios-surface/50",
              )}
              title="收藏题目"
            >
              <Bookmark className="h-5 w-5" fill={isFavorite ? "currentColor" : "none"} />
            </button>

            <button
              onClick={openNote}
              aria-label="添加笔记"
              className="squircle-press flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-ios-surface/80 text-ios-label-secondary hover:text-ios-label active:scale-95 dark:border-white/10 dark:bg-ios-surface/50"
              title="题目笔记"
            >
              <Edit3 className="h-5 w-5" />
            </button>

            {/* 计算器按钮 */}
            <button
              onClick={() => setCalcOpen((prev) => !prev)}
              aria-label="打开计算器"
              aria-pressed={calcOpen}
              className={cn(
                "squircle-press flex h-11 w-11 items-center justify-center rounded-2xl border transition-all active:scale-95",
                calcOpen
                  ? "border-ios-blue/40 bg-ios-blue/15 text-ios-blue shadow-sm"
                  : "border-white/60 bg-ios-surface/80 text-ios-label-secondary hover:text-ios-label dark:border-white/10 dark:bg-ios-surface/50",
              )}
              title="计算器"
            >
              <Calculator className="h-5 w-5" />
            </button>
          </div>

          {/* 右侧主控行动按钮 */}
          <div className="flex flex-1 items-center justify-end gap-3 max-w-md">
            {index > 0 && (
              <Button
                variant="secondary"
                size="default"
                className="flex-1 sm:flex-initial"
                onClick={handlePrev}
              >
                <ChevronLeft className="h-4 w-4" />
                上一题
              </Button>
            )}

            {!hasAnswered && !isSubjective && (
              <Button
                size="default"
                className="flex-1"
                disabled={selection === null}
                loading={submitting}
                loadingText="正在提交…"
                onClick={() => void handleSubmit()}
              >
                <Send className="h-4 w-4" />
                提交答案
              </Button>
            )}

            {hasAnswered && (
              <Button
                size="default"
                className="flex-1"
                disabled={submitting}
                loading={isLast && finishing}
                loadingText="正在结算报告…"
                onClick={() => void handleNext()}
              >
                {isLast ? "完成练习" : "下一题"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 浮动计算器（半透明可拖动，题目保持可见） */}
      <FloatingCalculator open={calcOpen} onClose={() => setCalcOpen(false)} />

      {/* 移动端答题卡 Sheet */}
      <Sheet
        open={navSheetOpen}
        onClose={() => setNavSheetOpen(false)}
        title="答题卡总览"
        description={`已答 ${attempts.size} / ${questions.length} 题`}
      >
        <QuestionNavigator
          questions={questions}
          attempts={attempts}
          currentIndex={index}
          onSelectIndex={handleJumpToIndex}
        />
      </Sheet>

      {/* 笔记弹窗 */}
      <Sheet
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="题目笔记"
        description="记录本题的解题思路、易错点或口诀，离线同步保存在本地"
      >
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="写下你的思路总结、核心公式或关键知识点…"
          rows={6}
          className="mb-4"
        />
        <Button
          className="w-full justify-center"
          size="lg"
          loading={savingNote}
          loadingText="正在保存笔记…"
          onClick={saveNote}
        >
          保存笔记
        </Button>
      </Sheet>
    </div>
  );
}
