"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import type { BankLoanKind } from "@/lib/bank-loan";
import type { LoanSource } from "@/lib/loan-facility";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

type LoanFacilityTableRow = {
  id: string;
  name: string;
  source: LoanSource;
  kind: BankLoanKind;
  lenderName: string;
  outstanding: number;
  suggestedPayment: number;
  status: "ACTIVE" | "CLOSED";
};

export default function LoanFacilityTable({
  rows,
}: {
  rows: LoanFacilityTableRow[];
}) {
  const { t } = useT();
  const router = useRouter();

  const columns = useMemo(() => {
    const cols: DataTableColumn<LoanFacilityTableRow>[] = [
      {
        key: "name",
        title: t("pages.loans.columns.name"),
        width: "14rem",
        share: 2,
        className: "min-w-[14rem]",
        render: (row) => (
          <div className="min-w-0">
            <p className="font-semibold text-text">{row.name}</p>
            <p className="mt-0.5 truncate text-sm text-subtle">
              {row.source === "SHAREHOLDER"
                ? t("pages.billing.loanSourceShareholder")
                : t("pages.billing.loanSourceBank")}
            </p>
          </div>
        ),
      },
      {
        key: "creditor",
        title: t("pages.loans.columns.creditor"),
        width: "12rem",
        share: 1.5,
        className: "min-w-[12rem]",
        render: (row) => (
          <p className="min-w-0 text-text">{row.lenderName}</p>
        ),
      },
      {
        key: "kind",
        title: t("pages.loans.columns.kind"),
        width: "10rem",
        cellAlign: "center",
        className: "min-w-[10rem] overflow-visible",
        render: (row) => {
          const label =
            row.kind === "TERM"
              ? t("pages.billing.bankLoanKindTerm")
              : t("pages.billing.bankLoanKindStandby");
          const words = label.trim().split(/\s+/);
          const lines =
            words.length >= 2
              ? ([
                  words.slice(0, -1).join(" "),
                  words[words.length - 1] ?? "",
                ] as const)
              : undefined;
          return (
            <StatusBadge
              status={row.kind === "TERM" ? "info" : "warning"}
              compact
              lines={lines}
            >
              {label}
            </StatusBadge>
          );
        },
      },
      {
        key: "outstanding",
        title: t("pages.loans.columns.outstanding"),
        width: "10rem",
        cellAlign: "right",
        className: "min-w-[10rem] whitespace-nowrap",
        render: (row) => (
          <p className="tabular-nums text-text">
            {formatContractPrice(row.outstanding)}
          </p>
        ),
      },
      {
        key: "next",
        title: t("pages.loans.columns.next"),
        width: "10rem",
        cellAlign: "right",
        className: "min-w-[10rem] whitespace-nowrap",
        render: (row) => (
          <p className="tabular-nums text-text">
            {formatContractPrice(row.suggestedPayment)}
          </p>
        ),
      },
      {
        key: "status",
        title: t("pages.loans.columns.status"),
        width: "8rem",
        cellAlign: "center",
        className: "min-w-[8rem] overflow-visible",
        render: (row) => (
          <StatusBadge
            status={row.status === "ACTIVE" ? "active" : "inactive"}
            compact
          >
            {row.status === "ACTIVE"
              ? t("pages.loans.statusActive")
              : t("pages.loans.statusClosed")}
          </StatusBadge>
        ),
      },
    ];
    return cols;
  }, [t]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowKey={(row) => row.id}
      onRowClick={(row) => router.push(`/billing/loans/${row.id}`)}
      emptyMessage={t("pages.loans.emptyTitle")}
    />
  );
}
