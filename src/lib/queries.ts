import { db, normalizeBankIds, type AttemptRecord, type PracticeSessionRecord } from "@/lib/db";

export interface DayStat {
  date: string;
  label: string;
  count: number;
  correct: number;
}

export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function weekdayLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("zh-CN", { weekday: "short" });
}

/** 今日统计（支持多题库）：走 [bankId+submittedAt] 复合索引范围查询，不扫全表 */
export async function getTodayStats(
  bankIds: string | string[],
): Promise<{ answered: number; correct: number }> {
  const ids = normalizeBankIds(bankIds);
  if (ids.length === 0) return { answered: 0, correct: 0 };
  const todayStart = startOfDay(Date.now());
  const lists = await Promise.all(
    ids.map((bankId) =>
      db.attempts
        .where("[bankId+submittedAt]")
        .between([bankId, todayStart], [bankId, Number.POSITIVE_INFINITY])
        .toArray(),
    ),
  );
  const attempts = lists.flat();
  const answered = attempts.length;
  const correct = attempts.filter((attempt) => attempt.correctness === "correct").length;
  return { answered, correct };
}

/** 近 N 天趋势（支持多题库）：同样走 [bankId+submittedAt] 范围查询 */
export async function getDailyTrend(bankIds: string | string[], days = 7): Promise<DayStat[]> {
  const ids = normalizeBankIds(bankIds);
  const todayStart = startOfDay(Date.now());
  const since = todayStart - (days - 1) * 86400_000;

  const lists =
    ids.length === 0
      ? []
      : await Promise.all(
          ids.map((bankId) =>
            db.attempts
              .where("[bankId+submittedAt]")
              .between([bankId, since], [bankId, Number.POSITIVE_INFINITY])
              .toArray(),
          ),
        );
  const attempts = lists.flat();

  const bucketMap = new Map<string, { count: number; correct: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = todayStart - i * 86400_000;
    const key = dayStart.toString();
    bucketMap.set(key, { count: 0, correct: 0 });
  }

  for (const attempt of attempts) {
    const key = startOfDay(attempt.submittedAt).toString();
    const bucket = bucketMap.get(key);
    if (!bucket) continue;
    bucket.count += 1;
    if (attempt.correctness === "correct") bucket.correct += 1;
  }

  const today = startOfDay(Date.now());
  return [...bucketMap.entries()].map(([key, value]) => {
    const timestamp = Number(key);
    return {
      date: key,
      label: timestamp === today ? "今天" : weekdayLabel(timestamp),
      count: value.count,
      correct: value.correct,
    };
  });
}

/** 最近完成的会话（支持多题库）：走 [bankId+status+startedAt] 复合索引倒序取 */
export async function getRecentSessions(
  bankIds: string | string[],
  limit = 5,
): Promise<PracticeSessionRecord[]> {
  const ids = normalizeBankIds(bankIds);
  if (ids.length === 0) return [];
  const lists = await Promise.all(
    ids.map((bankId) =>
      db.sessions
        .where("[bankId+status+startedAt]")
        .between([bankId, "completed", 0], [bankId, "completed", Number.POSITIVE_INFINITY])
        .reverse()
        .limit(limit)
        .toArray(),
    ),
  );
  return lists
    .flat()
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, limit);
}

/** 单题历史作答：走 [bankId+questionId] 复合索引点查，不扫全表 */
export async function getAttemptsForQuestion(
  bankId: string,
  questionId: string,
): Promise<AttemptRecord[]> {
  return db.attempts.where("[bankId+questionId]").equals([bankId, questionId]).toArray();
}
