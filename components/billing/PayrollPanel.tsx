"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  decideInternalPayrollDay,
  deletePayrollDeduction,
  unlockInternalPayroll,
} from "@/app/billing/payroll-actions";
import PayrollDeductionDialog from "@/components/billing/PayrollDeductionDialog";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
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
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import type {
  PayrollCatalogItem,
  PayrollDeductionRow,
  PayrollProjectOption,
} from "@/lib/internal-payroll-month";
import type { PayrollDayRow } from "@/lib/internal-payroll-days";
import type { InternalPayrollLockState } from "@/lib/internal-payroll-lock";
import { hasHeldSecurityDeposit } from "@/lib/payroll-deductions";
import {
  currentPayrollPeriod,
  formatPayrollPeriodRange,
  listPayrollPeriodChoices,
  parsePayrollPeriodKey,
  payrollPeriodKey,
} from "@/lib/internal-payroll-period";
import {
  formatDisplayDateTime,
  formatEnglishOrdinalDate,
  formatDisplayTime,
} from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { formatHoursWorked } from "@/lib/shift-pay";
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
};

type Props = {
  year: number;
  month: number;
  preview?: boolean;
  rows: PayrollRow[];
  items: PayrollCatalogItem[];
  projects: PayrollProjectOption[];
  lock?: InternalPayrollLockState;
  canUnlock?: boolean;
};

function deductionLabelKey(type: PayrollDeductionRow["type"]) {
  switch (type) {
    case "SECURITY_DEPOSIT":
      return "pages.payroll.deductionTypes.securityDeposit" as const;
    case "LOST_STOCK":
      return "pages.payroll.deductionTypes.lostStock" as const;
    case "PENALTY":
      return "pages.payroll.deductionTypes.penalty" as const;
    case "OTHER":
      return "pages.payroll.deductionTypes.other" as const;
    case "RETURN_OF_SECURITY_DEPOSIT":
      return "pages.payroll.deductionTypes.returnOfSecurityDeposit" as const;
    case "CLIENT_COMPENSATION":
      return "pages.payroll.deductionTypes.clientCompensation" as const;
    case "FORFEITED_WAGES":
      return "pages.payroll.deductionTypes.forfeitedWages" as const;
    default:
      return "pages.payroll.deductionTypes.other" as const;
  }
}

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

function canEditDayPay(day: PayrollDayRow) {
  if (day.absent) return false;
  return (
    day.needsPayDecision === true ||
    day.payDecision === "FULL_PAY" ||
    day.payDecision === "CUSTOM"
  );
}

export default function PayrollPanel({
  year,
  month,
  preview = false,
  rows,
  items,
  projects,
  lock,
  canUnlock = false,
}: Props) {
  const { t, bcp47 } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deducting, setDeducting] = useState<PayrollRow | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    {}
  );
  const periodLocked = lock?.locked === true;

  const current = useMemo(() => currentPayrollPeriod(), []);
  const periodOptions = useMemo(
    () => listPayrollPeriodChoices({ selected: { year, month } }),
    [year, month]
  );
  const selectedKey = payrollPeriodKey({ year, month });
  const selectedRange = formatPayrollPeriodRange(year, month, bcp47);

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

  function navigatePeriod(nextYear: number, nextMonth: number) {
    startTransition(() => {
      router.push(`/billing/payroll?year=${nextYear}&month=${nextMonth}`);
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

  function submitUnlock() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("year", String(year));
        formData.set("month", String(month));
        formData.set("reason", unlockReason.trim());
        await unlockInternalPayroll(formData);
        setUnlockOpen(false);
        setUnlockReason("");
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.payroll.errors.unlockFailed"));
      }
    });
  }

  const totalWage = rows.reduce((sum, r) => sum + r.wage, 0);
  const totalBpjsKesehatan = rows.reduce((sum, r) => sum + r.bpjsKesehatan, 0);
  const totalBpjsTk = rows.reduce((sum, r) => sum + r.bpjsTk, 0);
  const totalNet = rows.reduce((sum, r) => sum + r.netPay, 0);

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text">
              {t("pages.payroll.periodTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t("pages.payroll.periodWindowRange", { range: selectedRange })}
            </p>
            <p className="mt-1 text-sm text-muted">
              {preview
                ? t("pages.payroll.periodPreview")
                : t("pages.payroll.periodReconciled")}{" "}
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
            {!periodLocked && lock?.unlockedByName ? (
              <p className="mt-2 text-sm font-medium text-text">
                {t("pages.payroll.unlockedBy", {
                  name: lock.unlockedByName,
                  reason: lock.unlockReason ?? "",
                })}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
                  "h-auto min-h-8 min-w-[22rem] py-1.5 sm:min-w-[42rem]"
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
                    bcp47
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

        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">{t("pages.payroll.totalEmployees")}</p>
            <p className="font-medium text-text">{rows.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("pages.payroll.totalWage")}</p>
            <p className="font-medium text-text">{formatContractPrice(totalWage)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("pages.payroll.totalNetPay")}</p>
            <p className="font-medium text-text">{formatContractPrice(totalNet)}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-text">
            {t("pages.payroll.tableTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t("pages.payroll.tableDesc")}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              title={t("pages.payroll.emptyTitle")}
              description={t("pages.payroll.emptyDesc")}
            />
            <div className="flex justify-end gap-2">
              {periodLocked && canUnlock ? (
                <Button
                  type="button"
                  variant="outline"
                  size="badge"
                  disabled={pending}
                  onClick={() => setUnlockOpen(true)}
                >
                  {t("pages.payroll.unlockPeriod")}
                </Button>
              ) : null}
              <a
                href={`/api/payroll/export?year=${year}&month=${month}`}
                className="inline-flex h-8 items-center rounded-lg border border-border-strong bg-elevated px-3 text-sm font-semibold text-text hover:border-primary/45 hover:bg-card-hover"
              >
                {t("pages.payroll.generatePdf")}
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {rows.map((row) => (
              <article
                key={row.employeeId}
                className="rounded-xl border border-border/80 bg-elevated/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-text">
                      {row.firstName} {row.lastName}
                    </p>
                    <p className="font-mono text-xs text-muted">
                      {row.employeeNo}
                    </p>
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
                            <span>
                              {t(deductionLabelKey(line.type))}
                              {line.itemName ? ` · ${line.itemName}` : ""}
                              {line.reason ? ` · ${line.reason}` : ""}
                              {": "}
                              {line.type === "RETURN_OF_SECURITY_DEPOSIT"
                                ? "+"
                                : "−"}
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
                  <Button
                    size="badge"
                    variant="outline"
                    disabled={pending || periodLocked}
                    onClick={() => setDeducting(row)}
                  >
                    {t("pages.payroll.addDeduction")}
                  </Button>
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
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-[56rem] text-left text-sm">
                        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                          <tr>
                            <th className="px-2 py-2 text-left font-medium">
                              {t("pages.payroll.dayDate")}
                            </th>
                            <th className="px-2 py-2 font-medium">
                              {t("pages.payroll.daySite")}
                            </th>
                            <th className="px-2 py-2 font-medium">
                              {t("pages.payroll.dayShift")}
                            </th>
                            <th className="px-2 py-2 font-medium">
                              {t("pages.payroll.dayCheckIn")}
                            </th>
                            <th className="px-2 py-2 font-medium">
                              {t("pages.payroll.dayCheckOut")}
                            </th>
                            <th className="px-2 py-2 font-medium">
                              {t("pages.payroll.dayHours")}
                            </th>
                            <th className="px-2 py-2 text-right font-medium">
                              {t("pages.payroll.dayPay")}
                            </th>
                            <th className="px-2 py-2 text-center font-medium">
                              {t("pages.payroll.columns.actions")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(row.days ?? []).map((day) => (
                            <tr
                              key={day.sessionKey ?? day.dateKey}
                              className="border-b border-border/60 align-top"
                            >
                              <td className="px-2 py-2 text-text">
                                {formatEnglishOrdinalDate(
                                  `${day.dateKey}T00:00:00Z`,
                                  bcp47
                                )}
                              </td>
                              <td className="px-2 py-2 text-muted">
                                <p>{day.siteName ?? "—"}</p>
                              </td>
                              <td className="px-2 py-2 text-muted">
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
                                {day.doubleShift &&
                                !day.needsPayDecision &&
                                day.payAmount ? (
                                  <p className="mt-0.5 text-xs text-subtle">
                                    {t("pages.payroll.doubleShiftPayNote")}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-2 py-2 text-muted">
                                {day.absent && !day.checkInAt ? (
                                  <div>
                                    <span className="font-medium text-amber-600">
                                      {t("pages.payroll.absent")}
                                    </span>
                                    {day.shiftTakenOverByName ? (
                                      <p className="mt-0.5 text-xs font-medium text-amber-600">
                                        {t("pages.payroll.coveredByName", {
                                          name: day.shiftTakenOverByName,
                                        })}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div>
                                    <p>{jakartaTime(day.checkInAt, bcp47)}</p>
                                    {day.lateCheckIn ? (
                                      <p className="text-xs font-medium text-amber-600">
                                        {t("pages.payroll.lateCheckIn")}
                                      </p>
                                    ) : null}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-2 text-muted">
                                {day.absent && !day.checkOutAt ? (
                                  day.checkInAt ? (
                                    <div>
                                      <p>—</p>
                                      <p className="text-xs font-medium text-amber-600">
                                        {t("pages.payroll.absent")}
                                      </p>
                                    </div>
                                  ) : (
                                    "—"
                                  )
                                ) : (
                                  <div>
                                    <p>{jakartaTime(day.checkOutAt, bcp47)}</p>
                                    {day.earlyCheckOut ? (
                                      <p className="text-xs font-medium text-amber-600">
                                        {t(
                                          "pages.payroll.checkedOutBeforeShiftEnd"
                                        )}
                                      </p>
                                    ) : null}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-2 text-muted">
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
                              <td className="whitespace-nowrap px-2 py-2 text-right font-medium text-text">
                                {day.payAmount != null
                                  ? formatContractPrice(day.payAmount)
                                  : "—"}
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 text-center">
                                {canEditDayPay(day) && !periodLocked ? (
                                  <div className="flex items-center justify-center gap-2">
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
                                      className="h-7 w-32"
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
                                ) : null}
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
                      {t("pages.payroll.columns.netPay")}
                    </p>
                    <p className="font-semibold text-text">
                      {formatContractPrice(row.netPay)}
                    </p>
                  </div>
                  </div>
                </div>
              </article>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
                <p className="text-muted">
                  {t("pages.payroll.totalWage")}:{" "}
                  <span className="font-semibold text-text">
                    {formatContractPrice(totalWage)}
                  </span>
                </p>
                <p className="text-muted">
                  {t("pages.payroll.columns.bpjsKesehatan")}:{" "}
                  <span className="font-semibold text-text">
                    {totalBpjsKesehatan > 0
                      ? formatContractPrice(totalBpjsKesehatan)
                      : "—"}
                  </span>
                </p>
                <p className="text-muted">
                  {t("pages.payroll.columns.bpjsTk")}:{" "}
                  <span className="font-semibold text-text">
                    {totalBpjsTk > 0 ? formatContractPrice(totalBpjsTk) : "—"}
                  </span>
                </p>
                <p className="text-muted">
                  {t("pages.payroll.totalNetPay")}:{" "}
                  <span className="font-semibold text-text">
                    {formatContractPrice(totalNet)}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {periodLocked && canUnlock ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="badge"
                    disabled={pending}
                    onClick={() => setUnlockOpen(true)}
                  >
                    {t("pages.payroll.unlockPeriod")}
                  </Button>
                ) : null}
                <a
                  href={`/api/payroll/export?year=${year}&month=${month}`}
                  className="inline-flex h-8 items-center rounded-lg border border-border-strong bg-elevated px-3 text-sm font-semibold text-text hover:border-primary/45 hover:bg-card-hover"
                >
                  {t("pages.payroll.generatePdf")}
                </a>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

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

      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pages.payroll.unlockPeriod")}</DialogTitle>
            <DialogDescription>
              {t("pages.payroll.unlockPeriodDesc")}
            </DialogDescription>
          </DialogHeader>
          <label className="text-sm font-semibold text-text">
            {t("pages.payroll.unlockReason")}
          </label>
          <Textarea
            value={unlockReason}
            onChange={(event) => setUnlockReason(event.target.value)}
            rows={4}
          />
          <DialogFooter>
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
              onClick={submitUnlock}
            >
              {t("pages.payroll.unlockPeriod")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
