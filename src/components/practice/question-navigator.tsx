"use client";

import { cn } from "@/lib/utils";
import type { AttemptRecord, QuestionRecord } from "@/lib/db";
import { questionKey } from "@/lib/db";

type NavigatorStatus = "correct" | "incorrect" | "subjective" | "unanswered";

const NAVIGATOR_TONE_MAP: Record<NavigatorStatus, string> = {
  correct: "border-ios-green bg-ios-green/15 text-ios-green shadow-xs",
  incorrect: "border-ios-red bg-ios-red/15 text-ios-red shadow-xs",
  subjective: "border-ios-purple bg-ios-purple/15 text-ios-purple shadow-xs",
  unanswered:
    "border-ios-separator/60 bg-ios-surface/60 text-ios-label-secondary hover:border-ios-blue/40 hover:bg-ios-surface",
};

function navigatorStatus(attempt?: AttemptRecord): NavigatorStatus {
  if (attempt?.correctness === "correct") return "correct";
  if (attempt?.correctness === "incorrect") return "incorrect";
  if (attempt?.correctness === "ungraded") return "subjective";
  return "unanswered";
}

interface QuestionNavigatorProps {
  questions: QuestionRecord[];
  attempts: Map<string, AttemptRecord>;
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  className?: string;
}

export function QuestionNavigator({
  questions,
  attempts,
  currentIndex,
  onSelectIndex,
  className,
}: QuestionNavigatorProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* 状态图例 */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-ios-label-secondary">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-md bg-ios-green/20 border border-ios-green" />
          正确
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-md bg-ios-red/20 border border-ios-red" />
          错误
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-md bg-ios-purple/20 border border-ios-purple" />
          主观
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-md bg-ios-surface-tertiary border border-ios-separator" />
          未答
        </span>
      </div>

      {/* 题号网格 */}
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-5 gap-2.5">
        {questions.map((question, position) => {
          const status = navigatorStatus(
            attempts.get(questionKey(question.bankId, question.originalId)),
          );
          const isCurrent = position === currentIndex;

          return (
            <button
              key={questionKey(question.bankId, question.originalId)}
              type="button"
              onClick={() => onSelectIndex(position)}
              className={cn(
                "squircle-press relative flex h-11 items-center justify-center rounded-2xl border-2 font-bold text-[13px] tabular-nums transition-all duration-200 cursor-pointer",
                isCurrent &&
                  "ring-2 ring-ios-blue ring-offset-2 ring-offset-ios-background scale-105 z-10",
                NAVIGATOR_TONE_MAP[status],
              )}
            >
              {position + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
