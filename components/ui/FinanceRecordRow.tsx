import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Shared finance card row.
 *
 * type chip | title | status chip | amount
 *
 * Tracks are fixed (except the title) so every card uses the same columns.
 * Status chips fill that column and center their label — do not size the
 * chip to the word (PAID vs OVERDUE) or pair status + amount in a flex.
 */
export const financeRecordListClassName = "flex min-w-0 flex-col gap-2";

export const financeRecordRowClassName =
  "grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)_5.25rem_5.75rem] items-center gap-x-2 px-3 py-2.5 md:grid-cols-[6.25rem_minmax(0,1fr)_6.25rem_7.5rem] md:gap-x-8 md:px-4 md:py-2";

export const financeListTypeChipClassName =
  "inline-flex min-h-7 w-full min-w-0 items-center justify-center whitespace-normal rounded-md border px-1 py-1 text-center text-[0.5625rem] font-semibold uppercase leading-[1.1] tracking-[0.04em] md:min-h-7 md:px-2 md:text-[0.625rem]";

export const financeListStatusChipClassName =
  "box-border inline-flex h-8 max-h-8 min-h-8 w-full min-w-0 max-w-full items-center justify-center px-1 py-0 text-center text-[0.625rem] leading-none md:px-2 md:text-[0.6875rem]";

export function FinanceRecordTypeCell({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full min-w-0 flex-col flex-wrap items-center justify-center gap-1 text-center",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FinanceRecordTitleCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0", className)}>{children}</div>;
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
  type: ReactNode;
  title: ReactNode;
  status: ReactNode;
  amount: ReactNode;
  href?: string;
  className?: string;
};

export default function FinanceRecordRow({
  type,
  title,
  status,
  amount,
  href,
  className,
}: FinanceRecordRowProps) {
  const inner = (
    <>
      <FinanceRecordTypeCell>{type}</FinanceRecordTypeCell>
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
