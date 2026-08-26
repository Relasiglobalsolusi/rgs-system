import { notFound } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import {
  loadEmployeePayslipMonth,
  payslipStatusKey,
} from "@/lib/employee-payslips";
import { payrollDeductionTypeLabel } from "@/lib/internal-payroll-month";
import { formatEmployeeName } from "@/lib/employee-user-link";
import { formatDisplayTime, formatEnglishOrdinalDate } from "@/lib/format-date";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import { formatContractPrice } from "@/lib/project-billing";
import {
  assertPayslipEmployeeAccess,
  requirePayslipAccess,
} from "@/lib/payslip-access";

type Props = {
  params: Promise<{ employeeId: string; year: string; month: string }>;
};

export default async function EmployeePayslipMonthPage({ params }: Props) {
  const access = await requirePayslipAccess();

  const { employeeId, year: yearRaw, month: monthRaw } = await params;
  assertPayslipEmployeeAccess(employeeId, access);
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    notFound();
  }

  const locale = await getServerLocale();
  const t = createTranslator(locale);

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
    },
  });
  if (!employee) notFound();

  const detail = await loadEmployeePayslipMonth({
    companyId: access.session.user.companyId,
    employeeId: employee.id,
    year,
    month,
  });
  const monthLabel = t(`pages.reports.months.${month}`);
  const name = formatEmployeeName(employee);
  const days = detail.row?.days ?? [];

  return (
    <AppShell title={`${name} · ${monthLabel} ${year}`}>
      <BillingBreadcrumbs
        items={[
          { label: t("pages.payslips.title"), href: "/payslips" },
          { label: name, href: `/payslips/${employee.id}` },
          { label: `${monthLabel} ${year}` },
        ]}
      />
      <SectionCard className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-text">
            {t("pages.payslips.monthDetailTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {name} · {employee.employeeNo} · {monthLabel} {year}
          </p>
          <p className="mt-1 text-xs text-subtle">
            {t(
              `pages.payslips.${payslipStatusKey({
                netPay: detail.row?.netPay ?? null,
                preview: detail.preview,
              })}`
            )}
          </p>
        </div>

        {!detail.row ? (
          <EmptyState
            title={t("pages.payslips.emptyMonth")}
            description={t("pages.payslips.historyDesc")}
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryTile
                label={t("pages.payslips.daysWorked")}
                value={String(detail.row.daysWorked)}
              />
              <SummaryTile
                label={t("pages.payslips.earnings")}
                value={formatContractPrice(detail.earnings)}
              />
              <SummaryTile
                label={t("pages.payslips.deductions")}
                value={formatContractPrice(detail.deductions)}
              />
              <SummaryTile
                label={t("pages.payslips.bpjsEmployee")}
                value={formatContractPrice(detail.bpjsEmployee)}
              />
              <SummaryTile
                label={t("pages.payslips.bpjsCompany")}
                value={formatContractPrice(detail.bpjsCompany)}
              />
              <SummaryTile
                label={t("pages.payslips.columns.amountOwed")}
                value={formatContractPrice(detail.balanceDueToCompany)}
                danger={detail.balanceDueToCompany > 0}
              />
              <SummaryTile
                label={t("pages.payslips.netPay")}
                value={formatContractPrice(detail.row.netPay)}
                emphasize
              />
            </div>

            {detail.row.deductions.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-text">
                  {t("pages.payslips.deductions")}
                </h3>
                <ul className="space-y-2 text-sm">
                  {detail.row.deductions.map((line) => (
                    <li
                      key={line.id}
                      className="flex items-baseline justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
                    >
                      <span className="text-muted">
                        {line.reason?.trim() ||
                          payrollDeductionTypeLabel(line.type, locale)}
                        {line.itemName ? ` · ${line.itemName}` : ""}
                      </span>
                      <span className="tabular-nums text-text">
                        {formatContractPrice(line.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-text">
                {t("pages.payroll.dayListTitle")}
              </h3>
              {days.length === 0 ? (
                <p className="text-sm text-subtle">
                  {t("pages.payroll.noDays")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">
                          {t("pages.payroll.dayDate")}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t("pages.payroll.daySite")}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t("pages.payroll.dayCheckIn")}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t("pages.payroll.dayCheckOut")}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t("pages.payroll.dayPay")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day) => (
                        <tr
                          key={day.sessionKey}
                          className="border-b border-border/70"
                        >
                          <td className="px-3 py-2 text-text">
                            {formatEnglishOrdinalDate(
                              `${day.dateKey}T00:00:00Z`
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted">
                            {day.siteName ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-muted">
                            {day.checkInAt
                              ? formatDisplayTime(day.checkInAt)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-muted">
                            {day.checkOutAt
                              ? formatDisplayTime(day.checkOutAt)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-text">
                            {day.payAmount != null
                              ? formatContractPrice(day.payAmount)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </SectionCard>
    </AppShell>
  );
}

function SummaryTile({
  label,
  value,
  emphasize,
  danger,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-elevated/40 px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={
          danger
            ? "mt-1 font-semibold tabular-nums text-danger"
            : emphasize
              ? "mt-1 text-lg font-semibold tabular-nums text-text"
              : "mt-1 font-medium tabular-nums text-text"
        }
      >
        {value}
      </p>
    </div>
  );
}
