import { redirect } from "next/navigation";

import LoanFacilityCreateDialog from "@/components/billing/LoanFacilityCreateDialog";
import LoanFacilityTable from "@/components/billing/LoanFacilityTable";
import AppShell from "@/components/layout/AppShell";
import PageIntro from "@/components/i18n/PageIntro";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
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

  const outstanding = facilities
    .filter((row) => row.status === "ACTIVE")
    .reduce((sum, row) => sum + row.outstanding, 0);
  const interestPaidThisMonth = facilities.reduce(
    (sum, row) => sum + row.interestPaidThisMonth,
    0
  );

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
          title={t("pages.loans.outstandingPrincipal")}
          value={formatContractPrice(outstanding)}
          accent={outstanding > 0 ? "warning" : "muted"}
        />
        <DirectoryStatCard
          compact
          title={t("pages.loans.interestPaidThisMonth")}
          value={formatContractPrice(interestPaidThisMonth)}
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
        <LoanFacilityTable
          rows={facilities.map((row) => ({
            id: row.id,
            name: row.name,
            source: row.source,
            kind: row.kind,
            lenderName: row.lenderName,
            outstanding: row.outstanding,
            suggestedPayment: row.suggestedPayment,
            status: row.status,
          }))}
        />
      )}
    </AppShell>
  );
}
