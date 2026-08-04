"use client";

import LeaveTypeLabel from "@/components/leaves/LeaveTypeLabel";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDisplayDate } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";

export type OwnPendingLeaveRow = {
  id: string;
  type: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: string;
};

type Props = {
  data: OwnPendingLeaveRow[];
};

export default function OwnPendingLeaveNotice({ data }: Props) {
  const { t } = useT();
  if (data.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <p className="text-sm font-semibold text-text">
        {t("pages.approvals.ownPendingTitle")}
      </p>
      <p className="mt-1 text-sm text-subtle">
        {t("pages.approvals.ownPendingDesc")}
      </p>
      <ul className="mt-3 space-y-2">
        {data.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/60 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={row.type === "SICK" ? "warning" : "active"}
                  compact
                >
                  <LeaveTypeLabel type={row.type} />
                </StatusBadge>
                <StatusBadge status="pending" compact>
                  {t("pages.approvals.statusPending")}
                </StatusBadge>
              </div>
              <p className="mt-1.5 text-sm text-muted">
                {formatDisplayDate(row.startDate)} –{" "}
                {formatDisplayDate(row.endDate)}
                {row.reason ? ` · ${row.reason}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
