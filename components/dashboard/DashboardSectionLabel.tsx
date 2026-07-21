"use client";

import { useT } from "@/lib/i18n/use-t";

type Props = {
  title?: string;
  titleKey?: string;
  description?: string;
  descriptionKey?: string;
};

export default function DashboardSectionLabel({
  title,
  titleKey,
  description,
  descriptionKey,
}: Props) {
  const { t } = useT();
  const resolvedTitle = titleKey ? t(titleKey) : (title ?? "");
  const resolvedDescription = descriptionKey
    ? t(descriptionKey)
    : description;

  return (
    <div className="mb-3 lg:mb-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle lg:text-sm lg:tracking-[0.18em]">
        {resolvedTitle}
      </h2>
      {resolvedDescription && (
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted lg:text-sm">
          {resolvedDescription}
        </p>
      )}
    </div>
  );
}
