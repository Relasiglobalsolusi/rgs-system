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
  "PPH_26",
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

/** Project form: Charge VAT? + Charge PPh? → stored chargedTaxKind. */
export type ProjectPphKind =
  | "PPH_23"
  | "PPH_4_2"
  | "PPH_21"
  | "PPH_22"
  | "PPH_26";

export function isProjectPphKind(
  value: string | null | undefined
): value is ProjectPphKind {
  return (
    value === "PPH_23" ||
    value === "PPH_4_2" ||
    value === "PPH_21" ||
    value === "PPH_22" ||
    value === "PPH_26"
  );
}

export function chargedTaxKindFromVatPph(input: {
  chargeVat: boolean;
  chargePph: boolean;
  pphKind?: string | null;
}): CommercialTaxKind | "" {
  if (!input.chargePph && !input.chargeVat) return "";
  if (input.pphKind && !isProjectPphKind(input.pphKind)) {
    if (input.chargePph) return "OTHER";
    return input.chargeVat ? "PPN" : "";
  }
  const pph = isProjectPphKind(input.pphKind) ? input.pphKind : "PPH_23";
  if (input.chargeVat && input.chargePph) {
    if (pph === "PPH_4_2") return "PPN_AND_PPH_4_2";
    if (pph === "PPH_23") return "PPN_AND_PPH_23";
    return "OTHER";
  }
  if (input.chargeVat) return "PPN";
  if (input.chargePph) return pph;
  return "";
}

export function vatPphFromChargedTaxKind(kind: CommercialTaxKind | "" | null) {
  const resolved = kind || null;
  const chargeVat = commercialTaxIncludesVat(resolved);
  const chargePph =
    commercialTaxIncludesIncomeTax(resolved) || resolved === "OTHER";
  let pphKind: ProjectPphKind | string = "PPH_23";
  if (kind === "PPH_4_2" || kind === "PPN_AND_PPH_4_2") pphKind = "PPH_4_2";
  else if (kind === "PPH_21") pphKind = "PPH_21";
  else if (kind === "PPH_22") pphKind = "PPH_22";
  else if (kind === "PPH_26") pphKind = "PPH_26";
  else if (kind === "OTHER") pphKind = "OTHER";
  return { chargeVat, chargePph, pphKind };
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
  taxRateCode: string | null;
} {
  const chargedTaxKind = parseCommercialTaxKind(formData.get("chargedTaxKind"));
  const taxRateCodeRaw = String(formData.get("taxRateCode") ?? "").trim().toUpperCase();
  const pphRaw = String(formData.get("pphRatePercent") ?? "").trim();
  return {
    chargedTaxKind,
    requiresTaxInvoice: commercialTaxRequiresTaxInvoice(chargedTaxKind),
    pphRatePercent:
      commercialTaxRequiresRatePercent(chargedTaxKind) && pphRaw
        ? parseCommercialPphRatePercent(pphRaw)
        : null,
    otherTaxName: parseOtherTaxName(formData.get("otherTaxName"), chargedTaxKind),
    taxRateCode: taxRateCodeRaw || null,
  };
}

export type ExclusiveChargedTaxBreakdown = {
  exclusive: number;
  ppn: number;
  pph: number;
  taxAmount: number;
  gross: number;
};

/**
 * Contract / invoice typed amounts are exclusive of tax.
 * Commercial clients pay DPP + PPN + PPh to us; we then remit PPN and PPh.
 * Government contracts: cash in is DPP only (the institution remits tax).
 */
export function exclusivePricePlusChargedTax(input: {
  exclusiveAmount: number;
  chargedTaxKind?: CommercialTaxKind | "" | null;
  requiresTaxInvoice?: boolean | null;
  ppnRatePercent?: number | null;
  pphRatePercent?: number | null;
  isGovernmentContract?: boolean | null;
}): ExclusiveChargedTaxBreakdown {
  const exclusive = Math.max(0, Math.round(input.exclusiveAmount));
  if (exclusive <= 0) {
    return { exclusive: 0, ppn: 0, pph: 0, taxAmount: 0, gross: 0 };
  }

  const kind =
    projectChargedTaxKindFromRecord({
      chargedTaxKind: isCommercialTaxKind(input.chargedTaxKind)
        ? input.chargedTaxKind
        : null,
      requiresTaxInvoice: input.requiresTaxInvoice,
    }) || "PPN";

  let ppn = 0;
  let pph = 0;
  if (!input.isGovernmentContract) {
    if (commercialTaxIncludesVat(kind)) {
      const vatRate =
        input.ppnRatePercent != null && input.ppnRatePercent > 0
          ? input.ppnRatePercent
          : DEFAULT_PRODUCT_PPN_RATE_PERCENT;
      ppn = applyExclusiveVat(exclusive, ppnRateFromPercent(vatRate)).ppn;
    }
    if (commercialTaxIncludesIncomeTax(kind) || kind === "OTHER") {
      const rate =
        input.pphRatePercent != null && input.pphRatePercent > 0
          ? input.pphRatePercent
          : defaultCommercialNonVatRatePercent(kind) ?? 0;
      if (rate > 0) {
        pph = Math.round(exclusive * (rate / 100));
      }
    }
  }

  const taxAmount = ppn + pph;
  return {
    exclusive,
    ppn,
    pph,
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
    isGovernmentContract?: boolean | null;
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
    isGovernmentContract: project.isGovernmentContract,
  }).gross;
}

/** What the client still owes: exclusive + PPN + PPh (DPP only on government jobs). */
export function invoiceDueFromExclusive(
  exclusiveAmount: number,
  project: {
    chargedTaxKind?: CommercialTaxKind | "" | null;
    requiresTaxInvoice?: boolean | null;
    pphRatePercent?: number | null;
    isGovernmentContract?: boolean | null;
  },
  ppnRatePercent?: number | null
): number {
  return exclusivePricePlusChargedTax({
    exclusiveAmount,
    chargedTaxKind: project.chargedTaxKind,
    requiresTaxInvoice: project.requiresTaxInvoice,
    ppnRatePercent,
    pphRatePercent: project.pphRatePercent,
    isGovernmentContract: project.isGovernmentContract,
  }).gross;
}
