"use client";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

export interface ConfirmSheetProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  confirming?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** 统一破坏性操作确认：Sheet 样式、可测试、可读屏，不用原生阻塞 confirm */
export function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel = "确认",
  danger = false,
  confirming = false,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title} description={description}>
      <div className="flex gap-3">
        <Button variant="secondary" size="lg" className="flex-1 justify-center" onClick={onClose}>
          取消
        </Button>
        <Button
          size="lg"
          className="flex-1 justify-center"
          variant={danger ? "danger" : "primary"}
          loading={confirming}
          loadingText="处理中…"
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
