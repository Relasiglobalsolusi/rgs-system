"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  cancelInternalPayrollUnlock,
  decideInternalPayrollDay,
  deletePayrollDeduction,
  generateAndLockInternalPayroll,
  requestInternalPayrollUnlock,
} from "@/app/billing/payroll-actions";
import PayrollDeductionDialog from "@/components/billing/PayrollDeductionDialog";
import PayrollOvertimeDialog from "@/components/billing/PayrollOvertimeDialog";
import { cardTintWash } from "@/components/ui/card-tint";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { employeeSelectTriggerClass } from "@/components/employees/employee-dialog-ui";
import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import type {
  PayrollCatalogItem,
  PayrollDeductionRow,
  PayrollProjectOption,
} from "@/lib/internal-payroll-month";
import { INTERNAL_PAYROLL_WORKING_DAYS_DIVISOR } from "@/lib/internal-payroll-month";
import type { PayrollDayRow } from "@/lib/internal-payroll-days";
import type { InternalPayrollChangeRow } from "@/lib/internal-payroll-audit";
import type { InternalPayrollLockState } from "@/lib/internal-payroll-lock";
import type { PayrollUnlockRequestView } from "@/lib/payroll-unlock-request";
import {
  hasHeldSecurityDeposit,
  isPayrollPayableType,
  PAYROLL_DEDUCTION_LABEL_KEY,
} from "@/lib/payroll-deductions";
import {
  currentPayrollPeriod,
  formatPayrollPeriodRange,
  listPayrollPeriodChoices,
  parsePayrollPeriodKey,
  payrollPeriodKey,
  type PayrollRunKind,
} from "@/lib/internal-payroll-period";
import {
  formatDisplayDateTime,
  formatEnglishOrdinalDate,
  formatDisplayTime,
} from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { formatHoursWorked } from "@/lib/shift-pay";
import { chipScrollRowClassName, pageToolbarRowClassName } from "@/components/ui/chip-scroll-row";
import { cn } from "@/lib/utils";

export type PayrollRow = {
  employeeId: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  basePay: number;
  dailyRate: number;
  daysWorked: number;
  wage: number;
  bpjsKesehatan: number;
  bpjsTk: number;
  totalDeduction: number;
  netPay: number;
  depositStatus?: "NONE" | "HELD" | "RETURNED" | "KEPT_BY_COMPANY";
  depositHeldAmount?: number;
  securityDepositRequired?: boolean;
  deductions?: PayrollDeductionRow[];
  days?: PayrollDayRow[];
  cicoExempt?: boolean;
  overtimeEnabled?: boolean;
  coveredShifts?: number;
  surplusShifts?: number;
  doubleShiftDays?: number;
};

type Props = {
  year: number;
  month: number;
  preview?: boolean;
  rows: PayrollRow[];
  items: PayrollCatalogItem[];
  projects: PayrollProjectOption[];
  lock?: InternalPayrollLockState;
  unlockRequest?: PayrollUnlockRequestView | null;
  run?: PayrollRunKind;
  /** Permanent change record for this period. */
  changes?: InternalPayrollChangeRow[];
};

function jakartaTime(value: string | null, bcp47: string) {
  if (!value) return "—";
  return formatDisplayTime(
    value,
    {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
    bcp47
  );
}

function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      // Fall through to the plain filename.
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || null;
}

function canEditDayPay(day: PayrollDayRow) {
  if (day.unpaidSurplus) return false;
  if (day.absent || day.onLeave || day.off) return false;
  return (
    day.needsPayDecision === true ||
    day.payDecision === "FULL_PAY" ||
    day.payDecision === "CUSTOM"
  );
}

function dayCheckInLabel(
  row: PayrollRow,
  day: PayrollDayRow,
  t: ReturnType<typeof useT>["t"],
  bcp47: string
) {
  if (row.cicoExempt) return t("pages.payroll.exempt");
  if (day.onLeave && !day.checkInAt) return t("pages.payroll.onLeave");
  if (day.off && !day.checkInAt) return t("pages.payroll.restDay");
  if (day.absent && !day.checkInAt) return t("pages.payroll.absent");
  return jakartaTime(day.checkInAt, bcp47);
}

function dayCheckOutLabel(
  row: PayrollRow,
  day: PayrollDayRow,
  t: ReturnType<typeof useT>["t"],
  bcp47: string
) {
  if (row.cicoExempt) return t("pages.payroll.exempt");
  if ((day.off || day.absent) && !day.checkOutAt) return "—";
  return jakartaTime(day.checkOutAt, bcp47);
}

export default function PayrollPanel({
  year,
  month,
  preview = false,
  rows,
  items,
  projects,
  lock,
  unlockRequest = null,
  run = "PROJECT_CYCLE",
  changes = [],
}: Props) {
  const { t, bcp47 } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deducting, setDeducting] = useState<PayrollRow | null>(null);
  const [overtimeRow, setOvertimeRow] = useState<PayrollRow | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    {}
  );
  const [employeeQuery, setEmployeeQuery] = useState("");
  const periodLocked = lock?.locked === true;

  const current = useMemo(() => currentPayrollPeriod(undefined, run), [run]);
  const periodOptions = useMemo(
    () => listPayrollPeriodChoices({ selected: { year, month }, run }),
    [year, month, run]
  );
  const selectedKey = payrollPeriodKey({ year, month });
  const selectedRange = formatPayrollPeriodRange(year, month, bcp47, run);

  function decideDay(
    employeeId: string,
    dateKey: string,
    decision: "FULL_PAY" | "CUSTOM",
    amount?: string
  ) {
    if (periodLocked) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("employeeId", employeeId);
        formData.set("dateKey", dateKey);
        formData.set("year", String(year));
        formData.set("month", String(month));
        formData.set("run", run);
        formData.set("decision", decision);
        if (decision === "CUSTOM") {
          formData.set("amount", amount ?? "");
        }
        await decideInternalPayrollDay(formData);
        router.refresh();
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.payroll.errors.decideFailed")
        );
      }
    });
  }

  async function downloadPayrollFile(options: {
    url: string;
    fallbackName: string;
    failedMessage: string;
  }) {
    const response = await fetch(options.url);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        missing?: { name: string; fields: string[] }[];
      } | null;
      if (payload?.missing?.length) {
        showRejection({
          title: t("pages.payroll.errors.bankTransferBlockedTitle"),
          description: t("pages.payroll.errors.bankTransferBlockedDesc"),
          reasons: payload.missing.map(
            (row) => `${row.name} — ${row.fields.join(", ")}`
          ),
        });
        return;
      }
      throw new Error(payload?.error || options.failedMessage);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download =
      fileNameFromDisposition(response.headers.get("Content-Disposition")) ??
      options.fallbackName;
    link.click();
    URL.revokeObjectURL(objectUrl);
    router.refresh();
  }

  function exportPayrollPdf() {
    setLockConfirmOpen(false);
    startTransition(async () => {
      try {
        if (!periodLocked) {
          const formData = new FormData();
          formData.set("year", String(year));
          formData.set("month", String(month));
          formData.set("run", run);
          formData.set("confirmLock", "1");
          await generateAndLockInternalPayroll(formData);
        }
        await downloadPayrollFile({
          url: `/api/payroll/export?year=${year}&month=${month}&run=${run}`,
          fallbackName: `internal-payroll-${year}-${String(month).padStart(2, "0")}.pdf`,
          failedMessage: t("pages.payroll.errors.exportFailed"),
        });
      } catch (error) {
        showRejectionFromError(error, t("pages.payroll.errors.exportFailed"));
      }
    });
  }

  function requestPayrollPdf() {
    // Generating locks the period, so say so before it happens.
    if (periodLocked) {
      exportPayrollPdf();
      return;
    }
    setLockConfirmOpen(true);
  }

  function exportBankTransfer() {
    startTransition(async () => {
      try {
        await downloadPayrollFile({
          url: `/api/payroll/bank-transfer?year=${year}&month=${month}&run=${run}`,
          fallbackName: `internal-payroll-bank-transfer-${year}-${String(month).padStart(2, "0")}.xlsm`,
          failedMessage: t("pages.payroll.errors.bankTransferFailed"),
        });
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.payroll.errors.bankTransferFailed")
        );
      }
    });
  }

  function navigatePeriod(nextYear: number, nextMonth: number) {
    startTransition(() => {
      router.push(
        `/billing/payroll?year=${nextYear}&month=${nextMonth}&run=${run}`
      );
    });
  }

  function removeLine(id: string) {
    if (periodLocked) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", id);
        await deletePayrollDeduction(formData);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.payroll.errors.deleteFailed"));
      }
    });
  }

  function submitUnlockRequest() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("year", String(year));
        formData.set("month", String(month));
        formData.set("run", run);
        formData.set("reason", unlockReason.trim());
        await requestInternalPayrollUnlock(formData);
        setUnlockOpen(false);
        setUnlockReason("");
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.payroll.errors.unlockFailed"));
      }
    });
  }

  function cancelUnlockRequest() {
    if (!unlockRequest?.own) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", unlockRequest.id);
        await cancelInternalPayrollUnlock(formData);
        router.refresh();
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.payroll.errors.unlockCancelFailed")
        );
      }
    });
  }

  const totalWage = rows.reduce((sum, r) => sum + r.wage, 0);
  const totalNet = rows.reduce((sum, r) => sum + Math.max(0, r.netPay), 0);
  const visibleRows = useMemo(() => {
    const query = employeeQuery.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const name = `${row.firstName} ${row.lastName}`.toLowerCase();
      return name.includes(query) || row.employeeNo.toLowerCase().includes(query);
    });
  }, [rows, employeeQuery]);
  const totalBpjsKesehatan = rows.reduce((sum, r) => sum + r.bpjsKesehatan, 0);
  const totalBpjsTk = rows.reduce((sum, r) => sum + r.bpjsTk, 0);

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className={pageToolbarRowClassName("mb-5")}>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text">
              {t("pages.payroll.periodTitle")}
            </h2>
            <div className={chipScrollRowClassName("mt-3")}>
              <a
                href={`/billing/payroll?year=${year}&month=${month}&run=PROJECT_CYCLE`}
                className={cn(
                  buttonVariants({
                    variant: run === "PROJECT_CYCLE" ? "accent" : "outline",
                    size: "sm",
                  }),
                  "h-8"
                )}
              >
                {t("pages.payroll.runProjectCycle")}
              </a>
              <a
                href={`/billing/payroll?year=${year}&month=${month}&run=HEAD_OFFICE_MONTHLY`}
                className={cn(
                  buttonVariants({
                    variant:
                      run === "HEAD_OFFICE_MONTHLY" ? "accent" : "outline",
                    size: "sm",
                  }),
                  "h-8"
                )}
              >
                {t("pages.payroll.runHeadOffice")}
              </a>
            </div>
            <p className="mt-1 text-sm text-muted">
              {t("pages.payroll.periodWindowRange", { range: selectedRange })}
            </p>
            <p className="mt-1 text-sm text-muted">
              {preview
                ? t(
                    run === "HEAD_OFFICE_MONTHLY"
                      ? "pages.payroll.periodPreviewHeadOffice"
                      : "pages.payroll.periodPreview"
                  )
                : t(
                    run === "HEAD_OFFICE_MONTHLY"
                      ? "pages.payroll.periodReconciledHeadOffice"
                      : "pages.payroll.periodReconciled"
                  )}{" "}
              {t("pages.payroll.periodDesc")}
            </p>
            {periodLocked && lock?.lockedByName && lock.lockedAt ? (
              <p className="mt-2 text-sm font-medium text-amber-700">
                {t("pages.payroll.lockedBy", {
                  name: lock.lockedByName,
                  time: formatDisplayDateTime(lock.lockedAt, {
                    timeZone: "Asia/Jakarta",
                  }, bcp47),
                })}
              </p>
            ) : null}
            {periodLocked && unlockRequest ? (
              <p className="mt-2 text-sm font-medium text-amber-700">
                {t("pages.payroll.unlockPending", {
                  name:
                    unlockRequest.requestedByName ??
                    t("pages.payroll.unlockUnknownRequester"),
                  reason: unlockRequest.reason,
                })}
              </p>
            ) : null}
            {!periodLocked && lock?.unlockedByName ? (
              <p className="mt-2 text-sm font-medium text-text">
                {t("pages.payroll.unlockedBy", {
                  name: lock.unlockedByName,
                  reason: lock.unlockReason ?? "",
                })}
              </p>
            ) : null}
          </div>

          <div className="w-full min-w-0">
            <Select
              value={selectedKey}
              onValueChange={(value) => {
                const next = parsePayrollPeriodKey(value ?? "");
                if (next) navigatePeriod(next.year, next.month);
              }}
              disabled={pending}
            >
              <SelectTrigger
                className={cn(
                  employeeSelectTriggerClass,
                  "h-auto min-h-8 w-full min-w-0 max-w-full py-1.5"
                )}
                aria-label={t("pages.payroll.periodPicker")}
              >
                <SelectValue>{selectedRange}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((period) => {
                  const key = payrollPeriodKey(period);
                  const label = formatPayrollPeriodRange(
                    period.year,
                    period.month,
                    bcp47,
                    run
                  );
                  const isCurrent =
                    period.year === current.year &&
                    period.month === current.month;
                  return (
                    <SelectItem key={key} value={key}>
                      {isCurrent
                        ? `${label} (${t("pages.payroll.periodCurrent")})`
                        : label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className={`rounded-xl border px-3 py-2.5 ${cardTintWash.primary}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
              {t("pages.payroll.totalEmployees")}
            </p>
            <p className="mt-1 break-words text-lg font-bold tabular-nums text-text sm:text-xl">
              {rows.length}
            </p>
          </div>
          <div className={`rounded-xl border px-3 py-2.5 ${cardTintWash.info}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
              {t("pages.payroll.totalWage")}
            </p>
            <p className="mt-1 break-words text-lg font-bold tabular-nums text-text sm:text-xl">
              {formatContractPrice(totalWage)}
            </p>
          </div>
          <div className={`rounded-xl border px-3 py-2.5 ${cardTintWash.success}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
              {t("pages.payroll.columns.bpjsKesehatan")}
            </p>
            <p className="mt-1 break-words text-lg font-bold tabular-nums text-text sm:text-xl">
              {totalBpjsKesehatan > 0 ? formatContractPrice(totalBpjsKesehatan) : "—"}
            </p>
          </div>
          <div className={`rounded-xl border px-3 py-2.5 ${cardTintWash.success}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
              {t("pages.payroll.columns.bpjsTk")}
            </p>
            <p className="mt-1 break-words text-lg font-bold tabular-nums text-text sm:text-xl">
              {totalBpjsTk > 0 ? formatContractPrice(totalBpjsTk) : "—"}
            </p>
          </div>
          <div className={`rounded-xl border px-3 py-2.5 sm:col-span-2 lg:col-span-1 ${cardTintWash.warning}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
              {t("pages.payroll.totalNetPay")}
            </p>
            <p className="mt-1 break-words text-lg font-bold tabular-nums text-text sm:text-xl">
              {formatContractPrice(totalNet)}
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-text">
            {t("pages.payroll.tableTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t("pages.payroll.tableDesc")}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={employeeQuery}
              onChange={(event) => setEmployeeQuery(event.target.value)}
              placeholder={t("pages.payroll.searchEmployee")}
              className="min-w-0 w-full sm:max-w-md"
              aria-label={t("pages.payroll.searchEmployee")}
            />
            <div
              className={cn(
                "grid w-full gap-2 sm:shrink-0",
                periodLocked
                  ? "grid-cols-1 sm:w-[34rem] sm:grid-cols-3"
                  : "grid-cols-1 sm:ml-auto sm:w-[22rem] sm:grid-cols-2"
              )}
            >
              {periodLocked ? (
                <Button
                  type="button"
                  variant="warning"
                  size="default"
                  className="h-8 w-full justify-center"
                  disabled={pending || Boolean(unlockRequest && !unlockRequest.own)}
                  onClick={
                    unlockRequest?.own
                      ? cancelUnlockRequest
                      : () => setUnlockOpen(true)
                  }
                >
                  {unlockRequest
                    ? unlockRequest.own
                      ? t("pages.payroll.withdrawUnlockRequest")
                      : t("pages.payroll.unlockRequestPending")
                    : t("pages.payroll.requestUnlock")}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="accent"
                size="default"
                className="h-8 w-full justify-center"
                disabled={pending || (preview && !periodLocked)}
                onClick={requestPayrollPdf}
              >
                {t("pages.payroll.generatePdf")}
              </Button>
              <Button
                type="button"
                variant="accent"
                size="default"
                className="h-8 w-full justify-center"
                disabled={pending || !periodLocked}
                onClick={exportBankTransfer}
              >
                {t("pages.payroll.generateBankTransfer")}
              </Button>
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              title={t("pages.payroll.emptyTitle")}
              description={t("pages.payroll.emptyDesc")}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {visibleRows.map((row) => (
              <SectionCard
                key={row.employeeId}
                className="p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="min-w-0 break-words font-medium text-text">
                      {row.firstName} {row.lastName}
                    </p>
                    <p className="font-mono text-xs text-muted">
                      {row.employeeNo}
                    </p>
                    {!row.cicoExempt ? (
                      <p className="mt-1 text-xs text-muted">
                        {t("pages.payroll.shiftsAgainstBase", {
                          worked: row.daysWorked,
                          base:
                            row.coveredShifts ??
                            INTERNAL_PAYROLL_WORKING_DAYS_DIVISOR,
                        })}
                        {row.doubleShiftDays
                          ? ` · ${t("pages.payroll.doubleShiftCount", {
                              count: row.doubleShiftDays,
                            })}`
                          : ""}
                        {(row.surplusShifts ?? 0) > 0
                          ? ` · ${t("pages.payroll.surplusShifts", {
                              count: row.surplusShifts ?? 0,
                            })}`
                          : ""}
                      </p>
                    ) : null}
                    {(row.surplusShifts ?? 0) > 0 && !row.cicoExempt ? (
                      <p className="mt-1 text-xs text-muted">
                        {t("pages.payroll.suggestedOvertime", {
                          amount: formatContractPrice(
                            (row.surplusShifts ?? 0) * row.dailyRate
                          ),
                          count: row.surplusShifts ?? 0,
                        })}
                      </p>
                    ) : null}
                    {row.depositStatus && row.depositStatus !== "NONE" ? (
                      <p className="mt-1 text-xs text-muted">
                        {t(
                          `pages.payroll.depositStatus.${
                            row.depositStatus === "HELD"
                              ? "held"
                              : row.depositStatus === "RETURNED"
                                ? "returned"
                                : "keptByCompany"
                          }`
                        )}
                        {row.depositHeldAmount
                          ? ` · ${formatContractPrice(row.depositHeldAmount)}`
                          : ""}
                      </p>
                    ) : null}
                    {(row.deductions ?? []).length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-muted">
                        {(row.deductions ?? []).map((line) => (
                          <li
                            key={line.id}
                            className="flex items-start justify-between gap-2"
                          >
                            <span className="min-w-0 flex-1 break-words">
                              {t(PAYROLL_DEDUCTION_LABEL_KEY[line.type])}
                              {line.itemName ? ` · ${line.itemName}` : ""}
                              {line.reason ? ` · ${line.reason}` : ""}
                              {": "}
                              {isPayrollPayableType(line.type) ? "+" : "−"}
                              {formatContractPrice(line.amount)}
                            </span>
                            <button
                              type="button"
                              className="shrink-0 text-danger hover:underline"
                              disabled={pending || periodLocked}
                              onClick={() => removeLine(line.id)}
                            >
                              {t("common.actions.delete")}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {row.overtimeEnabled ? (
                      <Button
                        size="badge"
                        variant="successBadge"
                        disabled={pending || periodLocked}
                        onClick={() => setOvertimeRow(row)}
                      >
                        {t("pages.payroll.addOvertime")}
                      </Button>
                    ) : null}
                    <Button
                      size="badge"
                      variant="destructive"
                      disabled={pending || periodLocked}
                      onClick={() => setDeducting(row)}
                    >
                      {t("pages.payroll.addDeduction")}
                    </Button>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-text">
                    {t("pages.payroll.dayListTitle")}
                  </h3>
                  {(row.days ?? []).length === 0 ? (
                    <p className="mt-2 text-sm text-muted">
                      {t("pages.payroll.noDays")}
                    </p>
                  ) : (
                    <div className="mt-3 w-full overflow-x-auto rounded-xl border border-border bg-elevated/20">
                      <table className="w-full min-w-[72rem] text-base">
                        <thead className="bg-elevated/60 text-left text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                          <tr>
                            <th className="px-4 py-3.5 font-semibold">
                              {t("pages.payroll.dayListTitle")}
                            </th>
                            <th className="px-4 py-3.5 font-semibold">
                              {t("pages.payroll.daySite")}
                            </th>
                            <th className="px-4 py-3.5 font-semibold">
                              {t("pages.payroll.dayShift")}
                            </th>
                            <th className="px-4 py-3.5 font-semibold">
                              {t("pages.payroll.dayCheckIn")}
                            </th>
                            <th className="px-4 py-3.5 font-semibold">
                              {t("pages.payroll.dayCheckOut")}
                            </th>
                            <th className="px-4 py-3.5 font-semibold">
                              {t("pages.payroll.dayHours")}
                            </th>
                            <th className="px-4 py-3.5 font-semibold">
                              {t("pages.payroll.columns.netPay")}
                            </th>
                            <th className="px-4 py-3.5 font-semibold">
                              {t("common.actions.save")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(row.days ?? []).map((day) => (
                            <tr
                              key={day.sessionKey ?? day.dateKey}
                              className="border-t border-border align-top"
                            >
                              <td className="px-4 py-3.5 font-medium text-text">
                                {formatEnglishOrdinalDate(
                                  `${day.dateKey}T00:00:00Z`,
                                  bcp47
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-muted">
                                {day.siteName ?? "—"}
                              </td>
                              <td className="px-4 py-3.5 text-muted">
                                <p>{day.shiftLabel ?? "—"}</p>
                                {day.tookOverShiftLabel ? (
                                  <p className="mt-0.5 text-xs font-medium text-primary">
                                    {t("pages.payroll.coveredShift", {
                                      shift: day.tookOverShiftLabel,
                                      name: day.tookOverFromName ?? "—",
                                    })}
                                  </p>
                                ) : day.doubleShift ? (
                                  <p className="mt-0.5 text-xs font-medium text-primary">
                                    {t("pages.payroll.doubleShift")}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3.5 text-muted">
                                <p>{dayCheckInLabel(row, day, t, bcp47)}</p>
                                {day.lateCheckIn ? (
                                  <p className="text-xs font-medium text-amber-600">
                                    {t("pages.payroll.lateCheckIn")}
                                  </p>
                                ) : day.shiftTakenOverByName &&
                                  day.absent &&
                                  !day.checkInAt ? (
                                  <p className="text-xs font-medium text-amber-600">
                                    {t("pages.payroll.coveredByName", {
                                      name: day.shiftTakenOverByName,
                                    })}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3.5 text-muted">
                                <p>{dayCheckOutLabel(row, day, t, bcp47)}</p>
                                {day.earlyCheckOut ? (
                                  <p className="text-xs font-medium text-amber-600">
                                    {t(
                                      "pages.payroll.checkedOutBeforeShiftEnd"
                                    )}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3.5 text-muted">
                                {day.hoursWorked != null
                                  ? t("pages.payroll.hoursWorkedValue", {
                                      hours: formatHoursWorked(day.hoursWorked),
                                    })
                                  : day.sessionHours != null
                                    ? t("pages.payroll.hoursWorkedValue", {
                                        hours: formatHoursWorked(
                                          day.sessionHours
                                        ),
                                      })
                                    : "—"}
                              </td>
                              <td className="px-4 py-3.5 tabular-nums font-semibold text-text">
                                {day.unpaidSurplus
                                  ? t("pages.payroll.surplusShiftUnpaid")
                                  : day.payAmount != null
                                  ? formatContractPrice(day.payAmount)
                                  : "—"}
                              </td>
                              <td className="px-4 py-3.5">
                                {canEditDayPay(day) && !periodLocked ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={
                                        day.payDecision === "CUSTOM"
                                          ? "outline"
                                          : "default"
                                      }
                                      disabled={pending}
                                      onClick={() =>
                                        decideDay(
                                          row.employeeId,
                                          day.dateKey,
                                          "FULL_PAY"
                                        )
                                      }
                                    >
                                      {t("pages.payroll.fullPay")}
                                    </Button>
                                    <Input
                                      inputMode="numeric"
                                      className="h-7 w-40 shrink-0"
                                      placeholder={t(
                                        "pages.payroll.customAmountPlaceholder"
                                      )}
                                      value={
                                        customAmounts[day.sessionKey] ??
                                        (day.payDecision === "CUSTOM" &&
                                        day.payAmount != null
                                          ? String(day.payAmount)
                                          : "")
                                      }
                                      onChange={(event) =>
                                        setCustomAmounts((current) => ({
                                          ...current,
                                          [day.sessionKey]: event.target.value,
                                        }))
                                      }
                                      disabled={pending}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={
                                        day.payDecision === "CUSTOM"
                                          ? "default"
                                          : "outline"
                                      }
                                      disabled={pending}
                                      onClick={() =>
                                        decideDay(
                                          row.employeeId,
                                          day.dateKey,
                                          "CUSTOM",
                                          customAmounts[day.sessionKey] ??
                                            (day.payDecision === "CUSTOM" &&
                                            day.payAmount != null
                                              ? String(day.payAmount)
                                              : "")
                                        )
                                      }
                                    >
                                      {t("pages.payroll.saveCustomPay")}
                                    </Button>
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-text">
                    {t("pages.payroll.paySummaryTitle")}
                  </h3>
                  <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                  <div>
                    <p className="text-xs text-muted">
                      {t("pages.payroll.columns.daysWorked")}
                    </p>
                    <p className="font-medium text-text">{row.daysWorked}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">
                      {t("pages.payroll.columns.dailyRate")}
                    </p>
                    <p className="font-medium text-text">
                      {formatContractPrice(row.dailyRate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">
                      {t("pages.payroll.columns.bpjsKesehatan")}
                    </p>
                    <p className="font-medium text-text">
                      {row.bpjsKesehatan > 0
                        ? formatContractPrice(row.bpjsKesehatan)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">
                      {t("pages.payroll.columns.bpjsTk")}
                    </p>
                    <p className="font-medium text-text">
                      {row.bpjsTk > 0 ? formatContractPrice(row.bpjsTk) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">
                      {t("pages.payroll.columns.deductions")}
                    </p>
                    <p className="font-medium text-text">
                      {row.totalDeduction - row.bpjsKesehatan - row.bpjsTk > 0
                        ? formatContractPrice(
                            row.totalDeduction - row.bpjsKesehatan - row.bpjsTk
                          )
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">
                      {row.netPay < 0
                        ? t("pages.payroll.balanceDueToCompany")
                        : t("pages.payroll.columns.netPay")}
                    </p>
                    <p
                      className={
                        row.netPay < 0
                          ? "font-semibold text-danger"
                          : "font-semibold text-text"
                      }
                    >
                      {formatContractPrice(Math.abs(row.netPay))}
                    </p>
                    {row.netPay < 0 ? (
                      <p className="mt-1 text-[0.7rem] text-subtle">
                        {t("pages.payroll.balanceDueToCompanyHint")}
                      </p>
                    ) : null}
                  </div>
                  </div>
                </div>
              </SectionCard>
            ))}

          </div>
        )}
      </div>

      {deducting && !periodLocked ? (
        <PayrollDeductionDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setDeducting(null);
              router.refresh();
            }
          }}
          employeeId={deducting.employeeId}
          employeeName={`${deducting.firstName} ${deducting.lastName}`}
          year={year}
          month={month}
          run={run}
          items={items}
          projects={projects}
          securityDepositBlocked={
            deducting.securityDepositRequired === false ||
            hasHeldSecurityDeposit({
              depositStatus: deducting.depositStatus,
              depositHeldAmount: deducting.depositHeldAmount ?? 0,
              securityDepositLines: (deducting.deductions ?? []).filter(
                (line) => line.type === "SECURITY_DEPOSIT"
              ).length,
              returnOfDepositLines: (deducting.deductions ?? []).filter(
                (line) => line.type === "RETURN_OF_SECURITY_DEPOSIT"
              ).length,
            })
          }
          securityDepositBlockReason={
            deducting.securityDepositRequired === false
              ? "notRequired"
              : "held"
          }
        />
      ) : null}

      <SectionCard>
        <h3 className="text-lg font-semibold text-text">
          {t("pages.payroll.changeHistory")}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {t("pages.payroll.changeHistoryDesc")}
        </p>
        {changes.length === 0 ? (
          <p className="mt-4 text-sm text-subtle">
            {t("pages.payroll.changeHistoryEmpty")}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {changes.map((entry) => (
              <li
                key={entry.id}
                className="border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <p className="text-sm font-medium text-text">
                  {t(`pages.payroll.changeActions.${entry.action}`)}
                </p>
                {entry.description ? (
                  <p className="mt-0.5 text-sm text-muted">
                    {entry.description}
                  </p>
                ) : null}
                <p className="mt-0.5 text-xs text-subtle">
                  {[
                    entry.actorName,
                    formatDisplayDateTime(entry.at, {
                      timeZone: "Asia/Jakarta",
                    }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {overtimeRow && !periodLocked ? (
        <PayrollOvertimeDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setOvertimeRow(null);
              router.refresh();
            }
          }}
          employeeId={overtimeRow.employeeId}
          employeeName={`${overtimeRow.firstName} ${overtimeRow.lastName}`}
          year={year}
          month={month}
          run={run}
        />
      ) : null}

      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent className="max-h-[min(90dvh,40rem)] gap-0 overflow-hidden rounded-2xl border border-border bg-panel p-0 text-base text-text ring-0 sm:max-w-2xl">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-6 sm:px-10 sm:pt-8 sm:pb-7">
          <DialogHeader className="gap-4">
            <DialogTitle className="text-2xl">
              {t("pages.payroll.requestUnlock")}
            </DialogTitle>
            <DialogDescription className="text-base leading-7">
              {t("pages.payroll.requestUnlockDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex flex-col gap-4">
            <label
              htmlFor="payroll-unlock-reason"
              className="text-sm font-semibold leading-6 text-text"
            >
              {t("pages.payroll.unlockReason")}
            </label>
            <Textarea
              id="payroll-unlock-reason"
              value={unlockReason}
              onChange={(event) => setUnlockReason(event.target.value)}
              rows={8}
              className="mt-0 min-h-48"
            />
          </div>
          </div>
          <DialogFooter className="mx-0 mb-0 mt-0 flex-col gap-3 rounded-none border-t border-border bg-strip px-4 py-5 sm:justify-stretch sm:px-10 sm:py-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUnlockOpen(false)}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={pending || !unlockReason.trim()}
              onClick={submitUnlockRequest}
            >
              {t("pages.payroll.submitUnlockRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lockConfirmOpen} onOpenChange={setLockConfirmOpen}>
        <DialogContent className="max-h-[min(90dvh,40rem)] gap-0 overflow-hidden rounded-2xl border border-border bg-panel p-0 text-base text-text ring-0 sm:max-w-2xl">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-6 sm:px-10 sm:pt-8 sm:pb-7">
            <DialogHeader className="gap-4">
              <DialogTitle className="text-2xl">
                {t("pages.payroll.lockConfirmTitle")}
              </DialogTitle>
              <DialogDescription className="text-base leading-7">
                {t("pages.payroll.lockConfirmBody", {
                  period: selectedRange,
                })}
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="mx-0 mb-0 mt-0 flex-col gap-3 rounded-none border-t border-border bg-strip px-4 py-5 sm:justify-stretch sm:px-10 sm:py-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLockConfirmOpen(false)}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button type="button" disabled={pending} onClick={exportPayrollPdf}>
              {t("pages.payroll.lockConfirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
