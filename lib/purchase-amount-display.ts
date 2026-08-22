import { formatImportForeignAmount } from "@/lib/import-landed-cost";
import { decimalToNumber, formatContractPrice } from "@/lib/project-billing";

function moneyValue(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" || typeof value === "string") {
    return decimalToNumber(value);
  }
  if (typeof value === "object" && "toString" in value) {
    return decimalToNumber(value as { toString(): string });
  }
  return null;
}

function hasImportBankRate(exchangeRateToIdr: unknown): boolean {
  const rate = moneyValue(exchangeRateToIdr);
  return rate != null && rate > 0;
}

/** Listed AP / expense amount. Unpaid imports without a Booking Rate stay in foreign currency. */
export function formatPurchaseListedAmount(invoice: {
  amount?: unknown;
  origin?: string | null;
  invoiceCurrency?: string | null;
  invoiceForeignAmount?: unknown;
  exchangeRateToIdr?: unknown;
}): string {
  const foreign = moneyValue(invoice.invoiceForeignAmount);
  if (
    invoice.origin === "IMPORT" &&
    !hasImportBankRate(invoice.exchangeRateToIdr) &&
    foreign != null &&
    foreign > 0
  ) {
    return formatImportForeignAmount(invoice.invoiceCurrency ?? "USD", foreign);
  }
  return formatContractPrice(moneyValue(invoice.amount) ?? 0);
}

/** Unpaid overseas factory invoice still needs the Bank Rate used on the transfer. */
export function purchaseNeedsImportBankRate(invoice: {
  origin?: string | null;
  paidAt?: Date | string | null;
  invoiceForeignAmount?: unknown;
}): boolean {
  if (invoice.origin !== "IMPORT") return false;
  if (invoice.paidAt) return false;
  const foreign = moneyValue(invoice.invoiceForeignAmount);
  if (foreign == null || foreign <= 0) return false;
  return true;
}
