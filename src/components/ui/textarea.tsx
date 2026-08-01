import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-xl border border-ios-separator bg-ios-background px-3.5 py-3 text-[16px] leading-relaxed text-ios-label placeholder:text-ios-label-tertiary focus:border-ios-blue focus:outline-none dark:bg-ios-surface-tertiary",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
