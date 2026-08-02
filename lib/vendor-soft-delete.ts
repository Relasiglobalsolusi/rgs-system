import type { Prisma } from "@prisma/client";

import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

export type VendorSoftDeleteBlocker = {
  code: "unsettledPurchases" | "pendingTaxInvoices";
  count: number;
};

/**
 * Vendors may be soft-deleted while purchase history remains in the database.
 * Purchase invoices are not cascade-deleted; the vendor record is marked inactive.
 */
export async function getVendorSoftDeleteBlockers(
  _vendorId: string,
  _db: Tx = prisma
): Promise<VendorSoftDeleteBlocker[]> {
  return [];
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
  _vendorId: string,
  _db: Tx = prisma,
  _locale: AppLocale = DEFAULT_LOCALE
): Promise<void> {
  // Purchase history is retained; soft-delete is always allowed.
}
