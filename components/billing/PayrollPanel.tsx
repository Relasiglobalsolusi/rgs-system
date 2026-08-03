"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";

import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { employeeSelectTriggerClass } from "@/components/employees/employee-dialog-ui";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

export type PayrollRow = {
  employeeId: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  basePay: number;
  dailyRate: number;
  daysWorked: number;
  wage: number;
  bpjsKesehatan: number;
  bpjsTk: number;
  totalDeduction: number;
  netPay: number;
};

type Props = {
  year: number;
  month: number;
  rows: PayrollRow[];
};

export default function PayrollPanel({ year, month, rows }: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i + 1),
    []
  );
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from(
      new Set([
        ...Array.from({ length: 8 }, (_, i) => currentYear - 5 + i),
        year,
      ])
    ).sort((a, b) => a - b);
  }, [year]);

  function navigatePeriod(nextYear: number, nextMonth: number) {
    startTransition(() => {
      router.push(`/billing/payroll?year=${nextYear}&month=${nextMonth}`);
    });
  }

  const totalWage = rows.reduce((sum, r) => sum + r.wage, 0);
  const totalBpjsKesehatan = rows.reduce((sum, r) => sum + r.bpjsKesehatan, 0);
  const totalBpjsTk = rows.reduce((sum, r) => sum + r.bpjsTk, 0);
  const totalDeduction = rows.reduce((sum, r) => sum + r.totalDeduction, 0);
  const totalNet = rows.reduce((sum, r) => sum + r.netPay, 0);

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text">
              {t("pages.payroll.periodTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t("pages.payroll.periodDesc")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={String(month)}
              onValueChange={(v) => navigatePeriod(year, Number(v))}
              disabled={pending}
            >
              <SelectTrigger className={employeeSelectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {t(`pages.reports.months.${m}` as Parameters<typeof t>[0])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(year)}
              onValueChange={(v) => navigatePeriod(Number(v), month)}
              disabled={pending}
            >
              <SelectTrigger className={employeeSelectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">{t("pages.payroll.totalEmployees")}</p>
            <p className="font-medium text-text">{rows.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("pages.payroll.totalWage")}</p>
            <p className="font-medium text-text">{formatContractPrice(totalWage)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("pages.payroll.totalNetPay")}</p>
            <p className="font-medium text-text">{formatContractPrice(totalNet)}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-text">
            {t("pages.payroll.tableTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t("pages.payroll.tableDesc")}
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={t("pages.payroll.emptyTitle")}
            description={t("pages.payroll.emptyDesc")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    {t("pages.payroll.columns.employee")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("pages.payroll.columns.basePay")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("pages.payroll.columns.dailyRate")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("pages.payroll.columns.daysWorked")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("pages.payroll.columns.wage")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("pages.payroll.columns.bpjsKesehatan")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("pages.payroll.columns.bpjsTk")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("pages.payroll.columns.netPay")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.employeeId} className="border-b border-border/70">
                    <td className="px-3 py-3">
                      <p className="font-medium text-text">
                        {row.firstName} {row.lastName}
                      </p>
                      <p className="font-mono text-xs text-muted">
                        {row.employeeNo}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right text-muted">
                      {formatContractPrice(row.basePay)}
                    </td>
                    <td className="px-3 py-3 text-right text-muted">
                      {formatContractPrice(row.dailyRate)}
                    </td>
                    <td className="px-3 py-3 text-right text-muted">
                      {row.daysWorked}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-text">
                      {formatContractPrice(row.wage)}
                    </td>
                    <td className="px-3 py-3 text-right text-muted">
                      {row.bpjsKesehatan > 0
                        ? formatContractPrice(row.bpjsKesehatan)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-muted">
                      {row.bpjsTk > 0
                        ? formatContractPrice(row.bpjsTk)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-text">
                      {formatContractPrice(row.netPay)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-card-tint-emerald/30">
                  <td className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    {t("pages.payroll.totalRow")}
                  </td>
                  <td colSpan={3} />
                  <td className="px-3 py-3 text-right font-semibold text-text">
                    {formatContractPrice(totalWage)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-muted">
                    {totalBpjsKesehatan > 0
                      ? formatContractPrice(totalBpjsKesehatan)
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-muted">
                    {totalBpjsTk > 0
                      ? formatContractPrice(totalBpjsTk)
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-text">
                    {formatContractPrice(totalNet)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
