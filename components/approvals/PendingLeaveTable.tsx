"use client";

import { useMemo, useState } from "react";

import ApprovalActions from "@/components/approvals/ApprovalActions";
import LeaveTypeLabel from "@/components/leaves/LeaveTypeLabel";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import ProofLightbox from "@/components/ui/ProofLightbox";
import StatusBadge from "@/components/ui/StatusBadge";
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
  const [proofSrc, setProofSrc] = useState<string | null>(null);

  const columns = useMemo<DataTableColumn<PendingLeaveRow>[]>(
    () => [
      {
        key: "employee",
        title: t("pages.approvals.columns.employee"),
        width: "10rem",
        className: "min-w-[10rem]",
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
        width: "10rem",
        className:
          "min-w-[10rem] overflow-visible whitespace-nowrap text-center",
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
        title: t("pages.approvals.columns.reason"),
        render: (row) => (
          <span className="max-w-xs text-subtle">{row.reason}</span>
        ),
      },
      {
        key: "proof",
        title: t("pages.approvals.proof"),
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
      {
        key: "actions",
        title: t("common.labels.actions"),
        width: "10rem",
        align: "center",
        className: "min-w-[10rem] overflow-visible whitespace-nowrap",
        render: (row) => <ApprovalActions id={row.id} />,
      },
    ],
    [t]
  );

  return (
    <>
      <DataTable columns={columns} data={data} />
      <ProofLightbox
        open={proofSrc != null}
        onOpenChange={(open) => {
          if (!open) setProofSrc(null);
        }}
        src={proofSrc}
        title={t("pages.approvals.proof")}
      />
    </>
  );
}
