"use client";

import type { ReactNode } from "react";

import ApprovalActions from "@/components/approvals/ApprovalActions";
import LeaveTypeLabel from "@/components/leaves/LeaveTypeLabel";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import UploadedFilesLink from "@/components/ui/UploadedFilesLink";
import { formatDisplayDate } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";

export type PendingLeaveRow = {
  id: string;
  type: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: string;
  proofUrl: string | null;
  employee: { firstName: string; lastName: string; employeeNo: string };
};

type Props = {
  data: PendingLeaveRow[];
};

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="min-w-0">
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-text">{value}</dd>
    </div>
  );
}

export default function PendingLeaveCards({ data }: Props) {
  const { t } = useT();

  return (
    <div className="space-y-4">
      {data.map((row) => (
        <SectionCard key={row.id} className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h3 className="text-base font-semibold tracking-tight text-text">
                {row.employee.firstName} {row.employee.lastName}
              </h3>
              <p className="text-sm text-subtle">{row.employee.employeeNo}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={row.type === "SICK" ? "warning" : "active"}
                compact
              >
                <LeaveTypeLabel type={row.type} />
              </StatusBadge>
            </div>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetaRow
              label={t("pages.approvals.period")}
              value={
                <span>
                  {formatDisplayDate(row.startDate)} –{" "}
                  {formatDisplayDate(row.endDate)}
                </span>
              }
            />
            <MetaRow
              label={t("pages.approvals.columns.reason")}
              value={row.reason}
            />
            <MetaRow
              label={t("pages.approvals.proof")}
              value={
                row.proofUrl ? (
                  <UploadedFilesLink value={row.proofUrl} />
                ) : (
                  <span className="text-muted">-</span>
                )
              }
            />
          </dl>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
            <ApprovalActions id={row.id} type={row.type} />
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
