"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type FinancialKpiAccent =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

const iconTone: Record<FinancialKpiAccent, string> = {
  primary: "text-primary",
  success: "text-primary",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-accent-teal",
  muted: "text-accent-slate",
};

type BoardProps = {
  children: ReactNode;
  className?: string;
};

type RowProps = {
  children: ReactNode;
  className?: string;
  columnsClassName?: string;
};

/** Compact finance snapshot — one panel, hairline grid, no tall cards. */
export function FinancialKpiBoard({
  children,
  className,
}: BoardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-border",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FinancialKpiRow({
  children,
  className,
  columnsClassName = "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5",
}: RowProps) {
  return (
    <div className={cn("grid gap-px", columnsClassName, className)}>
      {children}
    </div>
  );
}

type CellProps = {
  title: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  accent?: FinancialKpiAccent;
  href?: string;
};

export function FinancialKpiCell({
  title,
  value,
  hint,
  icon,
  accent = "muted",
  href,
}: CellProps) {
  const valueText = String(value);
  const inner = (
    <div
      className={cn(
        "flex h-full min-h-[4.25rem] flex-col justify-center overflow-hidden bg-card px-2.5 py-2 sm:px-3 sm:py-2.5",
        href && "transition hover:bg-card-hover"
      )}
      title={hint ?? title}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
          {title}
        </p>
        {icon ? (
          <span className={cn("mt-0.5 shrink-0", iconTone[accent])}>{icon}</span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1.5 break-words text-sm font-bold leading-tight tabular-nums tracking-tight text-text sm:text-base xl:text-lg",
          accent === "danger" && "text-danger"
        )}
      >
        {valueText}
      </p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="min-w-0 bg-card">
        {inner}
      </Link>
    );
  }

  return inner;
}
