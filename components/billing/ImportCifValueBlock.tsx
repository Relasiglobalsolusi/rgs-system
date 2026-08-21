import { cn } from "@/lib/utils";

export type ImportCifRateChip = {
  currency: string;
  rateLabel: string;
  customsRateLabel: string;
};

/**
 * Customs Value (CIF) heading: title, quiet rate chips, then the formula.
 * Used on the add/edit form and the invoice detail breakdown.
 */
export default function ImportCifValueBlock({
  title,
  chips,
  formula,
  titleClassName,
  formulaClassName,
}: {
  title: string;
  chips: ImportCifRateChip[];
  formula: string;
  titleClassName?: string;
  formulaClassName?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <p className={cn("font-semibold tracking-tight text-text", titleClassName)}>
          {title}
        </p>
        {chips.map((chip) => (
          <span
            key={`${chip.currency}-${chip.rateLabel}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-elevated/70 px-2.5 py-1 text-xs text-muted"
          >
            <span className="font-semibold tabular-nums text-text">
              {chip.currency}
            </span>
            <span className="text-subtle" aria-hidden>
              ·
            </span>
            <span className="font-medium">{chip.customsRateLabel}</span>
            <span className="font-medium tabular-nums text-text">
              {chip.rateLabel}
            </span>
          </span>
        ))}
      </div>
      {formula ? (
        <p
          className={cn(
            "font-semibold tabular-nums tracking-tight text-text",
            formulaClassName
          )}
        >
          {formula}
        </p>
      ) : null}
    </div>
  );
}
