/**
 * Shared detail-page action control classes.
 * Keep this out of ProjectDetailActionBar — that file imports Finish/Start
 * buttons, so exporting from there creates a circular module graph.
 */
export const detailActionBarButtonClassName =
  "h-12 w-full min-h-12 justify-center rounded-xl px-5 text-sm font-semibold uppercase tracking-[0.1em] shadow-none sm:h-14 sm:text-[0.95rem]";
