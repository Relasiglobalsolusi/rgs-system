"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import type { BpjsProgramEmployeeRow } from "@/lib/bpjs-finance";
import type { MessageKey } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

const PROGRAMME_KEYS = ["jht", "jp", "jkk", "jkm"] as const;

const LINE_LABEL: Record<(typeof PROGRAMME_KEYS)[number], MessageKey> = {
  jht: "pages.bpjs.lineJht",
  jp: "pages.bpjs.lineJp",
  jkk: "pages.bpjs.lineJkk",
  jkm: "pages.bpjs.lineJkm",
};

function componentAmount(row: BpjsProgramEmployeeRow, key: string) {
  const line = row.components.find((item) => item.key === key);
  if (!line) return null;
  return line.employeeAmount + line.companyAmount;
}

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
        key: "employeeNo",
        title: t("pages.bpjs.columns.employeeNo"),
        width: "10rem",
        share: 1.1,
        cellAlign: "left",
        className: "min-w-[8rem]",
        render: (row) => (
          <p className="font-mono text-sm text-text">{row.employeeNo}</p>
        ),
      },
      {
        key: "name",
        title: t("pages.bpjs.columns.employee"),
        width: "12rem",
        share: 1.4,
        cellAlign: "left",
        className: "min-w-[10rem]",
        render: (row) => <p className="font-semibold text-text">{row.name}</p>,
      },
    ];

    if (showComponents) {
      for (const key of PROGRAMME_KEYS) {
        cols.push({
          key,
          title: t(LINE_LABEL[key]),
          width: "8rem",
          share: 1,
          cellAlign: "left",
          className: "min-w-[7rem]",
          render: (row) => {
            const amount = componentAmount(row, key);
            return (
              <p className="tabular-nums text-text">
                {amount == null ? "—" : formatContractPrice(amount)}
              </p>
            );
          },
        });
      }
    }

    cols.push(
      {
        key: "employeeShare",
        title: t("pages.bpjs.columns.employeeShare"),
        width: "9rem",
        share: 1,
        cellAlign: "left",
        className: "min-w-[8rem]",
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
        share: 1,
        cellAlign: "left",
        className: "min-w-[8rem]",
        render: (row) => (
          <p className="tabular-nums text-text">
            {formatContractPrice(row.companyShare)}
          </p>
        ),
      }
    );

    cols.push({
      key: "total",
      title: t("pages.bpjs.columns.total"),
      width: "9rem",
      share: 1,
      cellAlign: "left",
      className: "min-w-[8rem]",
      render: (row) => (
        <p className="tabular-nums text-text">
          {formatContractPrice(row.total)}
        </p>
      ),
    });
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
