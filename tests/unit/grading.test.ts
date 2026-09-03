import { describe, expect, it } from "vitest";
import { gradeQuestion, normalizeKeys, parseTrueFalse, toggleMultiKey } from "@/lib/grading";
import { nextReviewAt, nextReviewInDays } from "@/lib/review-schedule";
import type { Question } from "@/types/question-bank";

function makeQuestion(overrides: Partial<Question>): Question {
  return {
    id: "q-1",
    subjectId: "economic_law",
    type: "single_choice",
    unit: "chapter_practice",
    chapter: "总论",
    section: "单项选择题",
    number: 1,
    stem: "测试题干",
    options: [
      { key: "A", text: "选项A" },
      { key: "B", text: "选项B" },
      { key: "C", text: "选项C" },
    ],
    answer: { value: "A", display: "A" },
    explanation: "",
    explanationStatus: "provided",
    ...overrides,
  };
}

describe("判题引擎 gradeQuestion", () => {
  it("单选题：正确", () => {
    const question = makeQuestion({ answer: { value: "B", display: "B" } });
    expect(gradeQuestion(question, "B").correctness).toBe("correct");
  });

  it("单选题：大小写不敏感且忽略首尾空格", () => {
    const question = makeQuestion({ answer: { value: "a", display: "A" } });
    expect(gradeQuestion(question, " A ").correctness).toBe("correct");
  });

  it("单选题：错误", () => {
    const question = makeQuestion({ answer: { value: "C", display: "C" } });
    expect(gradeQuestion(question, "A").correctness).toBe("incorrect");
  });

  it("多选题：顺序无关且正确", () => {
    const question = makeQuestion({
      type: "multiple_choice",
      answer: { value: ["A", "C"], display: "AC" },
    });
    expect(gradeQuestion(question, ["c", "a"]).correctness).toBe("correct");
  });

  it("多选题：去重后仍正确", () => {
    const question = makeQuestion({
      type: "multiple_choice",
      answer: { value: ["A", "B"], display: "AB" },
    });
    expect(gradeQuestion(question, ["A", "B", "A"]).correctness).toBe("correct");
  });

  it("多选题：少选视为错误", () => {
    const question = makeQuestion({
      type: "multiple_choice",
      answer: { value: ["A", "B", "C"], display: "ABC" },
    });
    expect(gradeQuestion(question, ["A", "B"]).correctness).toBe("incorrect");
  });

  it("多选题：包含错误选项视为错误", () => {
    const question = makeQuestion({
      type: "multiple_choice",
      answer: { value: ["A", "B"], display: "AB" },
    });
    expect(gradeQuestion(question, ["A", "D"]).correctness).toBe("incorrect");
  });

  it("判断题：true 匹配", () => {
    const question = makeQuestion({
      type: "true_false",
      answer: { value: true, display: "正确" },
    });
    expect(gradeQuestion(question, true).correctness).toBe("correct");
    expect(gradeQuestion(question, false).correctness).toBe("incorrect");
  });

  it("判断题：不通过中文字符串判题", () => {
    const question = makeQuestion({
      type: "true_false",
      answer: { value: false, display: "错误" },
    });
    // "错误" 不是明确的 true/false 等价表达，严格映射返回 null，一律判错
    expect(gradeQuestion(question, "错误").correctness).toBe("incorrect");
  });

  it("判断题：接受明确的等价表达", () => {
    const question = makeQuestion({
      type: "true_false",
      answer: { value: true, display: "正确" },
    });
    expect(gradeQuestion(question, "TRUE").correctness).toBe("correct");
    expect(gradeQuestion(question, 1).correctness).toBe("correct");
    expect(gradeQuestion(question, 0).correctness).toBe("incorrect");
    expect(gradeQuestion(question, 2).correctness).toBe("incorrect");
    expect(gradeQuestion(question, null).correctness).toBe("incorrect");
  });

  it("主观题：一律返回 ungraded", () => {
    for (const type of ["short_answer", "comprehensive", "calculation_analysis"] as const) {
      const question = makeQuestion({
        type,
        answer: { value: "参考答案文本" },
      });
      const result = gradeQuestion(question, "用户手写内容");
      expect(result.correctness).toBe("ungraded");
    }
  });

  it("normalizeKeys：去重、大写、排序", () => {
    expect(normalizeKeys(["c", "a", "B", "a"])).toEqual(["A", "B", "C"]);
  });
});

describe("间隔复习规则 nextReviewInDays", () => {
  it("答错 → 1 天后", () => {
    expect(nextReviewInDays("incorrect")).toBe(1);
  });

  it("第一次正确 → 7 天后", () => {
    expect(nextReviewInDays("correct", undefined, 0)).toBe(7);
  });

  it("连续两次正确 → 14 天后", () => {
    expect(nextReviewInDays("correct", undefined, 1)).toBe(14);
  });

  it("连续三次及以上正确 → 30 天后", () => {
    expect(nextReviewInDays("correct", undefined, 2)).toBe(30);
    expect(nextReviewInDays("correct", undefined, 5)).toBe(30);
  });

  it("主观题自评不会（0）→ 1 天后", () => {
    expect(nextReviewInDays("ungraded", 0)).toBe(1);
  });

  it("主观题自评模糊（1）→ 3 天后", () => {
    expect(nextReviewInDays("ungraded", 1)).toBe(3);
  });

  it("主观题自评掌握（2）→ 7 天后", () => {
    expect(nextReviewInDays("ungraded", 2)).toBe(7);
  });
});

describe("判断题严格映射 parseTrueFalse", () => {
  it("布尔与数字映射", () => {
    expect(parseTrueFalse(true)).toBe(true);
    expect(parseTrueFalse(0)).toBe(false);
    expect(parseTrueFalse(2)).toBeNull();
  });

  it("歧义输入返回 null", () => {
    expect(parseTrueFalse("错误")).toBeNull();
    expect(parseTrueFalse("对")).toBeNull();
    expect(parseTrueFalse(null)).toBeNull();
    expect(parseTrueFalse(undefined)).toBeNull();
  });
});

describe("复习时间 nextReviewAt", () => {
  it("对齐到日期边界：23:00 答错，1 天后为次日 0 点", () => {
    const late = new Date(2026, 8, 3, 23, 0, 0).getTime();
    const expected = new Date(2026, 8, 4, 0, 0, 0).getTime();
    expect(nextReviewAt("incorrect", undefined, 0, late)).toBe(expected);
  });

  it("天数规则与 nextReviewInDays 一致", () => {
    const from = new Date(2026, 8, 3, 10, 0, 0).getTime();
    const dayStart = new Date(2026, 8, 3, 0, 0, 0).getTime();
    expect(nextReviewAt("correct", undefined, 1, from)).toBe(dayStart + 14 * 86400_000);
  });
});

describe("多选 toggleMultiKey", () => {
  it("未选中则加入", () => {
    expect(toggleMultiKey(["A"], "B")).toEqual(["A", "B"]);
  });

  it("已选中则移除", () => {
    expect(toggleMultiKey(["A", "B"], "A")).toEqual(["B"]);
  });

  it("不变更原数组", () => {
    const current = ["A"];
    toggleMultiKey(current, "B");
    expect(current).toEqual(["A"]);
  });
});
