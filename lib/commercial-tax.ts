import {
  applyExclusiveVat,
  DEFAULT_PRODUCT_PPN_RATE_PERCENT,
  parsePpnRatePercent,
  ppnRateFromPercent,
} from "@/lib/vat";

export const COMMERCIAL_TAX_KINDS = [
  "PPN",
  "PPH_23",
  "PPN_AND_PPH_23",
  "PPH_4_2",
  "PPN_AND_PPH_4_2",
  "PPH_21",
  "PPH_22",
  "PPH_26",
  "STAMP_DUTY",
  "PBB",
  "OTHER",
] as const;

export type CommercialTaxKind = (typeof COMMERCIAL_TAX_KINDS)[number];

/**
 * Expense / project picker. Keeps combos that appear on one invoice.
 * Hidden kinds stay valid on old records.
 */
export const COMMERCIAL_TAX_KIND_OPTIONS = [
  "PPN",
  "PPH_21",
  "PPH_23",
  "PPN_AND_PPH_23",
  "PPH_4_2",
  "PPN_AND_PPH_4_2",
  "PPH_22",
  "PBB",
  "STAMP_DUTY",
] as const satisfies readonly CommercialTaxKind[];

/** Usual Article 23 withholding on services. */
export const DEFAULT_PPH_23_RATE_PERCENT = 2;

export function isCommercialTaxKind(
  value: string | null | undefined
): value is CommercialTaxKind {
  return (COMMERCIAL_TAX_KINDS as readonly string[]).includes(
    String(value ?? "").trim().toUpperCase()
  );
}

export function commercialTaxKindPickerOptions(
  current?: CommercialTaxKind | "" | null
): CommercialTaxKind[] {
  const options: CommercialTaxKind[] = [...COMMERCIAL_TAX_KIND_OPTIONS];
  if (current && isCommercialTaxKind(current) && !options.includes(current)) {
    options.push(current);
  }
  return options;
}

export function parseCommercialTaxKind(
  value: FormDataEntryValue | string | null | undefined
): CommercialTaxKind {
  const raw = String(value ?? "").trim().toUpperCase();
  if (isCommercialTaxKind(raw)) return raw;
  throw new Error("Select the tax type.");
}

export function commercialTaxIncludesVat(
  kind: CommercialTaxKind | null | undefined
): boolean {
  return (
    kind === "PPN" || kind === "PPN_AND_PPH_23" || kind === "PPN_AND_PPH_4_2"
  );
}

export function commercialTaxIncludesWithholding(
  kind: CommercialTaxKind | null | undefined
): boolean {
  return (
    kind === "PPH_23" ||
    kind === "PPN_AND_PPH_23" ||
    kind === "PPH_21" ||
    kind === "PPH_22" ||
    kind === "PPH_26"
  );
}

export function commercialTaxIncludesFinalIncomeTax(
  kind: CommercialTaxKind | null | undefined
): boolean {
  return kind === "PPH_4_2" || kind === "PPN_AND_PPH_4_2";
}

export function commercialTaxIncludesIncomeTax(
  kind: CommercialTaxKind | null | undefined
): boolean {
  return (
    commercialTaxIncludesWithholding(kind) ||
    commercialTaxIncludesFinalIncomeTax(kind)
  );
}

export function commercialTaxRequiresRatePercent(
  kind: CommercialTaxKind | null | undefined
): boolean {
  return commercialTaxIncludesIncomeTax(kind) || kind === "OTHER";
}

export function commercialTaxRequiresOtherName(
  kind: CommercialTaxKind | null | undefined
): boolean {
  return kind === "OTHER";
}

export function commercialTaxRequiresTaxInvoice(
  kind: CommercialTaxKind | null | undefined
): boolean {
  return commercialTaxIncludesVat(kind);
}

export function defaultCommercialNonVatRatePercent(
  kind: CommercialTaxKind | null | undefined
): number | null {
  if (kind === "PPH_23" || kind === "PPN_AND_PPH_23") {
    return DEFAULT_PPH_23_RATE_PERCENT;
  }
  return null;
}

export function parseCommercialPphRatePercent(
  value: FormDataEntryValue | string | null | undefined
): number {
  const parsed = parsePpnRatePercent(String(value ?? ""));
  if (parsed == null) {
    throw new Error("Enter the tax rate percent.");
  }
  return parsed;
}

export function parseOtherTaxName(
  value: FormDataEntryValue | string | null | undefined,
  kind: CommercialTaxKind | null | undefined
): string | null {
  if (!commercialTaxRequiresOtherName(kind)) return null;
  const name = String(value ?? "").trim();
  if (!name) throw new Error("Enter the tax name.");
  return name;
}

export function commercialTaxKindLabelKey(
  kind: CommercialTaxKind
):
  | "pages.billing.commercialTaxKindPpn"
  | "pages.billing.commercialTaxKindPph23"
  | "pages.billing.commercialTaxKindPpnAndPph23"
  | "pages.billing.commercialTaxKindPph42"
  | "pages.billing.commercialTaxKindPpnAndPph42"
  | "pages.billing.commercialTaxKindPph21"
  | "pages.billing.commercialTaxKindPph22"
  | "pages.billing.commercialTaxKindPph26"
  | "pages.billing.commercialTaxKindStampDuty"
  | "pages.billing.commercialTaxKindPbb"
  | "pages.billing.commercialTaxKindOther" {
  switch (kind) {
    case "PPN":
      return "pages.billing.commercialTaxKindPpn";
    case "PPH_23":
      return "pages.billing.commercialTaxKindPph23";
    case "PPN_AND_PPH_23":
      return "pages.billing.commercialTaxKindPpnAndPph23";
    case "PPH_4_2":
      return "pages.billing.commercialTaxKindPph42";
    case "PPN_AND_PPH_4_2":
      return "pages.billing.commercialTaxKindPpnAndPph42";
    case "PPH_21":
      return "pages.billing.commercialTaxKindPph21";
    case "PPH_22":
      return "pages.billing.commercialTaxKindPph22";
    case "PPH_26":
      return "pages.billing.commercialTaxKindPph26";
    case "STAMP_DUTY":
      return "pages.billing.commercialTaxKindStampDuty";
    case "PBB":
      return "pages.billing.commercialTaxKindPbb";
    default:
      return "pages.billing.commercialTaxKindOther";
  }
}

export function projectChargedTaxKindFromRecord(project: {
  chargedTaxKind?: CommercialTaxKind | null;
  requiresTaxInvoice?: boolean | null;
}): CommercialTaxKind | "" {
  if (isCommercialTaxKind(project.chargedTaxKind)) {
    return project.chargedTaxKind;
  }
  if (project.requiresTaxInvoice) return "PPN";
  return "";
}

export function parseProjectChargedTax(formData: FormData): {
  chargedTaxKind: CommercialTaxKind;
  requiresTaxInvoice: boolean;
  pphRatePercent: number | null;
  otherTaxName: string | null;
} {
  const chargedTaxKind = parseCommercialTaxKind(formData.get("chargedTaxKind"));
  return {
    chargedTaxKind,
    requiresTaxInvoice: commercialTaxRequiresTaxInvoice(chargedTaxKind),
    pphRatePercent: commercialTaxRequiresRatePercent(chargedTaxKind)
      ? parseCommercialPphRatePercent(formData.get("pphRatePercent"))
      : null,
    otherTaxName: parseOtherTaxName(formData.get("otherTaxName"), chargedTaxKind),
  };
}

export type ExclusiveChargedTaxBreakdown = {
  exclusive: number;
  taxAmount: number;
  gross: number;
};

/**
 * Contract / invoice typed amounts are exclusive of tax.
 * Add Value Added Tax and final / other charged tax. Withholding is not added.
 */
export function exclusivePricePlusChargedTax(input: {
  exclusiveAmount: number;
  chargedTaxKind?: CommercialTaxKind | "" | null;
  requiresTaxInvoice?: boolean | null;
  ppnRatePercent?: number | null;
  pphRatePercent?: number | null;
}): ExclusiveChargedTaxBreakdown {
  const exclusive = Math.max(0, Math.round(input.exclusiveAmount));
  if (exclusive <= 0) {
    return { exclusive: 0, taxAmount: 0, gross: 0 };
  }

  const kind =
    projectChargedTaxKindFromRecord({
      chargedTaxKind: isCommercialTaxKind(input.chargedTaxKind)
        ? input.chargedTaxKind
        : null,
      requiresTaxInvoice: input.requiresTaxInvoice,
    }) || null;

  let taxAmount = 0;
  if (commercialTaxIncludesVat(kind)) {
    const vatRate =
      input.ppnRatePercent != null && input.ppnRatePercent > 0
        ? input.ppnRatePercent
        : DEFAULT_PRODUCT_PPN_RATE_PERCENT;
    taxAmount += applyExclusiveVat(exclusive, ppnRateFromPercent(vatRate)).ppn;
  }
  if (
    kind === "PPH_4_2" ||
    kind === "PPN_AND_PPH_4_2" ||
    kind === "OTHER"
  ) {
    const rate = input.pphRatePercent;
    if (rate != null && rate > 0) {
      taxAmount += Math.round(exclusive * (rate / 100));
    }
  }

  return {
    exclusive,
    taxAmount,
    gross: exclusive + taxAmount,
  };
}

export function invoiceGrossFromExclusivePrice(
  exclusiveAmount: number | null | undefined,
  project: {
    chargedTaxKind?: CommercialTaxKind | "" | null;
    requiresTaxInvoice?: boolean | null;
    pphRatePercent?: number | null;
  },
  ppnRatePercent?: number | null
): number | null {
  if (exclusiveAmount == null || !Number.isFinite(exclusiveAmount) || exclusiveAmount <= 0) {
    return null;
  }
  return exclusivePricePlusChargedTax({
    exclusiveAmount,
    chargedTaxKind: project.chargedTaxKind,
    requiresTaxInvoice: project.requiresTaxInvoice,
    ppnRatePercent,
    pphRatePercent: project.pphRatePercent,
  }).gross;
}
