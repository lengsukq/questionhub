"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Home,
  PenLine,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  db,
  getQuestionsByIds,
  questionKey,
  type AttemptRecord,
  type PracticeSessionRecord,
  type QuestionRecord,
} from "@/lib/db";
import { getAttemptsForSession } from "@/lib/session-utils";
import { formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QUESTION_TYPE_LABELS } from "@/types/question-bank";

export default function ResultPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<PracticeSessionRecord | null>(null);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sessionRecord = await db.sessions.get(sessionId);
      if (cancelled || !sessionRecord) return;
      const [questionList, attemptList] = await Promise.all([
        getQuestionsByIds(sessionRecord.questionRefs),
        getAttemptsForSession(sessionId),
      ]);
      if (cancelled) return;
      setSession(sessionRecord);
      setQuestions(questionList);
      setAttempts(attemptList);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const attemptMap = useMemo(
    () => new Map(attempts.map((a) => [questionKey(a.bankId, a.questionId), a])),
    [attempts],
  );

  const summary = useMemo(() => {
    const correct = attempts.filter((a) => a.correctness === "correct").length;
    const incorrect = attempts.filter((a) => a.correctness === "incorrect").length;
    const subjective = attempts.filter((a) => a.correctness === "ungraded").length;
    const objectiveTotal = correct + incorrect;
    const accuracy = objectiveTotal > 0 ? Math.round((correct / objectiveTotal) * 100) : 0;
    return { correct, incorrect, subjective, objectiveTotal, accuracy };
  }, [attempts]);

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-ios-surface-tertiary border-t-ios-blue" />
      </div>
    );
  }

  const answeredCount = attempts.length;
  const total = questions.length;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - summary.accuracy / 100);

  return (
    <div className="flex min-h-dvh flex-col bg-ios-background safe-top">
      {/* 顶部标题 */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-2">
        <div className="flex items-center gap-2 text-ios-blue">
          <Sparkles className="h-5 w-5" />
          <span className="text-[13px] font-bold tracking-wider uppercase">练习报告</span>
        </div>
        <h1 className="mt-1 text-[24px] font-extrabold tracking-tight text-ios-label sm:text-[28px]">
          {session.title} · 完成练习
        </h1>
      </div>

      {/* 响应式主体 */}
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* 左侧成就成绩面板 */}
          <div className="space-y-4 lg:col-span-5">
            <Card className="flex flex-col items-center p-8 text-center">
              {/* 环形进度仪 */}
              <div className="relative my-2 flex h-44 w-44 items-center justify-center">
                <svg className="h-44 w-44 -rotate-90" viewBox="0 0 160 160">
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke="var(--color-ios-surface-tertiary)"
                    strokeWidth="12"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke="var(--color-ios-blue)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)" }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <p className="text-[40px] font-extrabold tabular-nums leading-none tracking-tight text-ios-label">
                    {summary.accuracy}
                    <span className="text-[20px] font-bold text-ios-blue">%</span>
                  </p>
                  <p className="mt-1.5 text-[12px] font-semibold text-ios-label-secondary">
                    客观题正确率
                  </p>
                </div>
              </div>

              {/* 三连统计徽章卡片 */}
              <div className="mt-6 grid w-full grid-cols-3 gap-2.5">
                <Card className="border-ios-green/20 bg-ios-green/5 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-[12px] font-semibold text-ios-green">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    答对
                  </div>
                  <p className="mt-1 text-[20px] font-extrabold tabular-nums text-ios-label">
                    {summary.correct}
                  </p>
                </Card>

                <Card className="border-ios-red/20 bg-ios-red/5 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-[12px] font-semibold text-ios-red">
                    <XCircle className="h-3.5 w-3.5" />
                    答错
                  </div>
                  <p className="mt-1 text-[20px] font-extrabold tabular-nums text-ios-label">
                    {summary.incorrect}
                  </p>
                </Card>

                <Card className="border-ios-purple/20 bg-ios-purple/5 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-[12px] font-semibold text-ios-purple">
                    <PenLine className="h-3.5 w-3.5" />
                    主观
                  </div>
                  <p className="mt-1 text-[20px] font-extrabold tabular-nums text-ios-label">
                    {summary.subjective}
                  </p>
                </Card>
              </div>

              {/* 用时统计 */}
              <div className="mt-4 flex items-center justify-center gap-1.5 rounded-full bg-ios-surface-secondary/80 px-4 py-1.5 text-[13px] font-medium tabular-nums text-ios-label-secondary">
                <Clock className="h-3.5 w-3.5 text-ios-blue" />
                共耗时 {formatDuration(session.durationMs ?? 0)} · 已做 {answeredCount}/{total} 题
              </div>

              {/* 操作按钮组 */}
              <div className="mt-6 flex w-full flex-col sm:flex-row gap-3">
                <Link href="/" className="flex-1">
                  <Button variant="secondary" size="lg" className="w-full justify-center">
                    <Home className="h-4 w-4" />
                    返回首页
                  </Button>
                </Link>
                <Link href={`/practice/${sessionId}?view=0`} className="flex-1">
                  <Button size="lg" className="w-full justify-center">
                    <RotateCcw className="h-4 w-4" />
                    重新回顾
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          {/* 右侧题目回顾明细列表 */}
          <div className="space-y-3 lg:col-span-7">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[15px] font-bold text-ios-label">题目明细与解析回顾</h2>
              <span className="text-[12px] text-ios-label-secondary">共 {questions.length} 题</span>
            </div>

            <Card className="overflow-hidden p-2">
              <div className="divide-y divide-ios-separator/50">
                {questions.map((q, idx) => {
                  const attempt = attemptMap.get(questionKey(q.bankId, q.originalId));
                  const isCorrect = attempt?.correctness === "correct";
                  const isIncorrect = attempt?.correctness === "incorrect";

                  return (
                    <Link
                      key={questionKey(q.bankId, q.originalId)}
                      href={`/practice/${sessionId}?view=${idx}`}
                      className="group flex items-center gap-3.5 rounded-2xl p-3.5 transition-all hover:bg-ios-surface-secondary/70 active:scale-[0.99]"
                    >
                      {/* 题号小圆标 */}
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ios-surface-tertiary/70 text-[13px] font-bold text-ios-label-secondary group-hover:bg-ios-blue group-hover:text-white transition-colors">
                        {idx + 1}
                      </span>

                      {/* 对错图标 */}
                      <span className="shrink-0">
                        {isCorrect ? (
                          <CheckCircle2 className="h-5 w-5 text-ios-green" />
                        ) : isIncorrect ? (
                          <XCircle className="h-5 w-5 text-ios-red" />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ios-purple/10">
                            <PenLine className="h-3 w-3 text-ios-purple" />
                          </span>
                        )}
                      </span>

                      {/* 题目摘要 */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-ios-label">
                          {q.stem}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ios-label-tertiary">
                          {QUESTION_TYPE_LABELS[q.type]} · {q.chapter}
                        </p>
                      </div>

                      <ChevronRight className="h-4 w-4 shrink-0 text-ios-label-tertiary transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
