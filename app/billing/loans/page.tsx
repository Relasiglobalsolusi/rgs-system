import Link from "next/link";
import { redirect } from "next/navigation";

import LoanFacilityCreateDialog from "@/components/billing/LoanFacilityCreateDialog";
import AppShell from "@/components/layout/AppShell";
import PageIntro from "@/components/i18n/PageIntro";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import { listCompanyBankAccountOptions } from "@/lib/company-bank-accounts";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { listLoanFacilitySnapshots } from "@/lib/loan-facility-query";
import { prisma } from "@/lib/prisma";
import { formatContractPrice } from "@/lib/project-billing";
import { requireFinanceChild } from "@/lib/session";

export default async function LoansPage() {
  const session = await requireFinanceChild("loans");
  if (session.user.clientId || session.user.vendorId) {
    redirect("/billing");
  }

  const locale = await getServerLocale();
  const t = createTranslator(locale);

  const [facilities, vendors, bankAccounts] = await Promise.all([
    listLoanFacilitySnapshots(session.user.companyId),
    prisma.vendor.findMany({
      where: { companyId: session.user.companyId, active: true },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    listCompanyBankAccountOptions(session.user.companyId),
  ]);

  const outstanding = facilities.reduce((sum, row) => sum + row.outstanding, 0);
  const nextPayment = facilities
    .filter((row) => row.status === "ACTIVE")
    .reduce((sum, row) => sum + row.suggestedPayment, 0);

  return (
    <AppShell
      titleKey="pages.loans.title"
      descriptionKey="pages.loans.description"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <PageIntro
          titleKey="pages.loans.title"
          descriptionKey="pages.loans.description"
        />
        <LoanFacilityCreateDialog
          vendors={vendors}
          bankAccounts={bankAccounts}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DirectoryStatCard
          compact
          title={t("pages.loans.outstanding")}
          value={formatContractPrice(outstanding)}
          accent={outstanding > 0 ? "warning" : "muted"}
        />
        <DirectoryStatCard
          compact
          title={t("pages.loans.nextPayment")}
          value={formatContractPrice(nextPayment)}
          accent="info"
        />
      </div>

      {facilities.length === 0 ? (
        <SectionCard className="p-5 sm:p-6">
          <EmptyState
            titleKey="pages.loans.emptyTitle"
            descriptionKey="pages.loans.emptyDesc"
          />
        </SectionCard>
      ) : (
        <SectionCard className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-elevated text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  {t("pages.loans.columns.name")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("pages.loans.columns.source")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("pages.loans.columns.lender")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("pages.loans.columns.outstanding")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("pages.loans.columns.next")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("pages.loans.columns.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/billing/loans/${row.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text">
                    {row.source === "SHAREHOLDER"
                      ? t("pages.billing.loanSourceShareholder")
                      : t("pages.billing.loanSourceBank")}
                  </td>
                  <td className="px-4 py-3 text-text">{row.lenderName}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatContractPrice(row.outstanding)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatContractPrice(row.suggestedPayment)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={row.status === "ACTIVE" ? "active" : "inactive"}
                    >
                      {row.status === "ACTIVE"
                        ? t("pages.loans.statusActive")
                        : t("pages.loans.statusClosed")}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}
    </AppShell>
  );
}
