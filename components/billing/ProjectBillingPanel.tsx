"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition, useEffect, useMemo } from "react";
import {
  createMilestoneInvoice,
  deleteInvoicePeriod,
  rejectInvoicePaymentVerification,
  submitInvoicePaymentForVerification,
  updateProjectContractPrice,
  verifyInvoicePeriodPayment,
} from "@/app/projects/invoice-actions";
import { sendProgressForClientReview } from "@/app/billing/reconciliation/actions";
import ClientBillingReviewActions from "@/components/billing/ClientBillingReviewActions";
import PaymentReceivedDialog from "@/components/billing/PaymentReceivedDialog";
import ReconcilePeriodDialog from "@/components/billing/ReconcilePeriodDialog";
import TaxInvoiceDoneButton from "@/components/billing/TaxInvoiceDoneButton";
import ContractExtensionsHistory, {
  type ContractExtensionRow,
} from "@/components/projects/ContractExtensionsHistory";
import { findPriorOpenPeriodWarning } from "@/lib/billing";
import { isContractSubCategory } from "@/lib/project-contract";
import StatusBadge, { StackedChipLabel } from "@/components/ui/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { flexibleBadgeChipClassName } from "@/components/ui/trash-action-buttons";
import { cn } from "@/lib/utils";
import { isAwaitingClientAction } from "@/lib/client-billing-review";
import {
  getInvoicePaymentDisplay,
  isMonthlyPeriodAwaitingReconcile,
} from "@/lib/invoice-period";
import {
  formatContractPrice,
  formatInvoicePeriodLabel,
  formatMilestonePeriodLabel,
  dedupeOnCompletionPeriods,
  maxMilestonePercent,
} from "@/lib/project-billing";
import { formatDisplayDate } from "@/lib/format-date";
import {
  localizeBillingChipLines,
  localizeBillingMode,
  localizeBillingPeriodBasis,
  localizeBillingStatus,
} from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import type {
  BillingMode,
  BillingPeriodBasis,
  ClientReviewStatus,
  InvoicePeriodStatus,
  ProjectSubCategory,
} from "@prisma/client";
import { Download, Upload, Eye, FileText } from "lucide-react";

export type BillingPeriodRow = {
  id: string;
  label: string | null;
  periodStart: string;
  periodEnd: string;
  status: InvoicePeriodStatus;
  invoicePdfPath: string | null;
  reportCount: number;
  submittedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  amount: number | null;
  milestonePercent: number | null;
  compileNote?: string | null;
  taxInvoiceRequired?: boolean;
  taxInvoiceDoneAt?: string | null;
  taxInvoiceDocumentPath?: string | null;
  paymentProofPath?: string | null;
  paymentProofUploadedAt?: string | null;
  reconciledAt?: string | null;
  clientReviewStatus?: ClientReviewStatus | string | null;
  reviewReportPdfPath?: string | null;
  hoReviewNote?: string | null;
  hoReviewProofPath?: string | null;
};

type Props = {
  projectId: string;
  projectName: string;
  billingMode: BillingMode | string;
  billingPeriodBasis?: BillingPeriodBasis | string | null;
  contractPrice: number | null;
  invoicingDay: number;
  /** Real contract start (ISO) — drives Regular Cleaning anniversary cycles. */
  startDate?: string | null;
  /** Client payment terms (0 = Cash) — used if a legacy period lacks dueAt. */
  paymentTermsDays?: number | null;
  periods: BillingPeriodRow[];
  canManage: boolean;
  /** Client portal user — show Approve/Revise on pending reviews. */
  isClientPortal?: boolean;
  /** Regular Cleaning only — Contract Extensions history. */
  subCategory?: ProjectSubCategory | string | null;
  contractExtensions?: ContractExtensionRow[];
};

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function priceToInput(value: number | null): string {
  if (value == null) return "";
  return String(Math.round(value));
}

export default function ProjectBillingPanel({
  projectId,
  projectName,
  billingMode,
  billingPeriodBasis = null,
  contractPrice,
  invoicingDay,
  startDate,
  paymentTermsDays,
  periods: periodsProp,
  canManage,
  isClientPortal = false,
  subCategory = null,
  contractExtensions = [],
}: Props) {
  const { t, locale } = useT();
  const showExtensions = isContractSubCategory(subCategory);
  const [paymentDialogPeriodId, setPaymentDialogPeriodId] = useState<
    string | null
  >(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [priceInput, setPriceInput] = useState(priceToInput(contractPrice));
  const isMonthly = billingMode === "MONTHLY";
  const isMilestone = billingMode === "MILESTONE";
  const price = contractPrice;
  const periods = useMemo(
    () => dedupeOnCompletionPeriods(periodsProp, billingMode),
    [periodsProp, billingMode]
  );
  const dueToInvoiceCount = useMemo(() => {
    if (!isMonthly) return 0;
    const now = new Date();
    return periods.filter((p) =>
      isMonthlyPeriodAwaitingReconcile(
        {
          status: p.status,
          periodEnd: new Date(p.periodEnd),
          reconciledAt: p.reconciledAt,
        },
        now
      )
    ).length;
  }, [isMonthly, periods]);

  useEffect(() => {
    setPriceInput(priceToInput(contractPrice));
  }, [contractPrice]);

  const priorMax = maxMilestonePercent(
    periods.map((p) => ({
      milestonePercent: p.milestonePercent ?? null,
      status: p.status,
    }))
  );

  const scheduledReady = useMemo(
    () =>
      periods.filter(
        (p) =>
          p.milestonePercent != null &&
          (p.status === "ONGOING" || p.status === "COMPILING")
      ),
    [periods]
  );

  const hasSchedule = scheduledReady.length > 0 || periods.some(
    (p) => p.milestonePercent != null
  );

  const nextMilestone = useMemo(() => {
    return scheduledReady
      .filter((p) => (p.milestonePercent ?? 0) > priorMax)
      .sort(
        (a, b) => (a.milestonePercent ?? 0) - (b.milestonePercent ?? 0)
      )[0] ?? null;
  }, [scheduledReady, priorMax]);

  function run(action: () => Promise<unknown>, errorLabel: string) {
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, errorLabel);
      }
    });
  }

  function saveContractPrice() {
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("contractPrice", priceInput);
    run(
      () => updateProjectContractPrice(formData),
      t("pages.billing.saveContractPriceFailed")
    );
  }

  function invoiceNextMilestone() {
    if (!nextMilestone) return;
    run(
      () => sendProgressForClientReview(nextMilestone.id),
      t("pages.billing.createMilestoneFailed")
    );
  }

  /** Legacy projects without a pre-built schedule. */
  function submitAdHocMilestone(percent: number) {
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("milestonePercent", String(percent));
    run(
      () => createMilestoneInvoice(formData),
      t("pages.billing.createMilestoneFailed")
    );
  }

  function confirmDeletePeriod(period: BillingPeriodRow) {
    const label =
      formatInvoicePeriodLabel(period, { projectName, billingMode, locale }) ||
      period.label ||
      t("pages.billing.thisBillingPeriod");

    if (period.status === "PAID") {
      showRejection({ reasons: t("pages.billing.paidInvoiceCannotDelete") });
      return;
    }

    const isIssued =
      period.status === "AWAITING_PAYMENT" ||
      period.status === "OVERDUE" ||
      period.status === "PENDING_VERIFICATION";
    const message = isIssued
      ? t("pages.billing.deleteIssuedInvoiceConfirm", { label })
      : t("pages.billing.deletePeriodConfirm", { label });

    if (!window.confirm(message)) return;

    run(async () => {
      await deleteInvoicePeriod(period.id);
      router.refresh();
    }, t("pages.billing.deletePeriodFailed"));
  }

  function submitPaymentProof(periodId: string, file: File | null | undefined) {
    if (!file || file.size <= 0) {
      showRejection({ reasons: t("pages.billing.choosePaymentProof") });
      return;
    }
    const formData = new FormData();
    formData.set("periodId", periodId);
    formData.set("paymentProof", file);
    run(async () => {
      await submitInvoicePaymentForVerification(formData);
      router.refresh();
    }, t("pages.billing.submitPaymentFailed"));
  }

  function verifyPayment(periodId: string) {
    if (!window.confirm(t("pages.billing.verifyPaymentConfirm"))) {
      return;
    }
    run(async () => {
      const result = await verifyInvoicePeriodPayment(periodId);
      if (result.movedToHistory) {
        router.push("/projects?view=completed");
      }
      router.refresh();
    }, t("pages.billing.verifyPaymentFailed"));
  }

  function rejectPayment(periodId: string) {
    if (!window.confirm(t("pages.billing.rejectPaymentConfirm"))) {
      return;
    }
    run(async () => {
      await rejectInvoicePaymentVerification(periodId);
      router.refresh();
    }, t("pages.billing.rejectPaymentFailed"));
  }

  const modeLabel = localizeBillingMode(billingMode, locale);
  const basisLabel = isMonthly
    ? localizeBillingPeriodBasis(
        billingPeriodBasis ?? "CONTRACT_CYCLE",
        locale
      )
    : null;
  const priorOpenWarn = useMemo(
    () =>
      isMonthly
        ? findPriorOpenPeriodWarning(
            periods.map((p) => ({
              id: p.id,
              label: p.label,
              periodStart: p.periodStart,
              status: p.status,
            }))
          )
        : null,
    [isMonthly, periods]
  );

  return (
    <div className="space-y-6">
      {canManage && priorOpenWarn ? (
        <p className="rounded-xl border border-amber-500/25 bg-card-tint-amber px-4 py-3 text-sm text-amber-200">
          {t("pages.billing.priorPeriodOpenWarn", {
            open: priorOpenWarn.openLabel,
            next: priorOpenWarn.nextLabel,
          })}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-elevated px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-subtle">
            {t("pages.billing.billingMode")}
          </p>
          <p className="mt-1 text-lg font-semibold text-text">{modeLabel}</p>
          {isMonthly && basisLabel ? (
            <p className="mt-1 text-xs font-medium text-muted">
              {t("pages.billing.billingPeriodBasis")}: {basisLabel}
            </p>
          ) : null}
          {isMonthly && (
            <p className="mt-1 text-xs text-subtle">
              {billingPeriodBasis === "CALENDAR_MONTH"
                ? t("pages.billing.calendarMonthInvoiceDay")
                : t("pages.billing.anniversaryInvoiceDay", {
                    day: invoicingDay,
                  })}
              {startDate
                ? t("pages.billing.cycleFrom", {
                    date: formatDisplayDate(startDate),
                  })
                : ""}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-elevated px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-subtle">
            {t("pages.billing.contractPrice")}
          </p>
          {canManage ? (
            <div className="mt-2 space-y-2">
              <Input
                type="number"
                min={1}
                step="1"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder={t("pages.billing.amountExampleLarge")}
                className="h-9 border-border bg-elevated text-text"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="badge"
                  variant="successBadge"
                  className={flexibleBadgeChipClassName}
                  disabled={pending || !priceInput.trim()}
                  onClick={saveContractPrice}
                >
                  {pending
                    ? t("common.actions.saving")
                    : price == null
                      ? t("common.actions.save")
                      : t("common.actions.update")}
                </Button>
                {price != null && (
                  <p className="text-xs text-subtle">
                    {t("pages.billing.savedPrice", {
                      price: formatContractPrice(price),
                    })}
                  </p>
                )}
              </div>
              {!isMilestone && (
                <p className="text-xs text-subtle">
                  {t("pages.billing.contractPriceMonthlyHint")}
                </p>
              )}
              {isMilestone && (
                <p className="text-xs text-subtle">
                  {t("pages.billing.contractPriceMilestoneHint")}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-lg font-semibold text-text">
              {formatContractPrice(price)}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-elevated px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-subtle">
            {t("pages.billing.periods")}
          </p>
          <p className="mt-1 text-lg font-semibold text-text">
            {periods.length}
          </p>
          {isMilestone && (
            <p className="mt-1 text-xs text-subtle">
              {t("pages.billing.invoicedThrough", { percent: priorMax })}
            </p>
          )}
        </div>
      </div>

      {canManage && price == null && (
        <p className="rounded-xl border border-amber-500/25 bg-card-tint-amber px-4 py-3 text-sm text-amber-200">
          {isMilestone
            ? t("pages.billing.setPriceBeforeMilestone")
            : t("pages.billing.setPriceBeforeCompile")}
        </p>
      )}

      {canManage && isMonthly && dueToInvoiceCount > 0 && (
        <p className="rounded-xl border border-amber-500/25 bg-card-tint-amber px-4 py-3 text-sm text-amber-200">
          {t("pages.billing.cyclesReadyOnProject", {
            count: dueToInvoiceCount,
          })}
        </p>
      )}

      {isMilestone && canManage && priorMax < 100 && nextMilestone && (
        <div className="rounded-xl border border-border bg-elevated px-4 py-4">
          <p className="text-sm font-medium text-text">
            {t("pages.billing.nextMilestone")}
          </p>
          <p className="mt-1 text-xs text-subtle">
            {t("pages.billing.nextMilestoneDesc")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-text">
              {formatMilestonePeriodLabel(nextMilestone, projectName, locale) ??
                nextMilestone.label ??
                `${nextMilestone.milestonePercent}%`}
              {nextMilestone.amount != null || price != null ? (
                <span className="ml-2 text-subtle">
                  {formatContractPrice(
                    nextMilestone.amount ??
                      (price != null && nextMilestone.milestonePercent != null
                        ? (price * (nextMilestone.milestonePercent - priorMax)) /
                          100
                        : null)
                  )}
                </span>
              ) : null}
            </p>
            <Button
              size="badge"
              variant="successBadge"
              className={cn(flexibleBadgeChipClassName, "whitespace-normal")}
              disabled={
                pending ||
                price == null ||
                nextMilestone.amount === 0
              }
              onClick={invoiceNextMilestone}
            >
              {pending ? (
                t("pages.billing.invoicing")
              ) : (
                <StackedChipLabel
                  lines={[
                    t("pages.billing.invoiceMilestone1"),
                    t("pages.billing.invoiceMilestone2"),
                  ]}
                />
              )}
            </Button>
          </div>
        </div>
      )}

      {isMilestone && canManage && priorMax < 100 && !hasSchedule && (
        <div className="rounded-xl border border-border bg-elevated px-4 py-4">
          <p className="text-sm font-medium text-text">
            {t("pages.billing.createProgressInvoice")}
          </p>
          <p className="mt-1 text-xs text-subtle">
            {t("pages.billing.createProgressInvoiceDesc")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[30, 60, 100]
              .filter((p) => p > priorMax)
              .map((preset) => (
                <Button
                  key={preset}
                  size="badge"
                  variant="mutedBadge"
                  disabled={pending || price == null}
                  onClick={() => submitAdHocMilestone(preset)}
                >
                  {preset}%
                </Button>
              ))}
          </div>
        </div>
      )}

      {isMonthly && (
        <p className="text-sm text-subtle">
          {t("pages.billing.monthlyBillingHelp")}
        </p>
      )}

      {periods.length === 0 ? (
        <p className="text-subtle">
          {isMilestone
            ? t("pages.billing.noMilestonePeriods")
            : t("pages.billing.noInvoicePeriods")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-elevated">
              <tr className="border-b border-border text-[11px] uppercase tracking-[0.14em] text-subtle">
                <th className="h-11 px-4 py-3 font-semibold">
                  {t("pages.billing.columns.period")}
                </th>
                <th className="h-11 px-4 py-3 font-semibold">
                  {t("pages.billing.issued")}
                </th>
                <th className="h-11 px-4 py-3 font-semibold">
                  {t("pages.billing.columns.due")}
                </th>
                <th className="h-11 px-4 py-3 font-semibold">
                  {t("pages.billing.columns.amount")}
                </th>
                <th className="h-11 px-4 py-3 text-center font-semibold">
                  {t("pages.billing.columns.status")}
                </th>
                <th className="h-11 px-4 py-3 font-semibold">
                  {t("common.labels.time")}
                </th>
                <th className="h-11 px-4 py-3 pr-10 text-center font-semibold">
                  {t("common.labels.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => {
                const display = getInvoicePaymentDisplay({
                  status: period.status,
                  submittedAt: toDate(period.submittedAt),
                  dueAt: toDate(period.dueAt),
                  paidAt: toDate(period.paidAt),
                  paymentTermsDays,
                });
                const amount = period.amount ?? price;
                const isNextReady =
                  isMilestone &&
                  nextMilestone?.id === period.id &&
                  (period.status === "ONGOING" || period.status === "COMPILING");
                const monthlyAwaitingReconcile =
                  isMonthly &&
                  isMonthlyPeriodAwaitingReconcile({
                    status: period.status,
                    periodEnd: new Date(period.periodEnd),
                    reconciledAt: period.reconciledAt,
                  });
                const clientReviewPending =
                  period.status === "AWAITING_CLIENT_REVIEW" &&
                  isAwaitingClientAction(period.clientReviewStatus);
                return (
                  <Fragment key={period.id}>
                  <tr
                    className="border-b border-border last:border-0 hover:bg-elevated"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-text">
                        {formatInvoicePeriodLabel(period, {
                          projectName,
                          billingMode,
                          locale,
                        })}
                      </p>
                      <p className="mt-0.5 text-xs text-subtle">
                        {t(
                          period.reportCount === 1
                            ? "pages.billing.reportCountOne"
                            : "pages.billing.reportCountOther",
                          { count: period.reportCount }
                        )}
                        {period.milestonePercent != null
                          ? t("pages.billing.percentOfProject", {
                              percent: period.milestonePercent,
                            })
                          : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-muted">
                      {period.submittedAt
                        ? formatDisplayDate(period.submittedAt)
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-muted">
                      {display.dueAt
                        ? formatDisplayDate(display.dueAt, { timeZone: "UTC" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-text">
                      {amount != null ? (
                        <span>
                          {formatContractPrice(amount)}
                          {period.amount == null &&
                            price != null &&
                            (period.status === "ONGOING" ||
                              period.status === "COMPILING") && (
                              <span className="mt-0.5 block text-xs text-subtle">
                                {t("pages.billing.fromContractPrice")}
                              </span>
                            )}
                          {isMilestone &&
                            period.amount === 0 &&
                            period.status !== "PAID" && (
                              <span className="mt-0.5 block text-xs text-subtle">
                                {t("pages.billing.nothingLeftAfterRevision")}
                              </span>
                            )}
                          {period.compileNote?.includes(
                            "Contract price revised"
                          ) && (
                            <span className="mt-0.5 block text-xs text-amber-300/90">
                              {t("pages.billing.pdfMayShowPrevious")}
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-1.5">
                        {isMilestone &&
                        (period.status === "ONGOING" ||
                          period.status === "COMPILING") ? (
                          <StatusBadge
                            status="pending"
                            compact
                            lines={localizeBillingChipLines(
                              "readyToInvoice",
                              locale
                            )}
                          />
                        ) : monthlyAwaitingReconcile ? (
                          <StatusBadge
                            status="warning"
                            compact
                            lines={localizeBillingChipLines(
                              "readyToReconcile",
                              locale
                            )}
                          />
                        ) : clientReviewPending ||
                          period.status === "AWAITING_CLIENT_REVIEW" ? (
                          <StatusBadge
                            status="pending"
                            compact
                            lines={localizeBillingChipLines(
                              "awaitingClientReview",
                              locale
                            )}
                          />
                        ) : (
                          <StatusBadge
                            status={display.tone}
                            compact
                            lines={
                              display.chipLines
                                ? localizeBillingChipLines(
                                    display.key === "LATE"
                                      ? "latePayment"
                                      : display.key === "PENDING_VERIFICATION"
                                        ? "verifyingPayment"
                                        : display.key ===
                                            "AWAITING_CLIENT_REVIEW"
                                          ? "awaitingClientReview"
                                          : "awaitingPayment",
                                    locale
                                  )
                                : undefined
                            }
                          >
                            {display.chipLines
                              ? undefined
                              : localizeBillingStatus(display.key, locale)}
                          </StatusBadge>
                        )}
                        {period.taxInvoiceRequired &&
                        !period.taxInvoiceDoneAt ? (
                          <StatusBadge
                            status="pending"
                            compact
                            lines={localizeBillingChipLines(
                              "taxInvoiceDue",
                              locale
                            )}
                          />
                        ) : null}
                        {period.taxInvoiceRequired &&
                        period.taxInvoiceDoneAt ? (
                          <StatusBadge
                            status="success"
                            compact
                            lines={localizeBillingChipLines(
                              "taxInvoiceDone",
                              locale
                            )}
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-subtle">
                      {display.daysSinceInvoiced != null && (
                        <p>
                          {t(
                            display.daysSinceInvoiced === 1
                              ? "pages.billing.daysSinceInvoicedOne"
                              : "pages.billing.daysSinceInvoicedOther",
                            { count: display.daysSinceInvoiced }
                          )}
                        </p>
                      )}
                      {display.isLate && display.daysOverdue != null && (
                        <p className="mt-0.5 text-red-300">
                          {t(
                            display.daysOverdue === 1
                              ? "pages.billing.daysOverdueOne"
                              : "pages.billing.daysOverdueOther",
                            { count: display.daysOverdue }
                          )}
                        </p>
                      )}
                      {period.paidAt && (
                        <p className="mt-0.5 text-emerald-400/80">
                          {t("pages.billing.paidOn", {
                            date: formatDisplayDate(period.paidAt),
                          })}
                        </p>
                      )}
                      {period.status === "PENDING_VERIFICATION" &&
                        period.paymentProofUploadedAt && (
                          <p className="mt-0.5 text-amber-300/90">
                            {t("pages.billing.proofUploadedOn", {
                              date: formatDisplayDate(
                                period.paymentProofUploadedAt
                              ),
                            })}
                          </p>
                        )}
                      {display.daysSinceInvoiced == null &&
                        !period.paidAt &&
                        !display.isLate &&
                        period.status !== "PENDING_VERIFICATION" && (
                          <span className="text-muted">—</span>
                        )}
                    </td>
                    <td className="px-4 py-3.5 pr-10 text-center">
                      <div className="inline-flex max-w-full flex-col items-center justify-center gap-2">
                        <div className="hidden max-w-full flex-wrap items-center justify-center gap-2 has-[>*]:inline-flex">
                          {period.paymentProofPath && (
                            <a
                              href={period.paymentProofPath}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                buttonVariants({
                                  variant: "infoBadge",
                                  size: "badge",
                                }),
                                flexibleBadgeChipClassName
                              )}
                            >
                              <Eye className="h-3.5 w-3.5 shrink-0" />
                              {t("pages.billing.viewProof")}
                            </a>
                          )}
                          {period.taxInvoiceDocumentPath && (
                            <a
                              href={period.taxInvoiceDocumentPath}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                buttonVariants({
                                  variant: "infoBadge",
                                  size: "badge",
                                }),
                                flexibleBadgeChipClassName
                              )}
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              {t("pages.billing.viewTaxInvoice")}
                            </a>
                          )}
                          {!canManage &&
                            (period.status === "AWAITING_PAYMENT" ||
                              period.status === "OVERDUE") && (
                              <label
                                className={cn(
                                  buttonVariants({
                                    variant: "warningBadge",
                                    size: "badge",
                                  }),
                                  flexibleBadgeChipClassName,
                                  "cursor-pointer gap-1"
                                )}
                              >
                                <Upload className="h-3.5 w-3.5" />
                                {pending
                                  ? t("common.actions.submitting")
                                  : t("pages.billing.submitPayment")}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                                  className="sr-only"
                                  disabled={pending}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = "";
                                    submitPaymentProof(period.id, file);
                                  }}
                                />
                              </label>
                            )}
                          {!canManage &&
                            period.status === "PENDING_VERIFICATION" && (
                              <span className="text-xs text-subtle">
                                {t("pages.billing.awaitingVerification")}
                              </span>
                            )}
                          {canManage && isNextReady && period.amount !== 0 && (
                            <Button
                              size="badge"
                              variant="successBadge"
                              className={flexibleBadgeChipClassName}
                              disabled={pending || price == null}
                              onClick={() =>
                                run(
                                  () => sendProgressForClientReview(period.id),
                                  t("pages.billing.invoiceMilestoneFailed")
                                )
                              }
                            >
                              {t("pages.reconciliation.sendForClientReview")}
                            </Button>
                          )}
                          {canManage && monthlyAwaitingReconcile && (
                            <ReconcilePeriodDialog
                              periodId={period.id}
                              periodLabel={
                                formatInvoicePeriodLabel(period, {
                                  projectName,
                                  billingMode,
                                  locale,
                                }) ||
                                period.label ||
                                t("pages.billing.thisBillingPeriod")
                              }
                              suggestedAmount={amount ?? price}
                              disabled={pending}
                            />
                          )}
                          {period.reviewReportPdfPath &&
                            period.status === "AWAITING_CLIENT_REVIEW" &&
                            !isClientPortal && (
                              <a
                                href={period.reviewReportPdfPath}
                                target="_blank"
                                rel="noreferrer"
                                className={cn(
                                  buttonVariants({
                                    variant: "outline",
                                    size: "badge",
                                  }),
                                  flexibleBadgeChipClassName
                                )}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                {t("pages.reconciliation.viewReport")}
                              </a>
                            )}
                          {canManage &&
                            (period.status === "AWAITING_PAYMENT" ||
                              period.status === "OVERDUE") && (
                              <Button
                                size="badge"
                                variant="successBadge"
                                className={cn(
                                  flexibleBadgeChipClassName,
                                  "whitespace-normal"
                                )}
                                disabled={pending}
                                onClick={() =>
                                  setPaymentDialogPeriodId(period.id)
                                }
                              >
                                {pending ? (
                                  t("common.actions.saving")
                                ) : (
                                  <StackedChipLabel
                                    lines={[
                                      t("pages.billing.paymentReceived1"),
                                      t("pages.billing.paymentReceived2"),
                                    ]}
                                  />
                                )}
                              </Button>
                            )}
                          {canManage &&
                            period.status === "PENDING_VERIFICATION" && (
                              <>
                                <Button
                                  size="badge"
                                  variant="successBadge"
                                  disabled={pending}
                                  onClick={() => verifyPayment(period.id)}
                                >
                                  {t("common.actions.confirm")}
                                </Button>
                                <Button
                                  size="badge"
                                  variant="destructiveBadge"
                                  disabled={pending}
                                  onClick={() => rejectPayment(period.id)}
                                >
                                  {t("common.actions.reject")}
                                </Button>
                              </>
                            )}
                          {canManage &&
                            period.taxInvoiceRequired &&
                            !period.taxInvoiceDoneAt && (
                              <TaxInvoiceDoneButton
                                periodId={period.id}
                                projectName={
                                  period.label ??
                                  t("pages.billing.billingPeriod")
                                }
                                periodLabel={
                                  period.label ??
                                  t("pages.billing.billingPeriod")
                                }
                              />
                            )}
                        </div>
                        {(period.invoicePdfPath ||
                          (canManage && period.status !== "PAID")) && (
                          <div className="inline-flex items-center justify-center gap-2">
                            {period.invoicePdfPath && (
                              <a
                                href={period.invoicePdfPath}
                                target="_blank"
                                rel="noreferrer"
                                className={cn(
                                  buttonVariants({
                                    variant: "infoBadge",
                                    size: "badge",
                                  }),
                                  flexibleBadgeChipClassName
                                )}
                              >
                                <Download className="h-3.5 w-3.5 shrink-0" />
                                {t("pages.billing.downloadPdf")}
                              </a>
                            )}
                            {canManage && period.status !== "PAID" && (
                              <Button
                                size="badge"
                                variant="destructiveBadge"
                                className={flexibleBadgeChipClassName}
                                disabled={pending}
                                onClick={() => confirmDeletePeriod(period)}
                              >
                                {t("common.actions.delete")}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isClientPortal && clientReviewPending ? (
                    <tr className="border-b border-border bg-elevated/30">
                      <td colSpan={7} className="px-4 py-3">
                        <ClientBillingReviewActions
                          periodId={period.id}
                          reviewReportPdfPath={
                            period.reviewReportPdfPath ?? null
                          }
                          hoReviewNote={period.hoReviewNote}
                          hoReviewProofPath={period.hoReviewProofPath}
                          showHoRejection={
                            period.clientReviewStatus ===
                            "HO_REJECTED_REVISION"
                          }
                        />
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showExtensions ? (
        <ContractExtensionsHistory
          extensions={contractExtensions}
          className="border-t border-border pt-6"
        />
      ) : null}

      {paymentDialogPeriodId ? (
        <PaymentReceivedDialog
          open
          onOpenChange={(open) => {
            if (!open) setPaymentDialogPeriodId(null);
          }}
          periodId={paymentDialogPeriodId}
          projectName={projectName}
          movesToHistoryWhenFullyPaid={false}
          onSuccess={(result) => {
            setPaymentDialogPeriodId(null);
            if (result.movedToHistory) {
              router.push("/projects?view=completed");
            }
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
