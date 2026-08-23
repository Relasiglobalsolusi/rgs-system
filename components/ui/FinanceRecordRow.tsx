import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Shared finance / directory card row.
 *
 * type chip | title | status chip | amount
 *
 * One CSS grid so every row’s chips line up in the same vertical columns.
 * Column gap is equal (type↔title === status↔amount). Do not cluster
 * status + amount in a flex pair.
 */
export const financeRecordRowClassName =
  "grid min-w-0 grid-cols-[minmax(4.5rem,max-content)_minmax(0,1fr)_minmax(5.25rem,5.75rem)_minmax(5.5rem,auto)] items-center gap-x-3 gap-y-1 px-3.5 py-2.5 md:gap-x-10 md:px-4 md:py-2";

export const financeListTypeChipClassName =
  "inline-flex h-7 min-h-7 w-auto min-w-0 items-center justify-center whitespace-nowrap rounded-md border px-2 text-center text-[0.625rem] font-semibold uppercase leading-none tracking-[0.04em]";

export const financeListStatusChipClassName =
  "inline-flex h-8 max-h-8 min-h-8 w-auto min-w-[4.75rem] items-center justify-center px-2.5 py-0 text-center text-[0.6875rem] leading-none";

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
        "flex min-w-0 flex-wrap items-center justify-center gap-1 text-center",
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
        "flex w-full items-center justify-center text-center",
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
        "text-right text-sm font-semibold leading-none tabular-nums tracking-tight text-text",
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
