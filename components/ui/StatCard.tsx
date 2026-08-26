"use client";

import { ReactNode } from "react";

import {
  cardTintIcon,
  cardTintWash,
  type CardTintAccent,
} from "@/components/ui/card-tint";
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

const accentToTint: Record<StatCardAccent, CardTintAccent> = {
  emerald: "success",
  amber: "warning",
  cyan: "info",
  sky: "info",
  teal: "primary",
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
  const tint = accentToTint[accent];
  const resolvedTitle = titleKey ? t(titleKey, titleParams) : (title ?? "");
  const resolvedSubtitle = subtitleKey
    ? t(subtitleKey, subtitleParams)
    : subtitle;
  const valueText = String(value);

  return (
    <div
      className={cn(
        "motion-hover-lift rounded-2xl border p-4 shadow-[0_12px_28px_-22px_rgba(0,0,0,0.5)] sm:p-5 lg:p-6",
        cardTintWash[tint]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle lg:text-[11px] lg:tracking-[0.16em]">
            {resolvedTitle}
          </p>

          <h2
            className="mt-2 truncate text-2xl font-bold tracking-tight tabular-nums text-text sm:mt-3 sm:text-3xl lg:text-4xl"
            title={valueText}
          >
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
              cardTintIcon[tint]
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
