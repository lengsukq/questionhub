import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 select-none disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ios-blue/50",
  {
    variants: {
      variant: {
        primary: "bg-ios-blue text-white shadow-sm shadow-ios-blue/30 active:bg-ios-blue/90",
        green: "bg-ios-green text-white shadow-sm shadow-ios-green/30 active:bg-ios-green/90",
        red: "bg-ios-red text-white shadow-sm shadow-ios-red/30 active:bg-ios-red/90",
        secondary:
          "bg-ios-surface-tertiary text-ios-label dark:bg-ios-surface-secondary dark:text-white",
        outline: "border border-ios-blue/40 bg-transparent text-ios-blue",
        ghost: "bg-transparent text-ios-blue active:bg-ios-blue/10",
      },
      size: {
        default: "h-12 px-5 text-[17px] rounded-2xl",
        sm: "h-9 px-4 text-[15px] rounded-xl",
        icon: "h-10 w-10 rounded-full",
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
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
