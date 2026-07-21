"use client";

import { useT } from "@/lib/i18n/use-t";

/** Localized h2 + description block used above directory modules. */
export default function PageIntro({
  titleKey,
  descriptionKey,
}: {
  titleKey: string;
  descriptionKey: string;
}) {
  const { t } = useT();
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-text">{t(titleKey)}</h2>
      <p className="mt-1 text-sm text-muted">{t(descriptionKey)}</p>
    </div>
  );
}
