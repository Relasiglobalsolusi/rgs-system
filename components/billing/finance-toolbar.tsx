import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Matches `employeeSelectTriggerClass` so period actions sit flush with selects. */
export const financeToolbarActionClass =
  "box-border inline-flex h-11 min-h-11 max-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border-strong bg-elevated px-4 py-0 text-sm font-semibold text-text shadow-none hover:border-primary/45 hover:bg-card-hover";

/** Filled primary download action, same height as the period selects. */
export const financeToolbarPrimaryActionClass = cn(
  buttonVariants({ variant: "default" }),
  "h-11 min-h-11 max-h-11 w-full shrink-0 justify-center rounded-xl px-4 gap-2 sm:w-auto"
);

export function FinancePeriodToolbar({
  label,
  children,
  action,
  className,
}: {
  label: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium text-subtle">{label}</p>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {children}
        {action ? (
          <div className="flex flex-wrap items-center justify-start gap-2">
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}
