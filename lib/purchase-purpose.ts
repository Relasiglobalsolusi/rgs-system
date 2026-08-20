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

/** STOCK purchases create warehouse stock; PROJECT / INTERNAL are expense-only. */
export function purchaseCreatesStock(purpose: PurchasePurpose): boolean {
  return purpose === "STOCK";
}
