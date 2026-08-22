import { purchaseImportInputVat } from "@/lib/import-landed-cost";
import { isGovernmentOperatingExpense } from "@/lib/government-tax";

export type PurchaseOperatingCostInput = {
  amount: number;
  purchaseCategory?: string | null;
  governmentTaxKind?: string | null;
  origin?: "LOCAL" | "IMPORT" | null;
  includesPpn?: boolean;
  ppnRatePercent?: number | null;
  importPpnAmountIdr?: number | null;
  importValueIdr?: number | null;
  pph22AmountIdr?: number | null;
  transferFeeIdr?: number | null;
  loanInterestAmount?: number | null;
};

/**
 * Cash paid minus recoverable tax credits.
 * Import PPN is monthly PPN Masukan. Import PPh 22 and government
 * PPh 25 / 29 are annual corporate income-tax credits. Those are not
 * operating expense.
 */
export function operatingPurchaseAmount(
  invoice: PurchaseOperatingCostInput
): number {
  const amount = Number.isFinite(invoice.amount) ? invoice.amount : 0;
  if (amount <= 0) return 0;

  const transferFee =
    invoice.transferFeeIdr != null && Number.isFinite(invoice.transferFeeIdr)
      ? Math.max(0, invoice.transferFeeIdr)
      : 0;

  if (invoice.purchaseCategory === "BANK_LOAN") {
    const interest =
      invoice.loanInterestAmount != null &&
      Number.isFinite(invoice.loanInterestAmount)
        ? Math.max(0, invoice.loanInterestAmount)
        : amount;
    return interest + transferFee;
  }

  if (invoice.purchaseCategory === "GOVERNMENT") {
    const body = isGovernmentOperatingExpense(invoice.governmentTaxKind)
      ? amount
      : 0;
    return body + transferFee;
  }

  const vat = purchaseImportInputVat({
    origin: invoice.origin === "IMPORT" ? "IMPORT" : "LOCAL",
    amount,
    includesPpn: Boolean(invoice.includesPpn),
    ppnRatePercent: invoice.ppnRatePercent ?? null,
    importPpnAmountIdr: invoice.importPpnAmountIdr ?? null,
    importValueIdr: invoice.importValueIdr ?? null,
  });
  const pph22 =
    invoice.origin === "IMPORT" && invoice.pph22AmountIdr != null
      ? invoice.pph22AmountIdr
      : 0;
  return Math.max(0, amount - vat.ppn - pph22) + transferFee;
}
