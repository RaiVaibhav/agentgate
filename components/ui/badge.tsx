import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300",
        warning:
          "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300",
        info:
          "border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300",
        genai:
          "border-purple-200 bg-purple-50 text-purple-900 shadow-xs dark:bg-purple-950/60 dark:border-purple-800 dark:text-purple-300",
        terminal:
          "font-mono border-zinc-700 bg-zinc-900 text-emerald-400 shadow-xs dark:bg-zinc-950 dark:border-zinc-800",
        ai:
          "border-indigo-200 bg-linear-to-r from-indigo-50 to-purple-50 text-indigo-900 shadow-xs dark:from-indigo-950/40 dark:to-purple-950/40 dark:border-indigo-800 dark:text-indigo-300",
      },

    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
