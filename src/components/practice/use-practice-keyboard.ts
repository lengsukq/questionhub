"use client";

import { useEffect } from "react";
import type { QuestionRecord } from "@/lib/db";

interface UsePracticeKeyboardProps {
  question?: QuestionRecord;
  hasAnswered: boolean;
  selection: unknown;
  onSelect: (value: unknown) => void;
  onSubmit: () => void;
  onNext: () => void;
  onPrev: () => void;
  isNoteOpen?: boolean;
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
}: UsePracticeKeyboardProps) {
  useEffect(() => {
    if (!question || isNoteOpen) return;

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

      const key = e.key.toUpperCase();

      // 1. 选项按键选择 A/B/C/D
      if (!hasAnswered && ["A", "B", "C", "D", "E", "F"].includes(key)) {
        e.preventDefault();
        if (question.type === "true_false") {
          if (key === "A") onSelect(true);
          if (key === "B") onSelect(false);
        } else {
          const optExists = question.options?.some((o) => o.key === key);
          if (optExists) {
            if (question.type === "multiple_choice") {
              const current = Array.isArray(selection) ? [...selection] : [];
              const next = current.includes(key)
                ? current.filter((k) => k !== key)
                : [...current, key];
              onSelect(next);
            } else {
              onSelect(key);
            }
          }
        }
      }

      // 2. 判断题快速选择：T / Y / 1 为正确，F / N / 2 为错误
      if (!hasAnswered && question.type === "true_false") {
        if (["T", "Y", "1"].includes(key)) {
          e.preventDefault();
          onSelect(true);
        } else if (["F", "N", "2"].includes(key)) {
          e.preventDefault();
          onSelect(false);
        }
      }

      // 3. 回车键：未答题且有选择则提交；已答题则下一题
      if (e.key === "Enter") {
        e.preventDefault();
        if (!hasAnswered && selection !== null) {
          onSubmit();
        } else if (hasAnswered) {
          onNext();
        }
      }

      // 4. 方向键切换题目
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (hasAnswered) {
          onNext();
        }
      }
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
  ]);
}
