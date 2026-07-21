"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import RowDragHandle from "@/components/ui/RowDragHandle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { moveItemInArray } from "@/lib/reorder";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type DataTableColumnAlign = "left" | "center" | "right";

export type DataTableColumn<T> = {
  key: keyof T | string;
  title: ReactNode;
  render?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  /**
   * Alignment for header + body cells (default left — matches content start).
   * Prefer `"center"` for chip / status columns whose cells are centered.
   */
  align?: DataTableColumnAlign;
  /**
   * Hard column floor (e.g. `"11rem"`). Used for `<col>` min-width and the
   * table `min-width` sum so narrow viewports scroll instead of crushing.
   */
  width?: string;
  /**
   * Relative share of free table width after gutters. Primary identity
   * columns (name/address) should use a higher share; secondary columns
   * default to equal share (`1`).
   */
  share?: number;
  /** Marks the row-selection gutter column (excluded from row click). */
  selectionColumn?: boolean;
  /** Marks the drag-handle gutter column (excluded from row click). */
  reorderColumn?: boolean;
};

function columnAlignClass(align: DataTableColumnAlign | undefined) {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

/**
 * Comfortable trailing pad so Actions chips (and other right-edge cells)
 * don’t sit against the table border. Applied to the last column, any
 * `align: "right"` column, and the conventional `actions` key.
 */
function columnTrailingPadClass<T>(
  column: DataTableColumn<T>,
  isLastColumn: boolean
) {
  const key = String(column.key).toLowerCase();
  const needsEdgeGap =
    isLastColumn ||
    column.align === "right" ||
    key === "actions" ||
    key.endsWith("actions");
  return needsEdgeGap ? "pr-10" : undefined;
}

type Props<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  emptyMessage?: string;
  getRowKey?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  toolbar?: ReactNode;
  /** Optional first body row (e.g. directory Add control). */
  leadingRow?: ReactNode;
  className?: string;
  /**
   * When true, injects a grip column (after selection) and enables HTML5
   * drag-and-drop reordering. Calls `onReorder` with the new key order.
   */
  reorderable?: boolean;
  onReorder?: (orderedKeys: string[]) => void | Promise<void>;
};

/** Selection gutter width (matches `<col>`). */
const SELECTION_COLUMN_WIDTH = "3.5rem";
/** Drag-handle gutter width (matches `<col>`). */
export const REORDER_COLUMN_WIDTH = "2.75rem";
/**
 * Floor width for data columns without an explicit `width`.
 * Content-sized floors + horizontal scroll beat equal-% crushing.
 */
const MIN_FLEX_COLUMN_WIDTH = "10rem";
/** Default relative share for non-gutter columns. */
const DEFAULT_COLUMN_SHARE = 1;

const INTERACTIVE_SELECTOR =
  "a, button, [role='button'], [role='menuitem'], [role='checkbox'], input, textarea, select, label";

const REORDER_COLUMN_KEY = "__reorder";

/** Column count including an injected reorder grip when enabled. */
export function dataTableColumnCount(
  columnCount: number,
  options?: { reorderable?: boolean }
) {
  return columnCount + (options?.reorderable ? 1 : 0);
}

function isInteractiveTarget(
  target: EventTarget | null,
  currentTarget: EventTarget | null
) {
  if (!(target instanceof Element)) return false;
  const interactive = target.closest(INTERACTIVE_SELECTOR);
  if (!interactive) return false;
  if (currentTarget instanceof Element && interactive === currentTarget) {
    return false;
  }
  return true;
}

function isSelectionCell(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("[data-selection-cell]"));
}

function isReorderCell(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("[data-reorder-cell]"));
}

function isGutterColumn<T>(column: DataTableColumn<T>) {
  return Boolean(column.selectionColumn || column.reorderColumn);
}

/** Hard min width for a column — never percentage, never shrinks below this. */
function columnMinWidth<T>(column: DataTableColumn<T>) {
  if (column.selectionColumn) return SELECTION_COLUMN_WIDTH;
  if (column.reorderColumn) return REORDER_COLUMN_WIDTH;
  if (column.width) return column.width;
  return MIN_FLEX_COLUMN_WIDTH;
}

function columnShareWeight<T>(column: DataTableColumn<T>) {
  if (isGutterColumn(column)) return 0;
  const share = column.share;
  if (typeof share === "number" && Number.isFinite(share) && share > 0) {
    return share;
  }
  return DEFAULT_COLUMN_SHARE;
}

/**
 * Fixed gutters keep absolute rem widths; remaining columns split free width
 * by `share` (equal by default, larger for primary identity columns).
 */
function columnWidthStyle<T>(
  column: DataTableColumn<T>,
  shareTotal: number
): CSSProperties {
  const minWidth = columnMinWidth(column);

  if (isGutterColumn(column)) {
    return { width: minWidth, minWidth };
  }

  const weight = columnShareWeight(column);
  if (shareTotal <= 0) {
    return { width: minWidth, minWidth };
  }

  return {
    width: `${(weight / shareTotal) * 100}%`,
    minWidth,
  };
}

function resolveRowKey<T>(
  row: T,
  index: number,
  getRowKey?: (row: T, index: number) => string
) {
  if (getRowKey) return getRowKey(row, index);
  const record = row as { id?: unknown };
  if (typeof record.id === "string" && record.id) return record.id;
  return String(index);
}

export default function DataTable<T>({
  columns,
  data,
  emptyMessage,
  getRowKey,
  onRowClick,
  isRowSelected,
  toolbar,
  leadingRow,
  className,
  reorderable = false,
  onReorder,
}: Props<T>) {
  const { t } = useT();
  const resolvedEmptyMessage = emptyMessage ?? t("ui.noRecordsFound");
  const [rows, setRows] = useState(data);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => {
    setRows(data);
  }, [data]);

  const displayColumns = useMemo(() => {
    if (!reorderable) return columns;

    const gripColumn: DataTableColumn<T> = {
      key: REORDER_COLUMN_KEY,
      title: (
        <span className="sr-only">{t("ui.reorder")}</span>
      ),
      reorderColumn: true,
      width: REORDER_COLUMN_WIDTH,
      headerClassName:
        "w-11 min-w-[2.75rem] border-r border-border/60 px-1 py-2.5",
      className: "w-11 min-w-[2.75rem] border-r border-border/60 px-1 py-2.5",
    };

    const selectionIndex = columns.findIndex((column) => column.selectionColumn);
    if (selectionIndex >= 0) {
      return [
        ...columns.slice(0, selectionIndex + 1),
        gripColumn,
        ...columns.slice(selectionIndex + 1),
      ];
    }
    return [gripColumn, ...columns];
  }, [columns, reorderable, t]);

  const shareTotal = useMemo(
    () =>
      displayColumns.reduce(
        (sum, column) => sum + columnShareWeight(column),
        0
      ),
    [displayColumns]
  );

  const interactive = Boolean(onRowClick);
  const showEmptyMessage = rows.length === 0 && !leadingRow;
  /**
   * Sum of hard column floors. Narrow viewports scroll horizontally instead
   * of crushing chips / status text.
   */
  const tableMinWidth = `calc(${displayColumns.map(columnMinWidth).join(" + ")})`;

  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, row: T) {
    if (!onRowClick) return;
    if (isSelectionCell(event.target)) return;
    if (isReorderCell(event.target)) return;
    if (isInteractiveTarget(event.target, event.currentTarget)) return;
    onRowClick(row);
  }

  function stopGutterCellClick(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>, index: number) {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDropIndex(null);
  }

  function handleDragOver(event: DragEvent<HTMLTableRowElement>, index: number) {
    if (!reorderable || dragIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropIndex !== index) setDropIndex(index);
  }

  async function handleDrop(
    event: DragEvent<HTMLTableRowElement>,
    toIndex: number
  ) {
    if (!reorderable) return;
    event.preventDefault();
    event.stopPropagation();

    const raw = event.dataTransfer.getData("text/plain");
    const fromIndex = Number.parseInt(raw, 10);
    setDragIndex(null);
    setDropIndex(null);

    if (!Number.isFinite(fromIndex) || fromIndex === toIndex) return;

    const next = moveItemInArray(rows, fromIndex, toIndex);
    setRows(next);

    const orderedKeys = next.map((row, index) =>
      resolveRowKey(row, index, getRowKey)
    );
    try {
      await onReorder?.(orderedKeys);
    } catch {
      setRows(data);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {toolbar}
        </div>
      ) : null}

      <div
        className="overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-card [-webkit-overflow-scrolling:touch]"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/*
          Fixed layout + share-% widths: primary columns take a larger slice;
          remaining columns split free space equally. Floor mins scroll instead
          of crushing Actions / chips.
        */}
        <Table
          containerClassName="overflow-visible"
          className="w-full table-fixed"
          style={{ width: "100%", minWidth: tableMinWidth }}
        >
          <colgroup>
            {displayColumns.map((column) => (
              <col
                key={String(column.key)}
                style={columnWidthStyle(column, shareTotal)}
              />
            ))}
          </colgroup>

          <TableHeader className="bg-elevated">
            <TableRow className="border-border hover:bg-transparent">
              {displayColumns.map((column, columnIndex) => {
                const isLastColumn = columnIndex === displayColumns.length - 1;
                const isGutter =
                  column.selectionColumn || column.reorderColumn;

                return (
                  <TableHead
                    key={String(column.key)}
                    data-selection-cell={
                      column.selectionColumn ? true : undefined
                    }
                    data-reorder-cell={
                      column.reorderColumn ? true : undefined
                    }
                    onClick={isGutter ? stopGutterCellClick : undefined}
                    onPointerDown={isGutter ? stopGutterCellClick : undefined}
                    style={columnWidthStyle(column, shareTotal)}
                    className={cn(
                      "h-11 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle",
                      columnAlignClass(column.align),
                      columnTrailingPadClass(column, isLastColumn),
                      column.headerClassName,
                      column.className
                    )}
                  >
                    {column.title}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {leadingRow}

            {showEmptyMessage ? (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell
                  colSpan={displayColumns.length}
                  className="h-36 px-4 text-center font-normal text-muted"
                >
                  {resolvedEmptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => {
                const selected = isRowSelected?.(row) ?? false;
                const isDragging = dragIndex === index;
                const isDropTarget =
                  dropIndex === index && dragIndex !== null && dragIndex !== index;

                return (
                  <TableRow
                    key={resolveRowKey(row, index, getRowKey)}
                    data-state={selected ? "selected" : undefined}
                    className={cn(
                      "border-border transition duration-300",
                      interactive && "cursor-pointer hover:bg-card-hover",
                      selected
                        ? "bg-card-tint-emerald"
                        : index % 2 === 1
                          ? "bg-strip"
                          : "bg-card",
                      isDragging && "opacity-60",
                      isDropTarget && "ring-1 ring-inset ring-primary/40"
                    )}
                    onClick={
                      interactive
                        ? (event) => handleRowClick(event, row)
                        : undefined
                    }
                    onDragOver={
                      reorderable
                        ? (event) => handleDragOver(event, index)
                        : undefined
                    }
                    onDrop={
                      reorderable
                        ? (event) => {
                            void handleDrop(event, index);
                          }
                        : undefined
                    }
                  >
                    {displayColumns.map((column, columnIndex) => {
                      const isLastColumn =
                        columnIndex === displayColumns.length - 1;
                      const isGutter =
                        column.selectionColumn || column.reorderColumn;

                      return (
                        <TableCell
                          key={String(column.key)}
                          data-selection-cell={
                            column.selectionColumn ? true : undefined
                          }
                          data-reorder-cell={
                            column.reorderColumn ? true : undefined
                          }
                          onClick={isGutter ? stopGutterCellClick : undefined}
                          onPointerDown={
                            isGutter ? stopGutterCellClick : undefined
                          }
                          style={columnWidthStyle(column, shareTotal)}
                          className={cn(
                            "overflow-visible whitespace-normal px-4 py-3.5",
                            columnAlignClass(column.align),
                            columnTrailingPadClass(column, isLastColumn),
                            column.className
                          )}
                        >
                          {column.reorderColumn ? (
                            <div className="flex shrink-0 items-center justify-center">
                              <RowDragHandle
                                dragging={isDragging}
                                onDragStart={(event) =>
                                  handleDragStart(event, index)
                                }
                                onDragEnd={handleDragEnd}
                              />
                            </div>
                          ) : column.render ? (
                            column.render(row)
                          ) : (
                            String(row[column.key as keyof T] ?? "")
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
