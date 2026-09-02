import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 select-none disabled:pointer-events-none disabled:opacity-45 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ios-blue/50 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-ios-blue to-ios-blue-hover text-white shadow-lg shadow-ios-blue/25 hover:shadow-xl hover:shadow-ios-blue/30 active:opacity-95 border border-white/20",
        green:
          "bg-gradient-to-r from-ios-green to-emerald-600 text-white shadow-lg shadow-ios-green/25 hover:shadow-xl hover:shadow-ios-green/30 active:opacity-95 border border-white/20",
        red:
          "bg-gradient-to-r from-ios-red to-rose-600 text-white shadow-lg shadow-ios-red/25 hover:shadow-xl hover:shadow-ios-red/30 active:opacity-95 border border-white/20",
        secondary:
          "border border-white/70 bg-ios-surface text-ios-label shadow-sm hover:border-ios-blue/30 hover:bg-ios-surface-secondary dark:border-white/10 dark:bg-ios-surface/60",
        glass:
          "border border-white/60 bg-ios-surface/70 backdrop-blur-md text-ios-label hover:bg-ios-surface shadow-sm dark:border-white/10 dark:bg-ios-surface/50",
        outline:
          "border-2 border-ios-blue/40 bg-transparent text-ios-blue hover:bg-ios-blue/10 active:bg-ios-blue/20",
        ghost:
          "bg-transparent text-ios-label hover:bg-ios-surface-secondary/70 active:bg-ios-surface-tertiary",
      },
      size: {
        default: "h-12 px-5 text-[15px] rounded-2xl",
        sm: "h-9 px-3.5 text-[13px] rounded-xl",
        lg: "h-14 px-7 text-[16px] rounded-[20px]",
        icon: "h-10 w-10 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      type = "button",
      loading = false,
      loadingText,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const iconSize = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading}
        className={cn(
          buttonVariants({ variant, size }),
          loading && "opacity-80 cursor-wait",
          className,
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className={cn("animate-spin shrink-0", iconSize)} />
            {loadingText ? <span>{loadingText}</span> : children}
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
