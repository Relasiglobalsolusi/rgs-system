"use client";

import { Clock } from "lucide-react";

import type { ProgressEarlyCheckOutRow } from "@/app/progress/actions";
import { formatDisplayDate, formatDisplayTime } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  selectedDate: string;
  viewMode?: "day" | "month";
  dayRows: ProgressEarlyCheckOutRow[];
  monthRows: ProgressEarlyCheckOutRow[];
};

function EarlyRow({ row }: { row: ProgressEarlyCheckOutRow }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/70 py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="font-medium text-text">{row.employeeName}</p>
        <p className="text-xs text-subtle">{row.employeeNo}</p>
      </div>
      <p className="text-xs tabular-nums text-muted">
        {formatDisplayDate(row.date, { timeZone: "UTC" })}
        {" · "}
        {formatDisplayTime(row.checkOut)}
        {row.shiftEnd ? ` · ${row.shiftEnd}` : ""}
      </p>
    </li>
  );
}

export default function ProgressEarlyCheckoutBanner({
  selectedDate,
  viewMode = "day",
  dayRows,
  monthRows,
}: Props) {
  const { t } = useT();
  const monthView = viewMode === "month";
  const primaryRows = monthView ? monthRows : dayRows;

  return (
    <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-4">
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">
            {t("pages.progress.earlyCheckoutTitle")}
          </h3>
          <p className="mt-1 text-xs text-muted">
            {t("pages.progress.earlyCheckoutDesc")}
          </p>
        </div>
      </div>

      {primaryRows.length === 0 ? (
        <p className="mt-3 text-sm text-subtle">
          {t(
            monthView
              ? "pages.progress.earlyCheckoutEmptyMonth"
              : "pages.progress.earlyCheckoutEmptyDay"
          )}
        </p>
      ) : (
        <ul className="mt-3">
          {primaryRows.map((row) => (
            <EarlyRow key={row.id} row={row} />
          ))}
        </ul>
      )}
      <p className="sr-only">{selectedDate}</p>
    </section>
  );
}
