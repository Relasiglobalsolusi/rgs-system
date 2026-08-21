import type { Prisma } from "@prisma/client";

import {
  isProjectFullyPaid,
  OPEN_COLLECTION_STATUSES,
  TAX_INVOICE_ISSUED_STATUSES,
  UNPAID_INVOICE_STATUSES,
} from "@/lib/billing";
import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

export type ClientSoftDeleteBlocker = {
  code: "openProjects" | "unsettledBilling" | "pendingTaxInvoices";
  count: number;
};

/**
 * Soft-delete is allowed only when every linked project is settled and every
 * financial obligation is closed.
 *
 * "Completed / settled" matches Completed Projects / {@link isProjectFullyPaid}:
 * status COMPLETED, ≥1 PAID invoice, and no open collection statuses.
 *
 * CANCELLED projects are allowed only when they have no open billing periods.
 * Pending tax-invoice acknowledgment also blocks (including on PAID periods).
 */
export async function getClientSoftDeleteBlockers(
  clientId: string,
  db: Tx = prisma
): Promise<ClientSoftDeleteBlocker[]> {
  const projects = await db.project.findMany({
    where: { clientId },
    select: {
      id: true,
      name: true,
      status: true,
      subCategory: true,
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
      isProjectFullyPaid(project.invoicePeriods, project.subCategory);
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
    }

    pendingTaxInvoices += project.invoicePeriods.filter(
      (period) =>
        period.taxInvoiceRequired &&
        period.taxInvoiceDoneAt == null &&
        (TAX_INVOICE_ISSUED_STATUSES as readonly string[]).includes(period.status)
    ).length;
  }

  const blockers: ClientSoftDeleteBlocker[] = [];
  if (openProjects > 0) {
    blockers.push({ code: "openProjects", count: openProjects });
  }
  if (unsettledBilling > 0) {
    blockers.push({ code: "unsettledBilling", count: unsettledBilling });
  }
  if (pendingTaxInvoices > 0) {
    blockers.push({ code: "pendingTaxInvoices", count: pendingTaxInvoices });
  }
  return blockers;
}

export function formatClientSoftDeleteBlockers(
  blockers: ClientSoftDeleteBlocker[],
  locale: AppLocale = DEFAULT_LOCALE
): string[] {
  return blockers.map((blocker) =>
    translate(
      locale,
      `pages.clients.softDeleteBlockers.${blocker.code}`,
      { count: blocker.count }
    )
  );
}

export async function assertClientCanBeSoftDeleted(
  clientId: string,
  db: Tx = prisma,
  locale: AppLocale = DEFAULT_LOCALE
): Promise<void> {
  const blockers = await getClientSoftDeleteBlockers(clientId, db);
  if (blockers.length === 0) return;
  const messages = formatClientSoftDeleteBlockers(blockers, locale);
  throw new Error(
    translate(locale, "pages.clients.softDeleteBlocked", {
      blockers: messages.join("; "),
    })
  );
}
