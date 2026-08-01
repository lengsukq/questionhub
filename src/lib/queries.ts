import { db, type AttemptRecord, type PracticeSessionRecord } from "@/lib/db";

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

export async function getTodayStats(bankId: string): Promise<{ answered: number; correct: number }> {
  const todayStart = startOfDay(Date.now());
  const attempts = await db.attempts
    .where("bankId")
    .equals(bankId)
    .filter((attempt) => attempt.submittedAt >= todayStart)
    .toArray();
  const answered = attempts.length;
  const correct = attempts.filter((attempt) => attempt.correctness === "correct").length;
  return { answered, correct };
}

export async function getDailyTrend(bankId: string, days = 7): Promise<DayStat[]> {
  const todayStart = startOfDay(Date.now());
  const since = todayStart - (days - 1) * 86400_000;

  const attempts = await db.attempts
    .where("bankId")
    .equals(bankId)
    .filter((attempt) => attempt.submittedAt >= since)
    .toArray();

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

export async function getRecentSessions(bankId: string, limit = 5): Promise<PracticeSessionRecord[]> {
  return db.sessions
    .where("bankId")
    .equals(bankId)
    .filter((session) => session.status === "completed")
    .reverse()
    .sortBy("startedAt")
    .then((sessions) => sessions.slice(0, limit));
}

export async function getAttemptsForQuestion(
  bankId: string,
  questionId: string,
): Promise<AttemptRecord[]> {
  return db.attempts
    .where("bankId")
    .equals(bankId)
    .filter((attempt) => attempt.questionId === questionId)
    .toArray();
}
