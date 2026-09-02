"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, Clock, LayoutGrid } from "lucide-react";

interface PracticeHeaderProps {
  currentIndex: number;
  total: number;
  elapsedText: string;
  onOpenNavigator?: () => void;
  title?: string;
}

export function PracticeHeader({
  currentIndex,
  total,
  elapsedText,
  onOpenNavigator,
  title,
}: PracticeHeaderProps) {
  const router = useRouter();

  const handleExit = () => {
    if (window.confirm("确定退出当前练习吗？已答进度将自动保存。")) {
      router.push("/");
    }
  };

  const progressPercent = ((currentIndex + 1) / Math.max(1, total)) * 100;

  return (
    <header className="glass-header sticky top-0 z-30 px-4 pt-3 pb-2 safe-top transition-all">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        {/* 左侧返回 */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExit}
            aria-label="退出练习"
            className="squircle-press flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 bg-ios-surface/80 text-ios-label-secondary shadow-sm hover:border-ios-blue/30 hover:bg-ios-surface hover:text-ios-blue active:scale-95 dark:border-white/10 dark:bg-ios-surface/60"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
          </button>
          {title && (
            <span className="hidden text-[14px] font-semibold text-ios-label-secondary sm:inline-block max-w-[200px] truncate">
              {title}
            </span>
          )}
        </div>

        {/* 中间进度计数器 */}
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-bold tabular-nums text-ios-label">
            {currentIndex + 1}
          </span>
          <span className="text-[13px] text-ios-label-tertiary">/ {total}</span>
        </div>

        {/* 右侧：计时器与题卡呼出 */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-white/60 bg-ios-surface/80 px-3 py-1 text-[12px] font-semibold tabular-nums text-ios-label-secondary shadow-2xs backdrop-blur-md dark:border-white/10 dark:bg-ios-surface/60">
            <Clock className="h-3.5 w-3.5 text-ios-blue" />
            <span>{elapsedText}</span>
          </div>

          {onOpenNavigator && (
            <button
              onClick={onOpenNavigator}
              aria-label="查看答题卡"
              className="squircle-press flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-ios-surface/80 text-ios-label-secondary shadow-2xs hover:bg-ios-surface hover:text-ios-blue active:scale-95 dark:border-white/10 dark:bg-ios-surface/60"
              title="查看答题卡"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 顶部进度条 */}
      <div className="mx-auto mt-2 h-1 max-w-6xl overflow-hidden rounded-full bg-ios-surface-tertiary/60">
        <div
          className="h-full bg-gradient-to-r from-ios-blue to-ios-indigo transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </header>
  );
}
