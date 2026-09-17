import type { BillingPeriodBasis } from "@prisma/client";

import { usesInvoicePeriods } from "@/lib/project-billing";
import {
  addUtcDays,
  firstMonthlyPeriodBounds,
  toUtcDateOnly,
} from "@/lib/invoice-period";

export type CatchUpPeriodDraft = {
  key: string;
  periodStart: string;
  periodEnd: string;
  label: string;
};

export type CatchUpCompleteKind = "period" | "job";

export type CatchUpCompleteTarget = {
  kind: CatchUpCompleteKind;
  /** 1-based index among historical periods, or 1 for a one-time job. */
  ordinal: number;
  periodStart: string;
  periodEnd: string;
  label: string;
  /** After this save the project should leave In Progress. */
  closesProject: boolean;
};

export type ExistingCatchUpPeriod = {
  periodStart: Date | string;
  periodEnd: Date | string;
  isCatchUp?: boolean | null;
  invoicePdfPath?: string | null;
};

function toDateInput(date: Date): string {
  return toUtcDateOnly(date).toISOString().slice(0, 10);
}

export function catchUpPeriodKey(
  start: Date | string,
  end: Date | string
): string {
  return `${toDateInput(toUtcDateOnly(new Date(start)))}_${toDateInput(
    toUtcDateOnly(new Date(end))
  )}`;
}

export function usesMonthlyCatchUpPeriods(
  subCategory: string | null | undefined,
  billingMode: string | null | undefined
): boolean {
  return usesInvoicePeriods(subCategory) && billingMode === "MONTHLY";
}

export function listMonthlyCatchUpPeriods(opts: {
  startDate: Date;
  endDate: Date;
  basis: BillingPeriodBasis | null | undefined;
  fromDay?: number | null;
  toDay?: number | null;
}): CatchUpPeriodDraft[] {
  const start = toUtcDateOnly(opts.startDate);
  const end = toUtcDateOnly(opts.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end.getTime() < start.getTime()) return [];

  const first = firstMonthlyPeriodBounds(opts.basis, start, {
    fromDay: opts.fromDay,
    toDay: opts.toDay,
  });
  const rows: CatchUpPeriodDraft[] = [
    {
      key: `${toDateInput(first.periodStart)}_${toDateInput(first.periodEnd)}`,
      periodStart: toDateInput(first.periodStart),
      periodEnd: toDateInput(first.periodEnd),
      label: first.label,
    },
  ];

  let current = first;
  for (let i = 0; i < 120; i += 1) {
    const nextStart = addUtcDays(current.periodEnd, 1);
    if (nextStart.getTime() > end.getTime()) break;
    const next = firstMonthlyPeriodBounds(opts.basis, nextStart, {
      fromDay: opts.fromDay,
      toDay: opts.toDay,
    });
    if (next.periodStart.getTime() === current.periodStart.getTime()) break;
    rows.push({
      key: `${toDateInput(next.periodStart)}_${toDateInput(next.periodEnd)}`,
      periodStart: toDateInput(next.periodStart),
      periodEnd: toDateInput(next.periodEnd),
      label: next.label,
    });
    current = next;
  }
  return rows;
}

export function currentMonthlyCatchUpPeriod(opts: {
  asOf: Date;
  basis: BillingPeriodBasis | null | undefined;
  fromDay?: number | null;
  toDay?: number | null;
}): CatchUpPeriodDraft {
  const bounds = firstMonthlyPeriodBounds(opts.basis, toUtcDateOnly(opts.asOf), {
    fromDay: opts.fromDay,
    toDay: opts.toDay,
  });
  return {
    key: `${toDateInput(bounds.periodStart)}_${toDateInput(bounds.periodEnd)}`,
    periodStart: toDateInput(bounds.periodStart),
    periodEnd: toDateInput(bounds.periodEnd),
    label: bounds.label,
  };
}

/**
 * First live billing cycle: period start on or after `asOf` (books-open).
 * The cycle that only contains `asOf` (starts before it) is still catch-up.
 */
export function firstLiveMonthlyPeriod(opts: {
  asOf: Date;
  basis: BillingPeriodBasis | null | undefined;
  fromDay?: number | null;
  toDay?: number | null;
}): CatchUpPeriodDraft {
  const containing = currentMonthlyCatchUpPeriod(opts);
  const asOfKey = toDateInput(toUtcDateOnly(opts.asOf));
  if (containing.periodStart >= asOfKey) return containing;
  const nextStart = addUtcDays(parseDraftDate(containing.periodEnd), 1);
  return currentMonthlyCatchUpPeriod({
    asOf: nextStart,
    basis: opts.basis,
    fromDay: opts.fromDay,
    toDay: opts.toDay,
  });
}

/**
 * First monthly cycle to open as live billing: the contract's first period
 * when it starts on/after books-open, otherwise the first cycle that does.
 */
export function liveMonthlyPeriodBounds(opts: {
  contractStart: Date;
  asOf: Date;
  basis: BillingPeriodBasis | null | undefined;
  fromDay?: number | null;
  toDay?: number | null;
}): { periodStart: Date; periodEnd: Date; label: string } {
  const first = firstMonthlyPeriodBounds(opts.basis, opts.contractStart, {
    fromDay: opts.fromDay,
    toDay: opts.toDay,
  });
  if (first.periodStart.getTime() >= toUtcDateOnly(opts.asOf).getTime()) {
    return first;
  }
  const live = firstLiveMonthlyPeriod({
    asOf: opts.asOf,
    basis: opts.basis,
    fromDay: opts.fromDay,
    toDay: opts.toDay,
  });
  return {
    periodStart: parseDraftDate(live.periodStart),
    periodEnd: parseDraftDate(live.periodEnd),
    label: live.label,
  };
}

/** Billing cycles whose period end is before `asOf` (fully finished). */
export function listHistoricalCatchUpPeriods(opts: {
  startDate: Date;
  endDate?: Date | null;
  asOf: Date;
  basis: BillingPeriodBasis | null | undefined;
  fromDay?: number | null;
  toDay?: number | null;
}): CatchUpPeriodDraft[] {
  const start = toUtcDateOnly(opts.startDate);
  const asOf = toUtcDateOnly(opts.asOf);
  if (asOf.getTime() <= start.getTime()) return [];

  const contractEnd = opts.endDate ? toUtcDateOnly(opts.endDate) : null;
  const generateUntil =
    contractEnd && contractEnd.getTime() < asOf.getTime() ? contractEnd : asOf;
  if (generateUntil.getTime() < start.getTime()) return [];

  const asOfKey = toDateInput(asOf);
  return listMonthlyCatchUpPeriods({
    startDate: start,
    endDate: generateUntil,
    basis: opts.basis,
    fromDay: opts.fromDay,
    toDay: opts.toDay,
  }).filter((period) => period.periodEnd < asOfKey);
}

function parseDraftDate(value: string): Date {
  return toUtcDateOnly(new Date(`${value}T00:00:00.000Z`));
}

export function isRecordedCatchUpPeriod(
  period: ExistingCatchUpPeriod
): boolean {
  return Boolean(period.isCatchUp && period.invoicePdfPath);
}

export function isUnrecordedCatchUpPeriod(
  period: ExistingCatchUpPeriod
): boolean {
  return Boolean(period.isCatchUp && !period.invoicePdfPath);
}

export type CatchUpIntakePage = CatchUpCompleteTarget & {
  recorded: boolean;
};

export type CatchUpTargetOpts = {
  catchUpKind: string | null | undefined;
  status: string | null | undefined;
  isComplimentary?: boolean | null;
  isDemo?: boolean | null;
  subCategory: string | null | undefined;
  billingMode: string | null | undefined;
  startDate: Date | null | undefined;
  endDate: Date | null | undefined;
  basis: BillingPeriodBasis | null | undefined;
  fromDay?: number | null;
  toDay?: number | null;
  asOf: Date;
  existingPeriods: ExistingCatchUpPeriod[];
};

function catchUpIntakeEligible(opts: CatchUpTargetOpts): boolean {
  if (opts.catchUpKind !== "ONGOING" && opts.catchUpKind !== "COMPLETED") {
    return false;
  }
  if (opts.status !== "IN_PROGRESS") return false;
  if (opts.isComplimentary || opts.isDemo) return false;
  if (!usesInvoicePeriods(opts.subCategory)) return false;
  if (!opts.startDate) return false;
  if (
    opts.catchUpKind === "COMPLETED" &&
    usesMonthlyCatchUpPeriods(opts.subCategory, opts.billingMode)
  ) {
    return false;
  }
  return true;
}

/** Every historical period that needs a catch-up page (recorded or still open). */
export function listCatchUpIntakePages(
  opts: CatchUpTargetOpts
): CatchUpIntakePage[] {
  if (!catchUpIntakeEligible(opts) || !opts.startDate) return [];

  if (
    opts.catchUpKind === "ONGOING" &&
    usesMonthlyCatchUpPeriods(opts.subCategory, opts.billingMode)
  ) {
    const historical = listHistoricalCatchUpPeriods({
      startDate: opts.startDate,
      endDate: opts.endDate,
      asOf: opts.asOf,
      basis: opts.basis,
      fromDay: opts.fromDay,
      toDay: opts.toDay,
    });
    const recorded = new Set(
      opts.existingPeriods
        .filter(isRecordedCatchUpPeriod)
        .map((period) =>
          catchUpPeriodKey(period.periodStart, period.periodEnd)
        )
    );
    const firstLive = firstLiveMonthlyPeriod({
      asOf: opts.asOf,
      basis: opts.basis,
      fromDay: opts.fromDay,
      toDay: opts.toDay,
    });
    const contractEndedBeforeCurrent =
      Boolean(opts.endDate) &&
      toUtcDateOnly(opts.endDate as Date).getTime() <
        parseDraftDate(firstLive.periodStart).getTime();

    return historical.map((draft, index) => {
      const ordinal = index + 1;
      const isLast = ordinal === historical.length;
      return {
        kind: "period" as const,
        ordinal,
        periodStart: draft.periodStart,
        periodEnd: draft.periodEnd,
        label: draft.label,
        closesProject: contractEndedBeforeCurrent && isLast,
        recorded: recorded.has(draft.key),
      };
    });
  }

  const start = toUtcDateOnly(opts.startDate);
  const end = opts.endDate ? toUtcDateOnly(opts.endDate) : start;
  const recorded = opts.existingPeriods.some(isRecordedCatchUpPeriod);
  return [
    {
      kind: "job",
      ordinal: 1,
      periodStart: toDateInput(start),
      periodEnd: toDateInput(end.getTime() < start.getTime() ? start : end),
      label: "Completion Invoice",
      closesProject: true,
      recorded,
    },
  ];
}

export function catchUpPageByOrdinal(
  pages: CatchUpIntakePage[],
  ordinal: number
): CatchUpIntakePage | null {
  return pages.find((page) => page.ordinal === ordinal) ?? null;
}

export function resolveCatchUpCompleteTarget(
  opts: CatchUpTargetOpts
): CatchUpCompleteTarget | null {
  const next = listCatchUpIntakePages(opts).find((page) => !page.recorded);
  if (!next) return null;
  return {
    kind: next.kind,
    ordinal: next.ordinal,
    periodStart: next.periodStart,
    periodEnd: next.periodEnd,
    label: next.label,
    closesProject: next.closesProject,
  };
}
