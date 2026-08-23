import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Shared finance card row: title | leftover | status | amount.
 * No type-chip column — status stays in its own centered track.
 */
export const financeRecordListClassName = "flex min-w-0 flex-col gap-2";

export const financeRecordRowClassName =
  "grid min-w-0 grid-cols-[minmax(0,1fr)_5.25rem_5.75rem] items-center gap-x-2 px-3 py-2.5 md:grid-cols-[minmax(0,1fr)_6.25rem_7.5rem] md:gap-x-8 md:px-4 md:py-2";

export const financeListStatusChipClassName =
  "box-border inline-flex h-8 max-h-8 min-h-8 w-full min-w-0 max-w-full items-center justify-center px-1 py-0 text-center text-[0.625rem] leading-none md:px-2 md:text-[0.6875rem]";

export function FinanceRecordTitleCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 text-left", className)}>{children}</div>;
}

export function FinanceRecordStatusCell({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full min-w-0 items-center justify-center text-center",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FinanceRecordAmountCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full min-w-0 text-right text-[0.8125rem] font-semibold leading-none tabular-nums tracking-tight text-text md:text-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

type FinanceRecordRowProps = {
  title: ReactNode;
  status: ReactNode;
  amount: ReactNode;
  href?: string;
  className?: string;
};

export default function FinanceRecordRow({
  title,
  status,
  amount,
  href,
  className,
}: FinanceRecordRowProps) {
  const inner = (
    <>
      <FinanceRecordTitleCell>{title}</FinanceRecordTitleCell>
      <FinanceRecordStatusCell>{status}</FinanceRecordStatusCell>
      <FinanceRecordAmountCell>{amount}</FinanceRecordAmountCell>
    </>
  );

  const rowClass = cn(
    financeRecordRowClassName,
    "transition hover:bg-card-hover/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/40",
    className
  );

  if (href) {
    return (
      <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-elevated">
        <Link href={href} className={rowClass}>
          {inner}
        </Link>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-border bg-elevated",
        rowClass
      )}
    >
      {inner}
    </article>
  );
}
