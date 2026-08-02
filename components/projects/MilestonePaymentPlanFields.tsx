"use client";

import { useMemo } from "react";
import {
  employeeDialogFieldClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/use-t";
import {
  buildMilestoneSchedule,
  clampMilestonePaymentCount,
  DEFAULT_MILESTONE_PAYMENTS,
  formatContractPrice,
  formatMilestonePercentDisplay,
  MAX_MILESTONE_PAYMENTS,
  MIN_MILESTONE_PAYMENTS,
  splitEvenlyPercents,
} from "@/lib/project-billing";

type Props = {
  paymentCount: number;
  installmentPercents: number[];
  onPaymentCountChange: (count: number) => void;
  onInstallmentPercentsChange: (percents: number[]) => void;
  /** Optional contract price for amount preview (may be unset at create). */
  contractPrice?: number | null;
};

export default function MilestonePaymentPlanFields({
  paymentCount,
  installmentPercents,
  onPaymentCountChange,
  onInstallmentPercentsChange,
  contractPrice = null,
}: Props) {
  const { t } = useT();
  const sum =
    Math.round(
      installmentPercents.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) *
        100
    ) / 100;
  const sumOk = Math.abs(sum - 100) <= 0.01;

  const schedule = useMemo(() => {
    try {
      return buildMilestoneSchedule(installmentPercents, contractPrice);
    } catch {
      return null;
    }
  }, [installmentPercents, contractPrice]);

  function handleCountChange(raw: string) {
    const next = clampMilestonePaymentCount(Number(raw));
    onPaymentCountChange(next);
    onInstallmentPercentsChange(splitEvenlyPercents(next));
  }

  function splitEvenly() {
    onInstallmentPercentsChange(splitEvenlyPercents(paymentCount));
  }

  function setInstallmentAt(index: number, raw: string) {
    const next = [...installmentPercents];
    const value = raw.trim() === "" ? NaN : Number(raw);
    next[index] = value;
    onInstallmentPercentsChange(next);
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-elevated/60 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-text">
          {t("pages.projects.paymentPlan.title")}
        </p>
        <p className="mt-1 text-xs text-subtle">
          {t("pages.projects.paymentPlan.help")}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className={employeeDialogFieldClass}>
          <label
            htmlFor="milestone-payment-count"
            className="text-sm font-medium text-muted"
          >
            {t("pages.projects.paymentPlan.numberOfPayments")}
          </label>
          <Input
            id="milestone-payment-count"
            type="number"
            min={MIN_MILESTONE_PAYMENTS}
            max={MAX_MILESTONE_PAYMENTS}
            step={1}
            value={paymentCount}
            onChange={(e) => handleCountChange(e.target.value)}
            className={`${employeeInputClass} w-28`}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-border text-text"
          onClick={splitEvenly}
        >
          {t("pages.projects.paymentPlan.splitEvenly")}
        </Button>
        <p className="pb-2 text-xs text-subtle">
          {t("pages.projects.paymentPlan.defaultHint", {
            count: DEFAULT_MILESTONE_PAYMENTS,
          })}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-subtle">
          {t("pages.projects.paymentPlan.eachPaymentPercent")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {installmentPercents.map((pct, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-subtle">
                #{index + 1}
              </span>
              <Input
                name="milestoneInstallmentPercent"
                type="number"
                min={0.01}
                max={100}
                step="0.01"
                value={Number.isFinite(pct) ? pct : ""}
                onChange={(e) => setInstallmentAt(index, e.target.value)}
                required
                className={`${employeeInputClass} h-10`}
                aria-label={t("pages.projects.paymentPlan.paymentPercentAria", {
                  n: index + 1,
                })}
              />
              <span className="text-sm text-subtle">%</span>
            </div>
          ))}
        </div>
        <p
          className={`text-xs ${
            sumOk ? "text-emerald-400/90" : "text-amber-300"
          }`}
        >
          {sumOk
            ? t("pages.projects.paymentPlan.totalReadyToSave", { sum })
            : t("pages.projects.paymentPlan.totalMustEqual100", {
                sum: Number.isFinite(sum) ? sum : 0,
              })}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-subtle">
          {t("pages.projects.paymentPlan.schedulePreview")}
        </p>
        {schedule ? (
          <ul className="divide-y divide-white/10 overflow-hidden rounded-lg border border-border">
            {schedule.map((row) => (
              <li
                key={row.cumulativePercent}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <span className="font-medium text-text">
                  {t("pages.projects.paymentPlan.milestoneLabel", {
                    percent: formatMilestonePercentDisplay(row.cumulativePercent),
                  })}
                </span>
                <span className="text-xs text-subtle">
                  {t("pages.projects.paymentPlan.percentOfContract", {
                    percent: row.installmentPercent,
                  })}
                  {row.amount != null
                    ? ` · ${formatContractPrice(row.amount)}`
                    : t("pages.projects.paymentPlan.amountFromBilling")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-amber-500/20 bg-card-tint-amber px-3 py-2 text-xs text-amber-200">
            {t("pages.projects.paymentPlan.fixPercentagesToPreview")}
          </p>
        )}
      </div>
    </div>
  );
}
