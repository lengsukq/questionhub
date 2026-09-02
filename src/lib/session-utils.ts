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
import { gradeQuestion } from "@/lib/grading";
import { nextReviewInDays } from "@/lib/review-schedule";
import { selectQuestions } from "@/lib/bank-utils";
import type { Question, SelfRating } from "@/types/question-bank";

export interface CreateSessionInput extends PracticeConfig {
  mode: PracticeMode;
  title: string;
}

function getQuestionPersistId(question: Question): string {
  return (question as { originalId?: string }).originalId ?? question.id;
}

export async function createPracticeSession(input: CreateSessionInput): Promise<PracticeSessionRecord> {
  const bankIds = input.bankIds && input.bankIds.length > 0 ? input.bankIds : [input.bankId];
  const allQuestions =
    bankIds.length === 1
      ? await db.questions.where("bankId").equals(bankIds[0]).toArray()
      : await db.questions.where("bankId").anyOf(bankIds).toArray();
  const { refs, matchedCount } = selectQuestions(allQuestions, input);
  const count = Math.min(input.count, refs.length);

  const session: PracticeSessionRecord = {
    id: nanoid(12),
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
  question: Question,
  bankId: string,
  userAnswer: unknown,
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
  question: Question;
  userAnswer: unknown;
  correctness: AttemptRecord["correctness"];
  durationMs: number;
  selfRating?: SelfRating;
}

async function saveAttempt(input: SaveAttemptInput): Promise<void> {
  const questionPersistId = getQuestionPersistId(input.question);
  const now = Date.now();
  const attempt: AttemptRecord = {
    id: `${input.sessionId}:${questionPersistId}`,
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
  question: Question,
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
    if (stat.streak >= 2) stat.isWrongBook = false;
  } else {
    // 主观题自评
    stat.subjectiveCount += 1;
    if (selfRating !== undefined && selfRating <= 1) {
      stat.streak = 0;
      stat.isWrongBook = true;
    } else if (selfRating !== undefined && selfRating === 2) {
      stat.streak = previousStreak + 1;
      if (stat.streak >= 2) stat.isWrongBook = false;
    }
  }

  stat.attemptCount += 1;
  stat.lastCorrectness = correctness;
  stat.lastAnsweredAt = now;
  stat.nextReviewAt = now + nextReviewInDays(correctness, selfRating, previousStreak) * 86400_000;

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

export async function completeSession(sessionId: string): Promise<void> {
  const now = Date.now();
  await db.sessions.update(sessionId, {
    status: "completed",
    completedAt: now,
    durationMs: now - ((await db.sessions.get(sessionId))?.startedAt ?? now),
  });
}

export async function getAttemptsForSession(sessionId: string): Promise<AttemptRecord[]> {
  return db.attempts.where("sessionId").equals(sessionId).toArray();
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
