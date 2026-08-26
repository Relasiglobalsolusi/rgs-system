import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import {
  loadEmployeePayslipHistory,
  payslipStatusKey,
} from "@/lib/employee-payslips";
import { formatEmployeeName } from "@/lib/employee-user-link";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import {
  assertPayslipEmployeeAccess,
  requirePayslipAccess,
} from "@/lib/payslip-access";
import { prisma } from "@/lib/prisma";
import { formatContractPrice } from "@/lib/project-billing";
import { jakartaYearMonth } from "@/lib/vat";

type Props = {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ year?: string }>;
};

export default async function EmployeePayslipsPage({
  params,
  searchParams,
}: Props) {
  const access = await requirePayslipAccess();
  const { employeeId } = await params;
  assertPayslipEmployeeAccess(employeeId, access);

  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const query = await searchParams;

  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      companyId: access.session.user.companyId,
      archivedFromDirectory: false,
      status: { in: ["ACTIVE", "ON_LEAVE", "LEAVE_PENDING"] },
    },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
      hiredAt: true,
    },
  });
  if (!employee) notFound();

  const months = await loadEmployeePayslipHistory({
    companyId: access.session.user.companyId,
    employeeId: employee.id,
    hiredAt: employee.hiredAt,
  });
  const years = [...new Set(months.map((row) => row.year))].sort((a, b) => b - a);
  const currentYear = jakartaYearMonth().year;
  const yearRaw = Number(query.year ?? years[0] ?? currentYear);
  const selectedYear =
    Number.isInteger(yearRaw) && years.includes(yearRaw)
      ? yearRaw
      : years[0] ?? currentYear;
  const yearRows = months
    .filter((row) => row.year === selectedYear)
    .sort((a, b) => b.month - a.month);

  const directoryHref = access.canManageAll ? "/payslips" : undefined;

  return (
    <AppShell title={formatEmployeeName(employee)}>
      <BillingBreadcrumbs
        items={[
          ...(directoryHref
            ? [{ label: t("pages.payslips.title"), href: directoryHref }]
            : [{ label: t("pages.payslips.title") }]),
          { label: formatEmployeeName(employee) },
        ]}
      />
      <SectionCard>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text">
              {t("pages.payslips.historyTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t("pages.payslips.historyDesc")}
            </p>
            <p className="mt-1 font-mono text-xs text-subtle">
              {employee.employeeNo}
            </p>
          </div>
          {years.length > 0 ? (
            <form method="get" className="flex items-end gap-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-muted">
                  {t("pages.payslips.filterYear")}
                </span>
                <select
                  name="year"
                  defaultValue={String(selectedYear)}
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="h-10 rounded-xl border border-border bg-elevated px-3 text-sm font-medium text-text"
              >
                {t("pages.payslips.filterApply")}
              </button>
            </form>
          ) : null}
        </div>

        {yearRows.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title={t("pages.payslips.emptyMonths")}
              description={t("pages.payslips.historyDesc")}
            />
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full table-fixed text-left text-sm">
              <thead className="border-b border-border text-xs font-medium text-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("pages.payslips.columns.month")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("pages.payslips.netPay")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("pages.payslips.columns.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {yearRows.map((row) => {
                  const href = `/payslips/${employee.id}/${row.year}/${row.month}`;
                  return (
                    <tr
                      key={`${row.year}-${row.month}`}
                      className="border-b border-border/70 hover:bg-elevated/50"
                    >
                      <td className="p-0 text-left">
                        <Link
                          href={href}
                          className="block px-3 py-3 font-semibold text-primary"
                        >
                          {t(`pages.reports.months.${row.month}`)}
                        </Link>
                      </td>
                      <td className="p-0 text-left tabular-nums text-text">
                        <Link href={href} tabIndex={-1} className="block px-3 py-3">
                          {row.netPay == null
                            ? t("pages.payslips.noPay")
                            : formatContractPrice(row.netPay)}
                        </Link>
                      </td>
                      <td className="p-0 text-left text-muted">
                        <Link href={href} tabIndex={-1} className="block px-3 py-3">
                          {t(
                            `pages.payslips.${payslipStatusKey(row)}`
                          )}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
