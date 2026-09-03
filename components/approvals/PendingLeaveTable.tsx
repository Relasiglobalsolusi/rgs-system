"use client";

import { useMemo } from "react";

import ApprovalActions from "@/components/approvals/ApprovalActions";
import LeaveTypeLabel from "@/components/leaves/LeaveTypeLabel";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import UploadedFilesLink from "@/components/ui/UploadedFilesLink";
import StatusBadge from "@/components/ui/StatusBadge";
import { STATUS_COLUMN_WIDTH } from "@/components/ui/trash-action-buttons";
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

export default function PendingLeaveTable({ data }: Props) {
  const { t } = useT();

  const columns = useMemo<DataTableColumn<PendingLeaveRow>[]>(
    () => [
      {
        key: "employee",
        title: t("pages.approvals.columns.employee"),
        width: "10rem",
        share: 2,
        render: (row) => (
          <div className="min-w-0">
            <p className="font-medium text-text">
              {row.employee.firstName} {row.employee.lastName}
            </p>
            <p className="text-sm text-subtle">{row.employee.employeeNo}</p>
          </div>
        ),
      },
      {
        key: "type",
        title: t("pages.approvals.columns.type"),
        width: STATUS_COLUMN_WIDTH,
        cellAlign: "center",
        render: (row) => (
          <StatusBadge status={row.type === "SICK" ? "warning" : "active"}>
            <LeaveTypeLabel type={row.type} />
          </StatusBadge>
        ),
      },
      {
        key: "dates",
        title: t("pages.approvals.period"),
        width: "12rem",
        render: (row) => (
          <span className="text-muted">
            {formatDisplayDate(row.startDate)} –{" "}
            {formatDisplayDate(row.endDate)}
          </span>
        ),
      },
      {
        key: "reason",
        title: t("pages.approvals.columns.reason"),
        share: 2,
        render: (row) => (
          <span className="min-w-0 text-sm leading-6 text-text">{row.reason}</span>
        ),
      },
      {
        key: "proof",
        title: t("pages.approvals.proof"),
        width: "5rem",
        cellAlign: "center",
        render: (row) =>
          row.proofUrl ? (
            <UploadedFilesLink value={row.proofUrl} />
          ) : (
            <span className="text-muted">-</span>
          ),
      },
      {
        key: "actions",
        title: t("common.labels.actions"),
        // Two 7.5rem chips + gap-2. Sick leave asks about deduction after Approve.
        width: "19rem",
        cellAlign: "center",
        render: (row) => <ApprovalActions id={row.id} type={row.type} />,
      },
    ],
    [t]
  );

  return <DataTable columns={columns} data={data} />;
}
