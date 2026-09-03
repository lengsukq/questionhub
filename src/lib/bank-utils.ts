import type { QuestionRecord, PracticeConfig } from "@/lib/db";
import type { QuestionType, QuestionUnit } from "@/types/question-bank";

/** 章节复合键分隔符：编码与解码共用一处 */
const CHAPTER_KEY_SEPARATOR = "::";

export interface ChapterStats {
  chapter: string;
  count: number;
}

export interface SubjectStats {
  subjectId: string;
  name: string;
  total: number;
  chapters: ChapterStats[];
}

export interface BankStats {
  total: number;
  bySubject: Array<{ subjectId: string; name: string; count: number }>;
  byType: Array<{ type: QuestionType; count: number }>;
  byUnit: Array<{ unit: QuestionUnit; count: number }>;
  chapters: ChapterStats[];
}

export function computeBankStats(
  questions: QuestionRecord[],
  subjectNames?: Record<string, string>,
): BankStats {
  const total = questions.length;

  const subjectMap = new Map<string, number>();
  const typeMap = new Map<QuestionType, number>();
  const unitMap = new Map<QuestionUnit, number>();
  const chapterMap = new Map<string, number>();

  for (const question of questions) {
    subjectMap.set(question.subjectId, (subjectMap.get(question.subjectId) ?? 0) + 1);
    typeMap.set(question.type, (typeMap.get(question.type) ?? 0) + 1);
    unitMap.set(question.unit, (unitMap.get(question.unit) ?? 0) + 1);
    const chapterKey = [question.subjectId, question.unit, question.chapter].join(CHAPTER_KEY_SEPARATOR);
    chapterMap.set(chapterKey, (chapterMap.get(chapterKey) ?? 0) + 1);
  }

  const bySubject = [...subjectMap.entries()]
    .map(([subjectId, count]) => ({
      subjectId,
      name: subjectNames?.[subjectId] ?? subjectId,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const byType = [...typeMap.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const byUnit = [...unitMap.entries()]
    .map(([unit, count]) => ({ unit, count }))
    .sort((a, b) => b.count - a.count);

  const chapters = [...chapterMap.entries()].map(([key, count]) => {
    const [, unit, chapter] = key.split(CHAPTER_KEY_SEPARATOR);
    return { unit: unit as QuestionUnit, chapter, count };
  });

  return { total, bySubject, byType, byUnit, chapters };
}

export interface QuestionSelection {
  refs: Array<{ bankId: string; questionId: string }>;
  matchedCount: number;
}

/**
 * 按练习配置筛选题目并生成固定引用列表。
 * @param allQuestions 题库全量题目
 * @param config 练习配置
 */
export function selectQuestions(
  allQuestions: QuestionRecord[],
  config: PracticeConfig,
): QuestionSelection {
  let candidates = allQuestions;

  if (config.subjectId) {
    candidates = candidates.filter((question) => question.subjectId === config.subjectId);
  }
  if (config.unit) {
    candidates = candidates.filter((question) => question.unit === config.unit);
  }
  if (config.chapters && config.chapters.length > 0) {
    candidates = candidates.filter((question) => config.chapters?.includes(question.chapter));
  }
  if (config.types && config.types.length > 0) {
    candidates = candidates.filter((question) => config.types?.includes(question.type));
  }

  const ordered =
    config.order === "random" ? shuffle(candidates) : sortBySourceOrder(candidates);

  const picked = ordered.slice(0, config.count);
  return {
    refs: picked.map((question) => ({ bankId: question.bankId, questionId: question.originalId })),
    matchedCount: candidates.length,
  };
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 原题库顺序：按 globalIndex 升序，未编号题目沉底 */
function sortBySourceOrder(questions: QuestionRecord[]): QuestionRecord[] {
  return [...questions].sort((a, b) => (a.globalIndex ?? 0) - (b.globalIndex ?? 0));
}
