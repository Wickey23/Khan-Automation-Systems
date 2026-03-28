import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-slate-900 text-white hover:bg-slate-800",
        secondary: "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
        outline: "border border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50",
        ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        destructive: "bg-red-600 text-white hover:bg-red-700"
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-5 text-sm"
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
