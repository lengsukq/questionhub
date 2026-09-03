"use client";

import { Check, CheckCircle2, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseTrueFalse, toggleMultiKey, type UserAnswer } from "@/lib/grading";
import type { QuestionRecord } from "@/lib/db";
import type { AnswerValue } from "@/types/question-bank";

interface OptionListProps {
  question: QuestionRecord;
  selection: UserAnswer;
  hasAnswered: boolean;
  userAnswer?: UserAnswer;
  onSelect: (value: UserAnswer) => void;
}

/** 判题后四态：用户是否选 × 是否正确答案（单选/判断共用一张表） */
const GRADED_TONE_MAP = {
  hit: "border-ios-green bg-ios-green/10 text-ios-green shadow-sm",
  miss: "border-ios-red bg-ios-red/10 text-ios-red shadow-sm",
  leaked: "border-ios-green/50 bg-ios-green/5",
  idle: "border-ios-separator/40 bg-ios-surface/40 opacity-60",
} as const;

type GradedTone = keyof typeof GRADED_TONE_MAP;

function gradedTone(isUserChoice: boolean, isCorrectChoice: boolean): GradedTone {
  if (isUserChoice && isCorrectChoice) return "hit";
  if (isUserChoice) return "miss";
  if (isCorrectChoice) return "leaked";
  return "idle";
}

export function OptionList({
  question,
  selection,
  hasAnswered,
  userAnswer,
  onSelect,
}: OptionListProps) {
  if (question.type === "true_false") {
    return (
      <TrueFalseOptions
        answer={parseTrueFalse(question.answer.value) ?? false}
        hasAnswered={hasAnswered}
        userAnswer={userAnswer}
        selection={selection}
        onSelect={onSelect}
      />
    );
  }

  const userKeys = toKeyArray(hasAnswered ? userAnswer : selection);
  const correctKeys = toKeyArray(question.answer.value);

  const handleOptionClick = (key: string) => {
    if (hasAnswered) return;
    if (question.type === "multiple_choice") {
      onSelect(toggleMultiKey(toKeyArray(selection), key));
    } else {
      onSelect(key);
    }
  };

  return (
    <div className="space-y-3 pt-3">
      {question.options.map((option) => {
        const isSelected = userKeys.includes(option.key);
        const isCorrectChoice = correctKeys.includes(option.key);
        const isUserChoice = toKeyArray(userAnswer).includes(option.key);

        return (
          <button
            key={option.key}
            type="button"
            disabled={hasAnswered}
            onClick={() => handleOptionClick(option.key)}
            className={cn(
              "group relative flex w-full items-start gap-3.5 rounded-[22px] border-2 p-4 text-left transition-all duration-200 active:scale-[0.985] cursor-pointer",
              // 未答题态
              !hasAnswered && [
                "border-white/70 bg-ios-surface/85 shadow-sm backdrop-blur-md hover:border-ios-blue/40 hover:bg-ios-surface dark:border-white/10 dark:bg-ios-surface/60",
                isSelected &&
                  "border-ios-blue bg-ios-blue/8 shadow-md shadow-ios-blue/10 dark:bg-ios-blue/15",
              ],
              // 判题后状态（四态收敛到 GRADED_TONE_MAP）
              hasAnswered && [GRADED_TONE_MAP[gradedTone(isUserChoice, isCorrectChoice)]],
            )}
          >
            {/* 选项字母圆标 */}
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border-2 text-[13px] font-bold transition-all duration-200",
                !hasAnswered && [
                  isSelected
                    ? "border-ios-blue bg-ios-blue text-white shadow-sm shadow-ios-blue/30"
                    : "border-ios-separator/80 bg-ios-surface-tertiary/50 text-ios-label-secondary group-hover:border-ios-blue/40 group-hover:text-ios-blue",
                ],
                hasAnswered && [
                  isCorrectChoice
                    ? "border-ios-green bg-ios-green text-white"
                    : isUserChoice
                      ? "border-ios-red bg-ios-red text-white"
                      : "border-ios-separator text-ios-label-tertiary",
                ],
              )}
            >
              {option.key}
            </span>

            {/* 选项内容 */}
            <div className="min-w-0 flex-1 pt-0.5">
              <span className="text-[15px] sm:text-[16px] leading-relaxed text-ios-label">
                {option.text}
              </span>
            </div>

            {/* 判题状态指示图标 */}
            {hasAnswered && isUserChoice && (
              <span className="shrink-0 pt-0.5">
                {isCorrectChoice ? (
                  <CheckCircle2 className="h-5 w-5 text-ios-green animate-scale-in" />
                ) : (
                  <XCircle className="h-5 w-5 text-ios-red animate-scale-in" />
                )}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TrueFalseOptions({
  answer,
  hasAnswered,
  userAnswer,
  selection,
  onSelect,
}: {
  answer: boolean;
  hasAnswered: boolean;
  userAnswer: UserAnswer;
  selection: UserAnswer;
  onSelect: (value: UserAnswer) => void;
}) {
  const options = [
    { value: true, label: "正确" },
    { value: false, label: "错误" },
  ];

  const currentVal = parseTrueFalse(hasAnswered ? userAnswer : selection);

  return (
    <div className="grid grid-cols-2 gap-3 pt-3">
      {options.map((option) => {
        const isSelected = currentVal === option.value;
        const isUserChoice = hasAnswered && userAnswer === option.value;
        const isCorrectChoice = hasAnswered && answer === option.value;

        return (
          <button
            key={option.label}
            type="button"
            disabled={hasAnswered}
            onClick={() => onSelect(option.value)}
            className={cn(
              "squircle-press flex h-16 items-center justify-center rounded-[20px] border-2 text-[16px] font-bold transition-all duration-200 cursor-pointer",
              !hasAnswered && [
                "border-white/70 bg-ios-surface/85 shadow-sm backdrop-blur-md hover:border-ios-blue/40 dark:border-white/10 dark:bg-ios-surface/60",
                isSelected && "border-ios-blue bg-ios-blue/10 text-ios-blue shadow-md",
              ],
              hasAnswered && [
                // 判断题已选态自带文字色，修正态仅叠加边框与底色
                GRADED_TONE_MAP[gradedTone(isUserChoice, isCorrectChoice)],
                !isUserChoice && isCorrectChoice && "text-ios-green",
              ],
            )}
          >
            {isUserChoice && isCorrectChoice && <Check className="mr-1.5 h-5 w-5" />}
            {isUserChoice && !isCorrectChoice && <X className="mr-1.5 h-5 w-5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function toKeyArray(value: AnswerValue | UserAnswer | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).toUpperCase());
  if (typeof value === "string") return [value.toUpperCase()];
  return [];
}
