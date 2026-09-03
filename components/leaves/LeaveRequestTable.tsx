"use client";

import { useMemo } from "react";

import LeaveTypeLabel from "@/components/leaves/LeaveTypeLabel";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import UploadedFilesLink from "@/components/ui/UploadedFilesLink";
import StatusBadge from "@/components/ui/StatusBadge";
import { STATUS_COLUMN_WIDTH } from "@/components/ui/trash-action-buttons";
import { formatDisplayDate } from "@/lib/format-date";
import { localizeLeaveStatus } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";

export type LeaveRequestRow = {
  id: string;
  type: string;
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
  status: string;
  proofUrl: string | null;
  employee: { firstName: string; lastName: string };
};

type Props = {
  data: LeaveRequestRow[];
  showEmployee: boolean;
  hideType?: boolean;
};

export default function LeaveRequestTable({
  data,
  showEmployee,
  hideType = false,
}: Props) {
  const { t, locale } = useT();

  const columns = useMemo(() => {
    const cols: DataTableColumn<LeaveRequestRow>[] = [
      ...(showEmployee
        ? [
            {
              key: "employee",
              title: t("common.labels.employee"),
              width: "10rem",
              share: 1,
              className: "min-w-[10rem]",
              render: (row: LeaveRequestRow) => (
                <span className="font-medium text-text">
                  {row.employee.firstName} {row.employee.lastName}
                </span>
              ),
            } satisfies DataTableColumn<LeaveRequestRow>,
          ]
        : []),
      ...(!hideType
        ? [
            {
              key: "type",
              title: t("pages.leaves.columns.type"),
              width: STATUS_COLUMN_WIDTH,
              cellAlign: "center" as const,
              className: "min-w-[10rem] overflow-visible whitespace-nowrap",
              render: (row: LeaveRequestRow) => (
                <StatusBadge status={row.type === "SICK" ? "warning" : "active"}>
                  <LeaveTypeLabel type={row.type} />
                </StatusBadge>
              ),
            } satisfies DataTableColumn<LeaveRequestRow>,
          ]
        : []),
      {
        key: "dates",
        title: t("pages.leaves.period"),
        width: "14rem",
        className: "min-w-[14rem] whitespace-nowrap",
        render: (row) => (
          <span className="text-text">
            {formatDisplayDate(row.startDate)} –{" "}
            {formatDisplayDate(row.endDate)}
          </span>
        ),
      },
      {
        key: "reason",
        title: t("pages.leaves.columns.reason"),
        share: 2,
        render: (row) => (
          <span className="min-w-0 text-sm leading-6 text-text">{row.reason}</span>
        ),
      },
      {
        key: "status",
        title: t("pages.leaves.columns.status"),
        width: STATUS_COLUMN_WIDTH,
        cellAlign: "center",
        className: "min-w-[10rem] overflow-visible whitespace-nowrap",
        render: (row) => (
          <StatusBadge
            status={
              row.status === "APPROVED"
                ? "success"
                : row.status === "REJECTED"
                  ? "danger"
                  : "warning"
            }
          >
            {localizeLeaveStatus(row.status, locale)}
          </StatusBadge>
        ),
      },
      {
        key: "proof",
        title: t("pages.leaves.proof"),
        width: STATUS_COLUMN_WIDTH,
        cellAlign: "center",
        className: "min-w-[10rem] whitespace-nowrap",
        render: (row) =>
          row.proofUrl ? (
            <UploadedFilesLink value={row.proofUrl} />
          ) : (
            <span className="text-muted">-</span>
          ),
      },
    ];
    return cols;
  }, [hideType, locale, showEmployee, t]);

  return (
    <DataTable columns={columns} data={data} getRowKey={(row) => row.id} />
  );
}
