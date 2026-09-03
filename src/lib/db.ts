import Dexie, { type Table } from "dexie";
import type { UserAnswer } from "@/lib/grading";
import type {
  Correctness,
  Question,
  QuestionType,
  QuestionUnit,
  SelfRating,
  Subject,
} from "@/types/question-bank";

export interface BankRecord {
  id: string;
  name: string;
  schemaVersion: string;
  generatedAt?: string;
  importedAt: number;
  questionCount: number;
  isDefault: boolean;
  subjects: Subject[];
}

export interface QuestionRecord extends Question {
  /** 主键，格式 `${bankId}:${originalId}` */
  id: string;
  bankId: string;
  /** 题库内的原始题目 id */
  originalId: string;
}

export type PracticeMode =
  | "chapter"
  | "subject"
  | "mock"
  | "advanced"
  | "random"
  | "wrong"
  | "favorite"
  | "due";

export interface PracticeConfig {
  bankId: string;
  /** 多题库练习时，参与的题库 id 列表（单题库时为 undefined，兼容旧数据） */
  bankIds?: string[];
  subjectId?: string;
  unit?: QuestionUnit;
  chapters?: string[];
  types?: QuestionType[];
  count: number;
  order: "source" | "random";
}

export interface PracticeSessionRecord {
  id: string;
  bankId: string;
  title: string;
  mode: PracticeMode;
  config: PracticeConfig;
  /** 固定题目引用列表，创建会话后不再变化 */
  questionRefs: Array<{ bankId: string; questionId: string }>;
  currentIndex: number;
  status: "active" | "completed" | "abandoned";
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
}

export interface AttemptRecord {
  /** 主键，格式 `${sessionId}:${bankId}:${questionId}`（兼容旧 `${sessionId}:${questionId}` 数据） */
  id: string;
  sessionId: string;
  bankId: string;
  questionId: string;
  userAnswer: UserAnswer;
  correctness: Correctness;
  selfRating?: SelfRating;
  durationMs: number;
  submittedAt: number;
}

export interface QuestionStatRecord {
  /** 主键，格式 `${bankId}:${questionId}` */
  id: string;
  bankId: string;
  questionId: string;
  attemptCount: number;
  correctCount: number;
  wrongCount: number;
  subjectiveCount: number;
  lastCorrectness: Correctness | null;
  lastAnsweredAt: number | null;
  /** 连续答对/掌握次数 */
  streak: number;
  isWrongBook: boolean;
  isFavorite: boolean;
  note: string;
  nextReviewAt: number | null;
}

export function questionKey(bankId: string, questionId: string): string {
  return `${bankId}:${questionId}`;
}

/** 单题库 id 或多题库 id 统一归一化为空数组时直接返回空结果 */
export function normalizeBankIds(bankId: string | string[]): string[] {
  const ids = Array.isArray(bankId) ? bankId : [bankId];
  return [...new Set(ids.filter(Boolean))];
}

class QuestionHubDB extends Dexie {
  banks!: Table<BankRecord, string>;
  questions!: Table<QuestionRecord, string>;
  sessions!: Table<PracticeSessionRecord, string>;
  attempts!: Table<AttemptRecord, string>;
  questionStats!: Table<QuestionStatRecord, string>;

  constructor() {
    super("questionhub");
    this.version(1).stores({
      banks: "id",
      questions: "id, bankId, subjectId, unit, chapter, type",
      sessions: "id, bankId, status, startedAt",
      attempts: "id, sessionId, bankId, questionId, submittedAt",
      questionStats: "id, bankId, questionId, isWrongBook, isFavorite, nextReviewAt",
    });
    // v2：新增复合索引，替代高频 filter 全表扫描（attempts 上万后首页/趋势不再扫全表）。
    // 保留全部 v1 单字段索引，保证旧查询与已安装客户端平稳升级。
    this.version(2).stores({
      banks: "id",
      questions: "id, bankId, subjectId, unit, chapter, type",
      sessions: "id, bankId, status, startedAt, [bankId+status+startedAt], [status+startedAt]",
      attempts:
        "id, sessionId, bankId, questionId, submittedAt, [sessionId+submittedAt], [bankId+submittedAt], [bankId+questionId]",
      questionStats:
        "id, bankId, questionId, isWrongBook, isFavorite, nextReviewAt, [bankId+nextReviewAt]",
    });
  }
}

export const db = new QuestionHubDB();

export async function listBanks(): Promise<BankRecord[]> {
  const banks = await db.banks.toArray();
  return banks.sort((a, b) => a.importedAt - b.importedAt);
}

export async function listQuestions(bankId: string): Promise<QuestionRecord[]> {
  return db.questions.where("bankId").equals(bankId).toArray();
}

export async function listQuestionsByBankIds(bankIds: string[]): Promise<QuestionRecord[]> {
  if (bankIds.length === 0) return [];
  if (bankIds.length === 1) return listQuestions(bankIds[0]);
  return db.questions.where("bankId").anyOf(bankIds).toArray();
}

export async function getQuestion(
  bankId: string,
  questionId: string,
): Promise<QuestionRecord | undefined> {
  return db.questions.get(questionKey(bankId, questionId));
}

export async function getQuestionsByIds(
  refs: Array<{ bankId: string; questionId: string }>,
): Promise<QuestionRecord[]> {
  const keys = refs.map((ref) => questionKey(ref.bankId, ref.questionId));
  const records = await db.questions.bulkGet(keys);
  return records.filter((record): record is QuestionRecord => record !== undefined);
}

export async function getStat(
  bankId: string,
  questionId: string,
): Promise<QuestionStatRecord | undefined> {
  return db.questionStats.get(questionKey(bankId, questionId));
}

/** 仅拉取给定题目引用对应的学习统计（练习页收藏状态用，避免全库 toArray） */
export async function getStatsByRefs(
  refs: Array<{ bankId: string; questionId: string }>,
): Promise<QuestionStatRecord[]> {
  if (refs.length === 0) return [];
  const keys = refs.map((ref) => questionKey(ref.bankId, ref.questionId));
  const records = await db.questionStats.bulkGet(keys);
  return records.filter((record): record is QuestionStatRecord => record !== undefined);
}

export async function getActiveSession(): Promise<PracticeSessionRecord | undefined> {
  // 走 [status+startedAt] 复合索引倒序取，保证拿到最近开始的活跃会话
  const session = await db.sessions
    .where("[status+startedAt]")
    .between(["active", 0], ["active", Number.POSITIVE_INFINITY])
    .reverse()
    .first();
  return session ?? undefined;
}

/** 到期复习（支持多题库）：nextReviewAt 落在 (-∞, now] 区间，走复合索引范围查询 */
export async function getDueStats(bankIds: string | string[]): Promise<QuestionStatRecord[]> {
  const ids = normalizeBankIds(bankIds);
  if (ids.length === 0) return [];
  const now = Date.now();
  const lists = await Promise.all(
    ids.map((bankId) =>
      db.questionStats
        .where("[bankId+nextReviewAt]")
        .between([bankId, 0], [bankId, now])
        .toArray(),
    ),
  );
  return lists.flat();
}

/** 到期题数（首页徽标用，只 count 不拉记录） */
export async function getDueCount(bankIds: string | string[]): Promise<number> {
  const ids = normalizeBankIds(bankIds);
  if (ids.length === 0) return 0;
  const now = Date.now();
  const counts = await Promise.all(
    ids.map((bankId) =>
      db.questionStats
        .where("[bankId+nextReviewAt]")
        .between([bankId, 0], [bankId, now])
        .count(),
    ),
  );
  return counts.reduce((sum, count) => sum + count, 0);
}

/** 清空所有用户数据（保留题库），用于"重置学习记录" */
export async function clearUserData(): Promise<void> {
  await db.transaction("rw", [db.sessions, db.attempts, db.questionStats], async () => {
    await db.sessions.clear();
    await db.attempts.clear();
    await db.questionStats.clear();
  });
}

/** 完全重置应用（连题库一起删除） */
export async function resetAllData(): Promise<void> {
  await db.delete();
  await db.open();
}
