"use client";

import type { KeyboardEvent, ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type DirectoryStatAccent =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

const accentIcon: Record<DirectoryStatAccent, string> = {
  primary: "bg-elevated text-primary",
  success: "bg-elevated text-primary",
  warning: "bg-elevated text-warning",
  danger: "bg-elevated text-danger",
  info: "bg-elevated text-accent-teal",
  muted: "bg-elevated text-accent-slate",
};

const accentSelected: Record<DirectoryStatAccent, string> = {
  primary: "border-primary/35 bg-card-tint-emerald",
  success: "border-primary/35 bg-card-tint-emerald",
  warning: "border-warning/40 bg-card-tint-amber",
  danger: "border-danger/40 bg-card-tint-red",
  info: "border-accent-cyan/40 bg-card-tint-cyan",
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
  href?: string;
  /**
   * Denser padding/type for multi-row stat grids (e.g. User Accounts 3×2).
   * Other directories keep the default roomier card unless they opt in.
   */
  compact?: boolean;
  /** Larger type for the two top Financial Report cards. */
  featured?: boolean;
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
  href,
  compact = false,
  featured = false,
}: DirectoryStatCardProps) {
  const interactive = Boolean(onClick || href);
  const valueText = String(value);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }

  const card = (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card transition duration-300",
        compact ? "px-3.5 py-2.5" : featured ? "px-6 py-5" : "px-5 py-4",
        interactive &&
          "motion-hover-lift cursor-pointer hover:border-border-strong hover:bg-card-hover",
        selected && accentSelected[accent],
        className
      )}
      onClick={href ? undefined : onClick}
      onKeyDown={!href && interactive ? handleKeyDown : undefined}
      role={!href && interactive ? "button" : undefined}
      tabIndex={!href && interactive ? 0 : undefined}
      aria-pressed={!href && onClick ? selected : undefined}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-semibold uppercase text-subtle",
              compact
                ? "text-xs tracking-[0.12em]"
                : "text-[11px] tracking-[0.16em]"
            )}
            title={title}
          >
            {title}
          </p>
          <p
            className={cn(
              "truncate font-bold tabular-nums tracking-tight text-text",
              compact
                ? "mt-1 text-lg leading-none sm:text-xl xl:text-2xl"
                : featured
                  ? "mt-2 text-2xl leading-none sm:text-3xl xl:text-4xl"
                  : "mt-2 text-xl leading-none sm:text-2xl xl:text-3xl"
            )}
            title={valueText}
          >
            {value}
          </p>
          {subtitle ? (
            <p
              className={cn(
                "truncate text-subtle",
                compact ? "mt-0.5 text-xs leading-snug" : "mt-1 text-xs"
              )}
              title={subtitle}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {icon ? (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md",
              compact ? "h-8 w-8" : featured ? "h-11 w-11" : "h-10 w-10",
              accentIcon[accent]
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block min-w-0">
        {card}
      </Link>
    );
  }
  return card;
}
