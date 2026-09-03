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

/** Billing cycles from contract start up to, but not including, the cycle that contains `asOf`. */
export function listHistoricalCatchUpPeriods(opts: {
  startDate: Date;
  endDate?: Date | null;
  asOf: Date;
  basis: BillingPeriodBasis | null | undefined;
  fromDay?: number | null;
  toDay?: number | null;
}): CatchUpPeriodDraft[] {
  const start = toUtcDateOnly(opts.startDate);
  const current = currentMonthlyCatchUpPeriod({
    asOf: opts.asOf,
    basis: opts.basis,
    fromDay: opts.fromDay,
    toDay: opts.toDay,
  });
  const lastHistoricalEnd = addUtcDays(parseDraftDate(current.periodStart), -1);
  if (lastHistoricalEnd.getTime() < start.getTime()) return [];

  const contractEnd = opts.endDate ? toUtcDateOnly(opts.endDate) : null;
  const rangeEnd =
    contractEnd && contractEnd.getTime() < lastHistoricalEnd.getTime()
      ? contractEnd
      : lastHistoricalEnd;
  if (rangeEnd.getTime() < start.getTime()) return [];

  return listMonthlyCatchUpPeriods({
    startDate: start,
    endDate: rangeEnd,
    basis: opts.basis,
    fromDay: opts.fromDay,
    toDay: opts.toDay,
  }).filter((period) => period.periodStart < current.periodStart);
}

function parseDraftDate(value: string): Date {
  return toUtcDateOnly(new Date(`${value}T00:00:00.000Z`));
}

export function isRecordedCatchUpPeriod(
  period: ExistingCatchUpPeriod
): boolean {
  return Boolean(period.isCatchUp && period.invoicePdfPath);
}

export function nextHistoricalCatchUpPeriod(
  historical: CatchUpPeriodDraft[],
  existing: ExistingCatchUpPeriod[]
): { draft: CatchUpPeriodDraft; ordinal: number } | null {
  const recorded = new Set(
    existing
      .filter(isRecordedCatchUpPeriod)
      .map((period) => catchUpPeriodKey(period.periodStart, period.periodEnd))
  );
  for (const [index, draft] of historical.entries()) {
    if (!recorded.has(draft.key)) {
      return { draft, ordinal: index + 1 };
    }
  }
  return null;
}

export function resolveCatchUpCompleteTarget(opts: {
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
}): CatchUpCompleteTarget | null {
  if (opts.catchUpKind !== "ONGOING") return null;
  if (opts.status !== "IN_PROGRESS") return null;
  if (opts.isComplimentary || opts.isDemo) return null;
  if (!usesInvoicePeriods(opts.subCategory)) return null;
  if (!opts.startDate) return null;

  if (usesMonthlyCatchUpPeriods(opts.subCategory, opts.billingMode)) {
    const historical = listHistoricalCatchUpPeriods({
      startDate: opts.startDate,
      endDate: opts.endDate,
      asOf: opts.asOf,
      basis: opts.basis,
      fromDay: opts.fromDay,
      toDay: opts.toDay,
    });
    const next = nextHistoricalCatchUpPeriod(historical, opts.existingPeriods);
    if (!next) return null;

    const current = currentMonthlyCatchUpPeriod({
      asOf: opts.asOf,
      basis: opts.basis,
      fromDay: opts.fromDay,
      toDay: opts.toDay,
    });
    const contractEndedBeforeCurrent =
      Boolean(opts.endDate) &&
      toUtcDateOnly(opts.endDate as Date).getTime() <
        parseDraftDate(current.periodStart).getTime();
    const isLastHistorical = next.ordinal === historical.length;

    return {
      kind: "period",
      ordinal: next.ordinal,
      periodStart: next.draft.periodStart,
      periodEnd: next.draft.periodEnd,
      label: next.draft.label,
      closesProject: contractEndedBeforeCurrent && isLastHistorical,
    };
  }

  const alreadyClosed = opts.existingPeriods.some(isRecordedCatchUpPeriod);
  if (alreadyClosed) return null;

  const start = toUtcDateOnly(opts.startDate);
  const end = opts.endDate ? toUtcDateOnly(opts.endDate) : start;
  return {
    kind: "job",
    ordinal: 1,
    periodStart: toDateInput(start),
    periodEnd: toDateInput(end.getTime() < start.getTime() ? start : end),
    label: "Completion Invoice",
    closesProject: true,
  };
}
