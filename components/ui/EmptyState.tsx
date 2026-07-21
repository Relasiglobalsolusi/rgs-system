"use client";

import { Inbox } from "lucide-react";

import { useT } from "@/lib/i18n/use-t";
import type { TranslateParams } from "@/lib/i18n/translate";

type EmptyStateProps = {
  /** Plain title (used when titleKey is omitted). */
  title?: string;
  /** Plain description (used when descriptionKey is omitted). */
  description?: string;
  /** Message key — preferred for server pages so locale switches work. */
  titleKey?: string;
  descriptionKey?: string;
  titleParams?: TranslateParams;
  descriptionParams?: TranslateParams;
};

export default function EmptyState({
  title,
  description,
  titleKey,
  descriptionKey,
  titleParams,
  descriptionParams,
}: EmptyStateProps) {
  const { t } = useT();
  const resolvedTitle = titleKey ? t(titleKey, titleParams) : (title ?? "");
  const resolvedDescription = descriptionKey
    ? t(descriptionKey, descriptionParams)
    : (description ?? "");

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-accent-cyan/25 bg-card px-8 py-16 text-center sm:px-10">
      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-elevated text-accent-cyan">
        <Inbox size={26} />
      </div>

      <h3 className="mt-5 text-lg font-semibold tracking-tight text-text">
        {resolvedTitle}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-muted">
        {resolvedDescription}
      </p>
    </div>
  );
}
