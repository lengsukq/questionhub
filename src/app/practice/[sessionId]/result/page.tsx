"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Home,
  ListChecks,
  XCircle,
  PenLine,
} from "lucide-react";
import { db, getQuestionsByIds, type AttemptRecord, type PracticeSessionRecord, type QuestionRecord } from "@/lib/db";
import { getAttemptsForSession } from "@/lib/session-utils";
import { formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

  const summary = useMemo(() => {
    const correct = attempts.filter((attempt) => attempt.correctness === "correct").length;
    const incorrect = attempts.filter((attempt) => attempt.correctness === "incorrect").length;
    const subjective = attempts.filter((attempt) => attempt.correctness === "ungraded").length;
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
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - summary.accuracy / 100);

  return (
    <div className="flex min-h-dvh flex-col bg-ios-background safe-top">
      <div className="flex-1 overflow-y-auto">
        {/* 成绩头部 */}
        <div className="flex flex-col items-center px-4 pt-8">
          <h1 className="text-[22px] font-bold">练习完成</h1>
          <p className="mt-1 text-[14px] text-ios-label-secondary">
            {session.title} · {answeredCount}/{total} 题
          </p>

          <div className="relative my-6 flex h-36 w-36 items-center justify-center">
            <svg className="h-36 w-36 -rotate-90" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r={radius} fill="none" stroke="var(--color-ios-surface-tertiary)" strokeWidth="10" />
              <circle
                cx="64"
                cy="64"
                r={radius}
                fill="none"
                stroke="var(--color-ios-blue)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 1s ease" }}
              />
            </svg>
            <div className="absolute text-center">
              <p className="text-[34px] font-bold tabular-nums leading-none">
                {summary.accuracy}
                <span className="text-[18px]">%</span>
              </p>
              <p className="mt-1 text-[12px] text-ios-label-secondary">客观题正确率</p>
            </div>
          </div>

          <div className="grid w-full grid-cols-3 gap-3">
            <SummaryItem
              icon={<CheckCircle2 className="h-4 w-4 text-ios-green" />}
              label="答对"
              value={summary.correct}
            />
            <SummaryItem
              icon={<XCircle className="h-4 w-4 text-ios-red" />}
              label="答错"
              value={summary.incorrect}
            />
            <SummaryItem
              icon={<PenLine className="h-4 w-4 text-ios-purple" />}
              label="主观题"
              value={summary.subjective}
            />
          </div>

          <div className="mt-3 flex w-full items-center justify-center gap-2 text-[13px] text-ios-label-secondary">
            <Clock className="h-3.5 w-3.5" />
            用时 {formatDuration(session.durationMs ?? 0)}
          </div>
        </div>

        {/* 题目列表 */}
        <div className="px-4 pt-6">
          <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ios-label-secondary">
            题目回顾
          </h2>
          <Card className="overflow-hidden">
            {questions.map((question, index) => {
              const attempt = attempts.find((item) => item.questionId === question.originalId);
              return (
                <Link
                  key={question.originalId}
                  href={`/practice/${sessionId}?view=${index}`}
                  className={cn(
                    "row-active flex items-center gap-3 px-4 py-3.5",
                    index > 0 && "border-t border-ios-separator/50",
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-ios-label-secondary">
                    {index + 1}
                  </span>
                  {attempt?.correctness === "correct" ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-ios-green" />
                  ) : attempt?.correctness === "incorrect" ? (
                    <XCircle className="h-5 w-5 shrink-0 text-ios-red" />
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ios-purple/10">
                      <PenLine className="h-3 w-3 text-ios-purple" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{question.stem}</p>
                    <p className="text-[12px] text-ios-label-tertiary">
                      {QUESTION_TYPE_LABELS[question.type]} · {question.chapter}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ios-label-tertiary" />
                </Link>
              );
            })}
          </Card>
        </div>

        <div className="flex gap-3 px-4 py-6">
          <Link href="/" className="flex-1">
            <Button variant="secondary" className="w-full">
              <Home className="h-5 w-5" />
              返回首页
            </Button>
          </Link>
          <Link href={`/practice/${sessionId}?view=0`} className="flex-1">
            <Button className="w-full">
              <ListChecks className="h-5 w-5" />
              重新查看
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="flex flex-col items-center gap-1 py-3.5">
      <div className="flex items-center gap-1">{icon}<span className="text-[12px] text-ios-label-secondary">{label}</span></div>
      <p className="text-[22px] font-bold tabular-nums leading-none">{value}</p>
    </Card>
  );
}
