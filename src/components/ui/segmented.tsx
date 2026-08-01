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
}

/** iOS 分段控件 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex rounded-[10px] bg-ios-surface-tertiary p-0.5 dark:bg-ios-surface-secondary",
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
              "flex-1 rounded-lg px-3 py-1.5 text-[14px] font-medium transition-all duration-200",
              isActive
                ? "bg-ios-surface text-ios-label shadow-sm dark:bg-ios-surface-secondary dark:text-white"
                : "text-ios-label-secondary",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cn("ml-1 text-[12px]", isActive ? "text-ios-label-secondary" : "text-ios-label-tertiary")}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
