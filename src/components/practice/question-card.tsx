import { Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { type QuestionRecord } from "@/lib/db";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/types/question-bank";

interface QuestionCardProps {
  question: QuestionRecord;
}

export function QuestionCard({ question }: QuestionCardProps) {
  return (
    <Card className="p-6 transition-all duration-300">
      {/* 标签栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge color={badgeColor(question.type)}>
          {QUESTION_TYPE_LABELS[question.type]}
        </Badge>
        {question.chapter && (
          <span className="rounded-lg bg-ios-surface-secondary/80 px-2.5 py-0.5 text-[12px] font-medium text-ios-label-secondary">
            {question.chapter}
          </span>
        )}
        {question.quality?.needsReview && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-ios-orange/10 px-2 py-0.5 text-[11px] font-semibold text-ios-orange">
            <Flag className="h-3 w-3" /> 待复核
          </span>
        )}
      </div>

      {/* 题干文本 */}
      <h2 className="text-[17px] sm:text-[18px] font-medium leading-relaxed text-ios-label selection:bg-ios-blue/20">
        {question.stem}
      </h2>
    </Card>
  );
}

function badgeColor(type: QuestionType): "blue" | "green" | "orange" | "purple" {
  switch (type) {
    case "single_choice":
      return "blue";
    case "multiple_choice":
      return "green";
    case "true_false":
      return "orange";
    default:
      return "purple";
  }
}
