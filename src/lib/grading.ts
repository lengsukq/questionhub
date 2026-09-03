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
      // 严格映射：只接受布尔值与常见等价表达，避免 Boolean("错误") === true 这类隐式转换坑
      const user = parseTrueFalse(userAnswer);
      const correct = parseTrueFalse(question.answer.value);
      const isMatch = user !== null && correct !== null && user === correct;
      return {
        correctness: isMatch ? "correct" : "incorrect",
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

/** 用户作答：单选为选项 key，判断为布尔，多选为 key 数组，未选为 null（替代裸 unknown） */
export type UserAnswer = string | boolean | string[] | null | undefined;

export function isSubjectiveType(type: QuestionType): boolean {
  return type === "short_answer" || type === "comprehensive" || type === "calculation_analysis";
}

/** 多选 toggle：选中则移除，未选中则加入（选项列表与键盘快捷键共用） */
export function toggleMultiKey(current: string[], key: string): string[] {
  return current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
}

/** 判断题答案严格映射：只接受布尔值与明确的 true/false 等价表达，未知输入返回 null（调用方判错） */
export function parseTrueFalse(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "t", "y", "yes", "1"].includes(normalized)) return true;
    if (["false", "f", "n", "no", "0"].includes(normalized)) return false;
  }
  return null;
}
