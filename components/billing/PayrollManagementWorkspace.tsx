"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import {
  fillPayrollManagementFromCico,
  savePayrollManagementPeriod,
  unlockPayrollManagementPeriod,
} from "@/app/billing/payroll-management-actions";
import {
  computePayrollManagementTotals,
  formatClientCutoffLabel,
} from "@/lib/payroll-management";
import type { PayrollManagementReviewEmployee } from "@/lib/payroll-management-types";
import { employeeSelectTriggerClass } from "@/components/employees/employee-dialog-ui";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/use-t";
import {
  formatDisplayDateTime,
  formatDisplayTime,
  formatEnglishOrdinalDate,
} from "@/lib/format-date";
import { formatContractPrice } from "@/lib/project-billing";
import { showRejectionFromError } from "@/components/ui/rejection-notice";

type LineDraft = {
  key: string;
  employeeName: string;
  amount: string;
  accountNumber: string;
  notes: string;
};

type PeriodView = {
  id: string;
  status: string;
  notes: string | null;
  wagesTotal: number;
  feeAmount: number;
  taxAmount?: number;
  taxPercent?: number;
  clientBillAmount: number;
  serviceFeePercent: number;
  wagesPaidAt: string | null;
  invoicedAt: string | null;
  invoiceDueAt: string | null;
  reimbursedAt: string | null;
  paymentProofPath: string | null;
  lines: Array<{
    id: string;
    employeeName: string;
    amount: number;
    accountNumber: string | null;
    notes: string | null;
  }>;
};

type LockView = {
  locked: boolean;
  lockedAt: string | null;
  lockedByName: string | null;
  unlockedAt: string | null;
  unlockedByName: string | null;
  unlockReason: string | null;
};

type Props = {
  projectId: string;
  clientId: string;
  year: number;
  month: number;
  canManage: boolean;
  canUnlock: boolean;
  serviceFeePercent: number;
  taxPercent: number;
  paymentTermsDays: number;
  cutoffStartDay: number;
  cutoffEndDay: number;
  cutoffLabel: string;
  review: PayrollManagementReviewEmployee[];
  lock: LockView;
  period: PeriodView | null;
};

function newLine(): LineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    employeeName: "",
    amount: "",
    accountNumber: "",
    notes: "",
  };
}

function statusTone(status: string): "pending" | "info" | "warning" | "success" {
  if (status === "INVOICED" || status === "CLIENT_APPROVED") return "info";
  if (status === "AWAITING_CLIENT") return "warning";
  if (status === "REIMBURSED") return "success";
  return "pending";
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

export default function PayrollManagementWorkspace({
  projectId,
  clientId,
  year,
  month,
  canManage,
  canUnlock,
  serviceFeePercent,
  taxPercent,
  paymentTermsDays,
  cutoffStartDay,
  cutoffEndDay,
  cutoffLabel,
  review,
  lock,
  period,
}: Props) {
  const { t, bcp47 } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [lines, setLines] = useState<LineDraft[]>(() =>
    period && period.lines.length > 0
      ? period.lines.map((line) => ({
          key: line.id,
          employeeName: line.employeeName,
          amount: String(line.amount),
          accountNumber: line.accountNumber ?? "",
          notes: line.notes ?? "",
        }))
      : [newLine()]
  );
  useEffect(() => {
    if (period && period.lines.length > 0) {
      setLines(
        period.lines.map((line) => ({
          key: line.id,
          employeeName: line.employeeName,
          amount: String(line.amount),
          accountNumber: line.accountNumber ?? "",
          notes: line.notes ?? "",
        }))
      );
    }
  }, [period]);

  const billingLocked =
    period?.status === "AWAITING_CLIENT" ||
    period?.status === "CLIENT_APPROVED" ||
    period?.status === "WAGES_PAID" ||
    period?.status === "INVOICED" ||
    period?.status === "REIMBURSED";
  const locked = billingLocked || lock.locked;

  const totals = useMemo(() => {
    const parsed = lines
      .map((line) => ({
        amount: Number(line.amount) || 0,
      }))
      .filter((line) => line.amount > 0);
    return computePayrollManagementTotals(parsed, serviceFeePercent, taxPercent);
  }, [lines, serviceFeePercent, taxPercent]);

  const periodChoices = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const items: Array<{ year: number; month: number; label: string }> = [];
    let nextYear = currentYear;
    let nextMonth = currentMonth;
    for (let i = 0; i < 24; i += 1) {
      items.push({
        year: nextYear,
        month: nextMonth,
        label: formatClientCutoffLabel(
          nextYear,
          nextMonth,
          cutoffStartDay,
          cutoffEndDay,
          bcp47
        ),
      });
      nextMonth -= 1;
      if (nextMonth < 1) {
        nextMonth = 12;
        nextYear -= 1;
      }
    }
    if (!items.some((item) => item.year === year && item.month === month)) {
      items.unshift({
        year,
        month,
        label: formatClientCutoffLabel(
          year,
          month,
          cutoffStartDay,
          cutoffEndDay,
          bcp47
        ),
      });
    }
    return items;
  }, [bcp47, cutoffEndDay, cutoffStartDay, month, year]);

  function navigatePeriod(nextYear: number, nextMonth: number) {
    startTransition(() => {
      router.push(
        `/billing/${clientId}/${projectId}?year=${nextYear}&month=${nextMonth}`
      );
    });
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  }

  function saveList() {
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("year", String(year));
    formData.set("month", String(month));
    formData.set(
      "linesJson",
      JSON.stringify(
        lines
          .map((line) => ({
            employeeName: line.employeeName.trim(),
            amount: Number(line.amount) || 0,
            accountNumber: line.accountNumber.trim() || null,
            notes: line.notes.trim() || null,
          }))
          .filter((line) => line.employeeName)
      )
    );
    startTransition(async () => {
      try {
        await savePayrollManagementPeriod(formData);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.billing.payrollMgmt.saveFailed"));
      }
    });
  }

  function generatePdf() {
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/payroll-management/export?projectId=${projectId}&year=${year}&month=${month}`
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error || "Could not generate the wage sheet.");
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `payroll-management-${year}-${String(month).padStart(2, "0")}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
        router.refresh();
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.billing.payrollMgmt.actionFailed")
        );
      }
    });
  }

  function submitUnlock() {
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("year", String(year));
    formData.set("month", String(month));
    formData.set("reason", unlockReason.trim());
    startTransition(async () => {
      try {
        await unlockPayrollManagementPeriod(formData);
        setUnlockOpen(false);
        setUnlockReason("");
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.billing.payrollMgmt.unlockFailed"));
      }
    });
  }

  const status = period?.status ?? "DRAFT";

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-text">
              {t("pages.billing.payrollMgmt.periodTitle")}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {t("pages.billing.payrollMgmt.periodDesc")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={statusTone(status)}>
              {t(`pages.billing.payrollMgmt.status.${status}` as Parameters<typeof t>[0])}
            </StatusBadge>
            <Select
              value={`${year}-${month}`}
              onValueChange={(value) => {
                if (!value) return;
                const [nextYear, nextMonth] = value.split("-").map(Number);
                navigatePeriod(nextYear, nextMonth);
              }}
              disabled={pending}
            >
              <SelectTrigger className={employeeSelectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodChoices.map((item) => (
                  <SelectItem
                    key={`${item.year}-${item.month}`}
                    value={`${item.year}-${item.month}`}
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-sm text-muted">
          {t("pages.billing.payrollMgmt.cutoffRange", { range: cutoffLabel })}
        </p>
        <p className="mt-2 text-sm text-muted">
          {t("pages.billing.payrollMgmt.feeHint", {
            percent: serviceFeePercent,
            tax: taxPercent,
            days: paymentTermsDays,
          })}
        </p>
        {lock.locked && lock.lockedByName ? (
          <p className="mt-2 text-sm text-amber-700">
            {t("pages.payroll.lockedBy", {
              name: lock.lockedByName,
              time: lock.lockedAt
                ? formatDisplayDateTime(lock.lockedAt)
                : "—",
            })}
          </p>
        ) : null}
        {!lock.locked && lock.unlockedByName && lock.unlockReason ? (
          <p className="mt-2 text-sm text-muted">
            {t("pages.payroll.unlockedBy", {
              name: lock.unlockedByName,
              reason: lock.unlockReason,
            })}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-text">
              {t("pages.billing.payrollMgmt.reviewTitle")}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {t("pages.billing.payrollMgmt.reviewDesc")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lock.locked && canUnlock && !billingLocked ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setUnlockOpen(true)}
              >
                {t("pages.payroll.unlockPeriod")}
              </Button>
            ) : null}
            {canManage ? (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={generatePdf}
              >
                {t("pages.billing.payrollMgmt.generatePdf")}
              </Button>
            ) : null}
          </div>
        </div>

        {review.length === 0 ? (
          <p className="text-sm text-muted">
            {t("pages.billing.payrollMgmt.reviewEmpty")}
          </p>
        ) : (
          <div className="space-y-6">
            {review.map((row) => (
              <article
                key={row.employeeId}
                className="rounded-xl border border-border/80 bg-elevated/40 p-4"
              >
                <p className="font-medium text-text">
                  {row.employeeName}{" "}
                  <span className="text-sm text-muted">({row.employeeNo})</span>
                </p>
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-text">
                    {t("pages.payroll.dayListTitle")}
                  </h4>
                  {row.days.length === 0 ? (
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
                              {t("pages.payroll.dayCheckIn")}
                            </th>
                            <th className="px-2 py-2 font-medium">
                              {t("pages.payroll.dayCheckOut")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.days.map((day) => (
                            <tr
                              key={day.sessionKey}
                              className="border-b border-border/60 align-top"
                            >
                              <td className="px-2 py-2 text-text">
                                {formatEnglishOrdinalDate(
                                  `${day.dateKey}T00:00:00Z`,
                                  bcp47
                                )}
                              </td>
                              <td className="px-2 py-2 text-muted">
                                {day.siteName ?? "—"}
                              </td>
                              <td className="px-2 py-2 text-muted">
                                {day.absent && !day.checkInAt ? (
                                  <span className="font-medium text-amber-600">
                                    {t("pages.payroll.absent")}
                                  </span>
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
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
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
                      {t("pages.payroll.columns.wage")}
                    </p>
                    <p className="font-medium text-text">
                      {formatContractPrice(row.wage)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-text">
              {t("pages.billing.payrollMgmt.listTitle")}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {t("pages.billing.payrollMgmt.listDesc")}
            </p>
          </div>
          {canManage && !locked ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  const data = new FormData();
                  data.set("projectId", projectId);
                  data.set("year", String(year));
                  data.set("month", String(month));
                  startTransition(async () => {
                    try {
                      await fillPayrollManagementFromCico(data);
                      router.refresh();
                    } catch (error) {
                      showRejectionFromError(
                        error,
                        t("pages.billing.payrollMgmt.actionFailed")
                      );
                    }
                  });
                }}
              >
                {t("pages.billing.payrollMgmt.fillFromCico")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((current) => [...current, newLine()])}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("pages.billing.payrollMgmt.addLine")}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          {lines.map((line) => (
            <div
              key={line.key}
              className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]"
            >
              <Input
                placeholder={t("pages.billing.payrollMgmt.employeeName")}
                value={line.employeeName}
                disabled={!canManage || locked || pending}
                onChange={(event) =>
                  updateLine(line.key, { employeeName: event.target.value })
                }
              />
              <Input
                type="number"
                min={0}
                placeholder={t("pages.billing.payrollMgmt.amount")}
                value={line.amount}
                disabled={!canManage || locked || pending}
                onChange={(event) =>
                  updateLine(line.key, { amount: event.target.value })
                }
              />
              <Input
                placeholder={t("pages.billing.payrollMgmt.accountNumber")}
                value={line.accountNumber}
                disabled={!canManage || locked || pending}
                onChange={(event) =>
                  updateLine(line.key, { accountNumber: event.target.value })
                }
              />
              <Input
                placeholder={t("pages.billing.payrollMgmt.lineNotes")}
                value={line.notes}
                disabled={!canManage || locked || pending}
                onChange={(event) =>
                  updateLine(line.key, { notes: event.target.value })
                }
              />
              {canManage && !locked ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    setLines((current) =>
                      current.length <= 1
                        ? [newLine()]
                        : current.filter((row) => row.key !== line.key)
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-elevated/40 p-3">
            <p className="text-xs text-muted">
              {t("pages.billing.payrollMgmt.wagesTotal")}
            </p>
            <p className="mt-1 font-semibold text-text">
              {formatContractPrice(totals.wagesTotal)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-elevated/40 p-3">
            <p className="text-xs text-muted">
              {t("pages.billing.payrollMgmt.feeAmount", {
                percent: serviceFeePercent,
              })}
            </p>
            <p className="mt-1 font-semibold text-text">
              {formatContractPrice(totals.feeAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-elevated/40 p-3">
            <p className="text-xs text-muted">
              {t("pages.billing.payrollMgmt.taxAmount", {
                percent: taxPercent,
              })}
            </p>
            <p className="mt-1 font-semibold text-text">
              {formatContractPrice(totals.taxAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-elevated/40 p-3">
            <p className="text-xs text-muted">
              {t("pages.billing.payrollMgmt.clientBill")}
            </p>
            <p className="mt-1 font-semibold text-text">
              {formatContractPrice(totals.clientBillAmount)}
            </p>
          </div>
        </div>

        {canManage && !locked ? (
          <div className="mt-4">
            <Button type="button" onClick={saveList} disabled={pending}>
              {pending
                ? t("pages.billing.payrollMgmt.saving")
                : t("pages.billing.payrollMgmt.saveList")}
            </Button>
          </div>
        ) : null}
      </SectionCard>

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
