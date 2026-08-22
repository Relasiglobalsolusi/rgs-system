/**
 * Indonesian import landed-cost engine (Bea Cukai / Pajak Dalam Rangka Impor).
 *
 * Official order (UU Kepabeanan, UU PPN Pasal 1 angka 20, PMK 41/2022):
 * 1. Nilai Pabean (CIF) = invoice + freight + insurance. Each non-IDR
 *    currency is converted at that currency’s Customs Rate. Rupiah freight
 *    or insurance is added as entered — there is no Customs Rate (IDR).
 *    Details show this as one Customs Value (CIF) figure — not a second
 *    invoice / freight / insurance list.
 *    Paid To Vendor (remittance) is separate: included lines use the factory
 *    Bank Rate; not-included FX lines use that line’s own bank rate; IDR
 *    not-included lines are added as cash.
 * 2. Bea Masuk = Nilai Pabean × Customs Duty %. Form E (ATIGA) is usually 0%.
 * 3. Nilai Impor = Nilai Pabean + Bea Masuk. This is the tax base. It does
 *    not include PPN or PPnBM.
 * 4. PPnBM, PPN, and PPh 22 are each charged on Nilai Impor.
 *
 * Ordinary goods: PPN is an effective 11% (headline 12% × 11/12). Income Tax
 * Article 22 is 2.5% with an Importer Identification Number, or 7.5% without.
 *
 * Warehouse stock cost = cash spent minus tax credits (Paid To Vendor +
 * Customs Duty + Luxury Goods Tax + handling, excluding recoverable VAT
 * and prepaid Income Tax Article 22).
 */

import { DEFAULT_PRODUCT_PPN_RATE_PERCENT } from "@/lib/vat";

/** Form value when Head Office staff handle the import — no handling fee. */
export const HANDLING_BY_HEAD_OFFICE = "__HEAD_OFFICE__";

export function isHandlingByHeadOffice(
  value: string | null | undefined
): boolean {
  return String(value ?? "").trim() === HANDLING_BY_HEAD_OFFICE;
}

export const IMPORT_CURRENCIES = [
  "USD",
  "RMB",
  "CNY",
  "SGD",
  "EUR",
  "JPY",
  "THB",
  "MYR",
  "KRW",
  "GBP",
  "AUD",
  "HKD",
] as const;

/** Fee fields may be Rupiah or the same overseas currencies as the invoice. */
export const IMPORT_FEE_CURRENCIES = ["IDR", ...IMPORT_CURRENCIES] as const;

export function normalizeImportCurrency(
  value: string | null | undefined,
  fallback = "USD"
): string {
  const code = String(value ?? "")
    .trim()
    .toUpperCase();
  if (code === "IDR") return "IDR";
  if ((IMPORT_CURRENCIES as readonly string[]).includes(code)) return code;
  return fallback;
}

export const IMPORT_PPH22_API_RATE_PERCENT = 2.5;
export const IMPORT_PPH22_NON_API_RATE_PERCENT = 7.5;

export type ImportPph22Basis = "API" | "WITHOUT_API" | "CUSTOM";

export type ImportLandedCostInput = {
  foreignAmount: number;
  /** Factory invoice currency (USD, RMB, …). */
  currency?: string;
  /** Bank Rate — remittance for included factory-currency lines. */
  exchangeRateToIdr: number;
  /** Legacy single Customs Rate — used for the factory currency when the map omits it. */
  customsRateToIdr?: number;
  /** Customs Rate per foreign currency, e.g. { USD: 16200, RMB: 2250 }. No IDR key. */
  customsRatesToIdr?: Record<string, number>;
  freightCurrency?: string;
  freightForeignAmount?: number;
  freightIdr?: number;
  freightIncludedInInvoice?: boolean;
  freightRateToIdr?: number;
  freightCustomsRateToIdr?: number;
  insuranceCurrency?: string;
  insuranceForeignAmount?: number;
  insuranceIdr?: number;
  insuranceIncludedInInvoice?: boolean;
  insuranceRateToIdr?: number;
  insuranceCustomsRateToIdr?: number;
  bankFeeCurrency?: string;
  bankFeeForeignAmount?: number;
  bankFeeIdr?: number;
  fullAmountFeeCurrency?: string;
  fullAmountFeeForeignAmount?: number;
  fullAmountFeeIdr?: number;
  localBankFeeIdr?: number;
  clearanceCostIdr?: number;
  formEApplied?: boolean;
  beaMasukApplied?: boolean;
  beaMasukRatePercent?: number;
  beaMasukAmountIdr?: number | null;
  ppnbmApplied?: boolean;
  ppnbmRatePercent?: number;
  ppnbmAmountIdr?: number | null;
  ppnApplied?: boolean;
  ppnRatePercent?: number;
  ppnAmountIdr?: number | null;
  pph22Applied?: boolean;
  pph22Basis?: ImportPph22Basis;
  pph22RatePercent?: number;
  pph22AmountIdr?: number | null;
  /** PIB / vendor declared value. When set, CIF uses this instead of the factory invoice. */
  declaredValue?: number;
  declaredCurrency?: string;
  declaredCustomsRate?: number;
};

export type ImportVendorLine = {
  currency: string;
  foreignAmount: number | null;
  storedAsIdr: boolean;
  vendorIdr: number;
  includedInInvoice: boolean;
};

export type ImportCifForeignLine = {
  currency: string;
  foreignAmount: number;
  customsRate: number;
};

export type ImportCustomsRate = {
  currency: string;
  rate: number;
};

export type ImportVendorRemittance = {
  factory: ImportVendorLine;
  freight: ImportVendorLine;
  insurance: ImportVendorLine;
  bankCharge: ImportVendorLine;
  bankRate: number;
  /** Factory-currency sum of included remittance lines (IDR lines excluded). */
  factoryCurrencyFxSum: number;
  factoryCurrency: string;
  /** Included remittance lines at Bank Rate (legacy IDR extras added as stored Rupiah). */
  amountSentIdr: number;
  telexIdr: number;
  /** Historical extra bank fee. Included in Total Paid To Vendor only. */
  fullAmountFeeIdr: number;
  /** Not-included freight paid on a separate transfer. */
  separateFreightIdr: number;
  /** Not-included insurance paid on a separate transfer. */
  separateInsuranceIdr: number;
  paidToVendorIdr: number;
};

export type ImportLandedCostResult = {
  /** Factory Invoice × Bank Rate. */
  invoiceAmountIdr: number;
  /** Factory Invoice × Customs Rate — used only to compute CIF. */
  customsInvoiceAmountIdr: number;
  /** Freight in Rupiah at Customs Rate (CIF). IDR rows stay as stored. */
  freightIdr: number;
  /** Insurance in Rupiah at Customs Rate (CIF). IDR rows stay as stored. */
  insuranceIdr: number;
  vendorFreightIdr: number;
  vendorInsuranceIdr: number;
  bankChargeIdr: number;
  fullAmountFeeIdr: number;
  localBankFeeIdr: number;
  /** Bank Charge + Full Amount Fee + Telex Fee. */
  bankFeeIdr: number;
  amountSentIdr: number;
  paidToVendorIdr: number;
  remittance: ImportVendorRemittance;
  clearanceCostIdr: number;
  /** Factory-currency FX total (invoice + same-currency freight / insurance). */
  cifForeignAmount: number;
  cifCurrency: string;
  /** Non-IDR CIF amounts grouped by currency. */
  cifForeignLines: ImportCifForeignLine[];
  /** Rupiah freight / insurance added straight into CIF. */
  cifIdrExtra: number;
  /** Customs rates that were actually used (no IDR). */
  appliedCustomsRates: ImportCustomsRate[];
  customsValueIdr: number;
  formEApplied: boolean;
  beaMasukApplied: boolean;
  beaMasukRatePercent: number;
  beaMasukAmountIdr: number;
  ppnbmApplied: boolean;
  ppnbmRatePercent: number;
  ppnbmAmountIdr: number;
  importValueIdr: number;
  ppnApplied: boolean;
  ppnRatePercent: number;
  ppnAmountIdr: number;
  pph22Applied: boolean;
  pph22Basis: ImportPph22Basis;
  pph22RatePercent: number;
  pph22AmountIdr: number;
  dutiesTotalIdr: number;
  stockLandedCostIdr: number;
  cashOutIdr: number;
};

export type ImportStockAllocationLine = {
  quantity: number;
  foreignAmount?: number;
};

export type ImportStockAllocatedLine = {
  quantity: number;
  foreignAmount: number;
  unitCostIdr: number;
  totalCostIdr: number;
};

function roundIdr(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value);
}

/** Prisma Decimal, numeric string, or number → finite number. */
function coerceFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "object") {
    const obj = value as { toNumber?: () => number; toString?: () => string };
    if (typeof obj.toNumber === "function") {
      const n = obj.toNumber();
      if (Number.isFinite(n)) return n;
    }
    if (typeof obj.toString === "function") {
      const text = obj.toString();
      if (text && text !== "[object Object]") {
        const n = Number(text);
        if (Number.isFinite(n)) return n;
      }
    }
  }
  return null;
}

function moneyOrZero(value: unknown): number {
  const n = coerceFiniteNumber(value);
  if (n == null || n < 0) return 0;
  return n;
}

function rateOrZero(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

function overrideOrComputed(
  applied: boolean,
  override: number | null | undefined,
  computed: number
): number {
  if (!applied) return 0;
  if (override != null && Number.isFinite(override) && override >= 0) {
    return roundIdr(override);
  }
  return computed;
}

function convertImportAmountToIdr(params: {
  foreignAmount?: number | null;
  currency?: string | null;
  exchangeRateToIdr: number;
  amountIdr?: number | null;
}): number {
  const foreign = moneyOrZero(params.foreignAmount);
  const currency = String(params.currency ?? "")
    .trim()
    .toUpperCase();
  if (foreign > 0) {
    if (!currency || currency === "IDR") {
      return roundIdr(foreign);
    }
    return roundIdr(foreign * moneyOrZero(params.exchangeRateToIdr));
  }
  return roundIdr(moneyOrZero(params.amountIdr));
}

/** True when the fee was stored or entered as Rupiah — do not apply Bank Rate. */
function importFeeStoredAsIdr(params: {
  currency?: string | null;
  foreignAmount?: number | null;
}): boolean {
  const foreign = moneyOrZero(params.foreignAmount);
  const currency = String(params.currency ?? "")
    .trim()
    .toUpperCase();
  if (foreign <= 0) return true;
  return !currency || currency === "IDR";
}

export function parseCustomsRatesMap(
  value: unknown
): Record<string, number> {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const code = String(key ?? "")
      .trim()
      .toUpperCase();
    if (!(IMPORT_CURRENCIES as readonly string[]).includes(code)) continue;
    const n = coerceFiniteNumber(raw);
    if (n != null && n > 0) out[code] = n;
  }
  return out;
}

function resolveImportCustomsRates(input: {
  currency?: string | null;
  customsRateToIdr?: number | null;
  customsRatesToIdr?: Record<string, number> | null;
}): Record<string, number> {
  const factory = normalizeImportCurrency(input.currency, "USD");
  const rates = parseCustomsRatesMap(input.customsRatesToIdr);
  if (factory !== "IDR" && rates[factory] == null) {
    const legacy = moneyOrZero(input.customsRateToIdr);
    if (legacy > 0) rates[factory] = legacy;
  }
  return rates;
}

/** Stored Customs Rate for a factory currency. Never falls back to Bank Rate. */
function resolveFactoryCustomsRate(input: {
  currency?: string | null;
  customsRateToIdr?: number | null;
  customsRatesToIdr?: Record<string, number> | null;
}): { currency: string; rate: number } | null {
  const currency = normalizeImportCurrency(input.currency, "USD");
  if (currency === "IDR") return null;
  const rate = customsRateForCurrency(currency, resolveImportCustomsRates(input));
  if (rate <= 0) return null;
  return { currency, rate };
}

/**
 * Customs Rate implied by stored CIF minus Rupiah extras.
 * Used when the invoice predates the customsRateToIdr column.
 * Never uses Bank Rate.
 */
export function impliedFactoryCustomsRateFromStoredCif(params: {
  currency?: string | null;
  foreignAmount?: number | null;
  customsValueIdr?: number | null;
  idrExtra?: number | null;
}): number | null {
  const currency = normalizeImportCurrency(params.currency, "USD");
  if (currency === "IDR") return null;
  const amount = moneyOrZero(params.foreignAmount);
  const cif = moneyOrZero(params.customsValueIdr);
  const extra = moneyOrZero(params.idrExtra);
  if (amount <= 0 || cif <= extra) return null;
  const rate = (cif - extra) / amount;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

function customsRateForCurrency(
  currency: string,
  rates: Record<string, number>
): number {
  return moneyOrZero(rates[currency]);
}

type ImportCifAmountInput = {
  currency?: string | null;
  foreignAmount?: number | null;
  declaredValue?: number | null;
  declaredCurrency?: string | null;
  declaredCustomsRate?: number | null;
  freightCurrency?: string | null;
  freightForeignAmount?: number | null;
  freightIdr?: number | null;
  freightIncludedInInvoice?: boolean | null;
  freightCustomsRateToIdr?: number | null;
  insuranceCurrency?: string | null;
  insuranceForeignAmount?: number | null;
  insuranceIdr?: number | null;
  insuranceIncludedInInvoice?: boolean | null;
  insuranceCustomsRateToIdr?: number | null;
};

/** Distinct non-IDR currencies on Factory Invoice + Freight + Insurance. */
export function listImportCifFxCurrencies(
  input: ImportCifAmountInput
): string[] {
  const factory = normalizeImportCurrency(input.currency, "USD");
  const codes: string[] = [];
  function add(
    currency: string | null | undefined,
    foreignAmount: number | null | undefined,
    requireAmount: boolean
  ) {
    if (requireAmount && moneyOrZero(foreignAmount) <= 0) return;
    if (
      importFeeStoredAsIdr({
        currency,
        foreignAmount: requireAmount ? foreignAmount : foreignAmount ?? 1,
      })
    ) {
      return;
    }
    const code = normalizeImportCurrency(currency, factory);
    if (code === "IDR" || codes.includes(code)) return;
    codes.push(code);
  }
  if (factory !== "IDR") codes.push(factory);
  add(input.freightCurrency ?? factory, input.freightForeignAmount, true);
  add(input.insuranceCurrency ?? factory, input.insuranceForeignAmount, true);
  return codes;
}

export type ImportCifSummary = {
  foreignLines: ImportCifForeignLine[];
  idrAmount: number;
  invoiceIdr: number;
  freightIdr: number;
  insuranceIdr: number;
  customsValueIdr: number;
  appliedCustomsRates: ImportCustomsRate[];
  cifCurrency: string;
  cifForeignAmount: number;
};

function addCifFxLine(
  lines: ImportCifForeignLine[],
  currency: string,
  amount: number,
  customsRate: number
) {
  if (amount <= 0) return;
  const existing = lines.find(
    (line) => line.currency === currency && line.customsRate === customsRate
  );
  if (existing) {
    existing.foreignAmount += amount;
    return;
  }
  lines.push({ currency, foreignAmount: amount, customsRate });
}

function cifComponentIdr(params: {
  currency?: string | null;
  foreignAmount?: number | null;
  storedIdr?: number | null;
  fallbackCurrency: string;
  rates: Record<string, number>;
  ownCustomsRateToIdr?: number | null;
}): {
  fxCurrency: string | null;
  fxAmount: number;
  customsRate: number;
  idr: number;
} {
  const foreign = moneyOrZero(params.foreignAmount);
  if (
    importFeeStoredAsIdr({
      currency: params.currency,
      foreignAmount: params.foreignAmount,
    })
  ) {
    return {
      fxCurrency: null,
      fxAmount: 0,
      customsRate: 0,
      idr: convertImportAmountToIdr({
        foreignAmount: params.foreignAmount,
        currency: params.currency,
        exchangeRateToIdr: 1,
        amountIdr: params.storedIdr,
      }),
    };
  }
  const fxCurrency = normalizeImportCurrency(
    params.currency,
    params.fallbackCurrency
  );
  const own = moneyOrZero(params.ownCustomsRateToIdr);
  const rate =
    own > 0 ? own : customsRateForCurrency(fxCurrency, params.rates);
  return {
    fxCurrency,
    fxAmount: foreign,
    customsRate: rate,
    idr: convertImportAmountToIdr({
      foreignAmount: params.foreignAmount,
      currency: fxCurrency,
      exchangeRateToIdr: rate,
      amountIdr: params.storedIdr,
    }),
  };
}

function factoryCifComponent(
  input: ImportCifAmountInput & {
    customsRateToIdr?: number | null;
    customsRatesToIdr?: Record<string, number> | null;
  },
  factoryCurrency: string,
  rates: Record<string, number>
): {
  fxCurrency: string | null;
  fxAmount: number;
  customsRate: number;
  idr: number;
} {
  const foreign = moneyOrZero(input.foreignAmount);
  if (factoryCurrency === "IDR") {
    return {
      fxCurrency: null,
      fxAmount: 0,
      customsRate: 0,
      idr: convertImportAmountToIdr({
        foreignAmount: input.foreignAmount,
        currency: "IDR",
        exchangeRateToIdr: 1,
        amountIdr: foreign > 0 ? foreign : null,
      }),
    };
  }
  const rate = customsRateForCurrency(factoryCurrency, rates);
  return {
    fxCurrency: factoryCurrency,
    fxAmount: foreign,
    customsRate: rate,
    idr: convertImportAmountToIdr({
      foreignAmount: foreign,
      currency: factoryCurrency,
      exchangeRateToIdr: rate,
    }),
  };
}

function applyDeclaredCifFactory<
  T extends ImportCifAmountInput & {
    customsRateToIdr?: number | null;
    customsRatesToIdr?: Record<string, number> | null;
  },
>(input: T): T {
  const declared = moneyOrZero(input.declaredValue);
  if (declared <= 0) return input;
  const currency = normalizeImportCurrency(input.declaredCurrency, "IDR");
  const rate = moneyOrZero(input.declaredCustomsRate);
  const rates = parseCustomsRatesMap(input.customsRatesToIdr);
  if (currency !== "IDR" && rate > 0) {
    rates[currency] = rate;
  }
  return {
    ...input,
    currency,
    foreignAmount: declared,
    customsRateToIdr:
      currency === "IDR" ? undefined : rate || input.customsRateToIdr,
    customsRatesToIdr: rates,
  };
}

/** CIF: each FX currency × that currency’s Customs Rate, plus any IDR lines. */
export function summarizeImportCif(
  input: ImportCifAmountInput & {
    customsRateToIdr?: number | null;
    customsRatesToIdr?: Record<string, number> | null;
  }
): ImportCifSummary {
  const cifInput = applyDeclaredCifFactory(input);
  const factoryCurrency = normalizeImportCurrency(cifInput.currency, "USD");
  const rates = resolveImportCustomsRates(cifInput);
  const invoice = factoryCifComponent(cifInput, factoryCurrency, rates);
  const freight = cifComponentIdr({
    currency: cifInput.freightCurrency,
    foreignAmount: cifInput.freightForeignAmount,
    storedIdr: cifInput.freightIdr,
    fallbackCurrency: factoryCurrency,
    rates,
    ownCustomsRateToIdr:
      cifInput.freightIncludedInInvoice === false
        ? cifInput.freightCustomsRateToIdr
        : undefined,
  });
  const insurance = cifComponentIdr({
    currency: cifInput.insuranceCurrency,
    foreignAmount: cifInput.insuranceForeignAmount,
    storedIdr: cifInput.insuranceIdr,
    fallbackCurrency: factoryCurrency,
    rates,
    ownCustomsRateToIdr:
      cifInput.insuranceIncludedInInvoice === false
        ? cifInput.insuranceCustomsRateToIdr
        : undefined,
  });

  const foreignLines: ImportCifForeignLine[] = [];
  if (invoice.fxCurrency) {
    addCifFxLine(
      foreignLines,
      invoice.fxCurrency,
      invoice.fxAmount,
      invoice.customsRate
    );
  }
  if (freight.fxCurrency) {
    addCifFxLine(
      foreignLines,
      freight.fxCurrency,
      freight.fxAmount,
      freight.customsRate
    );
  }
  if (insurance.fxCurrency) {
    addCifFxLine(
      foreignLines,
      insurance.fxCurrency,
      insurance.fxAmount,
      insurance.customsRate
    );
  }

  const applied: ImportCustomsRate[] = [];
  function pushApplied(currency: string, rate: number) {
    if (
      rate > 0 &&
      !applied.some((row) => row.currency === currency && row.rate === rate)
    ) {
      applied.push({ currency, rate });
    }
  }
  if (factoryCurrency !== "IDR" && invoice.customsRate > 0) {
    pushApplied(factoryCurrency, invoice.customsRate);
  }
  for (const line of foreignLines) {
    pushApplied(line.currency, line.customsRate);
  }

  let idrAmount = 0;
  if (!invoice.fxCurrency) idrAmount += invoice.idr;
  if (!freight.fxCurrency) idrAmount += freight.idr;
  if (!insurance.fxCurrency) idrAmount += insurance.idr;

  const factoryFx = foreignLines
    .filter((line) => line.currency === factoryCurrency)
    .reduce((sum, line) => sum + line.foreignAmount, 0);

  return {
    foreignLines,
    idrAmount,
    invoiceIdr: invoice.idr,
    freightIdr: freight.idr,
    insuranceIdr: insurance.idr,
    customsValueIdr: invoice.idr + freight.idr + insurance.idr,
    appliedCustomsRates: applied,
    cifCurrency: factoryCurrency,
    cifForeignAmount: factoryFx,
  };
}

/** CIF from invoice + freight + insurance, before Customs Rate exists. */
export function formatImportCifNowLabel(input: {
  currency: string;
  foreignAmount: number;
  freightCurrency?: string | null;
  freightForeignAmount?: number | null;
  insuranceCurrency?: string | null;
  insuranceForeignAmount?: number | null;
  formatIdr: (amount: number) => string;
}): string | null {
  const factoryCurrency = normalizeImportCurrency(input.currency, "USD");
  const factoryAmount = moneyOrZero(input.foreignAmount);
  if (factoryAmount <= 0) return null;

  type Part = { currency: string; amount: number; idr: boolean };
  const parts: Part[] = [];

  function push(
    currency: string | null | undefined,
    amount: number | null | undefined,
    fallback: string
  ) {
    const value = moneyOrZero(amount);
    if (value <= 0) return;
    const asIdr = importFeeStoredAsIdr({
      currency,
      foreignAmount: amount,
    });
    const code = asIdr
      ? "IDR"
      : normalizeImportCurrency(currency, fallback);
    const existing = parts.find(
      (part) => part.currency === code && part.idr === asIdr
    );
    if (existing) {
      existing.amount += value;
      return;
    }
    parts.push({ currency: code, amount: value, idr: asIdr });
  }

  push(factoryCurrency, factoryAmount, factoryCurrency);
  push(input.freightCurrency, input.freightForeignAmount, factoryCurrency);
  push(
    input.insuranceCurrency,
    input.insuranceForeignAmount,
    factoryCurrency
  );
  if (parts.length === 0) return null;

  const labels = parts.map((part) =>
    part.idr
      ? input.formatIdr(part.amount)
      : formatImportForeignAmount(part.currency, part.amount)
  );
  if (parts.length === 1) return labels[0] ?? null;
  const sameFx =
    parts.every((part) => !part.idr && part.currency === parts[0]!.currency);
  if (sameFx) {
    const total = parts.reduce((sum, part) => sum + part.amount, 0);
    return `${labels.join(" + ")}  =  ${formatImportForeignAmount(
      parts[0]!.currency,
      total
    )}`;
  }
  return labels.join(" + ");
}

export function formatImportForeignAmount(
  currency: string,
  amount: number
): string {
  const code = String(currency ?? "").trim().toUpperCase() || "USD";
  const formatted = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 4,
  }).format(amount);
  return `${code} ${formatted}`;
}

/** `(USD 1.200 × Rp 16.200) + Rp 2.900.000  =  Rp 22.340.000` */
export function formatImportCifFormulaLabel(
  foreignLines: ImportCifForeignLine[],
  idrExtra: number,
  customsValueIdr: number,
  formatIdr: (amount: number) => string
): string {
  const parts: string[] = [];
  for (const line of foreignLines) {
    if (line.foreignAmount <= 0 || line.customsRate <= 0) continue;
    parts.push(
      `(${formatImportForeignAmount(line.currency, line.foreignAmount)} × ${formatIdr(line.customsRate)})`
    );
  }
  if (idrExtra > 0) {
    parts.push(formatIdr(idrExtra));
  }
  if (parts.length === 0) return "";
  return `${parts.join(" + ")}  =  ${formatIdr(customsValueIdr)}`;
}

export type ImportCifDisplay = {
  foreignLines: ImportCifForeignLine[];
  idrAmount: number;
  customsValueIdr: number;
  appliedCustomsRates: ImportCustomsRate[];
  formula: string;
};

/**
 * Detail-page CIF line. Always keeps factory-invoice FX when the invoice
 * currency is not IDR. Recovers a missing Customs Rate from
 * stored CIF − Rupiah extras (not Bank Rate). Recovers a missing factory
 * amount the same way when a rate is already stored.
 */
export function displayImportCifBreakdown(
  summary: ImportCifSummary,
  options: {
    currency?: string | null;
    foreignAmount?: number | null;
    customsRateToIdr?: number | null;
    customsRatesToIdr?: Record<string, number> | null;
    storedCustomsValueIdr?: number | null;
    formatIdr: (amount: number) => string;
  }
): ImportCifDisplay {
  const factoryCurrency = normalizeImportCurrency(options.currency, "USD");
  const foreignLines = summary.foreignLines.map((line) => ({ ...line }));
  const idrAmount = summary.idrAmount;
  const customsValueIdr =
    moneyOrZero(options.storedCustomsValueIdr) || summary.customsValueIdr;

  const stored = resolveFactoryCustomsRate(options);
  let factoryAmount =
    moneyOrZero(options.foreignAmount) ||
    moneyOrZero(summary.cifForeignAmount) ||
    foreignLines
      .filter((line) => line.currency === factoryCurrency)
      .reduce((sum, line) => sum + line.foreignAmount, 0);
  let factoryRate = stored?.rate ?? 0;

  if (factoryCurrency !== "IDR") {
    if (factoryRate <= 0) {
      factoryRate =
        impliedFactoryCustomsRateFromStoredCif({
          currency: factoryCurrency,
          foreignAmount: factoryAmount,
          customsValueIdr,
          idrExtra: idrAmount,
        }) ?? 0;
    }
    if (factoryAmount <= 0 && factoryRate > 0 && customsValueIdr > idrAmount) {
      factoryAmount = (customsValueIdr - idrAmount) / factoryRate;
    }
    if (factoryAmount > 0 && factoryRate > 0) {
      const existing = foreignLines.find(
        (line) =>
          line.currency === factoryCurrency &&
          (line.customsRate === factoryRate || line.customsRate <= 0)
      );
      if (existing) {
        existing.foreignAmount = Math.max(existing.foreignAmount, factoryAmount);
        existing.customsRate = factoryRate;
      } else {
        foreignLines.unshift({
          currency: factoryCurrency,
          foreignAmount: factoryAmount,
          customsRate: factoryRate,
        });
      }
    }
  }

  const applied: ImportCustomsRate[] = [];
  if (factoryCurrency !== "IDR" && factoryRate > 0) {
    applied.push({ currency: factoryCurrency, rate: factoryRate });
  }
  for (const row of summary.appliedCustomsRates) {
    if (
      !applied.some(
        (seen) => seen.currency === row.currency && seen.rate === row.rate
      )
    ) {
      applied.push(row);
    }
  }
  for (const line of foreignLines) {
    if (
      line.customsRate > 0 &&
      !applied.some(
        (seen) =>
          seen.currency === line.currency && seen.rate === line.customsRate
      )
    ) {
      applied.push({ currency: line.currency, rate: line.customsRate });
    }
  }

  return {
    foreignLines,
    idrAmount,
    customsValueIdr,
    appliedCustomsRates: applied,
    formula: formatImportCifFormulaLabel(
      foreignLines,
      idrAmount,
      customsValueIdr,
      options.formatIdr
    ),
  };
}

function vendorLine(params: {
  currency?: string | null;
  foreignAmount?: number | null;
  storedIdr?: number | null;
  bankRate: number;
  fallbackCurrency: string;
  includedInInvoice?: boolean;
  ownRateToIdr?: number | null;
}): ImportVendorLine {
  const includedInInvoice = params.includedInInvoice !== false;
  const storedAsIdr = importFeeStoredAsIdr({
    currency: params.currency,
    foreignAmount: params.foreignAmount,
  });
  const currency = storedAsIdr
    ? "IDR"
    : normalizeImportCurrency(params.currency, params.fallbackCurrency);
  const foreign = moneyOrZero(params.foreignAmount);
  const remittanceRate = includedInInvoice
    ? params.bankRate
    : storedAsIdr
      ? 1
      : moneyOrZero(params.ownRateToIdr);
  return {
    currency,
    foreignAmount: storedAsIdr ? null : foreign > 0 ? foreign : null,
    storedAsIdr,
    includedInInvoice,
    vendorIdr: convertImportAmountToIdr({
      foreignAmount: params.foreignAmount,
      currency: params.currency,
      exchangeRateToIdr: remittanceRate,
      amountIdr: params.storedIdr,
    }),
  };
}

/**
 * Warehouse factory portion. Uses Booking Rate (Net) or Bank Rate (Cash)
 * remittance. Customs CIF is only the fallback when no rate was stored.
 */
export function importWarehouseFactoryPortionIdr(params: {
  paidToVendorIdr: number;
  customsValueIdr: number;
}): number {
  return params.paidToVendorIdr > 0
    ? params.paidToVendorIdr
    : Math.max(0, params.customsValueIdr);
}

/**
 * Signed Rupiah for Head Office. Positive = paid more (expense).
 * Negative = paid less (income). Warehouse stays on the Booking Rate.
 */
export function importRateDifferenceIdr(params: {
  factoryCurrencyFxSum: number;
  bookingRate: number;
  bankRate: number;
}): number {
  const fx = moneyOrZero(params.factoryCurrencyFxSum);
  const booking = moneyOrZero(params.bookingRate);
  const bank = moneyOrZero(params.bankRate);
  if (fx <= 0 || booking <= 0 || bank <= 0) return 0;
  return Math.round((bank - booking) * fx);
}

/** Cash remittance fees stay in warehouse. Net settlement fees do not. */
export function importRemittanceFeesGoToWarehouse(invoice: {
  paidAt?: Date | string | null;
  paymentTermsDays?: number | null;
  paidExchangeRateToIdr?: unknown;
}): boolean {
  if (invoice.paidAt == null || invoice.paidAt === "") return false;
  if (moneyOrZero(invoice.paidExchangeRateToIdr) > 0) return false;
  return (invoice.paymentTermsDays ?? 0) === 0;
}

export function summarizeImportVendorRemittance(input: {
  foreignAmount: number;
  currency?: string | null;
  /** Factory Invoice already stored in Rupiah, if the foreign amount is missing. */
  invoiceAmountIdr?: number | null;
  exchangeRateToIdr: number;
  freightCurrency?: string | null;
  freightForeignAmount?: number | null;
  freightIdr?: number | null;
  freightIncludedInInvoice?: boolean | null;
  freightRateToIdr?: number | null;
  insuranceCurrency?: string | null;
  insuranceForeignAmount?: number | null;
  insuranceIdr?: number | null;
  insuranceIncludedInInvoice?: boolean | null;
  insuranceRateToIdr?: number | null;
  bankFeeCurrency?: string | null;
  bankFeeForeignAmount?: number | null;
  bankFeeIdr?: number | null;
  fullAmountFeeCurrency?: string | null;
  fullAmountFeeForeignAmount?: number | null;
  fullAmountFeeIdr?: number | null;
  localBankFeeIdr?: number | null;
}): ImportVendorRemittance {
  const bankRate = moneyOrZero(input.exchangeRateToIdr);
  const factoryCurrency = normalizeImportCurrency(input.currency, "USD");
  const factoryForeign = moneyOrZero(input.foreignAmount);
  const factory: ImportVendorLine = {
    currency: factoryForeign > 0 ? factoryCurrency : "IDR",
    foreignAmount: factoryForeign > 0 ? factoryForeign : null,
    storedAsIdr: factoryForeign <= 0,
    includedInInvoice: true,
    vendorIdr:
      factoryForeign > 0
        ? roundIdr(factoryForeign * bankRate)
        : roundIdr(moneyOrZero(input.invoiceAmountIdr)),
  };
  const freightIncluded = input.freightIncludedInInvoice !== false;
  const insuranceIncluded = input.insuranceIncludedInInvoice !== false;
  const freight = vendorLine({
    currency: input.freightCurrency,
    foreignAmount: input.freightForeignAmount,
    storedIdr: input.freightIdr,
    bankRate,
    fallbackCurrency: factoryCurrency,
    includedInInvoice: freightIncluded,
    ownRateToIdr: input.freightRateToIdr,
  });
  const insurance = vendorLine({
    currency: input.insuranceCurrency,
    foreignAmount: input.insuranceForeignAmount,
    storedIdr: input.insuranceIdr,
    bankRate,
    fallbackCurrency: factoryCurrency,
    includedInInvoice: insuranceIncluded,
    ownRateToIdr: input.insuranceRateToIdr,
  });
  const bankCharge = vendorLine({
    currency: input.bankFeeCurrency,
    foreignAmount: input.bankFeeForeignAmount,
    storedIdr: input.bankFeeIdr,
    bankRate,
    fallbackCurrency: factoryCurrency,
    includedInInvoice: true,
  });

  let factoryCurrencyFxSum = factory.storedAsIdr ? 0 : factoryForeign;
  let extraIdr = factory.storedAsIdr ? factory.vendorIdr : 0;
  let separateFreightIdr = 0;
  let separateInsuranceIdr = 0;
  for (const line of [freight, insurance, bankCharge]) {
    if (!line.includedInInvoice) {
      if (line === freight) separateFreightIdr += line.vendorIdr;
      if (line === insurance) separateInsuranceIdr += line.vendorIdr;
      continue;
    }
    if (line.storedAsIdr) {
      extraIdr += line.vendorIdr;
      continue;
    }
    if (line.currency === factoryCurrency && line.foreignAmount != null) {
      factoryCurrencyFxSum += line.foreignAmount;
      continue;
    }
    extraIdr += line.vendorIdr;
  }

  const amountSentIdr = roundIdr(factoryCurrencyFxSum * bankRate) + extraIdr;
  const telexIdr = roundIdr(moneyOrZero(input.localBankFeeIdr));
  const fullAmountFeeIdr = convertImportAmountToIdr({
    foreignAmount: input.fullAmountFeeForeignAmount,
    currency: input.fullAmountFeeCurrency,
    exchangeRateToIdr: bankRate,
    amountIdr: input.fullAmountFeeIdr,
  });

  return {
    factory,
    freight,
    insurance,
    bankCharge,
    bankRate,
    factoryCurrencyFxSum,
    factoryCurrency,
    amountSentIdr,
    telexIdr,
    fullAmountFeeIdr,
    separateFreightIdr,
    separateInsuranceIdr,
    paidToVendorIdr:
      amountSentIdr +
      telexIdr +
      fullAmountFeeIdr +
      separateFreightIdr +
      separateInsuranceIdr,
  };
}

export function pph22RatePercentForBasis(
  basis: ImportPph22Basis,
  customPercent?: number
): number {
  if (basis === "API") return IMPORT_PPH22_API_RATE_PERCENT;
  if (basis === "WITHOUT_API") return IMPORT_PPH22_NON_API_RATE_PERCENT;
  return rateOrZero(customPercent);
}

export function parseImportDecimal(raw: string | null | undefined): number | null {
  const cleaned = String(raw ?? "")
    .replace(/[^\d.,-]/g, "")
    .trim();
  if (!cleaned) return null;
  let normalized = cleaned;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const parts = cleaned.split(",");
    normalized =
      parts.length === 2 && parts[1]!.length <= 4
        ? `${parts[0]!.replace(/\./g, "")}.${parts[1]}`
        : cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export function calculateImportLandedCost(
  input: ImportLandedCostInput
): ImportLandedCostResult {
  const remittance = summarizeImportVendorRemittance(input);
  const invoiceAmountIdr = remittance.factory.vendorIdr;
  const cif = summarizeImportCif(input);
  const customsInvoiceAmountIdr = cif.invoiceIdr;
  const freightIdr = cif.freightIdr;
  const insuranceIdr = cif.insuranceIdr;
  const vendorFreightIdr = remittance.freight.vendorIdr;
  const vendorInsuranceIdr = remittance.insurance.vendorIdr;
  const bankChargeIdr = remittance.bankCharge.vendorIdr;
  const fullAmountFeeIdr = remittance.fullAmountFeeIdr;
  const localBankFeeIdr = remittance.telexIdr;
  const bankFeeIdr = bankChargeIdr + fullAmountFeeIdr + localBankFeeIdr;
  const amountSentIdr = remittance.amountSentIdr;
  const paidToVendorIdr = remittance.paidToVendorIdr;
  const clearanceCostIdr = roundIdr(moneyOrZero(input.clearanceCostIdr));
  const customsValueIdr = customsInvoiceAmountIdr + freightIdr + insuranceIdr;

  const formEApplied = Boolean(input.formEApplied);
  const beaMasukApplied = Boolean(input.beaMasukApplied);
  const beaMasukRatePercent = beaMasukApplied
    ? rateOrZero(input.beaMasukRatePercent)
    : 0;
  const beaMasukAmountIdr = overrideOrComputed(
    beaMasukApplied,
    input.beaMasukAmountIdr,
    roundIdr(customsValueIdr * (beaMasukRatePercent / 100))
  );

  const importValueIdr = customsValueIdr + beaMasukAmountIdr;

  const ppnbmApplied = Boolean(input.ppnbmApplied);
  const ppnbmRatePercent = ppnbmApplied ? rateOrZero(input.ppnbmRatePercent) : 0;
  const ppnbmAmountIdr = overrideOrComputed(
    ppnbmApplied,
    input.ppnbmAmountIdr,
    roundIdr(importValueIdr * (ppnbmRatePercent / 100))
  );

  const ppnApplied = Boolean(input.ppnApplied);
  const ppnRatePercent = ppnApplied
    ? rateOrZero(input.ppnRatePercent) || DEFAULT_PRODUCT_PPN_RATE_PERCENT
    : 0;
  const ppnAmountIdr = overrideOrComputed(
    ppnApplied,
    input.ppnAmountIdr,
    roundIdr(importValueIdr * (ppnRatePercent / 100))
  );

  const pph22Applied = Boolean(input.pph22Applied);
  const pph22Basis: ImportPph22Basis = input.pph22Basis ?? "API";
  const pph22RatePercent = pph22Applied
    ? pph22RatePercentForBasis(pph22Basis, input.pph22RatePercent)
    : 0;
  const pph22AmountIdr = overrideOrComputed(
    pph22Applied,
    input.pph22AmountIdr,
    roundIdr(importValueIdr * (pph22RatePercent / 100))
  );

  const dutiesTotalIdr =
    beaMasukAmountIdr + ppnbmAmountIdr + ppnAmountIdr + pph22AmountIdr;
  const factoryPortionIdr = importWarehouseFactoryPortionIdr({
    paidToVendorIdr,
    customsValueIdr,
  });
  const stockLandedCostIdr =
    factoryPortionIdr +
    clearanceCostIdr +
    beaMasukAmountIdr +
    ppnbmAmountIdr;
  const cashOutIdr = stockLandedCostIdr + ppnAmountIdr + pph22AmountIdr;

  return {
    invoiceAmountIdr,
    customsInvoiceAmountIdr,
    freightIdr,
    insuranceIdr,
    vendorFreightIdr,
    vendorInsuranceIdr,
    bankChargeIdr,
    fullAmountFeeIdr,
    localBankFeeIdr,
    bankFeeIdr,
    amountSentIdr,
    paidToVendorIdr,
    remittance,
    clearanceCostIdr,
    cifForeignAmount: cif.cifForeignAmount,
    cifCurrency: cif.cifCurrency,
    cifForeignLines: cif.foreignLines,
    cifIdrExtra: cif.idrAmount,
    appliedCustomsRates: cif.appliedCustomsRates,
    customsValueIdr,
    formEApplied,
    beaMasukApplied,
    beaMasukRatePercent,
    beaMasukAmountIdr,
    ppnbmApplied,
    ppnbmRatePercent,
    ppnbmAmountIdr,
    importValueIdr,
    ppnApplied,
    ppnRatePercent,
    ppnAmountIdr,
    pph22Applied,
    pph22Basis,
    pph22RatePercent,
    pph22AmountIdr,
    dutiesTotalIdr,
    stockLandedCostIdr,
    cashOutIdr,
  };
}

export function allocateImportStockCost(params: {
  stockLandedCostIdr: number;
  headerForeignAmount: number;
  lines: ImportStockAllocationLine[];
}): ImportStockAllocatedLine[] {
  const stock = roundIdr(params.stockLandedCostIdr);
  const lines = params.lines.filter((line) => line.quantity > 0);
  if (lines.length === 0) return [];

  const weights = lines.map((line) => {
    if (line.foreignAmount != null && line.foreignAmount > 0) {
      return line.foreignAmount;
    }
    return line.quantity;
  });
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightTotal <= 0) {
    return lines.map((line) => ({
      quantity: line.quantity,
      foreignAmount: 0,
      unitCostIdr: 0,
      totalCostIdr: 0,
    }));
  }

  const allocated: ImportStockAllocatedLine[] = [];
  let used = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const isLast = i === lines.length - 1;
    const totalCostIdr = isLast
      ? Math.max(0, stock - used)
      : roundIdr(stock * (weights[i]! / weightTotal));
    used += totalCostIdr;
    allocated.push({
      quantity: line.quantity,
      foreignAmount:
        line.foreignAmount != null && line.foreignAmount > 0
          ? line.foreignAmount
          : params.headerForeignAmount * (weights[i]! / weightTotal),
      totalCostIdr,
      unitCostIdr:
        line.quantity > 0
          ? Math.round((totalCostIdr / line.quantity) * 100) / 100
          : 0,
    });
  }
  return allocated;
}

export type ImportFormPayload = ImportLandedCostInput & {
  currency: string;
};

export function parseImportFormPayload(
  raw: string,
  options?: { requireCustomsRates?: boolean; requireBankRate?: boolean }
): ImportFormPayload {
  const requireCustomsRates = options?.requireCustomsRates === true;
  const requireBankRate = options?.requireBankRate !== false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Enter the overseas factory invoice amount.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Enter the overseas factory invoice amount.");
  }
  const row = parsed as Record<string, unknown>;
  const declaredValue = numberOrUndefined(row.declaredValue);
  const hasDeclared = moneyOrZero(declaredValue) > 0;
  const declaredCurrency = hasDeclared
    ? normalizeImportCurrency(String(row.declaredCurrency ?? ""), "IDR")
    : undefined;
  const declaredCustomsRate = hasDeclared
    ? numberOrUndefined(row.declaredCustomsRate)
    : undefined;
  if (hasDeclared && declaredCurrency !== "IDR") {
    if (moneyOrZero(declaredCustomsRate) <= 0) {
      throw new Error("Enter the Customs Rate for this declared value.");
    }
  }
  const foreignAmount = Number(row.foreignAmount);
  const exchangeRateToIdr = Number(row.exchangeRateToIdr);
  if (!hasDeclared) {
    if (!Number.isFinite(foreignAmount) || foreignAmount <= 0) {
      throw new Error("Enter the overseas invoice amount.");
    }
    if (
      requireBankRate &&
      (!Number.isFinite(exchangeRateToIdr) || exchangeRateToIdr <= 0)
    ) {
      throw new Error("Enter the Bank Rate.");
    }
  } else if (Number.isFinite(foreignAmount) && foreignAmount < 0) {
    throw new Error("Enter the overseas invoice amount.");
  }
  const currency = hasDeclared
    ? declaredCurrency === "IDR"
      ? "USD"
      : declaredCurrency!
    : String(row.currency ?? "USD").trim().toUpperCase() || "USD";
  const freightCurrency = optionalCurrency(row.freightCurrency, currency);
  const insuranceCurrency = optionalCurrency(row.insuranceCurrency, currency);
  const freightForeignAmount = numberOrUndefined(row.freightForeignAmount);
  const insuranceForeignAmount = numberOrUndefined(row.insuranceForeignAmount);
  const customsRatesToIdr = resolveImportCustomsRates({
    currency,
    customsRateToIdr: numberOrUndefined(row.customsRateToIdr),
    customsRatesToIdr: parseCustomsRatesMap(row.customsRatesToIdr),
  });
  const freightIncludedInInvoice = row.freightIncludedInInvoice !== false;
  const insuranceIncludedInInvoice = row.insuranceIncludedInInvoice !== false;
  const freightRateToIdr = numberOrUndefined(row.freightRateToIdr);
  const freightCustomsRateToIdr = numberOrUndefined(row.freightCustomsRateToIdr);
  const insuranceRateToIdr = numberOrUndefined(row.insuranceRateToIdr);
  const insuranceCustomsRateToIdr = numberOrUndefined(
    row.insuranceCustomsRateToIdr
  );
  requireSeparateFxRates({
    included: freightIncludedInInvoice,
    currency: freightCurrency,
    amount: freightForeignAmount,
    bankRate: freightRateToIdr,
    customsRate: freightCustomsRateToIdr,
    label: "Freight",
    requireBankRate,
    requireCustomsRate: requireCustomsRates,
  });
  requireSeparateFxRates({
    included: insuranceIncludedInInvoice,
    currency: insuranceCurrency,
    amount: insuranceForeignAmount,
    bankRate: insuranceRateToIdr,
    customsRate: insuranceCustomsRateToIdr,
    label: "Insurance",
    requireBankRate,
    requireCustomsRate: requireCustomsRates,
  });
  if (
    !freightIncludedInInvoice &&
    freightCurrency !== "IDR" &&
    moneyOrZero(freightForeignAmount) > 0 &&
    moneyOrZero(freightCustomsRateToIdr) > 0 &&
    (freightCurrency !== currency ||
      moneyOrZero(customsRatesToIdr[freightCurrency]) <= 0)
  ) {
    customsRatesToIdr[freightCurrency] = moneyOrZero(freightCustomsRateToIdr);
  }
  if (
    !insuranceIncludedInInvoice &&
    insuranceCurrency !== "IDR" &&
    moneyOrZero(insuranceForeignAmount) > 0 &&
    moneyOrZero(insuranceCustomsRateToIdr) > 0 &&
    (insuranceCurrency !== currency ||
      moneyOrZero(customsRatesToIdr[insuranceCurrency]) <= 0)
  ) {
    customsRatesToIdr[insuranceCurrency] = moneyOrZero(
      insuranceCustomsRateToIdr
    );
  }
  if (hasDeclared && declaredCurrency && declaredCurrency !== "IDR") {
    customsRatesToIdr[declaredCurrency] = moneyOrZero(declaredCustomsRate);
  }
  let customsRateToIdr = moneyOrZero(customsRatesToIdr[currency]);
  if (!hasDeclared && requireCustomsRates) {
    const factoryCustomsNeeded = listImportCifFxCurrencies({
      currency,
      foreignAmount,
      freightCurrency: freightIncludedInInvoice ? freightCurrency : currency,
      freightForeignAmount: freightIncludedInInvoice
        ? freightForeignAmount
        : undefined,
      insuranceCurrency: insuranceIncludedInInvoice
        ? insuranceCurrency
        : currency,
      insuranceForeignAmount: insuranceIncludedInInvoice
        ? insuranceForeignAmount
        : undefined,
    });
    for (const code of factoryCustomsNeeded) {
      if (moneyOrZero(customsRatesToIdr[code]) <= 0) {
        throw new Error(`Enter the Customs Rate (${code}).`);
      }
    }
    customsRateToIdr = moneyOrZero(customsRatesToIdr[currency]);
    if (customsRateToIdr <= 0) {
      throw new Error("Enter the Customs Rate.");
    }
  }
  const pph22BasisRaw = String(row.pph22Basis ?? "API").toUpperCase();
  const pph22Basis: ImportPph22Basis =
    pph22BasisRaw === "WITHOUT_API" || pph22BasisRaw === "CUSTOM"
      ? pph22BasisRaw
      : "API";

  return {
    currency,
    foreignAmount:
      hasDeclared && (!Number.isFinite(foreignAmount) || foreignAmount < 0)
        ? 0
        : Number.isFinite(foreignAmount)
          ? foreignAmount
          : 0,
    exchangeRateToIdr:
      hasDeclared &&
      (!Number.isFinite(exchangeRateToIdr) || exchangeRateToIdr < 0)
        ? 0
        : Number.isFinite(exchangeRateToIdr)
          ? exchangeRateToIdr
          : 0,
    declaredValue,
    declaredCurrency,
    declaredCustomsRate:
      declaredCurrency === "IDR" ? undefined : declaredCustomsRate,
    customsRateToIdr,
    customsRatesToIdr,
    freightIncludedInInvoice,
    freightCurrency,
    freightForeignAmount,
    freightIdr: numberOrUndefined(row.freightIdr),
    freightRateToIdr,
    freightCustomsRateToIdr,
    insuranceIncludedInInvoice,
    insuranceCurrency,
    insuranceForeignAmount,
    insuranceIdr: numberOrUndefined(row.insuranceIdr),
    insuranceRateToIdr,
    insuranceCustomsRateToIdr,
    bankFeeCurrency: optionalCurrency(row.bankFeeCurrency, currency),
    bankFeeForeignAmount: numberOrUndefined(row.bankFeeForeignAmount),
    bankFeeIdr: numberOrUndefined(row.bankFeeIdr),
    fullAmountFeeCurrency: optionalCurrency(row.fullAmountFeeCurrency, "USD"),
    fullAmountFeeForeignAmount: numberOrUndefined(
      row.fullAmountFeeForeignAmount
    ),
    fullAmountFeeIdr: numberOrUndefined(row.fullAmountFeeIdr),
    localBankFeeIdr: numberOrUndefined(row.localBankFeeIdr),
    clearanceCostIdr: 0,
    formEApplied: row.formEApplied === true,
    beaMasukApplied: row.beaMasukApplied === true,
    beaMasukRatePercent: numberOrUndefined(row.beaMasukRatePercent),
    beaMasukAmountIdr: numberOrNull(row.beaMasukAmountIdr),
    ppnbmApplied: row.ppnbmApplied === true,
    ppnbmRatePercent: numberOrUndefined(row.ppnbmRatePercent),
    ppnbmAmountIdr: numberOrNull(row.ppnbmAmountIdr),
    ppnApplied: row.ppnApplied === true,
    ppnRatePercent: numberOrUndefined(row.ppnRatePercent),
    ppnAmountIdr: numberOrNull(row.ppnAmountIdr),
    pph22Applied: row.pph22Applied === true,
    pph22Basis,
    pph22RatePercent: numberOrUndefined(row.pph22RatePercent),
    pph22AmountIdr: numberOrNull(row.pph22AmountIdr),
  };
}

function requireSeparateFxRates(params: {
  included: boolean;
  currency: string;
  amount: number | undefined;
  bankRate: number | undefined;
  customsRate: number | undefined;
  label: string;
  requireBankRate?: boolean;
  requireCustomsRate?: boolean;
}) {
  if (params.included) return;
  if (params.currency === "IDR") return;
  if (moneyOrZero(params.amount) <= 0) return;
  if (params.requireBankRate !== false && moneyOrZero(params.bankRate) <= 0) {
    throw new Error(`Enter the ${params.label} Bank Rate.`);
  }
  if (
    params.requireCustomsRate !== false &&
    moneyOrZero(params.customsRate) <= 0
  ) {
    throw new Error(`Enter the ${params.label} Customs Rate.`);
  }
}

function optionalCurrency(value: unknown, fallback: string): string {
  return normalizeImportCurrency(
    typeof value === "string" ? value : null,
    fallback
  );
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function purchaseImportInputVat(params: {
  origin: "LOCAL" | "IMPORT";
  amount: number;
  includesPpn: boolean;
  ppnRatePercent: number | null;
  importPpnAmountIdr: number | null;
  importValueIdr: number | null;
}): { gross: number; dpp: number; ppn: number; rate: number } {
  const rate =
    params.ppnRatePercent != null && params.ppnRatePercent > 0
      ? params.ppnRatePercent / 100
      : 0.11;
  if (
    params.origin === "IMPORT" &&
    params.importPpnAmountIdr != null &&
    params.importPpnAmountIdr >= 0
  ) {
    const ppn = roundIdr(params.importPpnAmountIdr);
    const dpp = roundIdr(params.importValueIdr ?? Math.max(0, params.amount - ppn));
    return { gross: dpp + ppn, dpp, ppn, rate };
  }
  const gross = roundIdr(params.amount);
  if (!params.includesPpn || rate <= 0) {
    return { gross, dpp: gross, ppn: 0, rate };
  }
  const dpp = Math.round(gross / (1 + rate));
  return { gross, dpp, ppn: gross - dpp, rate };
}
