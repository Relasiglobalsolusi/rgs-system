export const TAX_REPORT_VIEWS = [
  "all",
  "output",
  "input",
  "income",
  "other",
] as const;

export type TaxReportView = (typeof TAX_REPORT_VIEWS)[number];

export function isTaxReportView(value: string | null | undefined): value is TaxReportView {
  return (
    value === "all" ||
    value === "output" ||
    value === "input" ||
    value === "income" ||
    value === "other"
  );
}

export function parseTaxReportView(
  raw?: string | null,
  fallback: TaxReportView = "all"
): TaxReportView {
  const value = String(raw ?? "").trim().toLowerCase();
  return isTaxReportView(value) ? value : fallback;
}

export function taxReportViewIncludes(
  view: TaxReportView,
  kind: Exclude<TaxReportView, "all">
): boolean {
  return view === "all" || view === kind;
}
