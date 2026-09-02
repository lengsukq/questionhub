"use client";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedProps<T extends string> {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "default" | "sm";
}

/** 现代毛玻璃大圆角分段选择器 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "default",
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "relative flex items-center rounded-2xl border border-white/60 bg-ios-surface-tertiary/70 p-1 backdrop-blur-md shadow-inner dark:border-white/5 dark:bg-ios-surface-secondary/80",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex-1 rounded-xl font-semibold transition-all duration-200 cursor-pointer",
              size === "default" ? "py-2 px-3 text-[13px] lg:text-[14px]" : "py-1 px-2.5 text-[12px]",
              isActive
                ? "bg-ios-surface text-ios-label shadow-sm ring-1 ring-black/[0.04] dark:bg-ios-surface-solid dark:text-white dark:ring-white/10"
                : "text-ios-label-secondary hover:text-ios-label",
            )}
          >
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <span>{option.label}</span>
              {option.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[11px] font-bold",
                    isActive
                      ? "bg-ios-blue/10 text-ios-blue dark:bg-ios-blue/20"
                      : "bg-ios-surface/60 text-ios-label-tertiary",
                  )}
                >
                  {option.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
