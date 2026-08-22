"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import type { BpjsFinanceProgramLine } from "@/lib/bpjs-finance";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

export default function BpjsProgramTable({
  year,
  month,
  dueDateLabel,
  lines,
}: {
  year: number;
  month: number;
  dueDateLabel: string;
  lines: BpjsFinanceProgramLine[];
}) {
  const { t } = useT();
  const router = useRouter();

  const columns = useMemo(() => {
    const cols: DataTableColumn<BpjsFinanceProgramLine>[] = [
      {
        key: "program",
        title: t("pages.bpjs.columns.program"),
        width: "14rem",
        share: 2,
        className: "min-w-[14rem]",
        render: (row) => (
          <div className="min-w-0">
            <p className="font-semibold text-text">
              {row.key === "kesehatan"
                ? t("pages.bpjs.kesehatan")
                : t("pages.bpjs.ketenagakerjaan")}
            </p>
            <p className="mt-0.5 text-sm text-subtle">
              {t("pages.bpjs.enrolled", { count: String(row.employeeCount) })}
            </p>
          </div>
        ),
      },
      {
        key: "companyDue",
        title: t("pages.bpjs.columns.companyShare"),
        width: "8.5rem",
        cellAlign: "right",
        className: "min-w-[8.5rem] whitespace-nowrap",
        render: (row) => (
          <p className="tabular-nums text-text">
            {formatContractPrice(row.companyDue)}
          </p>
        ),
      },
      {
        key: "remaining",
        title: t("pages.bpjs.stillToPay"),
        width: "8.5rem",
        cellAlign: "right",
        className: "min-w-[8.5rem] whitespace-nowrap",
        render: (row) => (
          <p className="tabular-nums text-text">
            {formatContractPrice(row.remaining)}
          </p>
        ),
      },
      {
        key: "alreadyPaid",
        title: t("pages.bpjs.columns.paid"),
        width: "8.5rem",
        cellAlign: "right",
        className: "min-w-[8.5rem] whitespace-nowrap",
        render: (row) => (
          <p className="tabular-nums text-text">
            {formatContractPrice(row.alreadyPaid)}
          </p>
        ),
      },
      {
        key: "dueDate",
        title: t("pages.bpjs.columns.dueDate"),
        width: "8rem",
        className: "min-w-[8rem] whitespace-nowrap",
        render: () => <p className="text-text">{dueDateLabel}</p>,
      },
      {
        key: "status",
        title: t("pages.bpjs.columns.status"),
        width: "7.5rem",
        cellAlign: "center",
        className: "min-w-[7.5rem] overflow-visible",
        render: (row) => {
          const status =
            row.remaining <= 0 ? "paid" : row.overdue ? "overdue" : "due";
          return (
            <StatusBadge
              status={
                status === "paid"
                  ? "active"
                  : status === "overdue"
                    ? "danger"
                    : "warning"
              }
              compact
            >
              {status === "paid"
                ? t("pages.bpjs.statusPaid")
                : status === "overdue"
                  ? t("pages.bpjs.statusOverdue")
                  : t("pages.bpjs.statusDue")}
            </StatusBadge>
          );
        },
      },
    ];
    return cols;
  }, [dueDateLabel, t]);

  return (
    <DataTable
      columns={columns}
      data={lines}
      getRowKey={(row) => row.program}
      onRowClick={(row) =>
        router.push(
          `/billing/bpjs/${row.key}?year=${year}&month=${month}`
        )
      }
    />
  );
}
