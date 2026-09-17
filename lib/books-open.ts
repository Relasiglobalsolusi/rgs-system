import { toUtcDateOnly } from "@/lib/invoice-period";
import { jakartaTodayAsUtcDateOnly } from "@/lib/leave-employment-status";
import { prisma } from "@/lib/prisma";

/** Kept for a possible future go-live window. Add Project pills stay available. */
export const CATCH_UP_INTAKE_DAYS = 31;

/** Catch-up staff and material totals count on company P&L. */
export const LIVE_PROJECT_EXPENSE_WHERE = {} as const;

export async function loadBooksOpenDate(
  companyId?: string | null
): Promise<Date | null> {
  const company = await prisma.company.findFirst({
    where: companyId ? { id: companyId } : undefined,
    select: { booksOpenDate: true },
    orderBy: { createdAt: "asc" },
  });
  return company?.booksOpenDate ?? null;
}

/** Add Project pills stay available. `booksOpenDate` is unused until a future go-live cut. */
export function isCatchUpIntakeOpen(
  _booksOpenDate?: Date | null,
  _today?: Date
): boolean {
  return true;
}

/** Live-writer boundary if `booksOpenDate` is set later. Intake does not use this. */
export function catchUpAsOfDate(
  booksOpenDate: Date | null | undefined,
  today: Date = jakartaTodayAsUtcDateOnly()
): Date {
  if (!booksOpenDate) return toUtcDateOnly(today);
  return toUtcDateOnly(booksOpenDate);
}

/** Live writers must not open a cycle whose start is before books-open (or today if unset). */
export function periodStartsBeforeBooksOpen(
  periodStart: Date,
  booksOpenDate: Date | null | undefined
): boolean {
  return (
    toUtcDateOnly(periodStart).getTime() <
    catchUpAsOfDate(booksOpenDate).getTime()
  );
}

/** Paid invoices count on P&L by paid date, including recorded historical cycles. */
export function isLiveInvoiceIncome(opts: {
  isCatchUp?: boolean | null;
  paidAt?: Date | null;
  booksOpenDate?: Date | null;
}): boolean {
  return Boolean(opts.paidAt);
}

export function liveInvoiceIncomeWhere(_booksOpenDate?: Date | null) {
  return {};
}

export async function liveInvoiceIncomeWhereFor(companyId: string) {
  return liveInvoiceIncomeWhere(await loadBooksOpenDate(companyId));
}
