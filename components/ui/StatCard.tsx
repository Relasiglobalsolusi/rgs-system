"use client";

import { ReactNode } from "react";

import { useT } from "@/lib/i18n/use-t";
import type { TranslateParams } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

export type StatCardAccent = "emerald" | "amber" | "cyan" | "sky" | "teal";

type StatCardProps = {
  title?: string;
  titleKey?: string;
  titleParams?: TranslateParams;
  value: string | number;
  subtitle?: string;
  subtitleKey?: string;
  subtitleParams?: TranslateParams;
  icon?: ReactNode;
  /** Distinct color wash per metric type */
  accent?: StatCardAccent;
};

const accentStyles: Record<
  StatCardAccent,
  { card: string; icon: string; iconText: string }
> = {
  emerald: {
    card: "border-emerald-400/25 hover:border-emerald-400/40 bg-card-tint-emerald hover:bg-[color-mix(in_srgb,var(--color-card-tint-emerald),var(--color-card-hover)_35%)]",
    icon: "bg-elevated text-emerald-700",
    iconText: "text-emerald-700",
  },
  amber: {
    card: "border-amber-400/25 hover:border-amber-400/40 bg-card-tint-amber hover:bg-[color-mix(in_srgb,var(--color-card-tint-amber),var(--color-card-hover)_35%)]",
    icon: "bg-elevated text-amber-700",
    iconText: "text-amber-700",
  },
  cyan: {
    card: "border-accent-cyan/30 hover:border-accent-cyan/45 bg-card-tint-cyan hover:bg-[color-mix(in_srgb,var(--color-card-tint-cyan),var(--color-card-hover)_35%)]",
    icon: "bg-elevated text-accent-cyan",
    iconText: "text-accent-cyan",
  },
  sky: {
    card: "border-accent-blue/30 hover:border-accent-blue/45 bg-card-tint-sky hover:bg-[color-mix(in_srgb,var(--color-card-tint-sky),var(--color-card-hover)_35%)]",
    icon: "bg-elevated text-accent-blue",
    iconText: "text-accent-blue",
  },
  teal: {
    card: "border-primary/30 hover:border-primary/45 bg-card-tint-teal hover:bg-[color-mix(in_srgb,var(--color-card-tint-teal),var(--color-card-hover)_35%)]",
    icon: "bg-elevated text-primary",
    iconText: "text-primary",
  },
};

export default function StatCard({
  title,
  titleKey,
  titleParams,
  value,
  subtitle,
  subtitleKey,
  subtitleParams,
  icon,
  accent = "cyan",
}: StatCardProps) {
  const { t } = useT();
  const styles = accentStyles[accent];
  const resolvedTitle = titleKey ? t(titleKey, titleParams) : (title ?? "");
  const resolvedSubtitle = subtitleKey
    ? t(subtitleKey, subtitleParams)
    : subtitle;

  return (
    <div
      className={cn(
        "motion-hover-lift rounded-2xl border p-4 shadow-[0_12px_28px_-22px_rgba(0,0,0,0.5)] sm:p-5 lg:p-6",
        styles.card
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle lg:text-[11px] lg:tracking-[0.16em]">
            {resolvedTitle}
          </p>

          <h2 className="mt-2 text-[1.75rem] font-bold tracking-tight tabular-nums text-text sm:mt-3 sm:text-3xl lg:text-4xl">
            {value}
          </h2>

          {resolvedSubtitle && (
            <p className="mt-1 text-xs leading-snug text-muted sm:mt-1.5 sm:text-sm">
              {resolvedSubtitle}
            </p>
          )}
        </div>

        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-md sm:h-12 sm:w-12",
              styles.icon,
              styles.iconText
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
