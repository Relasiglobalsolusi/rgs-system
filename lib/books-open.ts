import { addUtcDays, toUtcDateOnly } from "@/lib/invoice-period";
import { jakartaTodayAsUtcDateOnly } from "@/lib/leave-employment-status";
import { prisma } from "@/lib/prisma";

/** Show the Add Project ongoing/completed pills until this many days after go-live. */
export const CATCH_UP_INTAKE_DAYS = 31;

export const LIVE_PROJECT_EXPENSE_WHERE = { isCatchUp: false } as const;

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

/** Add Project pills only. Closing this does not delete typed-in projects. */
export function isCatchUpIntakeOpen(
  booksOpenDate: Date | null | undefined,
  today: Date = jakartaTodayAsUtcDateOnly()
): boolean {
  if (!booksOpenDate) return true;
  const lastDay = addUtcDays(
    toUtcDateOnly(booksOpenDate),
    CATCH_UP_INTAKE_DAYS
  );
  return toUtcDateOnly(today).getTime() <= lastDay.getTime();
}

/** Boundary for historical vs current billing cycles. */
export function catchUpAsOfDate(
  booksOpenDate: Date | null | undefined,
  today: Date = jakartaTodayAsUtcDateOnly()
): Date {
  if (!booksOpenDate) return toUtcDateOnly(today);
  return toUtcDateOnly(booksOpenDate);
}

/** Catch-up paid before books open stays off live P&L. Unpaid catch-up is AR. */
export function isLiveInvoiceIncome(opts: {
  isCatchUp?: boolean | null;
  paidAt?: Date | null;
  booksOpenDate?: Date | null;
}): boolean {
  if (!opts.paidAt) return false;
  if (!opts.isCatchUp) return true;
  if (!opts.booksOpenDate) return false;
  return (
    opts.paidAt.getTime() >= toUtcDateOnly(opts.booksOpenDate).getTime()
  );
}

export function liveInvoiceIncomeWhere(booksOpenDate?: Date | null) {
  if (!booksOpenDate) {
    return { isCatchUp: false };
  }
  return {
    OR: [
      { isCatchUp: false },
      { isCatchUp: true, paidAt: { gte: toUtcDateOnly(booksOpenDate) } },
    ],
  };
}

export async function liveInvoiceIncomeWhereFor(companyId: string) {
  return liveInvoiceIncomeWhere(await loadBooksOpenDate(companyId));
}
