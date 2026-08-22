import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import LoanCloseButton from "@/components/billing/LoanCloseButton";
import LoanMovementDialog from "@/components/billing/LoanMovementDialog";
import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import { listCompanyBankAccountOptions } from "@/lib/company-bank-accounts";
import { formatDisplayDate } from "@/lib/format-date";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { getLoanFacilitySnapshot } from "@/lib/loan-facility-query";
import { formatContractPrice } from "@/lib/project-billing";
import { requireFinanceChild } from "@/lib/session";

export default async function LoanFacilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireFinanceChild("loans");
  if (session.user.clientId || session.user.vendorId) {
    redirect("/billing");
  }

  const { id } = await params;
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const [facility, bankAccounts] = await Promise.all([
    getLoanFacilitySnapshot(session.user.companyId, id),
    listCompanyBankAccountOptions(session.user.companyId),
  ]);
  if (!facility) notFound();

  const active = facility.status === "ACTIVE";

  return (
    <AppShell title={facility.name} descriptionKey="pages.loans.description">
      <BillingBreadcrumbs
        items={[
          { label: t("pages.loans.backToLoans"), href: "/billing/loans" },
          { label: facility.name },
        ]}
      />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-text">
              {facility.name}
            </h2>
            <StatusBadge status={active ? "active" : "inactive"}>
              {active
                ? t("pages.loans.statusActive")
                : t("pages.loans.statusClosed")}
            </StatusBadge>
          </div>
          <p className="mt-1 text-sm text-subtle">
            {facility.source === "SHAREHOLDER"
              ? t("pages.billing.loanSourceShareholder")
              : t("pages.billing.loanSourceBank")}
            {" · "}
            {facility.lenderName}
            {" · "}
            {facility.kind === "TERM"
              ? t("pages.billing.bankLoanKindTerm")
              : t("pages.billing.bankLoanKindStandby")}
          </p>
        </div>
        {active ? (
          <div className="flex flex-wrap gap-2">
            <LoanMovementDialog
              mode="DRAW"
              facility={facility}
              bankAccounts={bankAccounts}
            />
            <LoanMovementDialog
              mode="REPAYMENT"
              facility={facility}
              bankAccounts={bankAccounts}
            />
            <LoanCloseButton
              facilityId={facility.id}
              disabled={facility.outstanding > 0}
            />
          </div>
        ) : null}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DirectoryStatCard
          compact
          title={t("pages.loans.outstanding")}
          value={formatContractPrice(facility.outstanding)}
          accent={facility.outstanding > 0 ? "warning" : "muted"}
        />
        <DirectoryStatCard
          compact
          title={t("pages.loans.drawn")}
          value={formatContractPrice(facility.drawn)}
        />
        <DirectoryStatCard
          compact
          title={t("pages.loans.returned")}
          value={formatContractPrice(facility.principalReturned)}
        />
        <DirectoryStatCard
          compact
          title={t("pages.loans.nextPayment")}
          value={formatContractPrice(facility.suggestedPayment)}
          subtitle={
            facility.interestDue > 0
              ? t("pages.billing.loanPaymentSplit", {
                  interest: formatContractPrice(facility.interestDue),
                  principal: formatContractPrice(facility.principalDue),
                })
              : undefined
          }
          accent="info"
        />
      </div>

      {facility.unusedLimit != null ? (
        <p className="mb-4 text-sm text-subtle">
          {t("pages.loans.unusedLimit")}:{" "}
          <span className="tabular-nums text-text">
            {formatContractPrice(facility.unusedLimit)}
          </span>
        </p>
      ) : null}

      <SectionCard>
        <h3 className="mb-4 text-sm font-semibold text-text">
          {t("pages.loans.movementsTitle")}
        </h3>
        {facility.movements.length === 0 ? (
          <p className="text-sm text-subtle">{t("pages.loans.noMovements")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-4 font-semibold">
                    {t("pages.loans.startDate")}
                  </th>
                  <th className="py-2 pr-4 font-semibold">
                    {t("pages.loans.columns.source")}
                  </th>
                  <th className="py-2 pr-4 font-semibold">
                    {t("pages.billing.loanInterestPaid")}
                  </th>
                  <th className="py-2 pr-4 font-semibold">
                    {t("pages.billing.loanPrincipalReturned")}
                  </th>
                  <th className="py-2 font-semibold">
                    {t("pages.billing.purchaseAmount")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {facility.movements.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-2.5 pr-4">
                      {formatDisplayDate(row.movementDate, { timeZone: "UTC" })}
                      {row.reversedAt ? (
                        <span className="ml-2 text-xs text-danger">
                          {t("pages.billing.purchaseReversed")}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4">
                      {row.kind === "DRAW"
                        ? t("pages.loans.movementDraw")
                        : t("pages.loans.movementReturn")}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">
                      {row.kind === "REPAYMENT"
                        ? formatContractPrice(row.interestAmount)
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">
                      {formatContractPrice(row.principalAmount)}
                    </td>
                    <td className="py-2.5 tabular-nums">
                      {row.purchaseInvoiceId ? (
                        <Link
                          href={`/billing/purchase-invoices/${row.purchaseInvoiceId}`}
                          className="text-primary hover:underline"
                        >
                          {formatContractPrice(row.amount)}
                        </Link>
                      ) : (
                        formatContractPrice(row.amount)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
