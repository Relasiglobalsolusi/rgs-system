import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Matches `employeeSelectTriggerClass` so period actions sit flush with selects. */
export const financeToolbarActionClass =
  "box-border inline-flex h-11 min-h-11 max-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border-strong bg-elevated px-4 py-0 text-sm font-semibold text-text shadow-none hover:border-primary/45 hover:bg-card-hover";

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
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {action}
      </div>
    </div>
  );
}
