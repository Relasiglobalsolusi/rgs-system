import { toUtcDateOnly } from "@/lib/invoice-period";

function parseVisitDate(raw: string, label: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}.`);
  }
  return date;
}

export type PlannedProjectVisit = {
  visitIndex: number;
  startDate: Date;
  endDate: Date;
  amount: number | null;
};

function evenSplitAmounts(
  total: number | null,
  count: number
): Array<number | null> {
  if (total == null || !Number.isFinite(total) || total <= 0) {
    return Array.from({ length: count }, () => null);
  }
  const base = Math.floor(total / count);
  const remainder = Math.round(total - base * count);
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? base + remainder : base
  );
}

export function parseProjectVisitsFromForm(
  formData: FormData,
  contractPrice: number | null
): PlannedProjectVisit[] {
  const starts = formData
    .getAll("visitStart")
    .map((value) => String(value ?? "").trim());
  const ends = formData
    .getAll("visitEnd")
    .map((value) => String(value ?? "").trim());
  const pairs = starts
    .map((start, index) => ({ start, end: ends[index] ?? "" }))
    .filter((row) => row.start || row.end);

  if (pairs.length < 2) {
    throw new Error(
      "Multiple visits need at least two visit windows with start and end dates."
    );
  }

  const visits = pairs.map((row, index) => {
    const startDate = parseVisitDate(row.start, `visit ${index + 1} start`);
    const endDate = parseVisitDate(row.end, `visit ${index + 1} end`);
    if (!startDate || !endDate) {
      throw new Error(`Enter start and end dates for visit ${index + 1}.`);
    }
    const start = toUtcDateOnly(startDate);
    const end = toUtcDateOnly(endDate);
    if (end.getTime() < start.getTime()) {
      throw new Error(`Visit ${index + 1} end date must be on or after its start.`);
    }
    return { start, end };
  });

  for (let i = 1; i < visits.length; i += 1) {
    if (visits[i].start.getTime() <= visits[i - 1].end.getTime()) {
      throw new Error(
        `Visit ${i + 1} must start after visit ${i} ends. Multiple visits are separate trips, not overlapping progress.`
      );
    }
  }

  const amounts = evenSplitAmounts(contractPrice, visits.length);
  return visits.map((visit, index) => ({
    visitIndex: index + 1,
    startDate: visit.start,
    endDate: visit.end,
    amount: amounts[index],
  }));
}
