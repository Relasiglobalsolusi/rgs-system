import { cn } from "@/lib/utils";

/**
 * Filter-chip rows: swipe horizontally on phones, wrap from `sm` up.
 * Prevents chips from overflowing the page or stacking into a tall wrap.
 */
export function chipScrollRowClassName(...extra: Array<string | undefined>) {
  return cn(
    "chip-scroll-row flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-visible sm:pb-0",
    ...extra
  );
}

/** Title + actions: stack on phones so chips don't sit in a squeezed right column. */
export function pageToolbarRowClassName(...extra: Array<string | undefined>) {
  return cn(
    "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between",
    ...extra
  );
}

