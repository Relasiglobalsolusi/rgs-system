import type { BillingMode, ProjectSubCategory } from "@prisma/client";
import { getLocale, type AppLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { isContractSubCategory } from "@/lib/project-contract";
import { formatInvoicePeriodDateRange } from "@/lib/invoice-period";

export const BILLING_MODES = [
  "MONTHLY",
  "ON_COMPLETION",
  "MILESTONE",
] as const satisfies readonly BillingMode[];

export const BILLING_MODE_LABELS: Record<BillingMode, string> = {
  MONTHLY: "Monthly",
  ON_COMPLETION: "On completion",
  MILESTONE: "Milestone",
};

/** Canonical stored/display label for on-completion invoices (one per project). */
export const COMPLETION_INVOICE_LABEL = "Completion invoice";

/** Billing choices for General / Facade Cleaning only. */
export const MILESTONE_ELIGIBLE_BILLING_MODES = [
  "MILESTONE",
  "ON_COMPLETION",
] as const satisfies readonly BillingMode[];

export const MIN_MILESTONE_PAYMENTS = 2;
export const MAX_MILESTONE_PAYMENTS = 10;
export const DEFAULT_MILESTONE_PAYMENTS = 4;

export function isBillingMode(value: string): value is BillingMode {
  return (BILLING_MODES as readonly string[]).includes(value);
}

/**
 * Milestone payment schedules only apply to General Cleaning and Facade Cleaning.
 * Regular Cleaning (and any other subcategory) must not use MILESTONE billing.
 */
export function isMilestoneSubCategory(
  value: ProjectSubCategory | string | null | undefined
): boolean {
  return value === "GENERAL_CLEANING" || value === "FACADE_CLEANING";
}

/** Billing modes allowed for a subcategory (server + UI guard). */
export function allowedBillingModesForSubCategory(
  subCategory: ProjectSubCategory | string
): readonly BillingMode[] {
  if (isContractSubCategory(subCategory)) return ["MONTHLY"];
  if (isMilestoneSubCategory(subCategory)) {
    return MILESTONE_ELIGIBLE_BILLING_MODES;
  }
  return ["MONTHLY"];
}

/**
 * Assert billing mode is valid for the subcategory.
 * Throws on invalid combos (e.g. MILESTONE on Regular Cleaning).
 */
export function assertBillingModeForSubCategory(
  subCategory: ProjectSubCategory | string,
  billingMode: BillingMode | string
): asserts billingMode is BillingMode {
  if (!isBillingMode(billingMode)) {
    throw new Error("Invalid billing mode.");
  }
  const allowed = allowedBillingModesForSubCategory(subCategory);
  if (!allowed.includes(billingMode)) {
    throw new Error(
      billingMode === "MILESTONE"
        ? "Milestone payment schedules are only for General Cleaning and Facade Cleaning."
        : `Billing mode ${billingMode} is not allowed for this subcategory.`
    );
  }
}

/** Default billing mode from subcategory. */
export function defaultBillingMode(
  subCategory: ProjectSubCategory | string
): BillingMode {
  if (isContractSubCategory(subCategory)) return "MONTHLY";
  if (isMilestoneSubCategory(subCategory)) return "MILESTONE";
  return "MONTHLY";
}

/** Even installment percentages that sum to 100 (last row absorbs remainder). */
export function splitEvenlyPercents(paymentCount: number): number[] {
  const n = clampMilestonePaymentCount(paymentCount);
  const base = Math.floor((100 / n) * 100) / 100;
  const percents = Array.from({ length: n }, () => base);
  const sum = percents.reduce((a, b) => a + b, 0);
  percents[n - 1] = Math.round((percents[n - 1] + (100 - sum)) * 100) / 100;
  return percents;
}

export function clampMilestonePaymentCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MILESTONE_PAYMENTS;
  return Math.min(
    MAX_MILESTONE_PAYMENTS,
    Math.max(MIN_MILESTONE_PAYMENTS, Math.round(value))
  );
}

/** Cumulative labels: [25,25,25,25] → [25,50,75,100]. */
export function toCumulativePercents(installmentPercents: number[]): number[] {
  let running = 0;
  return installmentPercents.map((slice) => {
    running = Math.round((running + slice) * 100) / 100;
    return running;
  });
}

export type MilestoneScheduleRow = {
  index: number;
  /** This invoice’s share of contract value (delta). */
  installmentPercent: number;
  /** Cumulative progress % shown on the period (e.g. 25, 50, 75, 100). */
  cumulativePercent: number;
  label: string;
  /** Contract × installment % when price is known; otherwise null. */
  amount: number | null;
};

/** Format a milestone percent for labels (25 → "25", 33.33 → "33.33"). */
export function formatMilestonePercentDisplay(cumulativePercent: number): string {
  const pct = Math.round(cumulativePercent * 100) / 100;
  return Number.isInteger(pct) ? String(pct) : String(pct);
}

/**
 * Canonical stored schedule label (English): "Milestone 25%".
 * Keep DB values stable; localize at the display layer.
 */
export function formatMilestoneScheduleLabel(cumulativePercent: number): string {
  return `Milestone ${formatMilestonePercentDisplay(cumulativePercent)}%`;
}

/** Locale-aware schedule/display label. EN: "Milestone 25%", ID: "Tahap 25%". */
export function localizeMilestoneScheduleLabel(
  cumulativePercent: number,
  locale: AppLocale = getLocale()
): string {
  return translate(locale, "pages.projects.paymentPlan.milestoneLabel", {
    percent: formatMilestonePercentDisplay(cumulativePercent),
  });
}

/** True when a stored label is an on-completion invoice (any legacy wording). */
export function isCompletionPeriodLabel(
  label: string | null | undefined
): boolean {
  const trimmed = label?.trim() ?? "";
  if (!trimmed) return false;
  return /^(on\s+completion|completion\s+invoice)$/i.test(trimmed);
}

/**
 * Validate installment % list: 2–10 entries, each > 0, sum exactly 100.
 * Returns rounded percents or throws with a clear message.
 */
export function validateMilestoneInstallments(
  rawPercents: number[]
): number[] {
  const n = rawPercents.length;
  if (n < MIN_MILESTONE_PAYMENTS || n > MAX_MILESTONE_PAYMENTS) {
    throw new Error(
      `Payment plan must have ${MIN_MILESTONE_PAYMENTS}–${MAX_MILESTONE_PAYMENTS} payments.`
    );
  }

  const percents = rawPercents.map((p, i) => {
    if (!Number.isFinite(p) || p <= 0) {
      throw new Error(`Payment ${i + 1} must be a percentage greater than 0.`);
    }
    return Math.round(p * 100) / 100;
  });

  const sum = Math.round(percents.reduce((a, b) => a + b, 0) * 100) / 100;
  if (Math.abs(sum - 100) > 0.01) {
    throw new Error(
      `Payment percentages must sum to 100% (currently ${sum}%).`
    );
  }

  // Nudge last row so stored sum is exactly 100 after rounding.
  const headSum = percents.slice(0, -1).reduce((a, b) => a + b, 0);
  percents[percents.length - 1] =
    Math.round((100 - headSum) * 100) / 100;

  return percents;
}

/** Build schedule rows from installment % (and optional contract price). */
export function buildMilestoneSchedule(
  installmentPercents: number[],
  contractPrice?: number | null
): MilestoneScheduleRow[] {
  const percents = validateMilestoneInstallments(installmentPercents);
  const cumulative = toCumulativePercents(percents);
  const price =
    contractPrice != null && Number.isFinite(contractPrice) && contractPrice > 0
      ? contractPrice
      : null;

  return percents.map((installmentPercent, index) => {
    const cumulativePercent = cumulative[index]!;
    const amount =
      price == null
        ? null
        : Math.round(((price * installmentPercent) / 100) * 100) / 100;
    return {
      index,
      installmentPercent,
      cumulativePercent,
      label: formatMilestoneScheduleLabel(cumulativePercent),
      amount,
    };
  });
}

/**
 * Parse `milestoneInstallmentPercent` form fields into a validated plan.
 * Returns null when billing is not milestone (caller should skip).
 */
export function parseMilestoneInstallmentsFromFormData(
  formData: FormData
): number[] {
  const raw = formData
    .getAll("milestoneInstallmentPercent")
    .map((v) => Number(String(v).trim()));
  if (raw.length === 0) {
    throw new Error(
      "Add a payment plan (percentages that sum to 100%) for milestone billing."
    );
  }
  return validateMilestoneInstallments(raw);
}

/**
 * Convert Prisma Decimal (or number/string) to a plain number for RSC → client props.
 * Decimal objects are not serializable across the Server/Client boundary.
 */
export function decimalToNumber(
  value: { toString(): string } | number | string | null | undefined
): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const num = Number(typeof value === "string" ? value : value.toString());
  return Number.isFinite(num) ? num : null;
}

export function formatContractPrice(
  value: number | string | null | undefined
): string {
  if (value == null || value === "") return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

export function parseContractPrice(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
  if (!cleaned.trim()) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

/** Sum of amounts already invoiced (awaiting + paid + compiling). */
export function sumInvoicedAmount(
  periods: { amount: number | string | null; status: string }[]
): number {
  return periods.reduce((sum, p) => {
    if (
      !["AWAITING_PAYMENT", "PENDING_VERIFICATION", "PAID", "OVERDUE", "COMPILING"].includes(p.status)
    ) {
      return sum;
    }
    const n =
      p.amount == null
        ? 0
        : typeof p.amount === "string"
          ? Number(p.amount)
          : p.amount;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/** Statuses whose stored amounts are redistributed when contract price changes. */
export const MILESTONE_UNPAID_STATUSES = [
  "ONGOING",
  "COMPILING",
  "AWAITING_PAYMENT",
  "OVERDUE",
  "PENDING_VERIFICATION",
] as const;

export type MilestonePeriodForRevision = {
  id: string;
  milestonePercent: number | null;
  amount: number | string | null;
  status: string;
  compileNote?: string | null;
};

export type MilestoneAmountRevision = {
  id: string;
  amount: number;
  /** True when stored amount changed (issued invoices may need PDF regen). */
  amountChanged: boolean;
  /** Issued but unpaid — PDF may show the previous amount. */
  needsPdfRefresh: boolean;
  compileNote: string | null;
};

const CONTRACT_PRICE_REVISED_NOTE =
  "Contract price revised — invoice PDF may show the previous amount until regenerated.";

function periodAmountNumber(
  value: number | string | null | undefined
): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Recalculate unpaid milestone period amounts after a contract-price change.
 *
 * Formula:
 *   alreadyPaid = sum(PAID period amounts)  // actual money received
 *   remainingToCollect = max(0, newContractPrice - alreadyPaid)
 *   unpaidSliceWeights = installment % of each non-PAID period (from cumulative deltas)
 *   each unpaid amount = remainingToCollect × (slice / sum(unpaid slices))
 *
 * PAID rows are left unchanged. When alreadyPaid >= newContractPrice, unpaid
 * amounts become 0 (nothing left to invoice/collect).
 */
export function recalculateUnpaidMilestoneAmounts(
  periods: MilestonePeriodForRevision[],
  newContractPrice: number
): MilestoneAmountRevision[] {
  const priced =
    Number.isFinite(newContractPrice) && newContractPrice > 0
      ? newContractPrice
      : 0;

  const milestonePeriods = periods
    .filter(
      (p) =>
        p.milestonePercent != null && Number.isFinite(p.milestonePercent)
    )
    .map((p) => ({
      ...p,
      milestonePercent: p.milestonePercent as number,
    }))
    .sort((a, b) => a.milestonePercent - b.milestonePercent);

  let alreadyPaid = 0;
  for (const p of milestonePeriods) {
    if (p.status === "PAID") {
      alreadyPaid += periodAmountNumber(p.amount);
    }
  }
  alreadyPaid = Math.round(alreadyPaid * 100) / 100;
  const remainingToCollect = Math.max(
    0,
    Math.round((priced - alreadyPaid) * 100) / 100
  );

  type UnpaidRow = {
    id: string;
    slice: number;
    prevAmount: number;
    status: string;
    compileNote: string | null;
  };

  const unpaid: UnpaidRow[] = [];
  let prevCumulative = 0;
  for (const p of milestonePeriods) {
    const slice =
      Math.round((p.milestonePercent - prevCumulative) * 100) / 100;
    prevCumulative = p.milestonePercent;
    if (
      !(MILESTONE_UNPAID_STATUSES as readonly string[]).includes(p.status)
    ) {
      continue;
    }
    unpaid.push({
      id: p.id,
      slice: slice > 0 ? slice : 0,
      prevAmount: periodAmountNumber(p.amount),
      status: p.status,
      compileNote: p.compileNote ?? null,
    });
  }

  if (unpaid.length === 0) return [];

  const weightSum = unpaid.reduce((s, u) => s + u.slice, 0);
  const revisions: MilestoneAmountRevision[] = [];
  let allocated = 0;

  for (let i = 0; i < unpaid.length; i++) {
    const row = unpaid[i]!;
    const isLast = i === unpaid.length - 1;
    let amount: number;
    if (remainingToCollect <= 0 || weightSum <= 0) {
      amount = 0;
    } else if (isLast) {
      amount = Math.round((remainingToCollect - allocated) * 100) / 100;
    } else {
      amount =
        Math.round(((remainingToCollect * row.slice) / weightSum) * 100) /
        100;
      allocated = Math.round((allocated + amount) * 100) / 100;
    }
    if (amount < 0) amount = 0;

    const amountChanged =
      Math.round(row.prevAmount * 100) / 100 !==
      Math.round(amount * 100) / 100;
    const isIssuedUnpaid =
      row.status === "AWAITING_PAYMENT" ||
      row.status === "OVERDUE" ||
      row.status === "PENDING_VERIFICATION";
    const needsPdfRefresh = amountChanged && isIssuedUnpaid;

    let compileNote = row.compileNote;
    if (needsPdfRefresh) {
      const existing = (compileNote ?? "").trim();
      compileNote = existing.includes(CONTRACT_PRICE_REVISED_NOTE)
        ? existing
        : existing
          ? `${existing} ${CONTRACT_PRICE_REVISED_NOTE}`
          : CONTRACT_PRICE_REVISED_NOTE;
    }

    revisions.push({
      id: row.id,
      amount,
      amountChanged,
      needsPdfRefresh,
      compileNote,
    });
  }

  return revisions;
}

/** Highest milestone % already invoiced. */
export function maxMilestonePercent(
  periods: { milestonePercent: number | null; status: string }[]
): number {
  let max = 0;
  for (const p of periods) {
    if (
      p.milestonePercent != null &&
      ["AWAITING_PAYMENT", "PENDING_VERIFICATION", "PAID", "OVERDUE", "COMPILING"].includes(p.status)
    ) {
      max = Math.max(max, p.milestonePercent);
    }
  }
  return max;
}

/** Period fields needed to build a milestone-aware project title. */
export type ProjectTitlePeriod = {
  label?: string | null;
  milestonePercent?: number | null;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
};

function toPeriodDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveMilestonePercent(
  period: ProjectTitlePeriod
): number | null {
  if (
    period.milestonePercent != null &&
    Number.isFinite(period.milestonePercent)
  ) {
    return period.milestonePercent;
  }

  const label = period.label?.trim();
  if (!label) return null;

  // "Milestone 30%" / "Tahap 30%" / legacy "Bertahap 30%" (+ optional project name)
  const milestonePrefix = label.match(
    /^(?:Milestone|Tahap|Bertahap)\s+(\d+(?:\.\d+)?)\s*%/i
  );
  if (milestonePrefix) return Number(milestonePrefix[1]);

  // Legacy: "30% Payment Milestone"
  const paymentMilestone = label.match(
    /^(\d+(?:\.\d+)?)\s*%\s*Payment\s*Milestone$/i
  );
  if (paymentMilestone) return Number(paymentMilestone[1]);

  // Legacy: "Final milestone (100%)"
  if (/^Final\s+milestone\s*\(100%\)$/i.test(label)) return 100;

  return null;
}

/**
 * Milestone period label: "Milestone 25%" / "Tahap 25%" or with project name.
 * Returns null for monthly / completion periods.
 */
export function formatMilestonePeriodLabel(
  period: ProjectTitlePeriod,
  projectName?: string | null,
  locale: AppLocale = getLocale()
): string | null {
  const pct = resolveMilestonePercent(period);
  if (pct == null) return null;

  const base = localizeMilestoneScheduleLabel(pct, locale);
  const name = projectName?.trim();
  return name ? `${base} ${name}` : base;
}

/**
 * List/detail title for unpaid milestone context:
 * "Milestone 25% GC Batam" / "Tahap 25% GC Batam".
 * History / non-milestone stay plain "{name}".
 */
export function formatProjectTitle(
  projectName: string,
  period?: ProjectTitlePeriod | null,
  locale: AppLocale = getLocale()
): string {
  const name = projectName.trim() || "Untitled project";
  if (!period) return name;
  return formatMilestonePeriodLabel(period, name, locale) ?? name;
}

export type InvoicePeriodDisplayInput = ProjectTitlePeriod & {
  status?: string;
  /** Prisma Decimal or number — only used for ranking duplicates. */
  amount?: unknown;
  invoicePdfPath?: string | null;
  id?: string;
  paidAt?: Date | string | null;
  submittedAt?: Date | string | null;
  dueAt?: Date | string | null;
};

/**
 * Single display label for invoices & payments rows / download menus.
 * Milestone → "Milestone 25% {project}" / "Tahap 25% {project}";
 * monthly → date range; completion → one label.
 */
export function formatInvoicePeriodLabel(
  period: InvoicePeriodDisplayInput,
  opts?: {
    projectName?: string | null;
    billingMode?: BillingMode | string | null;
    locale?: AppLocale;
  }
): string {
  const locale = opts?.locale ?? getLocale();
  const milestone = formatMilestonePeriodLabel(
    period,
    opts?.projectName,
    locale
  );
  if (milestone) return milestone;

  if (
    opts?.billingMode === "ON_COMPLETION" ||
    isCompletionPeriodLabel(period.label)
  ) {
    return COMPLETION_INVOICE_LABEL;
  }

  const start = toPeriodDate(period.periodStart ?? null);
  const end = toPeriodDate(period.periodEnd ?? null);
  if (start && end) {
    return formatInvoicePeriodDateRange(start, end);
  }

  const label = period.label?.trim();
  if (label) return label;
  return "Billing period";
}

/**
 * On-completion projects should show one invoice row. Collapse legacy duplicates
 * ("On completion" + "Completion invoice") to the best issued period.
 */
export function dedupeOnCompletionPeriods<T extends InvoicePeriodDisplayInput>(
  periods: T[],
  billingMode?: BillingMode | string | null
): T[] {
  if (billingMode !== "ON_COMPLETION" && !periods.some((p) => isCompletionPeriodLabel(p.label))) {
    return periods;
  }

  const completionLike = periods.filter(
    (p) =>
      (p.milestonePercent == null || !Number.isFinite(p.milestonePercent)) &&
      (billingMode === "ON_COMPLETION" || isCompletionPeriodLabel(p.label))
  );

  if (completionLike.length <= 1) return periods;

  const rank = (p: InvoicePeriodDisplayInput): number => {
    let score = 0;
    if (p.invoicePdfPath) score += 8;
    if (p.status === "PAID") score += 4;
    if (p.status === "AWAITING_PAYMENT" || p.status === "OVERDUE") score += 3;
    if (p.status === "PENDING_VERIFICATION") score += 3.5;
    if (p.status === "COMPILING") score += 2;
    if (isCompletionPeriodLabel(p.label) && /completion invoice/i.test(p.label ?? "")) {
      score += 1;
    }
    return score;
  };

  const best = completionLike.reduce((a, b) => (rank(b) > rank(a) ? b : a));
  const dropIds = new Set(
    completionLike
      .filter((p) => p !== best && p.id)
      .map((p) => p.id as string)
  );

  if (dropIds.size > 0) {
    return periods.filter((p) => !p.id || !dropIds.has(p.id));
  }

  // No stable ids — keep the best completion row only among completion-like.
  return periods.filter((p) => !completionLike.includes(p) || p === best);
}

