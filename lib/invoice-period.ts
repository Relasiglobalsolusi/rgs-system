import type { BillingPeriodBasis, InvoicePeriodStatus } from "@prisma/client";
import { DISPLAY_LOCALE } from "@/lib/format-date";

/** Default days after invoice submit until payment is due. */
export const DEFAULT_INVOICE_DUE_DAYS = 14;

/** Cash = due immediately (invoice issue / submit date). */
export const CASH_PAYMENT_TERMS_DAYS = 0;

/**
 * Allowed project / purchase payment terms (`paymentTermsDays`).
 * `0` = Cash (due on invoice submit / issue date).
 * Longer nets (90–180) are for strong supplier or client relationships.
 */
export const PAYMENT_TERMS_DAYS_OPTIONS = [
  CASH_PAYMENT_TERMS_DAYS,
  7,
  14,
  30,
  45,
  60,
  90,
  120,
  150,
  180,
] as const;

export type PaymentTermsDaysOption =
  (typeof PAYMENT_TERMS_DAYS_OPTIONS)[number];

/** Whole months for long Net terms (90 / 120 / 150 / 180). */
export function paymentTermsMonthCount(
  days: number | null | undefined
): number | null {
  if (typeof days !== "number" || !Number.isFinite(days) || days < 90) {
    return null;
  }
  if (days % 30 !== 0) return null;
  return days / 30;
}

export function isCashPaymentTerms(
  days: number | null | undefined
): boolean {
  return days === CASH_PAYMENT_TERMS_DAYS;
}

export type InvoicePaymentDisplay = {
  /** UI status including computed Late. */
  key:
    | "ONGOING"
    | "COMPILING"
    | "AWAITING_CLIENT_REVIEW"
    | "AWAITING_PAYMENT"
    | "PENDING_VERIFICATION"
    | "PAID"
    | "LATE";
  label: string;
  /**
   * When set, render StatusBadge with `lines` so the label fits the fixed
   * 7.5rem chip (e.g. AWAITING / PAYMENT).
   */
  chipLines?: readonly [string, string];
  tone: "active" | "pending" | "success" | "warning" | "danger" | "inactive";
  dueAt: Date | null;
  daysSinceInvoiced: number | null;
  daysOverdue: number | null;
  isLate: boolean;
};

/** Long billing chip labels that must stack inside the fixed StatusBadge box. */
export const BILLING_CHIP_LINES = {
  awaitingPayment: ["Awaiting", "Payment"],
  awaitingInvoice: ["Awaiting", "Invoice"],
  verifyingPayment: ["Verifying", "Payment"],
  readyToReconcile: ["Ready to", "Reconcile"],
  readyToInvoice: ["Ready to", "Invoice"],
  awaitingClientReview: ["Awaiting", "Client"],
  taxInvoiceDue: ["Tax", "Pending"],
  taxInvoiceDone: ["Tax Invoice", "Sent"],
  latePayment: ["Late", "Payment"],
  paymentDue: ["Payment", "Due"],
  invoiceDue: ["Invoice", "Due"],
} as const satisfies Record<string, readonly [string, string]>;

/**
 * Clamp client/project payment terms to a sane range.
 * `0` = Cash (due immediately on invoice submit).
 */
export function normalizePaymentTermsDays(
  days: number | null | undefined
): number {
  if (typeof days !== "number" || !Number.isFinite(days)) {
    return DEFAULT_INVOICE_DUE_DAYS;
  }
  const n = Math.floor(days);
  if (n < 0) return DEFAULT_INVOICE_DUE_DAYS;
  return Math.min(n, 365);
}

/**
 * Invoice issue calendar day in Asia/Jakarta (ERP business timezone).
 * Stored / compared as a UTC date-only value (midnight UTC).
 */
export function invoiceIssueCalendarDate(submittedAt: Date = new Date()): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(submittedAt);
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * dueAt = issue calendar day (Asia/Jakarta) + N calendar days.
 * Example: issued 16 July + Net 14 → due 30 July.
 * Cash (N = 0): dueAt equals the invoice issue date.
 */
export function computeInvoiceDueAt(
  submittedAt: Date,
  dueDays: number = DEFAULT_INVOICE_DUE_DAYS
): Date {
  const base = invoiceIssueCalendarDate(submittedAt);
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + dueDays
    )
  );
}

/**
 * dueAt from client/vendor payment terms (falls back to
 * {@link DEFAULT_INVOICE_DUE_DAYS}). Cash (`0`) → same calendar day.
 */
export function dueAtFromClientPaymentTerms(
  submittedAt: Date,
  paymentTermsDays: number | null | undefined
): Date {
  return computeInvoiceDueAt(
    submittedAt,
    normalizePaymentTermsDays(paymentTermsDays)
  );
}

/** Alias for AP / purchase invoices using the same Net/Cash day math. */
export const dueAtFromPaymentTerms = dueAtFromClientPaymentTerms;

export type PurchasePaymentDisplay = {
  dueAt: Date | null;
  /** Unpaid and past dueAt (computed). Not a DB OVERDUE writer. */
  isOverdue: boolean;
  isPaid: boolean;
  key: "paid" | "overdue" | "open" | "no_due";
};

/**
 * AP payment display: Overdue = unpaid AND past computed dueAt.
 * Prefer this over unused DB status writers.
 */
export function getPurchasePaymentDisplay(
  invoice: {
    invoiceDate: Date;
    paidAt?: Date | null;
    paymentTermsDays?: number | null;
  },
  now: Date = new Date()
): PurchasePaymentDisplay {
  const isPaid = invoice.paidAt != null;
  const dueAt =
    invoice.paymentTermsDays != null
      ? dueAtFromPaymentTerms(invoice.invoiceDate, invoice.paymentTermsDays)
      : null;
  if (isPaid) {
    return { dueAt, isOverdue: false, isPaid: true, key: "paid" };
  }
  if (dueAt == null) {
    return { dueAt: null, isOverdue: false, isPaid: false, key: "no_due" };
  }
  const today = toUtcDateOnly(now);
  const isOverdue = toUtcDateOnly(dueAt).getTime() < today.getTime();
  return {
    dueAt,
    isOverdue,
    isPaid: false,
    key: isOverdue ? "overdue" : "open",
  };
}

/** AP tax incomplete: local PPN enabled but faktur pajak not uploaded yet. */
export function isPurchaseTaxIncomplete(invoice: {
  includesPpn: boolean;
  taxInvoiceFilePath?: string | null;
  origin?: string | null;
  purchaseCategory?: string | null;
}): boolean {
  if (invoice.purchaseCategory === "GOVERNMENT") return false;
  // Import PPN is credited from the customs payment (PIB), not an e-Faktur.
  if (invoice.origin === "IMPORT") return false;
  return invoice.includesPpn && !invoice.taxInvoiceFilePath;
}

export function resolveInvoiceDueAt(period: {
  dueAt?: Date | null;
  submittedAt?: Date | null;
  /** Used only when dueAt is missing (legacy rows). */
  paymentTermsDays?: number | null;
}): Date | null {
  if (period.dueAt) return period.dueAt;
  if (period.submittedAt) {
    return dueAtFromClientPaymentTerms(
      period.submittedAt,
      period.paymentTermsDays
    );
  }
  return null;
}

/** Whole UTC calendar days between two dates (a → b). */
export function utcDayDiff(from: Date, to: Date): number {
  const a = toUtcDateOnly(from).getTime();
  const b = toUtcDateOnly(to).getTime();
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

/**
 * Payment display for billing UI: Paid / Awaiting / Late (when past due).
 * Late is computed from dueAt even if DB status is still AWAITING_PAYMENT.
 */
export function getInvoicePaymentDisplay(
  period: {
    status: InvoicePeriodStatus | string;
    submittedAt?: Date | null;
    dueAt?: Date | null;
    paidAt?: Date | null;
    paymentTermsDays?: number | null;
  },
  now: Date = new Date()
): InvoicePaymentDisplay {
  const dueAt = resolveInvoiceDueAt(period);
  const daysSinceInvoiced =
    period.submittedAt != null ? Math.max(0, utcDayDiff(period.submittedAt, now)) : null;

  if (period.status === "PAID") {
    return {
      key: "PAID",
      label: "Paid",
      tone: "active",
      dueAt,
      daysSinceInvoiced,
      daysOverdue: null,
      isLate: false,
    };
  }

  if (period.status === "ONGOING") {
    return {
      key: "ONGOING",
      label: "Ongoing",
      tone: "active",
      dueAt,
      daysSinceInvoiced: null,
      daysOverdue: null,
      isLate: false,
    };
  }

  if (period.status === "COMPILING") {
    return {
      key: "COMPILING",
      label: "Compiling",
      tone: "pending",
      dueAt,
      daysSinceInvoiced: null,
      daysOverdue: null,
      isLate: false,
    };
  }

  if (period.status === "PENDING_VERIFICATION") {
    return {
      key: "PENDING_VERIFICATION",
      label: "Verifying Payment",
      chipLines: BILLING_CHIP_LINES.verifyingPayment,
      tone: "pending",
      dueAt,
      daysSinceInvoiced,
      daysOverdue: null,
      isLate: false,
    };
  }

  if (period.status === "AWAITING_CLIENT_REVIEW") {
    return {
      key: "AWAITING_CLIENT_REVIEW",
      label: "Awaiting Client Review",
      chipLines: BILLING_CHIP_LINES.awaitingClientReview,
      tone: "pending",
      dueAt,
      daysSinceInvoiced: null,
      daysOverdue: null,
      isLate: false,
    };
  }

  const openForPayment =
    period.status === "AWAITING_PAYMENT" || period.status === "OVERDUE";
  const isLate =
    openForPayment &&
    dueAt != null &&
    toUtcDateOnly(now).getTime() > toUtcDateOnly(dueAt).getTime();
  const daysOverdue =
    isLate && dueAt != null ? Math.max(0, utcDayDiff(dueAt, now)) : null;

  if (isLate || period.status === "OVERDUE") {
    return {
      key: "LATE",
      label: "Late",
      tone: "danger",
      dueAt,
      daysSinceInvoiced,
      daysOverdue: daysOverdue ?? (dueAt != null ? Math.max(0, utcDayDiff(dueAt, now)) : null),
      isLate: true,
    };
  }

  return {
    key: "AWAITING_PAYMENT",
    label: "Awaiting Payment",
    chipLines: BILLING_CHIP_LINES.awaitingPayment,
    tone: "warning",
    dueAt,
    daysSinceInvoiced,
    daysOverdue: null,
    isLate: false,
  };
}

/** Normalize to UTC midnight date-only value. */
export function toUtcDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("Invalid date.");
  }
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateInput(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function clampInvoicingDay(day: number | null | undefined): number {
  if (day == null || Number.isNaN(day)) return 1;
  return Math.min(28, Math.max(1, Math.floor(day)));
}

/** UTC month name, e.g. "July". */
function utcMonthLong(date: Date): string {
  return date.toLocaleDateString(DISPLAY_LOCALE, {
    month: "long",
    timeZone: "UTC",
  });
}

/**
 * Invoice period date-range label.
 * Same month: "1-31 July 2026". Cross-month: "28 June – 5 July 2026".
 */
export function formatInvoicePeriodDateRange(
  periodStart: Date,
  periodEnd: Date
): string {
  const startDay = periodStart.getUTCDate();
  const endDay = periodEnd.getUTCDate();
  const startMonth = periodStart.getUTCMonth();
  const endMonth = periodEnd.getUTCMonth();
  const startYear = periodStart.getUTCFullYear();
  const endYear = periodEnd.getUTCFullYear();

  if (startYear === endYear && startMonth === endMonth) {
    return `${startDay}-${endDay} ${utcMonthLong(periodStart)} ${startYear}`;
  }
  // Cross-month / cross-year: "15 May 2026 – 15 June 2026"
  return `${startDay} ${utcMonthLong(periodStart)} ${startYear} – ${endDay} ${utcMonthLong(periodEnd)} ${endYear}`;
}

/** Calendar month containing `ref` as a billing period (1st → last day). */
export function monthPeriodBounds(ref: Date): {
  periodStart: Date;
  periodEnd: Date;
  label: string;
} {
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0)
  );
  return {
    periodStart: start,
    periodEnd: end,
    label: formatInvoicePeriodDateRange(start, end),
  };
}

/** True when the range is a full UTC calendar month (1st → last day). */
export function isCalendarMonthPeriodBounds(
  periodStart: Date,
  periodEnd: Date
): boolean {
  const start = toUtcDateOnly(periodStart);
  const end = toUtcDateOnly(periodEnd);
  if (start.getUTCDate() !== 1) return false;
  const lastDay = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)
  );
  return end.getTime() === lastDay.getTime();
}

export function parseBillingPeriodBasis(
  raw: FormDataEntryValue | string | null | undefined
): BillingPeriodBasis | null {
  const value = String(raw ?? "").trim();
  if (value === "CALENDAR_MONTH" || value === "CONTRACT_CYCLE") return value;
  return null;
}

export type BillingCycleDays = {
  fromDay?: number | null;
  toDay?: number | null;
};

export function clampBillingCycleDay(
  day: number | null | undefined
): number {
  if (day == null || !Number.isFinite(day)) return 1;
  return Math.min(31, Math.max(1, Math.round(day)));
}

/** Day-of-month in UTC, clamping 31 in short months to the last day. */
export function utcDateForCycleDay(
  year: number,
  monthIndex: number,
  day: number
): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(year, monthIndex, Math.min(clampBillingCycleDay(day), lastDay))
  );
}

/** Stored Custom Period days, or the contract start day for both (legacy). */
export function resolveBillingCycleDays(
  contractStart: Date,
  fromDay?: number | null,
  toDay?: number | null
): { fromDay: number; toDay: number } {
  const fallback = clampBillingCycleDay(
    toUtcDateOnly(contractStart).getUTCDate()
  );
  return {
    fromDay: fromDay != null ? clampBillingCycleDay(fromDay) : fallback,
    toDay: toDay != null ? clampBillingCycleDay(toDay) : fallback,
  };
}

export function parseBillingCycleDayInput(
  raw: FormDataEntryValue | string | null | undefined
): number | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const day = Number(value);
  if (!Number.isFinite(day)) return null;
  const rounded = Math.round(day);
  if (rounded < 1 || rounded > 31) return null;
  return rounded;
}

/**
 * Custom Period from/to days (1–31). Calendar Month clears stored days.
 */
export function parseCustomBillingCycleDays(
  formData: FormData,
  basis: BillingPeriodBasis | null
): { billingCycleStartDay: number | null; billingCycleEndDay: number | null } {
  if (basis !== "CONTRACT_CYCLE") {
    return { billingCycleStartDay: null, billingCycleEndDay: null };
  }
  const billingCycleStartDay = parseBillingCycleDayInput(
    formData.get("billingCycleStartDay")
  );
  const billingCycleEndDay = parseBillingCycleDayInput(
    formData.get("billingCycleEndDay")
  );
  if (billingCycleStartDay == null || billingCycleEndDay == null) {
    throw new Error("From day and to day are required for Custom Period.");
  }
  return { billingCycleStartDay, billingCycleEndDay };
}

/** True when To Day is on or before From Day — the window ends next month. */
export function customDayCycleCrossesMonth(
  fromDay: number,
  toDay: number
): boolean {
  return (
    clampBillingCycleDay(toDay) <= clampBillingCycleDay(fromDay)
  );
}

export function customDayCyclePeriodStartingInMonth(
  year: number,
  monthIndex: number,
  fromDay: number,
  toDay: number
): { periodStart: Date; periodEnd: Date; label: string } {
  const from = clampBillingCycleDay(fromDay);
  const to = clampBillingCycleDay(toDay);
  const periodStart = utcDateForCycleDay(year, monthIndex, from);
  const periodEnd = customDayCycleCrossesMonth(from, to)
    ? utcDateForCycleDay(year, monthIndex + 1, to)
    : utcDateForCycleDay(year, monthIndex, to);
  return {
    periodStart,
    periodEnd,
    label: formatInvoicePeriodDateRange(periodStart, periodEnd),
  };
}

/** The recurring from/to window that contains `ref`. */
export function customDayCycleContaining(
  fromDay: number,
  toDay: number,
  ref: Date
): { periodStart: Date; periodEnd: Date; label: string } {
  const day = toUtcDateOnly(ref);
  const y = day.getUTCFullYear();
  const m = day.getUTCMonth();
  const current = customDayCyclePeriodStartingInMonth(y, m, fromDay, toDay);
  if (
    day.getTime() >= current.periodStart.getTime() &&
    day.getTime() <= current.periodEnd.getTime()
  ) {
    return current;
  }
  if (day.getTime() < current.periodStart.getTime()) {
    return customDayCyclePeriodStartingInMonth(y, m - 1, fromDay, toDay);
  }
  return customDayCyclePeriodStartingInMonth(y, m + 1, fromDay, toDay);
}

/**
 * First open monthly period for a Regular contract after Move to In Progress.
 * Calendar Month → month containing real start; Custom Period → window containing start.
 */
export function firstMonthlyPeriodBounds(
  basis: BillingPeriodBasis | null | undefined,
  contractStart: Date,
  cycle?: BillingCycleDays | null
): { periodStart: Date; periodEnd: Date; label: string } {
  const start = toUtcDateOnly(contractStart);
  if (basis === "CALENDAR_MONTH") {
    return monthPeriodBounds(start);
  }
  const days = resolveBillingCycleDays(start, cycle?.fromDay, cycle?.toDay);
  return customDayCycleContaining(days.fromDay, days.toDay, start);
}

/** Previous calendar month relative to `ref`. */
export function previousMonthPeriodBounds(ref: Date) {
  const prev = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1)
  );
  return monthPeriodBounds(prev);
}

/** Add whole UTC calendar days to a date-only value. */
export function addUtcDays(date: Date, days: number): Date {
  const base = toUtcDateOnly(date);
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + days
    )
  );
}

/**
 * Add calendar months in UTC, clamping the day when the target month is shorter
 * (e.g. 31 Jan + 1 month → 28/29 Feb; 31 Jan + 2 months → 31 Mar).
 */
export function addUtcMonthsClamped(date: Date, months: number): Date {
  const base = toUtcDateOnly(date);
  const day = base.getUTCDate();
  const probe = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1)
  );
  const lastDay = new Date(
    Date.UTC(probe.getUTCFullYear(), probe.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return new Date(
    Date.UTC(
      probe.getUTCFullYear(),
      probe.getUTCMonth(),
      Math.min(day, lastDay)
    )
  );
}

export type ContractCyclePeriodBounds = {
  cycleIndex: number;
  periodStart: Date;
  periodEnd: Date;
  label: string;
  /** Day after periodEnd — when the period may be compiled/sent. */
  invoiceDueOn: Date;
};

/**
 * Custom Period cycle (1-based) from From Day / To Day.
 * From 15, To 14 (cross-month): 15 Mar – 14 Apr, 15 Apr – 14 May …
 * From 5, To 20 (same month): 5 Mar – 20 Mar, 5 Apr – 20 Apr …
 * Short months clamp 31 to the last day.
 */
export function customDayCyclePeriodBounds(
  fromDay: number,
  toDay: number,
  cycleIndex: number,
  anchor: Date
): ContractCyclePeriodBounds {
  if (!Number.isInteger(cycleIndex) || cycleIndex < 1) {
    throw new Error("cycleIndex must be an integer >= 1.");
  }
  const first = customDayCycleContaining(fromDay, toDay, toUtcDateOnly(anchor));
  const startMonth =
    first.periodStart.getUTCMonth() + (cycleIndex - 1);
  const bounds = customDayCyclePeriodStartingInMonth(
    first.periodStart.getUTCFullYear(),
    startMonth,
    fromDay,
    toDay
  );
  return {
    cycleIndex,
    periodStart: bounds.periodStart,
    periodEnd: bounds.periodEnd,
    label: bounds.label,
    invoiceDueOn: addUtcDays(bounds.periodEnd, 1),
  };
}

/**
 * Regular Cleaning anniversary cycle (1-based) inferred from contract start day.
 * Start 15 May 2026 (from 15 → to 15, cross-month):
 *   1 → 15 May – 15 Jun
 *   2 → 15 Jun – 15 Jul
 */
export function contractCyclePeriodBounds(
  contractStart: Date,
  cycleIndex: number
): ContractCyclePeriodBounds {
  const start = toUtcDateOnly(contractStart);
  const day = start.getUTCDate();
  return customDayCyclePeriodBounds(day, day, cycleIndex, start);
}

export function resolveCustomDayCycleIndex(
  fromDay: number,
  toDay: number,
  anchor: Date,
  ref: Date
): number {
  const first = customDayCycleContaining(fromDay, toDay, toUtcDateOnly(anchor));
  const current = customDayCycleContaining(fromDay, toDay, toUtcDateOnly(ref));
  if (current.periodStart.getTime() < first.periodStart.getTime()) return 1;
  const months =
    (current.periodStart.getUTCFullYear() - first.periodStart.getUTCFullYear()) *
      12 +
    (current.periodStart.getUTCMonth() - first.periodStart.getUTCMonth());
  return months + 1;
}

/** True when `bounds` matches this project's From Day / To Day cycle. */
export function matchingCustomDayCycleIndex(
  fromDay: number,
  toDay: number,
  anchor: Date,
  periodStart: Date,
  periodEnd: Date
): number | null {
  const index = resolveCustomDayCycleIndex(
    fromDay,
    toDay,
    anchor,
    toUtcDateOnly(periodStart)
  );
  for (const idx of [index, index - 1, index + 1, 1]) {
    if (idx < 1) continue;
    const bounds = customDayCyclePeriodBounds(fromDay, toDay, idx, anchor);
    if (
      bounds.periodStart.getTime() === toUtcDateOnly(periodStart).getTime() &&
      bounds.periodEnd.getTime() === toUtcDateOnly(periodEnd).getTime()
    ) {
      return idx;
    }
  }
  return null;
}

/** Preferred auto-invoice day: the calendar day after To Day (clamped 1–28). */
export function invoicingDayFromCycleToDay(toDay: number): number {
  const day = clampBillingCycleDay(toDay);
  return clampInvoicingDay(day >= 31 ? 1 : day + 1);
}

/**
 * Preferred day-of-month for auto-invoice (day after the first period ends).
 * Clamped to 1–28 for storage.
 */
export function invoicingDayFromCycleEnd(cycleEnd: Date): number {
  return invoicingDayFromCycleToDay(toUtcDateOnly(cycleEnd).getUTCDate());
}

/**
 * Preferred day-of-month for auto-invoice, derived from real contract start
 * (day after the first period ends). Clamped to 1–28 for storage.
 */
export function invoicingDayFromContractStart(contractStart: Date): number {
  return invoicingDayFromCycleEnd(addUtcMonthsClamped(toUtcDateOnly(contractStart), 1));
}

/**
 * Regular Cleaning: invoice becomes due the calendar day after periodEnd.
 * (Replaces calendar-month "invoicing day of next month" checks.)
 */
export function isAnniversaryPeriodDue(
  today: Date,
  periodEnd: Date
): boolean {
  return toUtcDateOnly(today).getTime() > toUtcDateOnly(periodEnd).getTime();
}

/** Open monthly row that has reached its anniversary invoice day. */
export function isMonthlyPeriodReadyToInvoice(
  period: { status: string; periodEnd: Date },
  today: Date = new Date()
): boolean {
  if (period.status !== "ONGOING" && period.status !== "COMPILING") {
    return false;
  }
  return isAnniversaryPeriodDue(today, period.periodEnd);
}

/** Due monthly cycle that still needs staff reconcile before invoice submit. */
export function isMonthlyPeriodAwaitingReconcile(
  period: {
    status: string;
    periodEnd: Date;
    reconciledAt?: Date | string | null;
  },
  today: Date = new Date()
): boolean {
  if (!isMonthlyPeriodReadyToInvoice(period, today)) return false;
  return !period.reconciledAt;
}

/** Due monthly cycle reconciled and ready to submit/issue the invoice. */
export function isMonthlyPeriodReadyToSubmitInvoice(
  period: {
    status: string;
    periodEnd: Date;
    reconciledAt?: Date | string | null;
  },
  today: Date = new Date()
): boolean {
  if (!isMonthlyPeriodReadyToInvoice(period, today)) return false;
  return Boolean(period.reconciledAt);
}
