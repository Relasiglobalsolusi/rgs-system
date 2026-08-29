import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import LoanEarlySettleDialog from "@/components/billing/LoanEarlySettleDialog";
import LoanExtendDialog from "@/components/billing/LoanExtendDialog";
import LoanFacilityOverview from "@/components/billing/LoanFacilityOverview";
import LoanFacilityVariablesDialog from "@/components/billing/LoanFacilityVariablesDialog";
import LoanMovementDialog from "@/components/billing/LoanMovementDialog";
import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import SectionCard from "@/components/ui/SectionCard";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectoryStatGrid from "@/components/ui/DirectoryStatGrid";
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
  const isStandby = facility.kind === "STANDBY";
  const isTerm = facility.kind === "TERM";
  const showUnused = isStandby && facility.unusedLimit != null;
  const showInstallment = isTerm && facility.monthlyInstallment != null;
  const showCommitment =
    isStandby && facility.commitmentFeeApplies;
  return (
    <AppShell title={facility.name}>
      <BillingBreadcrumbs
        items={[
          { label: t("pages.loans.backToLoans"), href: "/billing/loans" },
          { label: facility.name },
        ]}
      />

      <div className="space-y-6">
        <LoanFacilityOverview
          facility={facility}
          t={t}
          actions={
            active ? (
              isStandby ? (
                <>
                  <LoanFacilityVariablesDialog facility={facility} />
                  <LoanMovementDialog
                    mode="DRAW"
                    facility={facility}
                    bankAccounts={bankAccounts}
                  />
                  <LoanMovementDialog
                    mode="RETURN_PRINCIPAL"
                    facility={facility}
                    bankAccounts={bankAccounts}
                  />
                  <LoanExtendDialog facility={facility} />
                </>
              ) : isTerm ? (
                <>
                  <LoanFacilityVariablesDialog facility={facility} />
                  <LoanExtendDialog facility={facility} />
                  <LoanEarlySettleDialog
                    facility={facility}
                    bankAccounts={bankAccounts}
                  />
                </>
              ) : (
                <LoanFacilityVariablesDialog facility={facility} />
              )
            ) : null
          }
        />

        <DirectoryStatGrid gapClassName="gap-4">
          <DirectoryStatCard
            compact
            title={t("pages.loans.outstandingPrincipal")}
            value={formatContractPrice(facility.outstanding)}
            accent={facility.outstanding > 0 ? "warning" : "muted"}
          />
          <DirectoryStatCard
            compact
            title={t("pages.loans.interestPaidThisMonth")}
            value={formatContractPrice(facility.interestPaidThisMonth)}
          />
          {showUnused ? (
            <DirectoryStatCard
              compact
              title={t("pages.loans.unusedLimit")}
              value={formatContractPrice(facility.unusedLimit ?? 0)}
            />
          ) : null}
          {showCommitment ? (
            <DirectoryStatCard
              compact
              title={t("pages.loans.commitmentFeeThisMonth")}
              value={formatContractPrice(facility.commitmentFeeThisMonth)}
              accent="info"
            />
          ) : null}
          {showInstallment ? (
            <DirectoryStatCard
              compact
              title={t("pages.billing.loanPaymentThisMonthShouldBe")}
              value={formatContractPrice(facility.monthlyInstallment ?? 0)}
              accent="info"
            />
          ) : null}
        </DirectoryStatGrid>

        {isStandby ? (
          <SectionCard>
            <h3 className="mb-5 text-base font-semibold tracking-tight text-text">
              {t("pages.loans.usageSlicesTitle")}
            </h3>
            {facility.usageSlices.length === 0 ? (
              <p className="text-sm leading-6 text-muted">
                {t("pages.loans.sliceEmpty")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="py-3 pr-4 font-semibold">
                        {t("pages.loans.sliceFrom")}
                      </th>
                      <th className="py-3 pr-4 font-semibold">
                        {t("pages.loans.sliceTo")}
                      </th>
                      <th className="py-3 pr-4 font-semibold">
                        {t("pages.loans.sliceAmountUsed")}
                      </th>
                      <th className="py-3 pr-4 font-semibold">
                        {t("pages.loans.sliceDays")}
                      </th>
                      <th className="py-3 font-semibold">
                        {t("pages.loans.sliceInterest")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {facility.usageSlices.map((row) => (
                      <tr
                        key={`${row.from.toISOString()}-${row.to.toISOString()}-${row.outstanding}`}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-3.5 pr-4">
                          {formatDisplayDate(row.from, { timeZone: "UTC" })}
                        </td>
                        <td className="py-3.5 pr-4">
                          {formatDisplayDate(row.to, { timeZone: "UTC" })}
                          {row.open ? (
                            <span className="ml-2 text-xs font-semibold text-accent-teal">
                              {t("pages.loans.sliceOpen")}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3.5 pr-4 tabular-nums">
                          {formatContractPrice(row.outstanding)}
                        </td>
                        <td className="py-3.5 pr-4 tabular-nums">{row.days}</td>
                        <td className="py-3.5 tabular-nums">
                          {formatContractPrice(row.interest)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        ) : null}

        {isStandby && facility.interestMonths.length > 0 ? (
          <SectionCard>
            <h3 className="mb-5 text-base font-semibold tracking-tight text-text">
              {t("pages.loans.interestByMonth")}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-3 pr-4 font-semibold">
                      {t("pages.loans.startDate")}
                    </th>
                    <th className="py-3 font-semibold">
                      {t("pages.billing.loanInterestPaid")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {facility.interestMonths.map((row) => (
                    <tr
                      key={row.yearMonth}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-3.5 pr-4">{row.label}</td>
                      <td className="py-3.5 tabular-nums">
                        {row.invoiceId && row.paid > 0 ? (
                          <Link
                            href={`/billing/purchase-invoices/${row.invoiceId}`}
                            className="text-primary hover:underline"
                          >
                            {formatContractPrice(row.paid)}
                          </Link>
                        ) : (
                          formatContractPrice(row.paid)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        ) : null}

        <SectionCard>
          <h3 className="mb-5 text-base font-semibold tracking-tight text-text">
            {t("pages.loans.movementsTitle")}
          </h3>
          {facility.movements.length === 0 ? (
            <p className="text-sm leading-6 text-muted">
              {t("pages.loans.noMovements")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-3 pr-4 font-semibold">
                      {t("pages.loans.startDate")}
                    </th>
                    <th className="py-3 pr-4 font-semibold">
                      {t("pages.loans.columns.source")}
                    </th>
                    <th className="py-3 pr-4 font-semibold">
                      {t("pages.billing.loanInterestPaid")}
                    </th>
                    <th className="py-3 pr-4 font-semibold">
                      {t("pages.billing.loanPrincipalReturned")}
                    </th>
                    <th className="py-3 font-semibold">
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
                      <td className="py-3.5 pr-4">
                        {formatDisplayDate(row.movementDate, { timeZone: "UTC" })}
                        {row.reversedAt ? (
                          <span className="ml-2 text-xs text-danger">
                            {t("pages.billing.purchaseReversed")}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3.5 pr-4">
                        {row.kind === "DRAW"
                          ? t("pages.loans.movementDraw")
                          : row.feeKind === "PROVISION"
                            ? t("pages.loans.movementProvision")
                            : row.feeKind === "ADMIN_FEE"
                              ? t("pages.loans.movementAdminFee")
                              : row.interestAmount > 0 &&
                                  row.principalAmount <= 0
                                ? t("pages.loans.movementInterest")
                                : t("pages.loans.movementReturn")}
                      </td>
                      <td className="py-3.5 pr-4 tabular-nums">
                        {row.kind === "REPAYMENT"
                          ? formatContractPrice(row.interestAmount)
                          : "—"}
                      </td>
                      <td className="py-3.5 pr-4 tabular-nums">
                        {formatContractPrice(row.principalAmount)}
                      </td>
                      <td className="py-3.5 tabular-nums">
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
      </div>
    </AppShell>
  );
}
