import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  indicatorClassName?: string;
  size?: "sm" | "default" | "lg";
}

/** 现代圆润进度条，value 为 0-100 */
export function Progress({
  value,
  className,
  indicatorClassName,
  size = "default",
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));

  const sizeClasses = {
    sm: "h-1.5",
    default: "h-2.5",
    lg: "h-4",
  };

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
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
