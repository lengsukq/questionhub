import { z } from "zod";

export const questionTypeSchema = z.enum([
  "single_choice",
  "multiple_choice",
  "true_false",
  "short_answer",
  "comprehensive",
  "calculation_analysis",
]);

export const questionUnitSchema = z.enum([
  "chapter_practice",
  "mock_exam",
  "advanced_subjective",
]);

export const explanationStatusSchema = z.enum([
  "provided",
  "source_not_provided",
  "ocr_failed",
]);

export const questionOptionSchema = z.object({
  key: z.string().min(1),
  text: z.string(),
});

// 答案 value 依题型不同可为字符串、布尔或字符串数组
export const answerValueSchema = z.union([
  z.string(),
  z.boolean(),
  z.array(z.string()),
]);

export const questionAnswerSchema = z.object({
  value: answerValueSchema,
  display: z.string().optional(),
});

export const sourceCropSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const sourceRefSchema = z.object({
  questionPdf: z.string().optional(),
  questionPages: z.array(z.number()).optional(),
  answerPdf: z.string().optional(),
  answerPages: z.array(z.number()).optional(),
  questionCrop: sourceCropSchema.optional(),
  answerCrop: sourceCropSchema.optional(),
});

export const qualityInfoSchema = z.object({
  status: z.string().optional(),
  ocrConfidence: z.number().optional(),
  needsReview: z.boolean().optional(),
  issues: z.array(z.string()).optional(),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  type: questionTypeSchema,
  unit: questionUnitSchema,
  chapter: z.string(),
  section: z.string(),
  number: z.number(),
  globalIndex: z.number().optional(),
  groupId: z.string().nullable().optional(),
  subQuestionIndex: z.number().nullable().optional(),
  stem: z.string().min(1),
  options: z.array(questionOptionSchema).default([]),
  answer: questionAnswerSchema,
  explanation: z.string().default(""),
  explanationStatus: explanationStatusSchema.default("provided"),
  analysisTips: z.string().optional(),
  knowledgePoints: z.array(z.string()).optional(),
  difficulty: z.number().nullable().optional(),
  assets: z.array(z.unknown()).optional(),
  source: sourceRefSchema.optional(),
  quality: qualityInfoSchema.optional(),
});

export const subjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  year: z.number().optional(),
  exam: z.string().optional(),
});

export const questionGroupSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  title: z.string().optional(),
  material: z.string().optional(),
  assets: z.array(z.unknown()).optional(),
});

export const questionBankSchema = z.object({
  schemaVersion: z.string(),
  generatedAt: z.string(),
  subjects: z.array(subjectSchema),
  groups: z.array(questionGroupSchema).default([]),
  questions: z.array(questionSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type QuestionBankInput = z.infer<typeof questionBankSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
