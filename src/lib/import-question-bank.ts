import { nanoid } from "nanoid";
import type { QuestionBankInput } from "@/lib/question-bank-schema";
import { questionBankSchema } from "@/lib/question-bank-schema";
import { db, questionKey, type BankRecord, type QuestionRecord } from "@/lib/db";
import type { QuestionType } from "@/types/question-bank";

export interface ValidationReport {
  ok: boolean;
  warnings: string[];
  errors: string[];
  questionCount: number;
  typeCounts: Partial<Record<QuestionType, number>>;
}

function validateIdUniqueness(ids: string[], warnings: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      warnings.push(`发现重复题目 id：${id}`);
    }
    seen.add(id);
  }
}

function validateSubjectRefs(
  data: QuestionBankInput,
  warnings: string[],
): void {
  const subjectIds = new Set(data.subjects.map((subject) => subject.id));
  for (const question of data.questions) {
    if (!subjectIds.has(question.subjectId)) {
      warnings.push(`题目 ${question.id} 引用了不存在的科目：${question.subjectId}`);
    }
  }
}

function validateAnswerConsistency(
  data: QuestionBankInput,
  warnings: string[],
): void {
  for (const question of data.questions) {
    const optionKeys = new Set(question.options.map((option) => option.key.trim().toUpperCase()));
    const { type } = question;
    const value = question.answer?.value;

    if (type === "single_choice") {
      if (question.options.length < 2) {
        warnings.push(`单选题 ${question.id} 选项少于 2 个`);
      }
      const answer = String(value).trim().toUpperCase();
      if (optionKeys.size > 0 && !optionKeys.has(answer)) {
        warnings.push(`单选题 ${question.id} 的答案 ${answer} 不在选项内`);
      }
    } else if (type === "multiple_choice") {
      if (question.options.length < 2) {
        warnings.push(`多选题 ${question.id} 选项少于 2 个`);
      }
      if (!Array.isArray(value)) {
        warnings.push(`多选题 ${question.id} 的答案不是数组`);
        continue;
      }
      const missing = value
        .map((key) => String(key).trim().toUpperCase())
        .filter((key) => optionKeys.size > 0 && !optionKeys.has(key));
      if (missing.length > 0) {
        warnings.push(`多选题 ${question.id} 的答案包含不在选项内的项：${missing.join(",")}`);
      }
    } else if (type === "true_false") {
      if (typeof value !== "boolean") {
        warnings.push(`判断题 ${question.id} 的答案不是布尔值`);
      }
    }
  }
}

/** 解析原始 JSON 并执行结构 + 内容软校验，返回报告 */
export function parseAndValidate(rawJson: string): ValidationReport & { data?: QuestionBankInput } {
  const warnings: string[] = [];
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    return {
      ok: false,
      warnings,
      errors: [`JSON 解析失败：${error instanceof Error ? error.message : String(error)}`],
      questionCount: 0,
      typeCounts: {},
    };
  }

  const result = questionBankSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    return {
      ok: false,
      warnings,
      errors: [`题库结构不符合规范（前若干条）：${details.join("；")}`],
      questionCount: 0,
      typeCounts: {},
    };
  }

  const data = result.data;
  validateIdUniqueness(
    data.questions.map((question) => question.id),
    warnings,
  );
  validateSubjectRefs(data, warnings);
  validateAnswerConsistency(data, warnings);

  const typeCounts: Partial<Record<QuestionType, number>> = {};
  for (const question of data.questions) {
    typeCounts[question.type] = (typeCounts[question.type] ?? 0) + 1;
  }

  return {
    ok: true,
    warnings,
    errors,
    data,
    questionCount: data.questions.length,
    typeCounts,
  };
}

export interface ImportResult {
  ok: boolean;
  bank?: BankRecord;
  warnings: string[];
  errors: string[];
  questionCount: number;
  typeCounts: Partial<Record<QuestionType, number>>;
}

/**
 * 将解析通过、含软校验报告的题库写入 IndexedDB。
 * @param rawJson  原始 JSON 文本
 * @param name     题库显示名
 * @param bankId   指定题库 id（默认题库固定为 "default"）
 */
export async function importQuestionBank(
  rawJson: string,
  name: string,
  bankId = `bank-${nanoid(8)}`,
): Promise<ImportResult> {
  const report = parseAndValidate(rawJson);
  if (!report.ok || !report.data) {
    return {
      ok: false,
      warnings: report.warnings,
      errors: report.errors,
      questionCount: 0,
      typeCounts: report.typeCounts,
    };
  }

  const data = report.data;
  const bank: BankRecord = {
    id: bankId,
    name,
    schemaVersion: data.schemaVersion,
    generatedAt: data.generatedAt,
    importedAt: Date.now(),
    questionCount: data.questions.length,
    isDefault: bankId === "default",
    subjects: data.subjects,
  };

  const questionRecords: QuestionRecord[] = data.questions.map((question) => ({
    ...question,
    id: questionKey(bankId, question.id),
    bankId,
    originalId: question.id,
  }));

  await db.transaction("rw", [db.banks, db.questions], async () => {
    await db.banks.put(bank);
    await db.questions.bulkPut(questionRecords);
  });

  return {
    ok: true,
    bank,
    warnings: report.warnings,
    errors: report.errors,
    questionCount: report.questionCount,
    typeCounts: report.typeCounts,
  };
}
