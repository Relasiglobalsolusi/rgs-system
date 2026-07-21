"use client";

import { Checkbox } from "@/components/ui/checkbox";

import type { DataTableColumn } from "@/components/ui/DataTable";

/** Shared gutter column: fixed width, right border, centered checkboxes. */
export const SELECTION_COLUMN_CLASS =
  "w-14 min-w-[3.5rem] border-r border-border/60 px-2 py-2.5 align-middle text-center [&:has([role=checkbox])]:!pr-2";

type CreateSelectionColumnOptions<T> = {
  ariaLabelAll: string;
  getRowAriaLabel: (row: T) => string;
  getRowId: (row: T) => string;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  onToggleSelectAll?: () => void;
  onToggleSelect?: (id: string) => void;
  selectedIds?: Set<string>;
  selectableIds?: Set<string>;
  selectAllDisabled?: boolean;
};

export function createSelectionColumn<T>(
  options: CreateSelectionColumnOptions<T>
): DataTableColumn<T> {
  const {
    ariaLabelAll,
    getRowAriaLabel,
    getRowId,
    allVisibleSelected,
    someVisibleSelected,
    onToggleSelectAll,
    onToggleSelect,
    selectedIds,
    selectableIds,
    selectAllDisabled = false,
  } = options;

  return {
    key: "select",
    selectionColumn: true,
    title: (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={allVisibleSelected}
          indeterminate={someVisibleSelected && !allVisibleSelected}
          disabled={selectAllDisabled}
          onCheckedChange={() => onToggleSelectAll?.()}
          aria-label={ariaLabelAll}
        />
      </div>
    ),
    headerClassName: SELECTION_COLUMN_CLASS,
    className: SELECTION_COLUMN_CLASS,
    render: (row) => {
      const id = getRowId(row);
      const isSelectable = selectableIds?.has(id) ?? false;
      const isSelected = selectedIds?.has(id) ?? false;

      return (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={isSelected}
            disabled={!isSelectable}
            onCheckedChange={() => onToggleSelect?.(id)}
            aria-label={getRowAriaLabel(row)}
          />
        </div>
      );
    },
  };
}
