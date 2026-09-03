import { describe, expect, it } from "vitest";
import { filterRandomPool, randomPoolKey } from "@/lib/bank-utils";
import type { QuestionRecord, QuestionStatRecord } from "@/lib/db";
import type { Question } from "@/types/question-bank";

function makeRecord(bankId: string, originalId: string): QuestionRecord {
  const base: Question = {
    id: `${bankId}:${originalId}`,
    subjectId: "economic_law",
    type: "single_choice",
    unit: "chapter_practice",
    chapter: "总论",
    section: "单项选择题",
    number: 1,
    stem: `题干 ${originalId}`,
    options: [
      { key: "A", text: "选项A" },
      { key: "B", text: "选项B" },
    ],
    answer: { value: "A", display: "A" },
    explanation: "",
    explanationStatus: "provided",
  };
  return { ...base, id: `${bankId}:${originalId}`, bankId, originalId };
}

function makeStat(
  bankId: string,
  questionId: string,
  overrides: Partial<QuestionStatRecord> = {},
): QuestionStatRecord {
  return {
    id: randomPoolKey(bankId, questionId),
    bankId,
    questionId,
    attemptCount: 0,
    correctCount: 0,
    wrongCount: 0,
    subjectiveCount: 0,
    lastCorrectness: null,
    lastAnsweredAt: null,
    streak: 0,
    isWrongBook: false,
    isFavorite: false,
    note: "",
    nextReviewAt: null,
    ...overrides,
  };
}

describe("随机挑战去重 filterRandomPool", () => {
  it("未做过的题目保留在候选池", () => {
    const questions = [makeRecord("bank-a", "q-1"), makeRecord("bank-a", "q-2")];
    const pool = filterRandomPool(questions, new Map());
    expect(pool.map((q) => q.originalId)).toEqual(["q-1", "q-2"]);
  });

  it("做对且已掌握的题目不再抽中，错题保留", () => {
    const questions = [
      makeRecord("bank-a", "q-done"),
      makeRecord("bank-a", "q-wrong"),
      makeRecord("bank-a", "q-fresh"),
    ];
    const statByKey = new Map([
      [
        randomPoolKey("bank-a", "q-done"),
        makeStat("bank-a", "q-done", { attemptCount: 1, correctCount: 1, streak: 1 }),
      ],
      [
        randomPoolKey("bank-a", "q-wrong"),
        makeStat("bank-a", "q-wrong", {
          attemptCount: 2,
          wrongCount: 2,
          isWrongBook: true,
        }),
      ],
    ]);
    const pool = filterRandomPool(questions, statByKey);
    expect(pool.map((q) => q.originalId).sort()).toEqual(["q-fresh", "q-wrong"]);
  });

  it("连对两次移出错题本后也不再抽中", () => {
    const questions = [makeRecord("bank-a", "q-1")];
    const statByKey = new Map([
      [
        randomPoolKey("bank-a", "q-1"),
        makeStat("bank-a", "q-1", {
          attemptCount: 2,
          correctCount: 2,
          streak: 2,
          isWrongBook: false,
        }),
      ],
    ]);
    expect(filterRandomPool(questions, statByKey)).toHaveLength(0);
  });

  it("同一原始题在不同题库按 bankId 隔离统计", () => {
    const questions = [makeRecord("bank-a", "q-1"), makeRecord("bank-b", "q-1")];
    const statByKey = new Map([
      [
        randomPoolKey("bank-a", "q-1"),
        makeStat("bank-a", "q-1", { attemptCount: 1, correctCount: 1, streak: 1 }),
      ],
    ]);
    const pool = filterRandomPool(questions, statByKey);
    expect(pool.map((q) => `${q.bankId}:${q.originalId}`)).toEqual(["bank-b:q-1"]);
  });
});
