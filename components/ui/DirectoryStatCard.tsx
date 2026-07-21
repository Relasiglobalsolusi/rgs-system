"use client";

import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

type DirectoryStatAccent =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "indigo"
  | "muted";

const accentIcon: Record<DirectoryStatAccent, string> = {
  primary: "bg-elevated text-primary",
  success: "bg-elevated text-primary",
  warning: "bg-elevated text-warning",
  danger: "bg-elevated text-danger",
  info: "bg-elevated text-accent-teal",
  // Legacy alias — maps to the single cool info accent (no indigo rainbow).
  indigo: "bg-elevated text-accent-teal",
  muted: "bg-elevated text-accent-slate",
};

const accentSelected: Record<DirectoryStatAccent, string> = {
  primary: "border-primary/35 bg-card-tint-emerald",
  success: "border-primary/35 bg-card-tint-emerald",
  warning: "border-warning/40 bg-card-tint-amber",
  danger: "border-danger/40 bg-card-tint-red",
  info: "border-accent-cyan/40 bg-card-tint-cyan",
  indigo: "border-accent-cyan/40 bg-card-tint-cyan",
  muted: "border-accent-slate/40 bg-card-tint-slate",
};

type DirectoryStatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  accent?: DirectoryStatAccent;
  className?: string;
  /** When set, the card becomes a button that filters the directory. */
  onClick?: () => void;
  selected?: boolean;
  /**
   * Denser padding/type for multi-row stat grids (e.g. User Accounts 3×2).
   * Other directories keep the default roomier card unless they opt in.
   */
  compact?: boolean;
};

export default function DirectoryStatCard({
  title,
  value,
  subtitle,
  icon,
  accent = "primary",
  className,
  onClick,
  selected = false,
  compact = false,
}: DirectoryStatCardProps) {
  const interactive = Boolean(onClick);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card transition duration-300",
        compact ? "px-3.5 py-2.5" : "px-5 py-4",
        interactive &&
          "motion-hover-lift cursor-pointer hover:border-border-strong hover:bg-card-hover",
        selected && accentSelected[accent],
        className
      )}
      onClick={onClick}
      onKeyDown={interactive ? handleKeyDown : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p
            className={cn(
              "font-semibold uppercase text-subtle",
              compact
                ? "text-xs tracking-[0.12em]"
                : "text-[11px] tracking-[0.16em]"
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "font-bold tabular-nums tracking-tight text-text",
              compact ? "mt-1 text-2xl leading-none" : "mt-2 text-3xl"
            )}
          >
            {value}
          </p>
          {subtitle ? (
            <p
              className={cn(
                "text-subtle",
                compact ? "mt-0.5 text-xs leading-snug" : "mt-1 text-xs"
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {icon ? (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md",
              compact ? "h-8 w-8" : "h-10 w-10",
              accentIcon[accent]
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
