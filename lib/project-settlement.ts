import { OPEN_COLLECTION_STATUSES, isProjectFullyPaid } from "@/lib/billing";
import { toUtcDateOnly } from "@/lib/invoice-period";
import {
  isMilestoneSubCategory,
  maxMilestonePercent,
} from "@/lib/project-billing";
import { isExtendableContractSubCategory } from "@/lib/project-contract";

/** Job has ended — commercial terms, staff, equipment, and shifts are frozen. */
export function isClosedProject(
  status: string | null | undefined
): boolean {
  return status === "COMPLETED";
}

export const CLOSED_PROJECT_TERMS_LOCKED_MESSAGE =
  "This project is closed. Contract amount, bank account, and other terms cannot be changed.";

export const CLOSED_PROJECT_WORKFORCE_LOCKED_MESSAGE =
  "This project is closed. Assigned staff, equipment, and shifts cannot be changed.";

export function assertProjectTermsEditable(
  status: string | null | undefined
): void {
  if (isClosedProject(status)) {
    throw new Error(CLOSED_PROJECT_TERMS_LOCKED_MESSAGE);
  }
}

export function assertProjectWorkforceEditable(
  status: string | null | undefined
): void {
  if (isClosedProject(status)) {
    throw new Error(CLOSED_PROJECT_WORKFORCE_LOCKED_MESSAGE);
  }
}

export const ISSUED_OR_COLLECTED_STATUSES = [
  "AWAITING_PAYMENT",
  "OVERDUE",
  "PENDING_VERIFICATION",
  "PAID",
] as const;

export function issuedOrPaidPeriodMissingTax(period: {
  status: string;
  taxInvoiceDoneAt?: Date | string | null;
}): boolean {
  if (period.taxInvoiceDoneAt) return false;
  return (ISSUED_OR_COLLECTED_STATUSES as readonly string[]).includes(
    period.status
  );
}

export function allIssuedOrPaidPeriodsHaveTaxInvoice(
  periods: Array<{
    status: string;
    taxInvoiceDoneAt?: Date | string | null;
  }>
): boolean {
  return !periods.some(issuedOrPaidPeriodMissingTax);
}

export function shouldCompleteProjectAfterSettlement(opts: {
  billingMode: string;
  subCategory: string | null | undefined;
  projectStatus: string;
  endDate: Date | null | undefined;
  lastPaidPeriodEnd: Date;
  periods: Array<{
    status: string;
    taxInvoiceDoneAt?: Date | string | null;
    milestonePercent?: number | null;
  }>;
}): boolean {
  const hasOpenCollection = opts.periods.some((period) =>
    (OPEN_COLLECTION_STATUSES as readonly string[]).includes(period.status)
  );
  if (hasOpenCollection) return false;
  if (!isProjectFullyPaid(opts.periods, opts.subCategory)) return false;
  if (!allIssuedOrPaidPeriodsHaveTaxInvoice(opts.periods)) return false;

  const isGcFacade =
    opts.billingMode === "ON_COMPLETION" ||
    opts.billingMode === "MULTI_VISIT" ||
    isMilestoneSubCategory(opts.subCategory);

  if (opts.projectStatus === "COMPLETED") return true;

  if (opts.billingMode === "MULTI_VISIT") {
    return true;
  }

  if (isGcFacade) {
    const maxPaidOrIssued = maxMilestonePercent(
      opts.periods.map((period) => ({
        status: period.status,
        milestonePercent: period.milestonePercent ?? null,
      }))
    );
    return opts.billingMode === "ON_COMPLETION" || maxPaidOrIssued >= 100;
  }

  if (isExtendableContractSubCategory(opts.subCategory) && opts.endDate) {
    return (
      toUtcDateOnly(opts.lastPaidPeriodEnd).getTime() >=
      toUtcDateOnly(opts.endDate).getTime()
    );
  }

  return false;
}
