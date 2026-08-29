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
export function parsePurchaseCategory(
  value: FormDataEntryValue | string | null | undefined
):
  | "PRODUCT"
  | "SERVICE"
  | "PETTY_CASH"
  | "GOVERNMENT"
  | "VEHICLE"
  | "BANK_LOAN"
  | "EMPLOYEE_PAYMENT" {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "SERVICE") return "SERVICE";
  if (raw === "PETTY_CASH") return "PETTY_CASH";
  if (raw === "GOVERNMENT") return "GOVERNMENT";
  if (raw === "VEHICLE") return "VEHICLE";
  if (raw === "BANK_LOAN") return "BANK_LOAN";
  if (raw === "EMPLOYEE_PAYMENT") return "EMPLOYEE_PAYMENT";
  return "PRODUCT";
}

export function resolvePurchasePurpose(options: {
  category: string;
  requested: PurchasePurpose;
  /** Vehicle purchase mints stock/assets; other vehicle spend is operating cost. */
  vehicleExpenseKind?: string | null;
}): PurchasePurpose {
  if (options.category === "PRODUCT") return "STOCK";
  if (options.category === "VEHICLE") {
    const kind = String(options.vehicleExpenseKind ?? "")
      .trim()
      .toUpperCase();
    return kind === "PURCHASE" ? "STOCK" : "INTERNAL";
  }
  if (options.category === "SERVICE") {
    return options.requested === "PROJECT" ? "PROJECT" : "INTERNAL";
  }
  if (options.category === "GOVERNMENT") return "INTERNAL";
  if (options.category === "BANK_LOAN") return "INTERNAL";
  if (options.category === "EMPLOYEE_PAYMENT") return "INTERNAL";
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

/** Product / STOCK purchases create warehouse stock. Vehicles mint assets instead. */
export function purchaseCreatesStock(
  purpose: PurchasePurpose,
  category?: string | null
): boolean {
  if (category === "VEHICLE" || category === "BANK_LOAN") return false;
  if (category === "PRODUCT") return true;
  return purpose === "STOCK";
}
