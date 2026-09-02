"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Info,
  X,
  XCircle,
} from "lucide-react";
import {
  db,
  getQuestionsByIds,
  getStat,
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
import { isSubjectiveType } from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  QUESTION_TYPE_LABELS,
  type Question,
  type QuestionType,
  type SelfRating,
} from "@/types/question-bank";

export default function PracticePage() {
  return (
    <Suspense fallback={null}>
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
  const [selection, setSelection] = useState<unknown>(null);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const questionStartRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sessionRecord = await db.sessions.get(sessionId);
      if (cancelled || !sessionRecord) return;

      const bankIds =
        sessionRecord.config.bankIds && sessionRecord.config.bankIds.length > 0
          ? sessionRecord.config.bankIds
          : [sessionRecord.bankId];
      const [attemptList, statList] = await Promise.all([
        getAttemptsForSession(sessionId),
        bankIds.length === 1
          ? db.questionStats.where("bankId").equals(bankIds[0]).toArray()
          : db.questionStats.where("bankId").anyOf(bankIds).toArray(),
      ]);
      const questionList = await getQuestionsByIds(sessionRecord.questionRefs);
      if (cancelled) return;

      const viewValue = searchParams.get("view");
      const fallbackStart = Math.min(sessionRecord.currentIndex, Math.max(0, questionList.length - 1));
      const startIndex =
        viewValue !== null
          ? Math.min(Number(viewValue) || 0, Math.max(0, questionList.length - 1))
          : fallbackStart;

      setSession(sessionRecord);
      setQuestions(questionList);
      setAttempts(
        new Map(
          attemptList.map((attempt) => [questionKey(attempt.bankId, attempt.questionId), attempt]),
        ),
      );
      setFavorites(
        new Set(
          statList.filter((stat) => stat.isFavorite).map((stat) => questionKey(stat.bankId, stat.questionId)),
        ),
      );
      setIndex(startIndex);
      questionStartRef.current = Date.now();
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, searchParams]);

  // 计时器
  useEffect(() => {
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentQuestion = questions[index];
  const currentAttempt = currentQuestion
    ? attempts.get(questionKey(currentQuestion.bankId, currentQuestion.originalId))
    : undefined;
  const isSubjective = currentQuestion ? isSubjectiveType(currentQuestion.type) : false;
  const hasAnswered = Boolean(currentAttempt);

  const handleSelect = (value: unknown) => {
    if (hasAnswered) return;
    setSelection(value);
  };

  const handleSubmit = async () => {
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
          id: `${session.id}:${currentQuestion.originalId}`,
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
  };

  const handleRevealSubjective = () => {
    if (hasAnswered) return;
    setRevealed(true);
  };

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
          id: `${session.id}:${currentQuestion.originalId}`,
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

  const handleNext = async () => {
    if (!session) return;
    const nextIndex = index + 1;
    if (nextIndex >= questions.length) {
      await completeSession(session.id);
      router.replace(`/practice/${session.id}/result`);
      return;
    }
    await db.sessions.update(session.id, { currentIndex: nextIndex });
    setIndex(nextIndex);
    setSelection(null);
    setRevealed(false);
    questionStartRef.current = Date.now();
  };

  const handlePrev = () => {
    if (index === 0) return;
    setIndex(index - 1);
    setSelection(null);
    setRevealed(false);
  };

  const handleToggleFavorite = async () => {
    if (!currentQuestion) return;
    const bankId = currentQuestion.bankId;
    const favorite = await toggleFavorite(bankId, currentQuestion.originalId);
    const key = questionKey(bankId, currentQuestion.originalId);
    setFavorites((set) => {
      const next = new Set(set);
      if (favorite) next.add(key);
      else next.delete(key);
      return next;
    });
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
    if (!currentQuestion || !session) return;
    await setNote(currentQuestion.bankId, currentQuestion.originalId, noteText);
    setNoteOpen(false);
  };

  const elapsedText = useMemo(() => {
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [elapsed]);

  if (!session || !currentQuestion) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-ios-surface-tertiary border-t-ios-blue" />
      </div>
    );
  }

  const total = questions.length;
  const isLast = index === total - 1;
  const isFavorite = favorites.has(questionKey(currentQuestion.bankId, currentQuestion.originalId));

  return (
    <div className="flex min-h-dvh flex-col bg-ios-background">
      {/* 顶部 */}
      <header className="glass sticky top-0 z-30 border-b border-ios-separator/60 safe-top">
        <div className="flex h-12 items-center justify-between px-2">
          <button
            onClick={() => router.back()}
            aria-label="返回"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ios-blue active:bg-ios-blue/10"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
          </button>
          <div className="flex items-center gap-1.5 text-[14px] font-medium text-ios-label-secondary">
            <span className="tabular-nums text-ios-label">
              {index + 1}
            </span>
            / {total}
          </div>
          <div className="flex items-center gap-1 text-[13px] tabular-nums text-ios-label-secondary">
            <Clock className="h-3.5 w-3.5" />
            {elapsedText}
          </div>
        </div>
        <div className="h-1 w-full bg-ios-surface-tertiary">
          <div
            className="h-full bg-ios-blue transition-all duration-300"
            style={{ width: `${(index / Math.max(1, total)) * 100}%` }}
          />
        </div>
      </header>

      {/* 题目内容 */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        <div className="mb-3 flex items-center gap-2">
          <Badge color={badgeColor(currentQuestion.type)}>{QUESTION_TYPE_LABELS[currentQuestion.type]}</Badge>
          <span className="text-[12px] text-ios-label-secondary">{currentQuestion.chapter}</span>
          {currentQuestion.quality?.needsReview && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-ios-orange">
              <Flag className="h-3 w-3" /> 待复核
            </span>
          )}
        </div>

        <CardShell>
          <p className="text-[17px] font-medium leading-relaxed">{currentQuestion.stem}</p>
        </CardShell>

        {/* 客观题选项 */}
        {!isSubjective && (
          <div className="mt-3 space-y-2.5">
            {currentQuestion.type === "true_false" ? (
              <TrueFalseOptions
                answer={currentQuestion.answer.value as boolean}
                hasAnswered={hasAnswered}
                userAnswer={currentAttempt?.userAnswer}
                onSelect={(value) => handleSelect(value)}
              />
            ) : (
              currentQuestion.options.map((option) => {
                const userKeys = toKeyArray(currentAttempt?.userAnswer);
                const correctKeys = toKeyArray(currentQuestion.answer.value);
                const selected = toKeyArray(selection).includes(option.key);
                return (
                  <button
                    key={option.key}
                    disabled={hasAnswered}
                    onClick={() => handleSelect(selectOption(currentQuestion.type, selection, option.key))}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border-2 bg-ios-surface p-4 text-left transition-all active:scale-[0.99]",
                      optionState(hasAnswered, userKeys, correctKeys, option.key),
                      !hasAnswered && selected && "border-ios-blue bg-ios-blue/5",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-semibold",
                        !hasAnswered && selected
                          ? "border-ios-blue bg-ios-blue text-white"
                          : "border-ios-separator text-ios-label-secondary",
                      )}
                    >
                      {option.key}
                    </span>
                    <span className="flex-1 text-[15px] leading-relaxed">{option.text}</span>
                    {hasAnswered && userKeys.includes(option.key) && (
                      <span className="shrink-0">
                        {userKeys.includes(option.key) && correctKeys.includes(option.key) ? (
                          <CheckCircle2 className="h-5 w-5 text-ios-green" />
                        ) : (
                          <XCircle className="h-5 w-5 text-ios-red" />
                        )}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* 主观题 */}
        {isSubjective && (
          <div className="mt-3">
            <CardShell className="border-2 border-dashed border-ios-separator">
              <p className="text-[14px] leading-relaxed text-ios-label-secondary">
                本题为主观题，建议先在纸上完整作答，再对照参考答案与解析自评。
              </p>
            </CardShell>
          </div>
        )}

        {/* 提交后的解析 */}
        {hasAnswered && (
          <AnswerPanel
            question={currentQuestion}
            attempt={currentAttempt!}
          />
        )}

        <div className="h-4" />
      </div>

      {/* 底部操作栏 */}
      <div className="border-t border-ios-separator/60 bg-ios-background/95 backdrop-blur-lg safe-bottom">
        <div className="mx-auto flex max-w-[560px] items-center gap-2 px-4 py-3">
          <button
            onClick={handleToggleFavorite}
            aria-label="收藏"
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
              isFavorite ? "bg-ios-orange/15 text-ios-orange" : "bg-ios-surface-tertiary text-ios-label-secondary",
            )}
          >
            <Bookmark className="h-5 w-5" fill={isFavorite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={openNote}
            aria-label="笔记"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ios-surface-tertiary text-ios-label-secondary"
          >
            <Flag className="h-5 w-5" />
          </button>

          <div className="flex flex-1 gap-2">
            {!hasAnswered && index > 0 && (
              <Button variant="secondary" size="default" className="flex-1" onClick={handlePrev}>
                上一题
              </Button>
            )}
            {!hasAnswered && (
              <>
                {isSubjective ? (
                  <Button variant="secondary" size="default" className="flex-1" onClick={handleRevealSubjective}>
                    查看参考答案
                  </Button>
                ) : (
                  <Button
                    size="default"
                    className="flex-1"
                    disabled={selection === null || submitting}
                    onClick={handleSubmit}
                  >
                    提交答案
                  </Button>
                )}
              </>
            )}
            {hasAnswered && (
              <Button size="default" className="flex-1" onClick={handleNext} disabled={submitting}>
                {isLast ? "查看结果" : "下一题"}
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
            {!hasAnswered && isSubjective && revealed && (
              <SelfRatingBar
                submitting={submitting}
                onRate={(rating) => void handleSelfRate(rating)}
              />
            )}
          </div>
        </div>
      </div>

      {/* 笔记弹层 */}
      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title="题目笔记">
        <Textarea
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          placeholder="记录本题的易错点、记忆口诀或知识点…"
          rows={6}
          className="mb-4"
        />
        <Button className="w-full" onClick={saveNote}>
          保存笔记
        </Button>
      </Sheet>
    </div>
  );
}

/* ---------- 子组件 ---------- */

function CardShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-ios-surface p-4 shadow-sm shadow-black/[0.03]", className)}>
      {children}
    </div>
  );
}

function TrueFalseOptions({
  answer,
  hasAnswered,
  userAnswer,
  onSelect,
}: {
  answer: boolean;
  hasAnswered: boolean;
  userAnswer: unknown;
  onSelect: (value: boolean) => void;
}) {
  const options: Array<{ value: boolean; label: string }> = [
    { value: true, label: "正确" },
    { value: false, label: "错误" },
  ];
  const user = hasAnswered ? Boolean(userAnswer) : null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => {
        const isSelected = !hasAnswered && userAnswer === option.value;
        const isUserChoice = hasAnswered && user === option.value;
        const isCorrectChoice = hasAnswered && answer === option.value;
        return (
          <button
            key={option.label}
            disabled={hasAnswered}
            onClick={() => onSelect(option.value)}
            className={cn(
              "flex h-16 items-center justify-center rounded-2xl border-2 bg-ios-surface text-[17px] font-semibold transition-all active:scale-[0.98]",
              isSelected && "border-ios-blue bg-ios-blue/5 text-ios-blue",
              isUserChoice && isCorrectChoice && "border-ios-green bg-ios-green/8 text-ios-green",
              isUserChoice && !isCorrectChoice && "border-ios-red bg-ios-red/8 text-ios-red",
              hasAnswered && !isUserChoice && isCorrectChoice && "border-ios-green/50 bg-ios-green/5 text-ios-green",
            )}
          >
            {isUserChoice && isCorrectChoice && <Check className="mr-1 h-5 w-5" />}
            {isUserChoice && !isCorrectChoice && <X className="mr-1 h-5 w-5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SelfRatingBar({
  submitting,
  onRate,
}: {
  submitting: boolean;
  onRate: (rating: SelfRating) => void;
}) {
  const options: Array<{ value: SelfRating; label: string }> = [
    { value: 0, label: "不会" },
    { value: 1, label: "模糊" },
    { value: 2, label: "掌握" },
  ];
  return (
    <div className="flex flex-1 gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          variant="secondary"
          size="default"
          className="flex-1"
          disabled={submitting}
          onClick={() => onRate(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function AnswerPanel({
  question,
  attempt,
}: {
  question: Question;
  attempt: AttemptRecord;
}) {
  const isObjective = !isSubjectiveType(question.type);
  const correctText = formatAnswerText(question);

  return (
    <div className="mt-3 space-y-3">
      {isObjective ? (
        <div
          className={cn(
            "flex items-center gap-2 rounded-2xl p-4",
            attempt.correctness === "correct" ? "bg-ios-green/8" : "bg-ios-red/8",
          )}
        >
          {attempt.correctness === "correct" ? (
            <CheckCircle2 className="h-6 w-6 shrink-0 text-ios-green" />
          ) : (
            <XCircle className="h-6 w-6 shrink-0 text-ios-red" />
          )}
          <div>
            <p className={cn("text-[15px] font-semibold", attempt.correctness === "correct" ? "text-ios-green" : "text-ios-red")}>
              {attempt.correctness === "correct" ? "回答正确" : "回答错误"}
            </p>
            <p className="mt-0.5 text-[13px] text-ios-label-secondary">
              正确答案：{correctText}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-ios-purple/8 p-4">
          <p className="text-[15px] font-semibold text-ios-purple">参考答案</p>
          <p className="mt-2 text-[14px] leading-relaxed text-ios-label">{correctText}</p>
          <p className="mt-3 text-[13px] text-ios-label-secondary">
            自评：{selfRatingLabel(attempt.selfRating)}
          </p>
        </div>
      )}

      <ExplanationCard question={question} />
    </div>
  );
}

function ExplanationCard({ question }: { question: Question }) {
  if (question.explanationStatus === "source_not_provided") {
    return (
      <div className="rounded-2xl bg-ios-surface p-4">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-ios-label-secondary">
          <Info className="h-4 w-4" />
          原答案书未提供独立解析
        </div>
      </div>
    );
  }
  if (question.explanationStatus === "ocr_failed") {
    return (
      <div className="rounded-2xl bg-ios-surface p-4">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-ios-label-secondary">
          <Info className="h-4 w-4" />
          原书存在解析，但当前未能识别
        </div>
      </div>
    );
  }
  if (!question.explanation) {
    return null;
  }
  return (
    <div className="rounded-2xl bg-ios-surface p-4">
      <p className="mb-2 text-[14px] font-semibold text-ios-blue">原书解析</p>
      <p className="text-[14px] leading-relaxed text-ios-label">{question.explanation}</p>
    </div>
  );
}

/* ---------- 工具函数 ---------- */

function badgeColor(type: QuestionType): "blue" | "green" | "orange" | "purple" {
  switch (type) {
    case "single_choice":
      return "blue";
    case "multiple_choice":
      return "green";
    case "true_false":
      return "orange";
    default:
      return "purple";
  }
}

function toKeyArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).toUpperCase());
  if (typeof value === "string") return [value.toUpperCase()];
  return [];
}

function selectOption(type: QuestionType, selection: unknown, key: string): unknown {
  if (type === "multiple_choice") {
    const current = Array.isArray(selection) ? [...selection] : [];
    if (current.includes(key)) return current.filter((item) => item !== key);
    return [...current, key];
  }
  return key;
}

function optionState(
  hasAnswered: boolean,
  userKeys: string[],
  correctKeys: string[],
  key: string,
): string {
  if (!hasAnswered) return "border-ios-separator";
  const isUser = userKeys.includes(key);
  const isCorrect = correctKeys.includes(key);
  if (isUser && isCorrect) return "border-ios-green bg-ios-green/8";
  if (isUser) return "border-ios-red bg-ios-red/8";
  if (isCorrect) return "border-ios-green/40 bg-ios-green/5";
  return "border-ios-separator opacity-70";
}

function formatAnswerText(question: Question): string {
  const { type, answer } = question;
  if (type === "true_false") {
    return answer.display ? String(answer.display) : answer.value ? "正确" : "错误";
  }
  if (Array.isArray(answer.value)) {
    return answer.display ? String(answer.display) : answer.value.join("");
  }
  return answer.display ? String(answer.display) : String(answer.value);
}

function selfRatingLabel(rating?: SelfRating): string {
  if (rating === 0) return "不会";
  if (rating === 1) return "模糊";
  if (rating === 2) return "掌握";
  return "未自评";
}
