import type {
  Correctness,
  Question,
  QuestionType,
} from "@/types/question-bank";

export interface GradeResult {
  correctness: Correctness;
  normalizedUserAnswer: unknown;
  normalizedCorrectAnswer: unknown;
}

/** 多选：去重、转大写、排序后作为集合使用 */
export function normalizeKeys(value: unknown): string[] {
  return Array.from(new Set(Array.isArray(value) ? value : []))
    .map((v) => String(v).trim().toUpperCase())
    .sort();
}

/** 单选：标准化为大写字符串 */
function normalizeString(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

/**
 * 统一判题接口。
 * 客观题（单选/多选/判断）自动判题；
 * 主观题（简答/综合/计算分析）一律返回 ungraded，由用户自评。
 */
export function gradeQuestion(question: Question, userAnswer: unknown): GradeResult {
  switch (question.type) {
    case "single_choice": {
      const user = normalizeString(userAnswer);
      const correct = normalizeString(question.answer.value);
      return {
        correctness: user === correct ? "correct" : "incorrect",
        normalizedUserAnswer: user,
        normalizedCorrectAnswer: correct,
      };
    }
    case "multiple_choice": {
      const user = normalizeKeys(userAnswer);
      const correct = normalizeKeys(question.answer.value);
      const isEqual =
        user.length === correct.length && user.every((key) => correct.includes(key));
      return {
        correctness: isEqual ? "correct" : "incorrect",
        normalizedUserAnswer: user,
        normalizedCorrectAnswer: correct,
      };
    }
    case "true_false": {
      // UI 的"正确/错误"映射为 true/false，不通过字符串判题
      const user = Boolean(userAnswer);
      const correct = Boolean(question.answer.value);
      return {
        correctness: user === correct ? "correct" : "incorrect",
        normalizedUserAnswer: user,
        normalizedCorrectAnswer: correct,
      };
    }
    default: {
      // short_answer / calculation_analysis / comprehensive
      return {
        correctness: "ungraded",
        normalizedUserAnswer: userAnswer,
        normalizedCorrectAnswer: question.answer.value,
      };
    }
  }
}

export function isSubjectiveType(type: QuestionType): boolean {
  return type === "short_answer" || type === "comprehensive" || type === "calculation_analysis";
}
