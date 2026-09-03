import { CheckCircle2, Info, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { isSubjectiveType } from "@/lib/grading";
import type { AttemptRecord, QuestionRecord } from "@/lib/db";
import type { ExplanationStatus, Question } from "@/types/question-bank";

interface ExplanationCardProps {
  question: QuestionRecord;
  attempt?: AttemptRecord;
  revealed?: boolean;
}

export function ExplanationCard({
  question,
  attempt,
  revealed,
}: ExplanationCardProps) {
  const isSubjective = isSubjectiveType(question.type);
  const correctText = formatAnswerText(question);

  return (
    <div className="space-y-4 pt-3">
      {/* 客观题判题结果大卡片 */}
      {!isSubjective && attempt && (
        <Card
          className={
            attempt.correctness === "correct"
              ? "border-ios-green/30 bg-ios-green/8 p-5"
              : "border-ios-red/30 bg-ios-red/8 p-5"
          }
        >
          <div className="flex items-center gap-3">
            {attempt.correctness === "correct" ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-ios-green" />
            ) : (
              <XCircle className="h-6 w-6 shrink-0 text-ios-red" />
            )}
            <div>
              <p
                className={`text-[16px] font-bold ${
                  attempt.correctness === "correct"
                    ? "text-ios-green"
                    : "text-ios-red"
                }`}
              >
                {attempt.correctness === "correct" ? "回答正确" : "回答错误"}
              </p>
              <p className="mt-0.5 text-[14px] text-ios-label-secondary">
                正确答案：<span className="font-bold text-ios-label">{correctText}</span>
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* 主观题参考答案 */}
      {isSubjective && (revealed || attempt) && (
        <Card className="border-ios-purple/20 bg-ios-purple/5 p-5">
          <p className="text-[14px] font-bold text-ios-purple">参考答案要点</p>
          <div className="mt-2 text-[15px] leading-relaxed text-ios-label whitespace-pre-wrap">
            {correctText}
          </div>
        </Card>
      )}

      {/* 原书解析 */}
      <DetailExplanation question={question} />
    </div>
  );
}

const MISSING_EXPLANATION_COPY: Partial<Record<ExplanationStatus, string>> = {
  source_not_provided: "原题库未收录独立文字解析",
  ocr_failed: "原题库包含解析，但当前文本未能完整识别",
};

function DetailExplanation({ question }: { question: QuestionRecord }) {
  const missingCopy = MISSING_EXPLANATION_COPY[question.explanationStatus];
  if (missingCopy) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-[13px] font-medium text-ios-label-tertiary">
          <Info className="h-4 w-4" />
          {missingCopy}
        </div>
      </Card>
    );
  }

  if (!question.explanation) return null;

  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-3 w-1 rounded-full bg-ios-blue" />
        <h4 className="text-[14px] font-bold text-ios-blue">考点与解题精析</h4>
      </div>
      <p className="text-[14px] sm:text-[15px] leading-relaxed text-ios-label whitespace-pre-wrap">
        {question.explanation}
      </p>
    </Card>
  );
}

const ANSWER_KEY_SEPARATOR = "、";

function formatAnswerText(question: Question): string {
  const { type, answer } = question;
  if (type === "true_false") {
    return answer.display ? String(answer.display) : answer.value ? "正确" : "错误";
  }
  if (Array.isArray(answer.value)) {
    return answer.display ? String(answer.display) : answer.value.join(ANSWER_KEY_SEPARATOR);
  }
  return answer.display ? String(answer.display) : String(answer.value);
}
