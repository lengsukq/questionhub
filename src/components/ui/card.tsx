import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "solid" | "interactive";
}

export function Card({
  className,
  variant = "glass",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "relative rounded-[24px] transition-all duration-200",
        variant === "glass" && "glass-card",
        variant === "solid" &&
          "border border-ios-separator/60 bg-ios-surface-solid shadow-sm",
        variant === "interactive" &&
          "glass-card cursor-pointer hover:border-ios-blue/30 hover:shadow-lg hover:shadow-ios-blue/5 active:scale-[0.99]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between px-5 pt-5 pb-1", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-[16px] font-bold tracking-tight text-ios-label lg:text-[17px]",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-[13px] text-ios-label-secondary", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-3", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between px-5 pb-5 pt-1", className)}
      {...props}
    />
  );
}
