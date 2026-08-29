import type { AppLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";

export const VEHICLE_OPERATING_EXPENSE_KINDS = [
  "SERVICING",
  "MODIFICATION",
  "OTHER",
  "LEASE_PAYMENT",
] as const;

export const VEHICLE_EXPENSE_KINDS = [
  "PURCHASE",
  "FUEL",
  "SERVICING",
  "MODIFICATION",
  "OTHER",
  "LEASE_PAYMENT",
] as const;

export type VehicleOperatingExpenseKind =
  (typeof VEHICLE_OPERATING_EXPENSE_KINDS)[number];

export type VehicleExpenseKindValue = (typeof VEHICLE_EXPENSE_KINDS)[number];

export function isVehicleOperatingExpenseKind(
  value: string
): value is VehicleOperatingExpenseKind {
  return (VEHICLE_OPERATING_EXPENSE_KINDS as readonly string[]).includes(value);
}

export function parseVehicleExpenseKind(
  value: string
): VehicleExpenseKindValue | null {
  const raw = value.trim().toUpperCase();
  return (VEHICLE_EXPENSE_KINDS as readonly string[]).includes(raw)
    ? (raw as VehicleExpenseKindValue)
    : null;
}

export function rankLeasePaymentsByVehicle<
  T extends {
    id: string;
    invoiceDate: Date | string;
    vehicleAssetId?: string | null;
    vehiclePlate?: string | null;
  },
>(payments: T[]): Map<string, number> {
  const groups = new Map<string, T[]>();
  for (const row of payments) {
    const key = row.vehicleAssetId || row.vehiclePlate || row.id;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const ranks = new Map<string, number>();
  for (const list of groups.values()) {
    for (const [id, number] of rankLeasePayments(list)) {
      ranks.set(id, number);
    }
  }
  return ranks;
}

export function rankLeasePayments<T extends { id: string; invoiceDate: Date | string }>(
  payments: T[]
): Map<string, number> {
  const ranked = [...payments].sort((left, right) => {
    const leftTime = new Date(left.invoiceDate).getTime();
    const rightTime = new Date(right.invoiceDate).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.id.localeCompare(right.id);
  });
  return new Map(ranked.map((row, index) => [row.id, index + 1]));
}

export function vehicleExpenseNarrative(input: {
  locale: AppLocale;
  kind: string | null | undefined;
  isLease?: boolean;
  vehicleName: string;
  plate: string;
  otherDescription?: string | null;
  installmentNumber?: number | null;
  tenorMonths?: number | null;
}): string {
  const locale = input.locale;
  const vehicle = input.vehicleName.trim() || translate(locale, "modules.inventory");
  const plate = input.plate.trim() || "—";
  const kind = String(input.kind ?? "").trim().toUpperCase();
  const params = { vehicle, plate };

  if (kind === "PURCHASE" && input.isLease) {
    return translate(locale, "pages.billing.vehicleNarrative.downPayment", params);
  }
  if (kind === "PURCHASE") {
    return translate(locale, "pages.billing.vehicleNarrative.purchase", params);
  }
  if (kind === "LEASE_PAYMENT") {
    const current = input.installmentNumber;
    const tenor = input.tenorMonths;
    if (current && tenor && tenor > 0) {
      return translate(locale, "pages.billing.vehicleNarrative.monthly", {
        ...params,
        current,
        tenor,
      });
    }
    if (current) {
      return translate(locale, "pages.billing.vehicleNarrative.monthlyOpen", {
        ...params,
        current,
      });
    }
    return translate(locale, "pages.billing.vehicleNarrative.monthlyBare", params);
  }
  if (kind === "SERVICING") {
    return translate(locale, "pages.billing.vehicleNarrative.servicing", params);
  }
  if (kind === "MODIFICATION") {
    return translate(locale, "pages.billing.vehicleNarrative.modification", params);
  }
  if (kind === "FUEL") {
    return translate(locale, "pages.billing.vehicleNarrative.fuel", params);
  }
  if (kind === "OTHER") {
    const description = input.otherDescription?.trim();
    if (description) {
      return translate(locale, "pages.billing.vehicleNarrative.other", {
        ...params,
        description,
      });
    }
    return translate(locale, "pages.billing.vehicleNarrative.otherFallback", params);
  }
  return translate(locale, "pages.billing.vehicleNarrative.generic", params);
}
