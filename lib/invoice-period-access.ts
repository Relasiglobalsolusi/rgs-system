import { catchUpAsOfDate, loadBooksOpenDate } from "@/lib/books-open";
import { toUtcDateOnly } from "@/lib/invoice-period";

export function invoicePeriodCompanyWhere(session: {
  user: { companyId?: string | null; clientId?: string | null };
}) {
  if (session.user.clientId) {
    return { clientId: session.user.clientId };
  }
  return { companyId: session.user.companyId ?? "__none__" };
}

export async function assertLiveBillingAllowed(period: {
  isCatchUp?: boolean | null;
  periodStart: Date;
  project: { companyId: string };
}) {
  if (period.isCatchUp) return;
  const asOf = catchUpAsOfDate(
    await loadBooksOpenDate(period.project.companyId)
  );
  if (toUtcDateOnly(period.periodStart).getTime() < asOf.getTime()) {
    throw new Error(
      "This cycle starts before books-open. Record it as catch-up, not live billing."
    );
  }
}
