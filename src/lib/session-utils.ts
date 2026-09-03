import { nanoid } from "nanoid";
import {
  db,
  getStat,
  questionKey,
  type AttemptRecord,
  type PracticeConfig,
  type PracticeMode,
  type PracticeSessionRecord,
  type QuestionStatRecord,
} from "@/lib/db";
import { gradeQuestion, type UserAnswer } from "@/lib/grading";
import { nextReviewAt } from "@/lib/review-schedule";
import { filterRandomPool, selectQuestions } from "@/lib/bank-utils";
import type { Question, SelfRating } from "@/types/question-bank";
import type { QuestionRecord } from "@/lib/db";

/** 可持久化题目：题库记录自带 originalId，练习中的 Question 需兼容旧字段 */
export type PersistableQuestion = QuestionRecord | (Question & { originalId?: string });

/** 会话 id 长度（nanoid） */
const SESSION_ID_LENGTH = 12;
/** 连续答对 N 次后移出错题本 */
const WRONG_BOOK_CLEAR_STREAK = 2;

export interface CreateSessionInput extends PracticeConfig {
  mode: PracticeMode;
  title: string;
  /** 直接指定题目引用（复习页错题/收藏/到期组卷用），与筛选配置二选一 */
  refs?: Array<{ bankId: string; questionId: string }>;
}

function getQuestionPersistId(question: PersistableQuestion): string {
  return "originalId" in question && question.originalId
    ? question.originalId
    : question.id;
}

export async function createPracticeSession(input: CreateSessionInput): Promise<PracticeSessionRecord> {
  // 直接 refs 组卷（复习页）：跳过全库筛选，校验空结果
  if (input.refs) {
    if (input.refs.length === 0) {
      throw new Error("没有符合条件的题目，请调整练习范围");
    }
    const session: PracticeSessionRecord = {
      id: nanoid(SESSION_ID_LENGTH),
      bankId: input.bankId,
      title: input.title,
      mode: input.mode,
      config: {
        bankId: input.bankId,
        bankIds: input.bankIds,
        count: input.refs.length,
        order: input.order,
      },
      questionRefs: input.refs,
      currentIndex: 0,
      status: "active",
      startedAt: Date.now(),
    };
    await db.sessions.add(session);
    return session;
  }

  const bankIds = input.bankIds && input.bankIds.length > 0 ? input.bankIds : [input.bankId];
  const allQuestions =
    bankIds.length === 1
      ? await db.questions.where("bankId").equals(bankIds[0]).toArray()
      : await db.questions.where("bankId").anyOf(bankIds).toArray();

  let effectiveQuestions = allQuestions;
  if (input.mode === "random" && !input.refs) {
    const keys = allQuestions.map((q) => questionKey(q.bankId, q.originalId));
    const statList = keys.length > 0 ? await db.questionStats.bulkGet(keys) : [];
    const statMap = new Map(
      statList.filter((s): s is QuestionStatRecord => Boolean(s)).map((s) => [s.id, s]),
    );
    effectiveQuestions = filterRandomPool(allQuestions, statMap);
  }

  const { refs, matchedCount } = selectQuestions(effectiveQuestions, input);
  if (matchedCount === 0 && input.mode === "random" && !input.refs) {
    const original = selectQuestions(allQuestions, input);
    if (original.matchedCount > 0) {
      throw new Error("ALL_MASTERED");
    }
  }
  const count = Math.min(input.count, refs.length);

  const session: PracticeSessionRecord = {
    id: nanoid(SESSION_ID_LENGTH),
    bankId: input.bankId,
    title: input.title,
    mode: input.mode,
    config: {
      bankId: input.bankId,
      bankIds: bankIds.length > 1 ? bankIds : undefined,
      subjectId: input.subjectId,
      unit: input.unit,
      chapters: input.chapters,
      types: input.types,
      count,
      order: input.order,
    },
    questionRefs: refs,
    currentIndex: 0,
    status: "active",
    startedAt: Date.now(),
  };

  if (matchedCount === 0) {
    throw new Error("没有符合条件的题目，请调整练习范围");
  }

  await db.sessions.add(session);
  return session;
}

export interface AnswerSubmission {
  correctness: AttemptRecord["correctness"];
}

export async function submitAnswer(
  session: PracticeSessionRecord,
  question: PersistableQuestion,
  bankId: string,
  userAnswer: UserAnswer,
  durationMs: number,
): Promise<AnswerSubmission> {
  const { correctness } = gradeQuestion(question, userAnswer);
  await saveAttempt({
    sessionId: session.id,
    bankId,
    question,
    userAnswer,
    correctness,
    durationMs,
  });
  return { correctness };
}

export async function selfRateSubjective(
  session: PracticeSessionRecord,
  question: Question,
  bankId: string,
  selfRating: SelfRating,
  durationMs: number,
): Promise<void> {
  await saveAttempt({
    sessionId: session.id,
    bankId,
    question,
    userAnswer: null,
    correctness: "ungraded",
    durationMs,
    selfRating,
  });
}

interface SaveAttemptInput {
  sessionId: string;
  bankId: string;
  question: PersistableQuestion;
  userAnswer: UserAnswer;
  correctness: AttemptRecord["correctness"];
  durationMs: number;
  selfRating?: SelfRating;
}

async function saveAttempt(input: SaveAttemptInput): Promise<void> {
  const questionPersistId = getQuestionPersistId(input.question);
  const now = Date.now();
  const attempt: AttemptRecord = {
    id: `${input.sessionId}:${input.bankId}:${questionPersistId}`,
    sessionId: input.sessionId,
    bankId: input.bankId,
    questionId: questionPersistId,
    userAnswer: input.userAnswer,
    correctness: input.correctness,
    selfRating: input.selfRating,
    durationMs: input.durationMs,
    submittedAt: now,
  };

  await db.transaction("rw", [db.attempts, db.questionStats], async () => {
    await db.attempts.put(attempt);
    await updateStat(input.question, input.bankId, input.correctness, input.selfRating, now);
  });
}

async function updateStat(
  question: PersistableQuestion,
  bankId: string,
  correctness: AttemptRecord["correctness"],
  selfRating: SelfRating | undefined,
  now: number,
): Promise<void> {
  const questionPersistId = getQuestionPersistId(question);
  const stat = (await getStat(bankId, questionPersistId)) ?? createEmptyStat(bankId, questionPersistId);
  const previousStreak = stat.streak;

  if (correctness === "incorrect") {
    stat.wrongCount += 1;
    stat.streak = 0;
    stat.isWrongBook = true;
  } else if (correctness === "correct") {
    stat.correctCount += 1;
    stat.streak = previousStreak + 1;
    if (stat.streak >= WRONG_BOOK_CLEAR_STREAK) stat.isWrongBook = false;
  } else {
    // 主观题自评：0 不会 / 1 模糊视为未掌握，2 掌握计入连击
    stat.subjectiveCount += 1;
    if (selfRating === 0 || selfRating === 1) {
      stat.streak = 0;
      stat.isWrongBook = true;
    } else if (selfRating === 2) {
      stat.streak = previousStreak + 1;
      if (stat.streak >= WRONG_BOOK_CLEAR_STREAK) stat.isWrongBook = false;
    }
  }

  stat.attemptCount += 1;
  stat.lastCorrectness = correctness;
  stat.lastAnsweredAt = now;
  // 对齐到日期边界：与 queries 按天分桶一致，避免 23:00 作答漂移成两天
  stat.nextReviewAt = nextReviewAt(correctness, selfRating, previousStreak, now);

  await db.questionStats.put(stat);
}

function createEmptyStat(bankId: string, questionId: string): QuestionStatRecord {
  return {
    id: questionKey(bankId, questionId),
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
  };
}

export async function completeSession(sessionId: string, durationMs?: number): Promise<void> {
  const now = Date.now();
  const session = await db.sessions.get(sessionId);
  const finalDuration =
    durationMs ?? session?.durationMs ?? (now - (session?.startedAt ?? now));
  await db.sessions.update(sessionId, {
    status: "completed",
    completedAt: now,
    durationMs: finalDuration,
  });
}

export async function getAttemptsForSession(sessionId: string): Promise<AttemptRecord[]> {
  // 走 [sessionId+submittedAt] 复合索引，按提交顺序返回
  return db.attempts
    .where("[sessionId+submittedAt]")
    .between([sessionId, 0], [sessionId, Number.POSITIVE_INFINITY])
    .toArray();
}

export async function toggleFavorite(bankId: string, questionId: string): Promise<boolean> {
  const stat = (await getStat(bankId, questionId)) ?? createEmptyStat(bankId, questionId);
  stat.isFavorite = !stat.isFavorite;
  await db.questionStats.put(stat);
  return stat.isFavorite;
}

export async function setNote(
  bankId: string,
  questionId: string,
  note: string,
): Promise<void> {
  const stat = (await getStat(bankId, questionId)) ?? createEmptyStat(bankId, questionId);
  stat.note = note;
  await db.questionStats.put(stat);
}
