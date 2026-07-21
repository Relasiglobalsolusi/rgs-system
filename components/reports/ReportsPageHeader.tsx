"use client";

import { useT } from "@/lib/i18n/use-t";

type Props = {
  periodLabel: string;
  projectCount: number;
  hasFilters: boolean;
};

export default function ReportsPageHeader({
  periodLabel,
  projectCount,
  hasFilters,
}: Props) {
  const { t } = useT();
  return (
    <div className="min-w-0">
      <h2 className="text-lg font-semibold text-text">
        {t("pages.reports.reportFor", { period: periodLabel })}
      </h2>
      <p className="mt-1 text-xs text-subtle">
        {t(
          projectCount === 1
            ? "pages.reports.projectOne"
            : "pages.reports.projectOther",
          { count: projectCount }
        )}
        {hasFilters ? ` ${t("pages.reports.matchingFilters")}` : ""}
      </p>
    </div>
  );
}
