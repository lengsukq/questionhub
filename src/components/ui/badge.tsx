import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: "blue" | "green" | "red" | "orange" | "purple" | "gray";
}

const colorClasses: Record<NonNullable<BadgeProps["color"]>, string> = {
  blue: "bg-ios-blue/12 text-ios-blue dark:bg-ios-blue/20 dark:text-ios-blue",
  green: "bg-ios-green/12 text-ios-green dark:bg-ios-green/20 dark:text-ios-green",
  red: "bg-ios-red/12 text-ios-red dark:bg-ios-red/20 dark:text-ios-red",
  orange: "bg-ios-orange/12 text-ios-orange dark:bg-ios-orange/20 dark:text-ios-orange",
  purple: "bg-ios-purple/12 text-ios-purple dark:bg-ios-purple/20 dark:text-ios-purple",
  gray: "bg-ios-surface-tertiary text-ios-label-secondary dark:bg-ios-surface-tertiary dark:text-ios-label-secondary",
};

export function Badge({ className, color = "blue", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium leading-4",
        colorClasses[color],
        className,
      )}
      {...props}
    />
  );
}
