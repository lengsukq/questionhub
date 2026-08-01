import Dexie, { type Table } from "dexie";
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
  /** 主键，格式 `${sessionId}:${questionId}` */
  id: string;
  sessionId: string;
  bankId: string;
  questionId: string;
  userAnswer: unknown;
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
  }
}

export const db = new QuestionHubDB();

export async function listBanks(): Promise<BankRecord[]> {
  return db.banks.orderBy("importedAt").toArray();
}

export async function listQuestions(bankId: string): Promise<QuestionRecord[]> {
  return db.questions.where("bankId").equals(bankId).toArray();
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

export async function getActiveSession(): Promise<PracticeSessionRecord | undefined> {
  const sessions = await db.sessions
    .where("status")
    .equals("active")
    .reverse()
    .sortBy("startedAt");
  return sessions[0];
}

export async function getDueStats(bankId: string): Promise<QuestionStatRecord[]> {
  const now = Date.now();
  return db.questionStats
    .where("bankId")
    .equals(bankId)
    .filter((stat) => stat.nextReviewAt !== null && stat.nextReviewAt <= now)
    .toArray();
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
