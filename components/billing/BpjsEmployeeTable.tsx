"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import type { BpjsProgramEmployeeRow } from "@/lib/bpjs-finance";
import type { MessageKey } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

const LINE_KEYS: Record<string, MessageKey> = {
  kesehatan: "pages.bpjs.lineKesehatan",
  jht: "pages.bpjs.lineJht",
  jp: "pages.bpjs.lineJp",
  jkk: "pages.bpjs.lineJkk",
  jkm: "pages.bpjs.lineJkm",
};

export default function BpjsEmployeeTable({
  rows,
  showComponents,
  programKey,
  year,
  month,
}: {
  rows: BpjsProgramEmployeeRow[];
  showComponents: boolean;
  programKey: "kesehatan" | "ketenagakerjaan";
  year: number;
  month: number;
}) {
  const { t } = useT();
  const router = useRouter();

  const columns = useMemo(() => {
    const cols: DataTableColumn<BpjsProgramEmployeeRow>[] = [
      {
        key: "name",
        title: t("pages.bpjs.columns.employee"),
        width: "16rem",
        share: 2,
        className: "min-w-[16rem]",
        render: (row) => (
          <div className="min-w-0">
            <p className="font-semibold text-text">{row.name}</p>
            <p className="mt-0.5 text-sm text-subtle">{row.employeeNo}</p>
            {showComponents && row.components.length > 1 ? (
              <p className="mt-1 max-w-lg truncate text-xs text-muted">
                {row.components
                  .map(
                    (line) =>
                      `${t(LINE_KEYS[line.key] ?? "pages.bpjs.lineKesehatan")} ${formatContractPrice(line.employeeAmount + line.companyAmount)}`
                  )
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        key: "employeeShare",
        title: t("pages.bpjs.columns.employeeShare"),
        width: "9rem",
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (row) => (
          <p className="tabular-nums text-text">
            {formatContractPrice(row.employeeShare)}
          </p>
        ),
      },
      {
        key: "companyShare",
        title: t("pages.bpjs.columns.companyShare"),
        width: "9rem",
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (row) => (
          <p className="tabular-nums text-text">
            {formatContractPrice(row.companyShare)}
          </p>
        ),
      },
      {
        key: "total",
        title: t("pages.bpjs.columns.total"),
        width: "9rem",
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (row) => (
          <p className="tabular-nums text-text">
            {formatContractPrice(row.total)}
          </p>
        ),
      },
    ];
    return cols;
  }, [showComponents, t]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowKey={(row) => row.id}
      onRowClick={(row) =>
        router.push(
          `/billing/bpjs/${programKey}/${row.id}?year=${year}&month=${month}`
        )
      }
      emptyMessage={t("pages.bpjs.employeesEmpty")}
    />
  );
}
