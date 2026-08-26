"use client";

import type { ReactNode } from "react";

import {
  cardTintIcon,
  cardTintWash,
  type CardTintAccent,
} from "@/components/ui/card-tint";
import { useT } from "@/lib/i18n/use-t";
import type { TranslateParams } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  labelKey?: string;
  labelParams?: TranslateParams;
  value: string | number;
  hint?: string;
  hintKey?: string;
  hintParams?: TranslateParams;
  icon: ReactNode;
  accent?: CardTintAccent;
};

export default function DashboardCompactStat({
  label,
  labelKey,
  labelParams,
  value,
  hint,
  hintKey,
  hintParams,
  icon,
  accent = "primary",
}: Props) {
  const { t } = useT();
  const resolvedLabel = labelKey ? t(labelKey, labelParams) : (label ?? "");
  const resolvedHint = hintKey ? t(hintKey, hintParams) : hint;

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3.5 sm:px-5 sm:py-4",
        cardTintWash[accent]
      )}
    >
      <div className="flex items-center justify-between gap-3 lg:items-start">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-subtle lg:text-xs lg:tracking-wider">
            {resolvedLabel}
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-text sm:mt-2 sm:text-3xl">
            {value}
          </p>
          {resolvedHint && (
            <p className="mt-1 text-xs leading-snug text-subtle">{resolvedHint}</p>
          )}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md sm:h-10 sm:w-10",
            cardTintIcon[accent]
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
