import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getFinancialReportClients,
  getFinancialReportDetailTotals,
  listFinancialReportBankAccounts,
  listFinancialReportScopeClients,
  type FinancialReportClientRow,
} from "@/app/billing/financial-report/actions";
import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import FinancialReportClientDirectory from "@/components/billing/FinancialReportClientDirectory";
import FinancialReportFilters from "@/components/billing/FinancialReportFilters";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import SectionCard from "@/components/ui/SectionCard";
import { buttonVariants } from "@/components/ui/button";
import {
  financialReportQueryString,
  parseFinancialReportSelection,
} from "@/lib/financial-report-query";
import { formatDisplayDate } from "@/lib/format-date";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatContractPrice } from "@/lib/project-billing";
import { requireFinanceChild } from "@/lib/session";
import { UNPAID_INVOICE_STATUSES } from "@/lib/billing";
import {
  listHeldSecurityDeposits,
  listKeptSecurityDeposits,
  listReturnedSecurityDeposits,
} from "@/lib/internal-payroll-month";
import { cn } from "@/lib/utils";

const METRICS = [
  "periodNet",
  "netPosition",
  "moneyIn",
  "moneyOut",
  "ar",
  "ap",
  "warehouse",
  "overhead",
  "deposits",
  "depositsReturned",
  "depositsKept",
] as const;

type Metric = (typeof METRICS)[number];

function isMetric(value: string | undefined): value is Metric {
  return Boolean(value && (METRICS as readonly string[]).includes(value));
}

type SearchParams = Promise<{
  year?: string;
  month?: string;
  bank?: string;
  metric?: string;
}>;

export default async function FinancialReportDetailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFinanceChild("financialReport");
  if (session.user.clientId || session.user.vendorId) {
    redirect("/billing/financial-report");
  }
  const t = createTranslator(await getServerLocale());
  const params = await searchParams;
  const metric = isMetric(params.metric) ? params.metric : "periodNet";
  const selection = parseFinancialReportSelection(params);
  const queryString = financialReportQueryString(selection);
  const backHref = `/billing/financial-report?${queryString}`;

  const needsClientDirectory =
    metric === "periodNet" || metric === "moneyIn" || metric === "moneyOut";

  const [company, clients, scopeClients, bankAccounts] = await Promise.all([
    getFinancialReportDetailTotals(selection, metric),
    needsClientDirectory
      ? getFinancialReportClients(selection)
      : Promise.resolve([] as FinancialReportClientRow[]),
    listFinancialReportScopeClients(),
    listFinancialReportBankAccounts(),
  ]);

  const depositMetric =
    metric === "deposits" ||
    metric === "depositsReturned" ||
    metric === "depositsKept";

  const [arPeriods, apInvoices, heldDeposits, returnedDeposits, keptDeposits] =
    await Promise.all([
    metric === "ar" || metric === "netPosition"
      ? prisma.projectInvoicePeriod.findMany({
          where: {
            project: { companyId: session.user.companyId },
            status: { in: [...UNPAID_INVOICE_STATUSES] },
          },
          select: {
            id: true,
            amount: true,
            revisedInvoiceAmount: true,
            dueAt: true,
            project: {
              select: {
                name: true,
                client: { select: { name: true } },
              },
            },
          },
          orderBy: [{ dueAt: "asc" }],
          take: 80,
        })
      : Promise.resolve([]),
    metric === "ap" || metric === "netPosition"
      ? prisma.purchaseInvoice.findMany({
          where: {
            companyId: session.user.companyId,
            paidAt: null,
            reversedAt: null,
            freeOfCharge: false,
          },
          select: {
            id: true,
            supplierName: true,
            invoiceRef: true,
            amount: true,
            invoiceDate: true,
          },
          orderBy: [{ invoiceDate: "desc" }],
          take: 80,
        })
      : Promise.resolve([]),
    metric === "deposits"
      ? listHeldSecurityDeposits(session.user.companyId)
      : Promise.resolve([]),
    metric === "depositsReturned" || metric === "moneyOut"
      ? listReturnedSecurityDeposits(session.user.companyId)
      : Promise.resolve([]),
    metric === "depositsKept" || metric === "moneyIn"
      ? listKeptSecurityDeposits(session.user.companyId)
      : Promise.resolve([]),
  ]);

  const titleKey = `pages.financialReport.detail.${metric}` as const;

  return (
    <AppShell
      title={t(titleKey)}
      descriptionKey="pages.financialReport.detailDescription"
    >
      <BillingBreadcrumbs
        items={[
          { label: t("pages.financialReport.title"), href: backHref },
          { label: t(titleKey) },
        ]}
      />
      <FinancialReportFilters
        selection={selection}
        clients={scopeClients}
        scopeClientId={null}
        bankAccounts={bankAccounts}
        detailMetric={metric}
      />

      <div
        className={
          depositMetric
            ? "mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
            : "mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        }
      >
        {metric === "periodNet" || metric === "moneyIn" || metric === "moneyOut" ? (
          <>
            {metric === "periodNet" ? (
              <DirectoryStatCard
                title={t("pages.financialReport.periodNet")}
                value={formatContractPrice(company.period.net)}
                accent={company.period.net < 0 ? "danger" : "success"}
              />
            ) : null}
            <DirectoryStatCard
              title={t("pages.financialReport.moneyIn")}
              value={formatContractPrice(company.period.moneyIn)}
              accent="success"
            />
            <DirectoryStatCard
              title={t("pages.financialReport.moneyOut")}
              value={formatContractPrice(company.period.moneyOut)}
              accent="warning"
            />
          </>
        ) : null}
        {metric === "moneyIn" ? (
          <DirectoryStatCard
            title={t("pages.financialReport.depositsKept")}
            value={formatContractPrice(company.deposits.kept)}
            subtitle={t("pages.financialReport.depositsKeptHint")}
            accent="success"
            href={`/billing/financial-report/detail?metric=depositsKept&${queryString}`}
          />
        ) : null}
        {metric === "moneyOut" ? (
          <>
            <DirectoryStatCard
              title={t("pages.financialReport.headOfficeOverhead")}
              value={formatContractPrice(company.overhead.total)}
              subtitle={t("pages.financialReport.headOfficeOverheadPeriodHint")}
              href={`/billing/financial-report/detail?metric=overhead&${queryString}`}
            />
            <DirectoryStatCard
              title={t("pages.financialReport.depositsReturned")}
              value={formatContractPrice(company.deposits.returned)}
              subtitle={t("pages.financialReport.depositsReturnedHint")}
              accent="warning"
              href={`/billing/financial-report/detail?metric=depositsReturned&${queryString}`}
            />
          </>
        ) : null}
        {metric === "netPosition" ? (
          <>
            <DirectoryStatCard
              title={t("pages.financialReport.netPosition")}
              value={formatContractPrice(company.netPosition)}
              accent={company.netPosition < 0 ? "danger" : "success"}
            />
            <DirectoryStatCard
              title={t("pages.financialReport.clientsStillOwe")}
              value={formatContractPrice(company.clientsOwe.unpaid)}
            />
            <DirectoryStatCard
              title={t("pages.financialReport.weStillOweVendors")}
              value={formatContractPrice(company.vendorsOwe.unpaid)}
            />
          </>
        ) : null}
        {metric === "ar" ? (
          <DirectoryStatCard
            title={t("pages.financialReport.clientsStillOwe")}
            value={formatContractPrice(company.clientsOwe.unpaid)}
            subtitle={t("pages.financialReport.accountsReceivableHint", {
              overdue: formatContractPrice(company.clientsOwe.overdue),
            })}
            accent="warning"
          />
        ) : null}
        {metric === "ap" ? (
          <DirectoryStatCard
            title={t("pages.financialReport.weStillOweVendors")}
            value={formatContractPrice(company.vendorsOwe.unpaid)}
            subtitle={t("pages.financialReport.accountsPayableHint", {
              overdue: formatContractPrice(company.vendorsOwe.overdue),
            })}
            accent="warning"
          />
        ) : null}
        {metric === "warehouse" ? (
          <DirectoryStatCard
            title={t("pages.financialReport.stockInWarehouse")}
            value={formatContractPrice(company.warehouseStockValue)}
            accent="info"
          />
        ) : null}
        {metric === "overhead" ? (
          <>
            <DirectoryStatCard
              title={t("pages.financialReport.headOfficeOverhead")}
              value={formatContractPrice(company.overhead.total)}
            />
            <DirectoryStatCard
              title={t("pages.financialReport.detail.overheadWages")}
              value={formatContractPrice(company.overhead.wages)}
            />
            <DirectoryStatCard
              title={t("pages.financialReport.detail.overheadPurchases")}
              value={formatContractPrice(company.overhead.internalPurchases)}
            />
            <DirectoryStatCard
              title={t("pages.financialReport.detail.overheadStock")}
              value={formatContractPrice(company.overhead.internalStockUsed)}
            />
          </>
        ) : null}
        {depositMetric ? (
          <>
            <DirectoryStatCard
              title={t("pages.financialReport.depositsHeld")}
              value={formatContractPrice(company.deposits.held)}
              accent="info"
              href={`/billing/financial-report/detail?metric=deposits&${queryString}`}
            />
            <DirectoryStatCard
              title={t("pages.financialReport.depositsReturned")}
              value={formatContractPrice(company.deposits.returned)}
              accent="warning"
              href={`/billing/financial-report/detail?metric=depositsReturned&${queryString}`}
            />
            <DirectoryStatCard
              title={t("pages.financialReport.depositsKept")}
              value={formatContractPrice(company.deposits.kept)}
              accent="success"
              href={`/billing/financial-report/detail?metric=depositsKept&${queryString}`}
            />
          </>
        ) : null}
      </div>

      {metric === "periodNet" || metric === "moneyIn" || metric === "moneyOut" ? (
        <FinancialReportClientDirectory
          clients={clients}
          queryString={queryString}
        />
      ) : null}

      {metric === "moneyOut" ? (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DirectoryStatCard
            title={t("pages.financialReport.detail.overheadWages")}
            value={formatContractPrice(company.overhead.wages)}
          />
          <DirectoryStatCard
            title={t("pages.financialReport.detail.overheadPurchases")}
            value={formatContractPrice(company.overhead.internalPurchases)}
          />
          <DirectoryStatCard
            title={t("pages.financialReport.detail.overheadStock")}
            value={formatContractPrice(company.overhead.internalStockUsed)}
          />
        </div>
      ) : null}

      {metric === "warehouse" ? (
        <SectionCard>
          <p className="text-sm text-subtle">
            {t("pages.financialReport.detail.warehouseHelp")}
          </p>
          <Link
            href="/inventory"
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-4")}
          >
            {t("pages.financialReport.detail.openInventory")}
          </Link>
        </SectionCard>
      ) : null}

      {metric === "overhead" ||
      depositMetric ||
      metric === "netPosition" ||
      metric === "moneyIn" ||
      metric === "moneyOut" ? (
        <SectionCard className="mt-4">
          <p className="text-sm text-subtle">
            {t(`pages.financialReport.detail.${metric}Help`)}
          </p>
        </SectionCard>
      ) : null}

      {heldDeposits.length > 0 ? (
        <SectionCard className="mt-4">
          <h2 className="text-base font-semibold text-text">
            {t("pages.financialReport.depositsHeld")}
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {heldDeposits.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="text-text">
                  {row.employeeName}
                  <span className="ml-2 text-subtle">{row.employeeNo}</span>
                  {row.projectName ? (
                    <span className="ml-2 text-subtle">{row.projectName}</span>
                  ) : null}
                </span>
                <span className="tabular-nums text-text">
                  {formatContractPrice(row.amount)}
                  {row.date ? ` · ${formatDisplayDate(row.date)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {returnedDeposits.length > 0 ? (
        <SectionCard className="mt-4">
          <h2 className="text-base font-semibold text-text">
            {t("pages.financialReport.depositsReturned")}
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {returnedDeposits.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="text-text">
                  {row.employeeName}
                  <span className="ml-2 text-subtle">{row.employeeNo}</span>
                  {row.projectName ? (
                    <span className="ml-2 text-subtle">{row.projectName}</span>
                  ) : null}
                </span>
                <span className="tabular-nums text-text">
                  {formatContractPrice(row.amount)}
                  {` · ${t(`pages.reports.months.${row.month}`)} ${row.year}`}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {keptDeposits.length > 0 ? (
        <SectionCard className="mt-4">
          <h2 className="text-base font-semibold text-text">
            {t("pages.financialReport.depositsKept")}
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {keptDeposits.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="text-text">
                  {row.employeeName}
                  <span className="ml-2 text-subtle">{row.employeeNo}</span>
                  {row.projectName ? (
                    <span className="ml-2 text-subtle">{row.projectName}</span>
                  ) : null}
                </span>
                <span className="tabular-nums text-text">
                  {formatContractPrice(row.amount)}
                  {row.date ? ` · ${formatDisplayDate(row.date)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {arPeriods.length > 0 ? (
        <SectionCard className="mt-4">
          <h2 className="text-base font-semibold text-text">
            {t("pages.financialReport.clientsStillOwe")}
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {arPeriods.map((period) => {
              const amount =
                decimalToNumber(period.revisedInvoiceAmount) ??
                decimalToNumber(period.amount);
              return (
                <li
                  key={period.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span className="text-text">
                    {period.project.name}
                    <span className="ml-2 text-subtle">
                      {period.project.client?.name ?? "—"}
                    </span>
                  </span>
                  <span className="tabular-nums text-text">
                    {amount != null ? formatContractPrice(amount) : "—"}
                    {period.dueAt
                      ? ` · ${formatDisplayDate(period.dueAt)}`
                      : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ) : null}

      {apInvoices.length > 0 ? (
        <SectionCard className="mt-4">
          <h2 className="text-base font-semibold text-text">
            {t("pages.financialReport.weStillOweVendors")}
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {apInvoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <Link
                  href={`/billing/purchase-invoices/${invoice.id}`}
                  className="text-text hover:underline"
                >
                  {invoice.supplierName}
                  <span className="ml-2 text-subtle">{invoice.invoiceRef}</span>
                </Link>
                <span className="tabular-nums text-text">
                  {formatContractPrice(decimalToNumber(invoice.amount))}
                  {` · ${formatDisplayDate(invoice.invoiceDate, {
                    timeZone: "UTC",
                  })}`}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </AppShell>
  );
}
