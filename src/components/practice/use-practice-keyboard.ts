"use client";

import { useEffect } from "react";
import { toggleMultiKey, type UserAnswer } from "@/lib/grading";
import type { QuestionRecord } from "@/lib/db";

/** 选项快捷键上限：题库选项 key 为 A 起的连续字母 */
const OPTION_KEYS = ["A", "B", "C", "D", "E", "F"];
const TRUE_FALSE_OPTION_KEYS = { correct: "A", incorrect: "B" } as const;
/** 判断题别名快捷键：T/Y/1 表正确，F/N/2 表错误 */
const TRUE_KEYS = ["T", "Y", "1"];
const FALSE_KEYS = ["F", "N", "2"];

interface UsePracticeKeyboardProps {
  question?: QuestionRecord;
  hasAnswered: boolean;
  selection: UserAnswer;
  onSelect: (value: UserAnswer) => void;
  onSubmit: () => void;
  onNext: () => void;
  onPrev: () => void;
  isNoteOpen?: boolean;
  isCalcOpen?: boolean;
}

export function usePracticeKeyboard({
  question,
  hasAnswered,
  selection,
  onSelect,
  onSubmit,
  onNext,
  onPrev,
  isNoteOpen = false,
  isCalcOpen = false,
}: UsePracticeKeyboardProps) {
  useEffect(() => {
    if (!question || isNoteOpen || isCalcOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在文本输入或按下 Cmd/Ctrl 时误触发
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }

      if (handleOptionKey(e, question, hasAnswered, selection, onSelect)) return;
      if (handleTrueFalseAlias(e, question, hasAnswered, onSelect)) return;
      if (handleEnterKey(e, hasAnswered, selection, onSubmit, onNext)) return;
      handleArrowKey(e, hasAnswered, onNext, onPrev);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    question,
    hasAnswered,
    selection,
    onSelect,
    onSubmit,
    onNext,
    onPrev,
    isNoteOpen,
    isCalcOpen,
  ]);
}

/** 选项键 A/B/C…：判断题映射正误，其余题型按选项存在性选择，多选共用 toggle */
function handleOptionKey(
  e: KeyboardEvent,
  question: QuestionRecord,
  hasAnswered: boolean,
  selection: UserAnswer,
  onSelect: (value: UserAnswer) => void,
): boolean {
  const key = e.key.toUpperCase();
  if (hasAnswered || !OPTION_KEYS.includes(key)) return false;
  e.preventDefault();
  if (question.type === "true_false") {
    if (key === TRUE_FALSE_OPTION_KEYS.correct) onSelect(true);
    if (key === TRUE_FALSE_OPTION_KEYS.incorrect) onSelect(false);
    return true;
  }
  if (!question.options?.some((option) => option.key === key)) return true;
  if (question.type === "multiple_choice") {
    onSelect(toggleMultiKey(Array.isArray(selection) ? selection.map(String) : [], key));
  } else {
    onSelect(key);
  }
  return true;
}

/** 判断题别名键：T/Y/1 为正确，F/N/2 为错误 */
function handleTrueFalseAlias(
  e: KeyboardEvent,
  question: QuestionRecord,
  hasAnswered: boolean,
  onSelect: (value: UserAnswer) => void,
): boolean {
  if (hasAnswered || question.type !== "true_false") return false;
  const key = e.key.toUpperCase();
  if (TRUE_KEYS.includes(key)) {
    e.preventDefault();
    onSelect(true);
    return true;
  }
  if (FALSE_KEYS.includes(key)) {
    e.preventDefault();
    onSelect(false);
    return true;
  }
  return false;
}

/** 回车：未答题且有选择则提交，已答题则下一题 */
function handleEnterKey(
  e: KeyboardEvent,
  hasAnswered: boolean,
  selection: UserAnswer,
  onSubmit: () => void,
  onNext: () => void,
): boolean {
  if (e.key !== "Enter") return false;
  e.preventDefault();
  if (!hasAnswered && selection !== null) {
    onSubmit();
  } else if (hasAnswered) {
    onNext();
  }
  return true;
}

/** 左右方向键：上一题 / 下一题（下一题仅已答题可进） */
function handleArrowKey(
  e: KeyboardEvent,
  hasAnswered: boolean,
  onNext: () => void,
  onPrev: () => void,
): boolean {
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    onPrev();
    return true;
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    if (hasAnswered) onNext();
    return true;
  }
  return false;
}
