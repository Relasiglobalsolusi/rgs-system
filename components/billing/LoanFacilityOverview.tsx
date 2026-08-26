import type { ReactNode } from "react";

import StatusBadge from "@/components/ui/StatusBadge";
import SectionCard from "@/components/ui/SectionCard";
import { formatDisplayDate } from "@/lib/format-date";
import { createTranslator } from "@/lib/i18n/translate";
import type { LoanFacilitySnapshot } from "@/lib/loan-facility-query";
import { formatContractPrice } from "@/lib/project-billing";

type LoanTranslator = ReturnType<typeof createTranslator>;

function methodLabel(
  method: LoanFacilitySnapshot["calculationMethod"],
  t: LoanTranslator
) {
  if (method === "FLAT") return t("pages.billing.loanCalculationMethodFlat");
  if (method === "EFFECTIVE") {
    return t("pages.billing.loanCalculationMethodEffective");
  }
  if (method === "ANNUITY") {
    return t("pages.billing.loanCalculationMethodAnnuity");
  }
  return "—";
}

function LoanFact({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
        {label}
      </p>
      <p className="text-sm font-semibold leading-snug text-text">{value}</p>
    </div>
  );
}

export default function LoanFacilityOverview({
  facility,
  t,
  actions,
}: {
  facility: LoanFacilitySnapshot;
  t: LoanTranslator;
  actions?: ReactNode;
}) {
  const active = facility.status === "ACTIVE";
  const isStandby = facility.kind === "STANDBY";
  const isTerm = facility.kind === "TERM";
  const interestLabel = facility.chargesInterest
    ? `${
        facility.interestRateBasis === "MONTHLY"
          ? t("pages.billing.loanInterestBasisMonthly")
          : t("pages.billing.loanInterestBasisAnnual")
      } ${facility.annualRatePercent ?? 0}%`
    : t("pages.loans.noInterest");

  return (
    <SectionCard>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-text">
              {facility.name}
            </h2>
            <StatusBadge status={active ? "active" : "inactive"}>
              {active
                ? t("pages.loans.statusActive")
                : t("pages.loans.statusClosed")}
            </StatusBadge>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 xl:grid-cols-4">
            <LoanFact
              label={t("pages.loans.source")}
              value={
                facility.source === "SHAREHOLDER"
                  ? t("pages.billing.loanSourceShareholder")
                  : t("pages.billing.loanSourceBank")
              }
            />
            <LoanFact
              label={t("pages.loans.lenderName")}
              value={facility.lenderName}
            />
            <LoanFact
              label={t("pages.billing.bankLoanKind")}
              value={
                isTerm
                  ? t("pages.billing.bankLoanKindTerm")
                  : t("pages.billing.bankLoanKindStandby")
              }
            />
            <LoanFact
              label={t("pages.loans.startDate")}
              value={formatDisplayDate(facility.startDate, { timeZone: "UTC" })}
            />
            {isStandby && facility.facilityLimit != null ? (
              <LoanFact
                label={t("pages.loans.creditCeiling")}
                value={formatContractPrice(facility.facilityLimit)}
              />
            ) : null}
            {facility.bankAccountLabel ? (
              <LoanFact
                label={t("pages.loans.bankAccount")}
                value={facility.bankAccountLabel}
              />
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-strip text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    {t("pages.loans.variable")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("pages.loans.value")}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/70">
                  <td className="px-4 py-3 text-muted">
                    {t("pages.loans.dayCountYear")}
                  </td>
                  <td className="px-4 py-3 font-medium text-text">
                    {t("pages.loans.dayCountActual", {
                      year: facility.dayCountYear,
                    })}
                  </td>
                </tr>
                <tr className="border-b border-border/70">
                  <td className="px-4 py-3 text-muted">
                    {t("pages.loans.interestRate")}
                  </td>
                  <td className="px-4 py-3 font-medium text-text">
                    {interestLabel}
                  </td>
                </tr>
                {facility.chargesInterest ? (
                  <tr className="border-b border-border/70">
                    <td className="px-4 py-3 text-muted">
                      {t("pages.billing.loanInterestBasis")}
                    </td>
                    <td className="px-4 py-3 font-medium text-text">
                      {facility.interestRateBasis === "MONTHLY"
                        ? t("pages.billing.loanInterestBasisMonthly")
                        : t("pages.billing.loanInterestBasisAnnual")}
                    </td>
                  </tr>
                ) : null}
                {isStandby ? (
                  <>
                    <tr className="border-b border-border/70">
                      <td className="px-4 py-3 text-muted">
                        {t("pages.loans.commitmentFeeApplies")}
                      </td>
                      <td className="px-4 py-3 font-medium text-text">
                        {facility.commitmentFeeApplies
                          ? t("common.actions.yes")
                          : t("common.actions.no")}
                      </td>
                    </tr>
                    {facility.commitmentFeeApplies ? (
                      <tr className="border-b border-border/70">
                        <td className="px-4 py-3 text-muted">
                          {t("pages.billing.loanCommitmentFeeRate")}
                        </td>
                        <td className="px-4 py-3 font-medium text-text">
                          {`${facility.commitmentFeeRatePercent ?? 0}%`}
                        </td>
                      </tr>
                    ) : null}
                  </>
                ) : null}
                {isTerm ? (
                  <>
                    <tr className="border-b border-border/70">
                      <td className="px-4 py-3 text-muted">
                        {t("pages.billing.loanCalculationMethod")}
                      </td>
                      <td className="px-4 py-3 font-medium text-text">
                        {methodLabel(facility.calculationMethod, t)}
                      </td>
                    </tr>
                    {facility.tenorMonths != null ? (
                      <tr className="border-b border-border/70 last:border-0">
                        <td className="px-4 py-3 text-muted">
                          {t("pages.billing.bankLoanTenorMonths")}
                        </td>
                        <td className="px-4 py-3 font-medium text-text">
                          {String(facility.tenorMonths)}
                        </td>
                      </tr>
                    ) : null}
                  </>
                ) : null}
              </tbody>
            </table>
          </div>

          {isStandby ? (
            <p className="max-w-3xl text-sm leading-6 text-muted">
              {t("pages.loans.standbySliceHint")}
            </p>
          ) : null}
          {facility.notes ? (
            <p className="max-w-3xl text-sm leading-6 text-muted">
              {facility.notes}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
