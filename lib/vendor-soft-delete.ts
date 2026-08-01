import type { Prisma } from "@prisma/client";

import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import {
  isPurchaseInvoiceUnsettledAp,
  isPurchaseTaxInvoicePending,
} from "@/lib/purchases";

type Tx = Prisma.TransactionClient | typeof prisma;

export type VendorSoftDeleteBlocker = {
  code: "unsettledPurchases" | "pendingTaxInvoices";
  count: number;
};

/**
 * Soft-delete is allowed only when every linked purchase obligation is closed.
 *
 * There is no PurchaseOrder model and PurchaseInvoice has no PAID / CANCELLED
 * (or paidAt) field yet — see {@link lib/purchases}. All linked purchases count
 * as unsettled AP. Missing faktur pajak on PPN purchases also blocks.
 */
export async function getVendorSoftDeleteBlockers(
  vendorId: string,
  db: Tx = prisma
): Promise<VendorSoftDeleteBlocker[]> {
  const invoices = await db.purchaseInvoice.findMany({
    where: { vendorId },
    select: {
      id: true,
      includesPpn: true,
      taxInvoiceFilePath: true,
    },
  });

  let unsettledPurchases = 0;
  let pendingTaxInvoices = 0;

  for (const invoice of invoices) {
    if (isPurchaseInvoiceUnsettledAp(invoice)) {
      unsettledPurchases += 1;
    }
    if (isPurchaseTaxInvoicePending(invoice)) {
      pendingTaxInvoices += 1;
    }
  }

  const blockers: VendorSoftDeleteBlocker[] = [];
  if (unsettledPurchases > 0) {
    blockers.push({ code: "unsettledPurchases", count: unsettledPurchases });
  }
  if (pendingTaxInvoices > 0) {
    blockers.push({ code: "pendingTaxInvoices", count: pendingTaxInvoices });
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
      blockers: messages.join("; "),
    })
  );
}
