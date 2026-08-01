"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

/** iOS 风格底部弹层 */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        aria-label="关闭"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={cn(
          "relative flex max-h-[85dvh] w-full max-w-[560px] flex-col rounded-t-[20px] bg-ios-surface dark:bg-ios-surface-secondary animate-in slide-in-from-bottom-4",
          className,
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-ios-separator" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="关闭弹层"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ios-surface-tertiary text-ios-label-secondary dark:bg-ios-surface-tertiary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-8 safe-bottom">{children}</div>
      </div>
    </div>
  );
}
