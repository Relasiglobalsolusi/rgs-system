import type {
  Prisma,
  ProjectStatus,
  ProjectSubCategory,
} from "@prisma/client";
import { PROJECT_SUB_CATEGORIES } from "@/lib/project-subcategory";
import {
  getInvoicePaymentDisplay,
  resolveInvoiceDueAt,
} from "@/lib/invoice-period";

export const UNPAID_INVOICE_STATUSES = [
  "AWAITING_PAYMENT",
  "OVERDUE",
  "PENDING_VERIFICATION",
] as const;

/** Issued / in-flight invoices that still block Completed Projects. */
export const OPEN_COLLECTION_STATUSES = [
  "AWAITING_PAYMENT",
  "OVERDUE",
  "PENDING_VERIFICATION",
  "COMPILING",
  "AWAITING_CLIENT_REVIEW",
] as const;
const UNPAID_STATUSES = UNPAID_INVOICE_STATUSES;

/**
 * Fully paid for Completed Projects / billing exit = at least one PAID invoice
 * and no open collection (awaiting / overdue / verifying / compiling).
 *
 * Unissued ONGOING schedule or anniversary-cycle rows do not block Completed
 * Projects once the contract is COMPLETED and every issued invoice is paid —
 * otherwise leftover schedule rows (or periods re-created on ended contracts)
 * make paid projects vanish from Payment Due without appearing in Completed
 * Projects.
 */
export function isProjectFullyPaid(
  periods: { status: string }[]
): boolean {
  if (periods.length === 0) return false;
  const hasPaid = periods.some((p) => p.status === "PAID");
  if (!hasPaid) return false;
  return !periods.some((p) =>
    (OPEN_COLLECTION_STATUSES as readonly string[]).includes(p.status)
  );
}

/** Prisma: COMPLETED contract with all issued invoices collected. */
function projectFullyPaidInvoiceWhere(): Prisma.ProjectWhereInput {
  return {
    AND: [
      { invoicePeriods: { some: { status: "PAID" } } },
      {
        invoicePeriods: {
          none: { status: { in: [...OPEN_COLLECTION_STATUSES] } },
        },
      },
    ],
  };
}

/**
 * Prisma filter: invoices awaiting payment, or finished work still needing
 * an invoice issued.
 *
 * Does NOT require project COMPLETED — ongoing Regular Cleaning contracts can
 * have a month in Payment Due while the project stays active.
 *
 * Planning (PLANNED) projects are not invoiced; they only appear here if an
 * unpaid issued invoice already exists (legacy / edge cases).
 */
export function paymentDueWhere(): Prisma.ProjectWhereInput {
  return {
    status: { not: "CANCELLED" },
    OR: [
      {
        invoicePeriods: {
          some: { status: { in: [...UNPAID_INVOICE_STATUSES] } },
        },
      },
      {
        status: "COMPLETED",
        NOT: projectFullyPaidInvoiceWhere(),
      },
    ],
  };
}

/**
 * In-memory mirror of {@link paymentDueWhere} for a loaded project row.
 * True when there is an unpaid issued invoice, or finished work still needs
 * collection / issuing.
 */
export function isProjectInPaymentDue(input: {
  status: ProjectStatus | string;
  invoicePeriods: { status: string }[];
}): boolean {
  if (input.status === "CANCELLED") return false;
  if (
    input.invoicePeriods.some((p) =>
      (UNPAID_INVOICE_STATUSES as readonly string[]).includes(p.status)
    )
  ) {
    return true;
  }
  if (input.status === "COMPLETED") {
    return !isProjectFullyPaid(input.invoicePeriods);
  }
  return false;
}

/**
 * Prisma filter: contract truly ended (COMPLETED) and every issued invoice paid.
 * Ongoing regular contracts never land here until explicitly ended.
 * Leftover ONGOING rows do not exclude a project from Completed Projects.
 */
export function projectHistoryWhere(): Prisma.ProjectWhereInput {
  return {
    status: "COMPLETED",
    ...projectFullyPaidInvoiceWhere(),
  };
}

/**
 * Prisma filter: projects that belong in Invoice and Billing directories.
 * In Progress (and On Hold) always; COMPLETED only while collection / issuing
 * remains. Planning is excluded — invoicing starts after Move to In Progress.
 */
export function billingActiveProjectWhere(): Prisma.ProjectWhereInput {
  return {
    OR: [
      { status: { in: ["IN_PROGRESS", "ON_HOLD"] } },
      {
        status: "COMPLETED",
        NOT: projectFullyPaidInvoiceWhere(),
      },
    ],
  };
}

/** Issued invoice statuses that can appear in the Tax Invoice queue. */
export const TAX_INVOICE_ISSUED_STATUSES = [
  "AWAITING_PAYMENT",
  "OVERDUE",
  "PENDING_VERIFICATION",
  "PAID",
] as const;

/**
 * True when a newer billing period exists while an earlier period is still
 * unsettled (not PAID). Used to warn HO to remind the client.
 */
export function findPriorOpenPeriodWarning(
  periods: {
    id: string;
    label: string | null;
    periodStart: string | Date;
    status: string;
  }[]
): { openLabel: string; nextLabel: string } | null {
  const sorted = [...periods].sort((a, b) => {
    const aTime = new Date(a.periodStart).getTime();
    const bTime = new Date(b.periodStart).getTime();
    return aTime - bTime;
  });

  for (let i = 1; i < sorted.length; i += 1) {
    const prior = sorted[i - 1];
    const next = sorted[i];
    if (prior.status === "PAID") continue;
    // Only warn when a later period has already been opened.
    if (
      next.status === "ONGOING" ||
      next.status === "COMPILING" ||
      next.status === "AWAITING_CLIENT_REVIEW" ||
      (OPEN_COLLECTION_STATUSES as readonly string[]).includes(next.status)
    ) {
      return {
        openLabel: prior.label?.trim() || "Earlier Period",
        nextLabel: next.label?.trim() || "Next Period",
      };
    }
  }
  return null;
}

/** Prisma filter: issued invoices still awaiting tax-invoice acknowledgment. */
export function taxInvoicePendingWhere(): Prisma.ProjectInvoicePeriodWhereInput {
  return {
    taxInvoiceRequired: true,
    taxInvoiceDoneAt: null,
    status: { in: [...TAX_INVOICE_ISSUED_STATUSES] },
  };
}

/** Prisma filter: tax invoices already marked done. */
export function taxInvoiceCompletedWhere(): Prisma.ProjectInvoicePeriodWhereInput {
  return {
    taxInvoiceRequired: true,
    taxInvoiceDoneAt: { not: null },
  };
}

/** Projects that should appear in Invoice and Billing. */
export function isBillingActiveProject(input: {
  status: ProjectStatus | string;
  invoicePeriods: { status: string }[];
}): boolean {
  if (input.status === "IN_PROGRESS" || input.status === "ON_HOLD") {
    return true;
  }
  if (input.status === "COMPLETED") {
    // Finished work still needs invoicing or collection.
    return !isProjectFullyPaid(input.invoicePeriods);
  }
  return false;
}

export function subcategorySortIndex(
  subCategory: ProjectSubCategory | string
): number {
  const idx = (PROJECT_SUB_CATEGORIES as readonly string[]).indexOf(
    subCategory
  );
  return idx === -1 ? 99 : idx;
}

export function countOpenInvoices(
  periods: {
    status: string;
    dueAt?: Date | null;
    submittedAt?: Date | null;
    paymentTermsDays?: number | null;
  }[],
  now: Date = new Date()
): { open: number; late: number; paid: number; verifying: number } {
  let open = 0;
  let late = 0;
  let paid = 0;
  let verifying = 0;

  for (const period of periods) {
    const display = getInvoicePaymentDisplay(period, now);
    if (display.key === "PAID") {
      paid += 1;
    } else if (display.key === "PENDING_VERIFICATION") {
      verifying += 1;
      open += 1;
    } else if (display.key === "LATE") {
      late += 1;
      open += 1;
    } else if (display.key === "AWAITING_PAYMENT") {
      open += 1;
    }
  }

  return { open, late, paid, verifying };
}

export function periodHasDueDate(period: {
  dueAt?: Date | null;
  submittedAt?: Date | null;
  paymentTermsDays?: number | null;
}): boolean {
  return resolveInvoiceDueAt(period) != null;
}

export function isUnpaidInvoiceStatus(status: string): boolean {
  return (UNPAID_STATUSES as readonly string[]).includes(status);
}

/** Earliest-due unpaid invoice (late first when due dates tie). */
export function getMostUrgentUnpaidPeriod<
  T extends {
    status: string;
    dueAt?: Date | null;
    submittedAt?: Date | null;
    paymentTermsDays?: number | null;
  },
>(periods: T[], now: Date = new Date()): T | null {
  const unpaid = periods.filter((p) => isUnpaidInvoiceStatus(p.status));
  if (unpaid.length === 0) return null;

  return unpaid.reduce((best, period) => {
    const bestDue = resolveInvoiceDueAt(best);
    const periodDue = resolveInvoiceDueAt(period);
    if (!bestDue) return period;
    if (!periodDue) return best;
    const bestTime = bestDue.getTime();
    const periodTime = periodDue.getTime();
    if (periodTime < bestTime) return period;
    if (periodTime > bestTime) return best;
    const bestLate = getInvoicePaymentDisplay(best, now).isLate;
    const periodLate = getInvoicePaymentDisplay(period, now).isLate;
    if (periodLate && !bestLate) return period;
    return best;
  });
}

export type PaymentDueStage = {
  /** No issued unpaid invoice yet (zero invoices, or only ongoing/compiling). */
  kind: "awaiting_invoice" | "awaiting_payment" | "verifying";
  label: string;
  dueAt: Date | null;
  isLate: boolean;
  daysOverdue: number | null;
  /** Unpaid / verifying period to act on, when present. */
  unpaidPeriodId?: string;
};

/** Stage shown on Payment Due cards. */
export function getPaymentDueStage<
  T extends {
    id?: string;
    status: string;
    dueAt?: Date | null;
    submittedAt?: Date | null;
    paymentTermsDays?: number | null;
  },
>(periods: T[], now: Date = new Date()): PaymentDueStage {
  const unpaid = getMostUrgentUnpaidPeriod(periods, now);
  if (!unpaid) {
    return {
      kind: "awaiting_invoice",
      label: "Awaiting Invoice",
      dueAt: null,
      isLate: false,
      daysOverdue: null,
    };
  }

  if (unpaid.status === "PENDING_VERIFICATION") {
    const display = getInvoicePaymentDisplay(unpaid, now);
    return {
      kind: "verifying",
      label: "Verifying Payment",
      dueAt: display.dueAt,
      isLate: false,
      daysOverdue: null,
      unpaidPeriodId: unpaid.id,
    };
  }

  const display = getInvoicePaymentDisplay(unpaid, now);
  return {
    kind: "awaiting_payment",
    label: display.isLate ? "Late" : "Awaiting Payment",
    dueAt: display.dueAt,
    isLate: display.isLate,
    daysOverdue: display.daysOverdue,
    unpaidPeriodId: unpaid.id,
  };
}
