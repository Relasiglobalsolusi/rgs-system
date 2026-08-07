import type { Prisma } from "@prisma/client";

import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

export type VendorSoftDeleteBlocker = {
  code: "outstandingPayables" | "pendingTaxInvoices";
  count: number;
};

/**
 * Block vendor soft-delete while money is still owed or tax documents are open.
 *
 * Outstanding payables: unpaid PurchaseInvoice rows (paidAt is null).
 * Pending tax invoices: PPN enabled but Faktur Pajak (taxInvoiceFilePath) missing.
 */
export async function getVendorSoftDeleteBlockers(
  vendorId: string,
  db: Tx = prisma
): Promise<VendorSoftDeleteBlocker[]> {
  const blockers: VendorSoftDeleteBlocker[] = [];

  const p = db as typeof prisma;

  const [payablesAgg, pendingTaxCount] = await Promise.all([
    p.purchaseInvoice.aggregate({
      where: { vendorId, paidAt: null },
      _count: { id: true },
      _sum: { amount: true },
    }),
    p.purchaseInvoice.count({
      where: { vendorId, includesPpn: true, taxInvoiceFilePath: null },
    }),
  ]);

  const outstandingTotal = payablesAgg._sum.amount?.toNumber() ?? 0;
  if (payablesAgg._count.id > 0 && outstandingTotal > 0) {
    blockers.push({
      code: "outstandingPayables",
      count: payablesAgg._count.id,
    });
  }

  if (pendingTaxCount > 0) {
    blockers.push({ code: "pendingTaxInvoices", count: pendingTaxCount });
  }

  return blockers;
}

export function formatVendorSoftDeleteBlockers(
  blockers: VendorSoftDeleteBlocker[],
  locale: AppLocale = DEFAULT_LOCALE
): string[] {
  return blockers.map((blocker) =>
    translate(
      locale,
      `pages.vendors.softDeleteBlockers.${blocker.code}`,
      { count: blocker.count }
    )
  );
}

export async function assertVendorCanBeSoftDeleted(
  vendorId: string,
  db: Tx = prisma,
  locale: AppLocale = DEFAULT_LOCALE
): Promise<void> {
  const blockers = await getVendorSoftDeleteBlockers(vendorId, db);
  if (blockers.length === 0) return;

  const messages = formatVendorSoftDeleteBlockers(blockers, locale);
  throw new Error(
    translate(locale, "pages.vendors.softDeleteBlocked", {
      blockers: messages.join(", "),
    })
  );
}
