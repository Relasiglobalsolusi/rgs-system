export const GOVERNMENT_TAX_KINDS = [
  "PPN",
  "PPH_25",
  "PPH_29",
  "PPH_21",
  "PPH_23",
  "PPH_4_2",
  "PPH_22",
  "STAMP_DUTY",
  "PBB",
  "BPJS_KESEHATAN",
  "BPJS_KETENAGAKERJAAN",
  "OTHER",
] as const;

export type GovernmentTaxKind = (typeof GOVERNMENT_TAX_KINDS)[number];

export type BpjsGovernmentKind = "BPJS_KESEHATAN" | "BPJS_KETENAGAKERJAAN";

/** Government expense picker. Hidden kinds stay valid on old records. */
export const GOVERNMENT_TAX_KIND_OPTIONS = [
  "BPJS_KESEHATAN",
  "BPJS_KETENAGAKERJAAN",
  "PPN",
  "PPH_21",
  "PPH_23",
  "PPH_4_2",
  "PPH_25",
  "PPH_29",
  "PBB",
  "PPH_22",
  "STAMP_DUTY",
] as const satisfies readonly GovernmentTaxKind[];

export const GOVERNMENT_PAYEE_DJP = "Direktorat Jenderal Pajak";
export const GOVERNMENT_PAYEE_OTHER = "Government";
export const GOVERNMENT_PAYEE_BPJS_KESEHATAN = "BPJS Kesehatan";
export const GOVERNMENT_PAYEE_BPJS_TK = "BPJS Ketenagakerjaan";

export function isGovernmentTaxKind(
  value: string | null | undefined
): value is GovernmentTaxKind {
  return (GOVERNMENT_TAX_KINDS as readonly string[]).includes(
    String(value ?? "").trim().toUpperCase()
  );
}

export function isBpjsGovernmentKind(
  value: string | null | undefined
): value is BpjsGovernmentKind {
  return value === "BPJS_KESEHATAN" || value === "BPJS_KETENAGAKERJAAN";
}

export function bpjsProgramFromGovernmentKind(
  kind: BpjsGovernmentKind
): "KESEHATAN" | "KETENAGAKERJAAN" {
  return kind === "BPJS_KESEHATAN" ? "KESEHATAN" : "KETENAGAKERJAAN";
}

export function governmentTaxKindPickerOptions(
  current?: GovernmentTaxKind | "" | null
): GovernmentTaxKind[] {
  const options: GovernmentTaxKind[] = [...GOVERNMENT_TAX_KIND_OPTIONS];
  if (current && isGovernmentTaxKind(current) && !options.includes(current)) {
    options.push(current);
  }
  return options;
}

export function parseGovernmentTaxKind(
  value: FormDataEntryValue | string | null | undefined
): GovernmentTaxKind {
  const raw = String(value ?? "").trim().toUpperCase();
  if (isGovernmentTaxKind(raw)) return raw;
  throw new Error("Select the government payment type.");
}

export function governmentPayeeName(kind: GovernmentTaxKind): string {
  if (kind === "BPJS_KESEHATAN") return GOVERNMENT_PAYEE_BPJS_KESEHATAN;
  if (kind === "BPJS_KETENAGAKERJAAN") return GOVERNMENT_PAYEE_BPJS_TK;
  return kind === "OTHER" || kind === "STAMP_DUTY" || kind === "PBB"
    ? GOVERNMENT_PAYEE_OTHER
    : GOVERNMENT_PAYEE_DJP;
}

/**
 * Final income tax (Pasal 4(2)), stamp duty, PBB, other government
 * charges, and the company share of BPJS are operating expenses.
 * Withholding remittances (21 / 23) and prepaid corporate tax
 * (22 / 25 / 29) and VAT settlement are not.
 */
export function isGovernmentOperatingExpense(
  kind: string | null | undefined
): boolean {
  return (
    kind === "STAMP_DUTY" ||
    kind === "OTHER" ||
    kind === "PPH_4_2" ||
    kind === "PBB" ||
    isBpjsGovernmentKind(kind)
  );
}

export function governmentTaxKindLabelKey(
  kind: GovernmentTaxKind
): `pages.billing.governmentTaxKind${
  | "Ppn"
  | "Pph25"
  | "Pph29"
  | "Pph21"
  | "Pph23"
  | "Pph42"
  | "Pph22"
  | "StampDuty"
  | "Pbb"
  | "BpjsKesehatan"
  | "BpjsKetenagakerjaan"
  | "Other"}` {
  switch (kind) {
    case "PPN":
      return "pages.billing.governmentTaxKindPpn";
    case "PPH_25":
      return "pages.billing.governmentTaxKindPph25";
    case "PPH_29":
      return "pages.billing.governmentTaxKindPph29";
    case "PPH_21":
      return "pages.billing.governmentTaxKindPph21";
    case "PPH_23":
      return "pages.billing.governmentTaxKindPph23";
    case "PPH_4_2":
      return "pages.billing.governmentTaxKindPph42";
    case "PPH_22":
      return "pages.billing.governmentTaxKindPph22";
    case "STAMP_DUTY":
      return "pages.billing.governmentTaxKindStampDuty";
    case "PBB":
      return "pages.billing.governmentTaxKindPbb";
    case "BPJS_KESEHATAN":
      return "pages.billing.governmentTaxKindBpjsKesehatan";
    case "BPJS_KETENAGAKERJAAN":
      return "pages.billing.governmentTaxKindBpjsKetenagakerjaan";
    default:
      return "pages.billing.governmentTaxKindOther";
  }
}
