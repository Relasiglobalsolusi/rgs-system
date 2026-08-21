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
  "OTHER",
] as const;

export type GovernmentTaxKind = (typeof GOVERNMENT_TAX_KINDS)[number];

/** Government expense picker. Hidden kinds stay valid on old records. */
export const GOVERNMENT_TAX_KIND_OPTIONS = [
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

export function isGovernmentTaxKind(
  value: string | null | undefined
): value is GovernmentTaxKind {
  return (GOVERNMENT_TAX_KINDS as readonly string[]).includes(
    String(value ?? "").trim().toUpperCase()
  );
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
  throw new Error("Select the government tax type.");
}

export function governmentPayeeName(kind: GovernmentTaxKind): string {
  return kind === "OTHER" || kind === "STAMP_DUTY" || kind === "PBB"
    ? GOVERNMENT_PAYEE_OTHER
    : GOVERNMENT_PAYEE_DJP;
}

/**
 * Final income tax (Pasal 4(2)), stamp duty, PBB, and other government
 * charges are operating expenses. Withholding remittances (21 / 23) and
 * prepaid corporate tax (22 / 25 / 29) and VAT settlement are not.
 */
export function isGovernmentOperatingExpense(
  kind: string | null | undefined
): boolean {
  return (
    kind === "STAMP_DUTY" ||
    kind === "OTHER" ||
    kind === "PPH_4_2" ||
    kind === "PBB"
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
    default:
      return "pages.billing.governmentTaxKindOther";
  }
}
