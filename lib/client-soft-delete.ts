import type { Prisma } from "@prisma/client";

import {
  isProjectFullyPaid,
  OPEN_COLLECTION_STATUSES,
  TAX_INVOICE_ISSUED_STATUSES,
  UNPAID_INVOICE_STATUSES,
} from "@/lib/billing";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

/**
 * Soft-delete is allowed only when every linked project is settled and every
 * financial obligation is closed.
 *
 * "Completed / settled" matches Completed Projects / {@link isProjectFullyPaid}:
 * status COMPLETED, ≥1 PAID invoice, and no open collection statuses.
 *
 * CANCELLED projects are allowed only when they have no open billing periods.
 * Pending tax-invoice acknowledgment also blocks (including on PAID periods).
 *
 * Prior product note (transcript): soft-delete used to only hide from Billing;
 * this gate replaces that — soft-delete is blocked while work/finances remain open.
 */
export async function getClientSoftDeleteBlockers(
  clientId: string,
  db: Tx = prisma
): Promise<string[]> {
  const projects = await db.project.findMany({
    where: { clientId },
    select: {
      id: true,
      name: true,
      status: true,
      invoicePeriods: {
        select: {
          status: true,
          taxInvoiceRequired: true,
          taxInvoiceDoneAt: true,
        },
      },
    },
  });

  let openProjects = 0;
  let unsettledBilling = 0;
  let pendingTaxInvoices = 0;

  for (const project of projects) {
    const hasOpenCollection = project.invoicePeriods.some((period) =>
      (OPEN_COLLECTION_STATUSES as readonly string[]).includes(period.status)
    );
    const hasUnpaidIssued = project.invoicePeriods.some((period) =>
      (UNPAID_INVOICE_STATUSES as readonly string[]).includes(period.status)
    );
    const settledCompleted =
      project.status === "COMPLETED" &&
      isProjectFullyPaid(project.invoicePeriods);
    const cancelledClear =
      project.status === "CANCELLED" && !hasOpenCollection && !hasUnpaidIssued;

    if (!settledCompleted && !cancelledClear) {
      if (
        project.status === "PLANNED" ||
        project.status === "IN_PROGRESS" ||
        project.status === "ON_HOLD"
      ) {
        openProjects += 1;
      } else {
        // COMPLETED but not fully paid, or CANCELLED with open AR, etc.
        unsettledBilling += 1;
      }
    } else if (hasOpenCollection || hasUnpaidIssued) {
      unsettledBilling += 1;
    }

    pendingTaxInvoices += project.invoicePeriods.filter(
      (period) =>
        period.taxInvoiceRequired &&
        period.taxInvoiceDoneAt == null &&
        (TAX_INVOICE_ISSUED_STATUSES as readonly string[]).includes(period.status)
    ).length;
  }

  const blockers: string[] = [];
  if (openProjects > 0) {
    blockers.push(
      `${openProjects} open project${openProjects === 1 ? "" : "s"} (not Completed and settled)`
    );
  }
  if (unsettledBilling > 0) {
    blockers.push(
      `outstanding billing on ${unsettledBilling} project${unsettledBilling === 1 ? "" : "s"}`
    );
  }
  if (pendingTaxInvoices > 0) {
    blockers.push(
      `${pendingTaxInvoices} outstanding tax invoice${pendingTaxInvoices === 1 ? "" : "s"}`
    );
  }
  return blockers;
}

export async function assertClientCanBeSoftDeleted(
  clientId: string,
  db: Tx = prisma
): Promise<void> {
  const blockers = await getClientSoftDeleteBlockers(clientId, db);
  if (blockers.length === 0) return;
  throw new Error(
    `Cannot delete this client while work or finances are still open: ${blockers.join("; ")}.`
  );
}
