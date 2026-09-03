import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  CircleDollarSign,
  Download,
  FileCheck,
  FileClock,
  Landmark,
  Shield,
  Wallet,
} from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectoryStatGrid from "@/components/ui/DirectoryStatGrid";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { buttonVariants } from "@/components/ui/button";
import { directoryToolbarDownloadClass } from "@/components/ui/DirectoryFilterSelect";
import { getEmployeeCompanyBalance } from "@/lib/employee-company-balance";
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
  const issuedCount = yearRows.filter((row) => payslipStatusKey(row) === "issued").length;
  const previewCount = yearRows.filter((row) => payslipStatusKey(row) === "preview").length;
  const yearNetPay = yearRows.reduce((sum, row) => sum + (row.netPay ?? 0), 0);
  const isOwnAccount = !access.canManageAll;
  const ownBalance = isOwnAccount
    ? await getEmployeeCompanyBalance(prisma, employee.id)
    : null;

  const directoryHref = access.canManageAll ? "/payslips" : undefined;

  return (
    <AppShell
      title={
        isOwnAccount
          ? t("pages.payslips.ownTitle")
          : formatEmployeeName(employee)
      }
    >
      <BillingBreadcrumbs
        items={
          isOwnAccount
            ? [{ label: t("pages.payslips.ownTitle") }]
            : [
                ...(directoryHref
                  ? [{ label: t("pages.payslips.title"), href: directoryHref }]
                  : [{ label: t("pages.payslips.title") }]),
                { label: formatEmployeeName(employee) },
              ]
        }
      />
      {isOwnAccount ? (
        <DirectoryStatGrid className="mb-5">
          <DirectoryStatCard
            tinted
            title={t("pages.payslips.cards.yourYearNet")}
            value={formatContractPrice(yearNetPay)}
            subtitle={t("pages.payslips.cards.yourYearNetSubtitle")}
            icon={<CircleDollarSign size={20} />}
            accent="primary"
          />
          <DirectoryStatCard
            tinted
            title={t("pages.payslips.cards.youOwe")}
            value={formatContractPrice(ownBalance?.amountOwed ?? 0)}
            subtitle={t("pages.payslips.cards.youOweSubtitle")}
            icon={<Wallet size={20} />}
            accent={(ownBalance?.amountOwed ?? 0) > 0 ? "danger" : "muted"}
          />
          <DirectoryStatCard
            tinted
            title={t("pages.payslips.cards.yourDeposit")}
            value={formatContractPrice(ownBalance?.depositHeld ?? 0)}
            subtitle={t("pages.payslips.cards.yourDepositSubtitle")}
            icon={<Shield size={20} />}
            accent="info"
          />
          <DirectoryStatCard
            tinted
            title={t("pages.payslips.cards.yourBpjs")}
            value={formatContractPrice(ownBalance?.heldBpjsShare ?? 0)}
            subtitle={t("pages.payslips.cards.yourBpjsSubtitle")}
            icon={<Landmark size={20} />}
            accent="warning"
          />
        </DirectoryStatGrid>
      ) : (
        <DirectoryStatGrid className="mb-5" gapClassName="gap-2">
          <DirectoryStatCard
            compact
            tinted
            title={t("pages.payslips.cards.months")}
            value={yearRows.length}
            subtitle={t("pages.payslips.cards.monthsSubtitle")}
            icon={<CalendarDays size={16} />}
            accent="primary"
          />
          <DirectoryStatCard
            compact
            tinted
            title={t("pages.payslips.cards.issued")}
            value={issuedCount}
            subtitle={t("pages.payslips.cards.issuedSubtitle")}
            icon={<FileCheck size={16} />}
            accent="success"
          />
          <DirectoryStatCard
            compact
            tinted
            title={t("pages.payslips.cards.preview")}
            value={previewCount}
            subtitle={t("pages.payslips.cards.previewSubtitle")}
            icon={<FileClock size={16} />}
            accent="warning"
          />
          <DirectoryStatCard
            compact
            tinted
            title={t("pages.payslips.cards.yearNet")}
            value={formatContractPrice(yearNetPay)}
            subtitle={t("pages.payslips.cards.yearNetSubtitle")}
            icon={<CircleDollarSign size={16} />}
            accent="info"
          />
        </DirectoryStatGrid>
      )}
      <SectionCard>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text">
              {t(
                isOwnAccount
                  ? "pages.payslips.ownHistoryTitle"
                  : "pages.payslips.historyTitle"
              )}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t(
                isOwnAccount
                  ? "pages.payslips.ownHistoryDesc"
                  : "pages.payslips.historyDesc"
              )}
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
              description={t(
                isOwnAccount
                  ? "pages.payslips.ownHistoryDesc"
                  : "pages.payslips.historyDesc"
              )}
            />
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
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
                  <th className="px-3 py-2 text-left font-medium">
                    {t("pages.payslips.columns.download")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {yearRows.map((row) => {
                  const href = `/payslips/${employee.id}/${row.year}/${row.month}`;
                  const statusKey = payslipStatusKey(row);
                  return (
                    <tr
                      key={`${row.year}-${row.month}`}
                      className="border-b border-border/70 hover:bg-elevated/50"
                    >
                      <td className="px-3 py-3 text-left">
                        <Link
                          href={href}
                          className={`${buttonVariants({
                            variant: "infoBadge",
                            size: "badgeFlex",
                          })} min-w-[6.5rem] justify-center`}
                        >
                          {t(`pages.reports.months.${row.month}`)}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-left tabular-nums text-text">
                        {row.netPay == null
                          ? t("pages.payslips.noPay")
                          : formatContractPrice(row.netPay)}
                      </td>
                      <td className="px-3 py-3 text-left text-muted">
                        {t(`pages.payslips.${statusKey}`)}
                      </td>
                      <td className="px-3 py-3 text-left">
                        {statusKey === "noPayslip" ? (
                          <span className="text-subtle">
                            {t("pages.payslips.noPay")}
                          </span>
                        ) : (
                          <a
                            href={`/api/payslips/${employee.id}/${row.year}/${row.month}`}
                            className={directoryToolbarDownloadClass}
                          >
                            <Download size={14} aria-hidden />
                            {t("pages.payslips.download")}
                          </a>
                        )}
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
