import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: "blue" | "green" | "red" | "orange" | "purple" | "teal" | "gray";
  variant?: "subtle" | "solid";
}

const colorClasses: Record<NonNullable<BadgeProps["color"]>, { subtle: string; solid: string }> = {
  blue: {
    subtle: "border border-ios-blue/20 bg-ios-blue/10 text-ios-blue dark:bg-ios-blue/20",
    solid: "bg-ios-blue text-white",
  },
  green: {
    subtle: "border border-ios-green/20 bg-ios-green/10 text-ios-green dark:bg-ios-green/20",
    solid: "bg-ios-green text-white",
  },
  red: {
    subtle: "border border-ios-red/20 bg-ios-red/10 text-ios-red dark:bg-ios-red/20",
    solid: "bg-ios-red text-white",
  },
  orange: {
    subtle: "border border-ios-orange/20 bg-ios-orange/10 text-ios-orange dark:bg-ios-orange/20",
    solid: "bg-ios-orange text-white",
  },
  purple: {
    subtle: "border border-ios-purple/20 bg-ios-purple/10 text-ios-purple dark:bg-ios-purple/20",
    solid: "bg-ios-purple text-white",
  },
  teal: {
    subtle: "border border-ios-teal/20 bg-ios-teal/10 text-ios-teal dark:bg-ios-teal/20",
    solid: "bg-ios-teal text-white",
  },
  gray: {
    subtle: "border border-ios-separator/60 bg-ios-surface-tertiary/60 text-ios-label-secondary",
    solid: "bg-ios-surface-tertiary text-ios-label",
  },
};

export function Badge({
  className,
  color = "blue",
  variant = "subtle",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 whitespace-nowrap items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight shadow-2xs backdrop-blur-xs select-none",
        colorClasses[color][variant],
        className,
      )}
      {...props}
    />
  );
}
