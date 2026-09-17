/** PPh Badan on the Financial Report. Not PPN and not client PPh. */
export const CORPORATE_INCOME_TAX_RATE = 0.22;
export const CORPORATE_INCOME_TAX_RATE_PERCENT = 22;

/** Rate × profit before tax. A loss books no tax. */
export function corporateIncomeTaxOnProfitBeforeTax(
  profitBeforeTax: number,
  rate: number = CORPORATE_INCOME_TAX_RATE
): number {
  if (!Number.isFinite(profitBeforeTax) || profitBeforeTax <= 0) return 0;
  const applied = Number.isFinite(rate) && rate > 0 ? rate : 0;
  return Math.round(profitBeforeTax * applied);
}
