/** Matches adjacent DirectoryFilterTab / manage chips (h-9, elevated surface). */
export const directoryFilterSelectTriggerClass =
  "h-9 min-h-9 rounded-xl border border-border bg-elevated px-3.5 pr-2.5 text-sm font-semibold text-text shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-colors hover:border-border-strong hover:bg-card-hover focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/10 data-[size=default]:h-9 data-[size=sm]:h-9";

/** Same height as directory filter selects, for a download / action on that row. */
export const directoryToolbarActionClass =
  "box-border inline-flex h-9 min-h-9 max-h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/35 bg-card-tint-emerald px-3.5 py-0 text-sm font-bold text-primary-dark shadow-none hover:bg-[color-mix(in_srgb,var(--color-card-tint-emerald),var(--color-primary)_12%)]";

/** Download / report toolbar action — cyan like Open Billing. */
export const directoryToolbarDownloadClass =
  "box-border inline-flex h-9 min-h-9 max-h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-accent-cyan/40 bg-card-tint-cyan px-3.5 py-0 text-sm font-semibold text-accent-teal shadow-none hover:bg-[color-mix(in_srgb,var(--color-card-tint-cyan),var(--color-accent-cyan)_12%)]";
