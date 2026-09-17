export const TAX_RATE_CODE = {
  PPN: "PPN",
  PPH_BADAN: "PPH_BADAN",
  PPH_21: "PPH_21",
  PPH_22: "PPH_22",
  PPH_23: "PPH_23",
  PPH_26: "PPH_26",
  PPH_4_2: "PPH_4_2",
} as const;

export type TaxRateCodeValue =
  (typeof TAX_RATE_CODE)[keyof typeof TAX_RATE_CODE];

export const TAX_RATE_MISSING = "TAX_RATE_MISSING";

export type TaxRateAppliesToValue = "CLIENT_CHARGE" | "CORPORATE";

export type TaxRateVersionView = {
  id: string;
  ratePercent: number;
  effectiveFrom: string;
  note: string | null;
  createdAt: string;
};

export type TaxRateTypeView = {
  id: string;
  code: string;
  name: string;
  appliesTo: TaxRateAppliesToValue;
  commercialKind: string | null;
  isSystem: boolean;
  currentPercent: number | null;
  currentFrom: string | null;
  versions: TaxRateVersionView[];
};

export type TaxRatePickerRow = {
  code: string;
  name: string;
  appliesTo: TaxRateAppliesToValue;
  commercialKind: string | null;
  isSystem: boolean;
  ratePercent: number;
  effectiveFrom: string;
};

export function isTaxRateMissing(error: unknown): boolean {
  return error instanceof Error && error.name === TAX_RATE_MISSING;
}

export function taxRateMissingError(): Error {
  const error = new Error(TAX_RATE_MISSING);
  error.name = TAX_RATE_MISSING;
  return error;
}

export function formatTaxRatePercent(percent: number): string {
  const rounded = Math.round(percent * 10000) / 10000;
  return `${rounded}%`;
}

export function slugTaxRateCode(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "CUSTOM";
}

export function pphTaxCodeFromChargedKind(
  kind: string | null | undefined,
  taxRateCode?: string | null
): string | null {
  const raw = String(kind ?? "").trim().toUpperCase();
  if (raw === "PPH_23" || raw === "PPN_AND_PPH_23") return TAX_RATE_CODE.PPH_23;
  if (raw === "PPH_4_2" || raw === "PPN_AND_PPH_4_2") return TAX_RATE_CODE.PPH_4_2;
  if (raw === "PPH_21") return TAX_RATE_CODE.PPH_21;
  if (raw === "PPH_22") return TAX_RATE_CODE.PPH_22;
  if (raw === "PPH_26") return TAX_RATE_CODE.PPH_26;
  if (raw === "OTHER") {
    const code = String(taxRateCode ?? "").trim().toUpperCase();
    return code || null;
  }
  return null;
}

export function chargedKindUsesPpn(kind: string | null | undefined): boolean {
  const raw = String(kind ?? "").trim().toUpperCase();
  return raw === "PPN" || raw === "PPN_AND_PPH_23" || raw === "PPN_AND_PPH_4_2";
}

export function isCustomTaxRateType(row: {
  isSystem: boolean;
  commercialKind: string | null;
}): boolean {
  return !row.isSystem || row.commercialKind === "OTHER";
}
