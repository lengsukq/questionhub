import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-2xl border border-ios-separator/70 bg-ios-surface/80 p-4 text-[15px] leading-relaxed text-ios-label placeholder:text-ios-label-tertiary backdrop-blur-md shadow-inner transition-all duration-200 focus:border-ios-blue focus:bg-ios-surface focus:outline-none focus:ring-4 focus:ring-ios-blue/15 dark:border-white/10 dark:bg-ios-surface/40 dark:focus:bg-ios-surface/80",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
