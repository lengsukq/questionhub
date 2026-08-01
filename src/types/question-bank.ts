export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "calculation_analysis"
  | "short_answer"
  | "comprehensive";

export type QuestionUnit = "chapter_practice" | "mock_exam" | "advanced_subjective";

export type ExplanationStatus = "provided" | "source_not_provided" | "ocr_failed";

export type Correctness = "correct" | "incorrect" | "partial" | "ungraded";

export type SelfRating = 0 | 1 | 2;

export type ContentStatus =
  | "imported"
  | "review_pending"
  | "reviewed"
  | "published"
  | "disabled";

export interface QuestionOption {
  key: string;
  text: string;
}

export type AnswerValue = string | boolean | string[];

export interface QuestionAnswer {
  value: AnswerValue;
  display?: string;
}

export interface SourceCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SourceRef {
  questionPdf?: string;
  questionPages?: number[];
  answerPdf?: string;
  answerPages?: number[];
  questionCrop?: SourceCrop;
  answerCrop?: SourceCrop;
}

export interface QualityInfo {
  status?: string;
  ocrConfidence?: number;
  needsReview?: boolean;
  issues?: string[];
}

export interface Question {
  id: string;
  subjectId: string;
  type: QuestionType;
  unit: QuestionUnit;
  chapter: string;
  section: string;
  number: number;
  globalIndex?: number;
  groupId?: string | null;
  subQuestionIndex?: number | null;
  stem: string;
  options: QuestionOption[];
  answer: QuestionAnswer;
  explanation: string;
  explanationStatus: ExplanationStatus;
  analysisTips?: string;
  knowledgePoints?: string[];
  difficulty?: number | null;
  assets?: unknown[];
  source?: SourceRef;
  quality?: QualityInfo;
}

export interface Subject {
  id: string;
  name: string;
  year?: number;
  exam?: string;
}

export interface QuestionGroup {
  id: string;
  type: string;
  title?: string;
  material?: string;
  assets?: unknown[];
}

export interface QuestionBank {
  schemaVersion: string;
  generatedAt: string;
  subjects: Subject[];
  groups: QuestionGroup[];
  questions: Question[];
  metadata?: Record<string, unknown>;
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  true_false: "判断题",
  short_answer: "简答题",
  comprehensive: "综合题",
  calculation_analysis: "计算分析题",
};

export const QUESTION_UNIT_LABELS: Record<QuestionUnit, string> = {
  chapter_practice: "章节练习",
  mock_exam: "模拟套卷",
  advanced_subjective: "主观题专项",
};

export const OBJECTIVE_TYPES: QuestionType[] = [
  "single_choice",
  "multiple_choice",
  "true_false",
];

export const SUBJECTIVE_TYPES: QuestionType[] = [
  "short_answer",
  "calculation_analysis",
  "comprehensive",
];

export const ALL_QUESTION_TYPES: QuestionType[] = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "short_answer",
  "calculation_analysis",
  "comprehensive",
];

export function isObjective(type: QuestionType): boolean {
  return OBJECTIVE_TYPES.includes(type);
}
