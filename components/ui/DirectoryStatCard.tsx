"use client";

import type { KeyboardEvent, ReactNode } from "react";
import Link from "next/link";

import {
  cardTintIcon,
  cardTintWash,
  cardTintWashSelected,
  type CardTintAccent,
} from "@/components/ui/card-tint";
import { cn } from "@/lib/utils";

type DirectoryStatAccent = CardTintAccent;

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
  /** Center title, value, and icon. Used on Expenses. */
  align?: "start" | "center";
  /** Soft tint at the Goods Catalog level. On by default so every page matches. */
  tinted?: boolean;
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
  align = "start",
  tinted = true,
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
        "min-w-0 overflow-hidden rounded-2xl border border-border bg-card transition duration-300",
        compact ? "px-3.5 py-2.5" : featured ? "px-6 py-5" : "px-5 py-4",
        interactive &&
          "motion-hover-lift cursor-pointer hover:border-border-strong hover:bg-card-hover",
        tinted &&
          (selected ? cardTintWashSelected[accent] : cardTintWash[accent]),
        className
      )}
      onClick={href ? undefined : onClick}
      onKeyDown={!href && interactive ? handleKeyDown : undefined}
      role={!href && interactive ? "button" : undefined}
      tabIndex={!href && interactive ? 0 : undefined}
      aria-pressed={!href && onClick ? selected : undefined}
    >
      <div
        className={cn(
          align === "center"
            ? "flex flex-col items-center text-center"
            : "flex items-start justify-between gap-2.5"
        )}
      >
        {align === "center" && icon ? (
          <div
            className={cn(
              "mb-2 flex shrink-0 items-center justify-center rounded-md",
              compact ? "h-8 w-8" : featured ? "h-11 w-11" : "h-10 w-10",
              cardTintIcon[accent]
            )}
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-semibold text-subtle",
              compact ? "text-xs" : "text-[11px]"
            )}
            title={title}
          >
            {title}
          </p>
          <p
            className={cn(
              "font-bold tabular-nums tracking-tight break-words",
              "text-text",
              compact
                ? "mt-1 text-lg leading-tight sm:text-xl xl:text-2xl"
                : featured
                  ? "mt-2 text-2xl leading-tight sm:text-3xl xl:text-4xl"
                  : "mt-2 text-xl leading-tight sm:text-2xl xl:text-3xl"
            )}
            title={valueText}
          >
            {value}
          </p>
          {subtitle ? (
            <p
              className={cn(
                "text-pretty text-subtle",
                compact ? "mt-0.5 text-xs leading-snug" : "mt-1 text-xs leading-snug"
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {align !== "center" && icon ? (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md",
              compact ? "h-8 w-8" : featured ? "h-11 w-11" : "h-10 w-10",
              cardTintIcon[accent]
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
