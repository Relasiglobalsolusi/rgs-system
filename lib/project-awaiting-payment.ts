import { isMilestoneSubCategory } from "@/lib/project-billing";

const UNPAID_ISSUED = [
  "AWAITING_PAYMENT",
  "OVERDUE",
  "PENDING_VERIFICATION",
] as const;

const ISSUED_OR_COLLECTING = [
  ...UNPAID_ISSUED,
  "PAID",
  "COMPILING",
] as const;

/**
 * True when the last General Cleaning / Facade part is invoiced and still
 * unpaid. Visible status is Awaiting payment until the last invoice is paid.
 * Intermediate milestones stay In Progress (crew still on site).
 */
export function isGcFacadeAwaitingPayment(project: {
  subCategory?: string | null;
  status?: string | null;
  billingMode?: string | null;
  invoicePeriods: Array<{
    status: string;
    milestonePercent?: number | null;
  }>;
}): boolean {
  if (!isMilestoneSubCategory(project.subCategory)) return false;
  if (
    project.status === "COMPLETED" ||
    project.status === "CANCELLED" ||
    project.status === "PLANNED"
  ) {
    return false;
  }

  const unpaidIssued = project.invoicePeriods.filter((period) =>
    (UNPAID_ISSUED as readonly string[]).includes(period.status)
  );
  if (unpaidIssued.length === 0) return false;

  if (project.billingMode === "ON_COMPLETION") return true;

  const scheduled = project.invoicePeriods
    .map((period) => period.milestonePercent)
    .filter((p): p is number => p != null && Number.isFinite(p));
  const maxScheduled = scheduled.length > 0 ? Math.max(...scheduled) : 100;
  const issuedPercents = project.invoicePeriods
    .filter((period) =>
      (ISSUED_OR_COLLECTING as readonly string[]).includes(period.status)
    )
    .map((period) => period.milestonePercent)
    .filter((p): p is number => p != null && Number.isFinite(p));
  const maxIssued = issuedPercents.length > 0 ? Math.max(...issuedPercents) : 0;
  return maxIssued >= 100 || maxIssued >= maxScheduled;
}
