"use client";

import { CheckCircle2, Eye, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SelfRating } from "@/types/question-bank";

interface SubjectivePanelProps {
  hasAnswered: boolean;
  revealed: boolean;
  submitting: boolean;
  selfRating?: SelfRating;
  onReveal: () => void;
  onRate: (rating: SelfRating) => void;
}

export function SubjectivePanel({
  hasAnswered,
  revealed,
  submitting,
  selfRating,
  onReveal,
  onRate,
}: SubjectivePanelProps) {
  return (
    <div className="space-y-4 pt-3">
      {/* 提示卡片 */}
      <Card className="border-2 border-dashed border-ios-purple/30 bg-ios-purple/5 p-5">
        <div className="flex items-start gap-3">
          <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-ios-purple" />
          <div>
            <p className="text-[14px] font-semibold text-ios-purple">主观题作答提示</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ios-label-secondary">
              本题为主观题，建议在草稿纸上理清思路完整作答后，点击下方「查看参考答案」对照要点自评。
            </p>
          </div>
        </div>
      </Card>

      {/* 查看答案按钮（未查看时） */}
      {!revealed && !hasAnswered && (
        <Button
          variant="secondary"
          size="lg"
          className="w-full justify-center"
          onClick={onReveal}
        >
          <Eye className="h-5 w-5 text-ios-blue" />
          查看参考答案与解析
        </Button>
      )}

      {/* 自评按钮组（已查看且未提交时） */}
      {(revealed || hasAnswered) && (
        <Card className="p-5">
          <p className="text-[14px] font-semibold text-ios-label">参考答案自评掌握度</p>
          <p className="mt-1 text-[12px] text-ios-label-secondary">
            根据要点命中情况评估掌握度，自评将记录到复习算法模型中：
          </p>

          {!hasAnswered ? (
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <Button
                variant="secondary"
                size="default"
                disabled={submitting}
                className="border-ios-red/30 hover:border-ios-red hover:bg-ios-red/10 text-ios-red"
                onClick={() => onRate(0)}
              >
                不会 (0分)
              </Button>
              <Button
                variant="secondary"
                size="default"
                disabled={submitting}
                className="border-ios-orange/30 hover:border-ios-orange hover:bg-ios-orange/10 text-ios-orange"
                onClick={() => onRate(1)}
              >
                模糊 (部分)
              </Button>
              <Button
                variant="secondary"
                size="default"
                disabled={submitting}
                className="border-ios-green/30 hover:border-ios-green hover:bg-ios-green/10 text-ios-green"
                onClick={() => onRate(2)}
              >
                掌握 (答对)
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-ios-surface-secondary p-3">
              <CheckCircle2 className="h-4 w-4 text-ios-green" />
              <span className="text-[13px] font-medium text-ios-label">
                已自评：{selfRatingLabel(selfRating)}
              </span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function selfRatingLabel(rating?: SelfRating): string {
  if (rating === 0) return "不会 (0分)";
  if (rating === 1) return "模糊 (部分命中)";
  if (rating === 2) return "熟练掌握";
  return "未自评";
}
