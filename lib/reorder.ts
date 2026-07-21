/**
 * Shared helpers for ERP directory row reordering (HTML5 DnD + persisted sortOrder).
 */

export const SORT_ORDER_STEP = 10;

/** Move an item within an array; returns a new array. */
export function moveItemInArray<T>(
  items: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  if (fromIndex === toIndex) return items;
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return items;
  next.splice(toIndex, 0, moved);
  return next;
}

/** Assign sequential sortOrder values (1-based steps) for an ordered id list. */
export function sortOrdersForIds(
  ids: string[],
  step = SORT_ORDER_STEP
): { id: string; sortOrder: number }[] {
  return ids.map((id, index) => ({
    id,
    sortOrder: (index + 1) * step,
  }));
}

/** Next sortOrder after the current max (or `step` when empty). */
export function nextSortOrderFromMax(
  maxSortOrder: number | null | undefined,
  step = SORT_ORDER_STEP
): number {
  return (maxSortOrder ?? 0) + step;
}
