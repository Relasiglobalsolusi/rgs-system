import type { PurchasePurpose } from "@prisma/client";

export const PURCHASE_PURPOSES = [
  "STOCK",
  "PROJECT",
  "INTERNAL",
  "PETTY_CASH",
] as const satisfies readonly PurchasePurpose[];

export function isPurchasePurpose(value: string): value is PurchasePurpose {
  return (PURCHASE_PURPOSES as readonly string[]).includes(value);
}

export function parsePurchasePurpose(
  value: FormDataEntryValue | string | null | undefined
): PurchasePurpose {
  const raw = String(value ?? "").trim().toUpperCase();
  return isPurchasePurpose(raw) ? raw : "STOCK";
}

/**
 * Product buys always become warehouse stock. Project cost happens later
 * when Inventory issues the item. Service / government / petty cash are
 * not stock-in.
 */
export function resolvePurchasePurpose(options: {
  category: string;
  requested: PurchasePurpose;
}): PurchasePurpose {
  if (options.category === "PRODUCT") return "STOCK";
  if (options.category === "SERVICE") {
    return options.requested === "PROJECT" ? "PROJECT" : "INTERNAL";
  }
  if (options.category === "GOVERNMENT") return "INTERNAL";
  if (options.category === "PETTY_CASH") return "PETTY_CASH";
  return options.requested;
}

export function assertPurchasePurposeProject(options: {
  purpose: PurchasePurpose;
  projectId: string | null;
}) {
  if (options.purpose === "PETTY_CASH") {
    if (options.projectId) {
      throw new Error("Petty Cash top-ups are not tagged to a project.");
    }
    return;
  }
  if (options.purpose === "PROJECT" && !options.projectId) {
    throw new Error("Select the project this purchase is for.");
  }
  if (options.purpose !== "PROJECT" && options.projectId) {
    throw new Error("Only project-purpose purchases can be tagged to a project.");
  }
}

/** Product / STOCK purchases create warehouse stock. */
export function purchaseCreatesStock(
  purpose: PurchasePurpose,
  category?: string | null
): boolean {
  if (category === "PRODUCT") return true;
  return purpose === "STOCK";
}
