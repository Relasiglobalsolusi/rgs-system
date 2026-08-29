import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Shared finance card row: title | leftover | status | amount.
 * No type-chip column — status stays in its own centered track.
 */
export const financeRecordListClassName = "flex min-w-0 flex-col gap-2";

const financeRecordRowClassName =
  "grid min-h-[4.25rem] min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 md:gap-x-8 md:px-4 md:py-2";
const financeRecordRowWithStatusClassName =
  "md:grid-cols-[minmax(0,1fr)_8.75rem_7.5rem]";
const financeRecordRowAmountOnlyClassName =
  "md:grid-cols-[minmax(0,1fr)_7.5rem]";

export const financeListStatusChipClassName =
  "box-border inline-flex h-auto min-h-8 w-fit min-w-0 max-w-full shrink-0 items-center justify-center px-2.5 py-1.5 text-center text-[0.625rem] leading-none md:min-w-[7.5rem] md:px-3 md:text-[0.6875rem]";

function FinanceRecordTitleCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("col-start-1 row-start-1 min-w-0 text-left", className)}>
      {children}
    </div>
  );
}

function FinanceRecordStatusCell({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "col-span-2 row-start-2 flex w-fit max-w-full min-w-0 items-center justify-start text-center md:col-span-1 md:col-start-2 md:row-start-1 md:w-full md:justify-center",
        className
      )}
    >
      {children}
    </div>
  );
}

function FinanceRecordAmountCell({
  children,
  className,
  hasStatus,
}: {
  children: ReactNode;
  className?: string;
  hasStatus: boolean;
}) {
  return (
    <div
      className={cn(
        "col-start-2 row-start-1 w-full min-w-0 text-right text-[0.8125rem] font-semibold leading-none tabular-nums tracking-tight text-text md:text-sm",
        hasStatus ? "md:col-start-3" : "md:col-start-2",
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
  const hasStatus = status != null && status !== false && status !== "";

  const inner = (
    <>
      <FinanceRecordTitleCell>{title}</FinanceRecordTitleCell>
      {hasStatus ? (
        <FinanceRecordStatusCell>{status}</FinanceRecordStatusCell>
      ) : null}
      <FinanceRecordAmountCell hasStatus={hasStatus}>
        {amount}
      </FinanceRecordAmountCell>
    </>
  );

  const rowClass = cn(
    financeRecordRowClassName,
    hasStatus
      ? financeRecordRowWithStatusClassName
      : financeRecordRowAmountOnlyClassName,
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
