import type { Correctness, SelfRating } from "@/types/question-bank";

/**
 * 简化间隔复习规则（参照开发文档 §13.2）：
 *
 * - 答错 / 自评不会           → 1 天后
 * - 正确但自评模糊            → 3 天后
 * - 第一次正确                → 7 天后
 * - 连续两次正确              → 14 天后
 * - 连续三次及以上正确        → 30 天后
 *
 * @param correctness      本次判题结果
 * @param selfRating       主观题自评（0 不会 / 1 模糊 / 2 掌握）
 * @param consecutiveCorrect 此前的连续正确次数（客观题用）
 * @returns 距下次复习的天数
 */
export function nextReviewInDays(
  correctness: Correctness,
  selfRating?: SelfRating,
  consecutiveCorrect = 0,
): number {
  if (correctness === "incorrect") {
    return 1;
  }

  if (correctness === "correct") {
    const streak = consecutiveCorrect + 1;
    if (streak >= 3) return 30;
    if (streak === 2) return 14;
    return 7;
  }

  // ungraded（主观题）：按自评
  if (selfRating === 0) return 1;
  if (selfRating === 1) return 3;
  return 7;
}

/** 主观题自评后更新的连续掌握次数 */
export function nextSubjectiveMasteryCount(selfRating: SelfRating, current = 0): number {
  return selfRating >= 2 ? current + 1 : 0;
}

/**
 * 计算下次复习时间戳。
 * 返回 null 表示不需要进入复习队列（尚未作答）。
 */
export function nextReviewAt(
  correctness: Correctness,
  selfRating?: SelfRating,
  consecutiveCorrect = 0,
): number {
  return Date.now() + nextReviewInDays(correctness, selfRating, consecutiveCorrect) * 86400_000;
}

export const SELF_RATING_LABELS: Record<SelfRating, string> = {
  0: "不会",
  1: "模糊",
  2: "掌握",
};
