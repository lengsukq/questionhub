import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  indicatorClassName?: string;
  size?: "sm" | "default" | "lg";
}

/** 进度条边界（与 aria-valuemin/max 共用） */
const PROGRESS_MIN = 0;
const PROGRESS_MAX = 100;

/** 现代圆润进度条，value 为 0-100 */
export function Progress({
  value,
  className,
  indicatorClassName,
  size = "default",
}: ProgressProps) {
  const clamped = Math.max(PROGRESS_MIN, Math.min(PROGRESS_MAX, value));

  const sizeClasses = {
    sm: "h-1.5",
    default: "h-2.5",
    lg: "h-4",
  };

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={PROGRESS_MIN}
      aria-valuemax={PROGRESS_MAX}
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-ios-surface-tertiary/70 shadow-inner",
        sizeClasses[size],
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-ios-blue to-ios-indigo transition-all duration-500 ease-out shadow-sm",
          indicatorClassName,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
