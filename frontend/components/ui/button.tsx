import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_12px_28px_-16px_hsl(var(--primary)/0.9)] hover:-translate-y-0.5 hover:bg-primary/95",
        secondary: "border border-slate-200 bg-white/85 text-slate-700 hover:border-slate-300 hover:bg-white",
        outline:
          "border border-slate-300 bg-white/70 text-slate-900 shadow-[0_8px_20px_-16px_rgba(15,23,42,0.65)] hover:border-slate-400 hover:bg-white",
        ghost: "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900",
        destructive:
          "bg-red-600 text-white shadow-[0_12px_24px_-16px_rgba(220,38,38,0.8)] hover:-translate-y-0.5 hover:bg-red-700"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-6 text-sm"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
