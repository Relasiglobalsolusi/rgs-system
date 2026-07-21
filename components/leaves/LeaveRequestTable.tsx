"use client";

import { useMemo, useState } from "react";

import LeaveTypeLabel from "@/components/leaves/LeaveTypeLabel";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import ProofLightbox from "@/components/ui/ProofLightbox";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDisplayDate } from "@/lib/format-date";
import { localizeLeaveStatus } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";

export type LeaveRequestRow = {
  id: string;
  type: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: string;
  proofUrl: string | null;
  employee: { firstName: string; lastName: string };
};

type Props = {
  data: LeaveRequestRow[];
  showEmployee: boolean;
};

export default function LeaveRequestTable({ data, showEmployee }: Props) {
  const { t, locale } = useT();
  const [proofSrc, setProofSrc] = useState<string | null>(null);

  const columns = useMemo(() => {
    const cols: DataTableColumn<LeaveRequestRow>[] = [
      ...(showEmployee
        ? [
            {
              key: "employee",
              title: t("common.labels.employee"),
              width: "10rem",
              className: "min-w-[10rem]",
              render: (row: LeaveRequestRow) => (
                <span className="text-text">
                  {row.employee.firstName} {row.employee.lastName}
                </span>
              ),
            } satisfies DataTableColumn<LeaveRequestRow>,
          ]
        : []),
      {
        key: "type",
        title: t("pages.leaves.columns.type"),
        width: "10rem",
        className: "min-w-[10rem] overflow-visible whitespace-nowrap text-center",
        render: (row) => (
          <StatusBadge status={row.type === "SICK" ? "warning" : "active"}>
            <LeaveTypeLabel type={row.type} />
          </StatusBadge>
        ),
      },
      {
        key: "dates",
        title: t("pages.leaves.period"),
        width: "12rem",
        className: "min-w-[12rem] whitespace-nowrap",
        render: (row) => (
          <span className="text-muted">
            {formatDisplayDate(row.startDate)} –{" "}
            {formatDisplayDate(row.endDate)}
          </span>
        ),
      },
      {
        key: "reason",
        title: t("pages.leaves.columns.reason"),
        render: (row) => (
          <span className="max-w-xs truncate text-subtle">{row.reason}</span>
        ),
      },
      {
        key: "status",
        title: t("pages.leaves.columns.status"),
        width: "10rem",
        className: "min-w-[10rem] overflow-visible whitespace-nowrap text-center",
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
        width: "5rem",
        className: "min-w-[5rem] whitespace-nowrap",
        render: (row) =>
          row.proofUrl ? (
            <button
              type="button"
              onClick={() => setProofSrc(row.proofUrl)}
              className="text-cyan-400 hover:underline"
            >
              {t("common.actions.view")}
            </button>
          ) : (
            <span className="text-muted">-</span>
          ),
      },
    ];
    return cols;
  }, [locale, showEmployee, t]);

  return (
    <>
      <DataTable columns={columns} data={data} />
      <ProofLightbox
        open={proofSrc != null}
        onOpenChange={(open) => {
          if (!open) setProofSrc(null);
        }}
        src={proofSrc}
        title={t("pages.leaves.proof")}
      />
    </>
  );
}
