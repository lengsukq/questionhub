"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** 弹窗默认最大宽度与高度（dvh 适配移动端浏览器栏伸缩） */
const DEFAULT_SHEET_MAX_WIDTH = "max-w-lg";
const SHEET_MAX_HEIGHT_CLASS = "max-h-[88dvh]";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  maxWidth?: string;
}

/**
 * 响应式弹窗/抽屉（Mobile 底部滑出抽屉，Pad/PC 居中大圆角模态框）。
 * 经 Portal 直挂 document.body，避免被祖先 stacking context
 *（如 sticky + z-index 的 header）困住而盖不过底部操作栏。
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = DEFAULT_SHEET_MAX_WIDTH,
}: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  // SSR 安全的挂载标记：首屏服务端渲染为 false，客户端挂载后才允许建 Portal
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

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

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* 遮罩层 */}
      <button
        aria-label="关闭遮罩"
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* 弹窗主体 */}
      <div
        ref={sheetRef}
        className={cn(
          "relative z-10 flex w-full flex-col overflow-hidden bg-ios-surface/95 shadow-2xl backdrop-blur-2xl transition-all duration-300",
          SHEET_MAX_HEIGHT_CLASS,
          // Mobile 样式（底部大圆角抽屉）
          "rounded-t-[32px] border-t border-white/80 dark:border-white/10 dark:bg-ios-surface/90",
          // Pad / PC 样式（居中大圆角模态框）
          "md:rounded-[28px] md:border md:border-white/80 md:dark:border-white/10",
          maxWidth,
          className,
        )}
      >
        {/* 移动端顶部拉手 */}
        <div className="mx-auto mt-3 h-1.2 w-10 rounded-full bg-ios-separator md:hidden" />

        {/* 头部 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            {title && (
              <h2 className="text-[18px] font-bold tracking-tight text-ios-label">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-[12px] text-ios-label-secondary">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="关闭弹层"
            className="squircle-press flex h-8 w-8 items-center justify-center rounded-full bg-ios-surface-tertiary text-ios-label-secondary hover:bg-ios-surface-tertiary/90 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-6 pb-8 safe-bottom">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
