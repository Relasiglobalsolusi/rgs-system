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
   * Alignment for title and cells. Default is left. Action / button
   * columns (`actions`) are always centered so Save / Remove sit under
   * a centered Actions title. Gutters stay centered.
   */
  align?: DataTableColumnAlign;
  /**
   * Hard column floor (e.g. `"11rem"`). Used for `<col>` min-width and the
   * table `min-width` sum so narrow viewports scroll instead of crushing.
   */
  width?: string;
  /**
   * Relative share of free table width after gutters and fixed columns.
   * Primary identity columns (name/address) should use a higher share;
   * secondary columns default to equal share (`1`). Use `0` to lock a
   * rem `width` (Actions / chip columns) so they never shrink into a
   * neighbor.
   */
  share?: number;
  /** Marks the row-selection gutter column (excluded from row click). */
  selectionColumn?: boolean;
  /** Marks the drag-handle gutter column (excluded from row click). */
  reorderColumn?: boolean;
};

function columnAlignClass(align: DataTableColumnAlign) {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

/** Titles: left with the data, except gutters and action buttons. */
function columnHeaderJustifyClass(align: DataTableColumnAlign) {
  if (align === "right") return "justify-end";
  if (align === "center") return "justify-center";
  return "justify-start";
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
 * Columns never shrink below this — a small window scrolls sideways.
 */
const MIN_FLEX_COLUMN_WIDTH = "12rem";
/** Default relative share for non-gutter columns. */
const DEFAULT_COLUMN_SHARE = 1;

const INTERACTIVE_SELECTOR =
  "a, button, [role='button'], [role='menuitem'], [role='checkbox'], input, textarea, select, label";

const REORDER_COLUMN_KEY = "__reorder";

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

/**
 * Action / button columns and gutters are centered (title + cells).
 * Everything else is left so the title lines up with the data under it.
 */
function resolveColumnAlign<T>(
  column: DataTableColumn<T>
): DataTableColumnAlign {
  if (isGutterColumn(column) || isActionsColumn(column)) return "center";
  return "left";
}

/** True when `width` is a percentage (layout hint), not a rem/px floor. */
function isPercentageWidth(width: string | undefined) {
  return Boolean(width && /^\d+(\.\d+)?%$/.test(width.trim()));
}

/** Hard min width for a column — never percentage, never shrinks below this. */
function columnMinWidth<T>(column: DataTableColumn<T>) {
  if (column.selectionColumn) return SELECTION_COLUMN_WIDTH;
  if (column.reorderColumn) return REORDER_COLUMN_WIDTH;
  // Percentage `width` is a share of free space, not a min-width floor.
  if (column.width && !isPercentageWidth(column.width)) return column.width;
  return MIN_FLEX_COLUMN_WIDTH;
}

function isActionsColumn<T>(column: DataTableColumn<T>) {
  const key = String(column.key).toLowerCase();
  return key === "actions" || key.endsWith("actions");
}

function columnShareWeight<T>(column: DataTableColumn<T>) {
  if (isGutterColumn(column)) return 0;
  const share = column.share;
  if (typeof share === "number" && Number.isFinite(share)) {
    return Math.max(0, share);
  }
  // Chip columns keep a rem floor; a % share would let table-fixed crush
  // them into the previous column on medium viewports.
  if (isActionsColumn(column)) return 0;
  return DEFAULT_COLUMN_SHARE;
}

function isFixedWidthColumn<T>(column: DataTableColumn<T>) {
  return isGutterColumn(column) || columnShareWeight(column) === 0;
}

function fixedWidthSum<T>(columns: DataTableColumn<T>[]) {
  const parts = columns
    .filter(isFixedWidthColumn)
    .map((column) => columnMinWidth(column));
  return parts.length > 0 ? parts.join(" + ") : "0px";
}

/**
 * Columns keep a rem floor. Never size by % of the viewport — a narrow
 * window must scroll sideways instead of cramping the table.
 */
function columnWidthStyle<T>(column: DataTableColumn<T>): CSSProperties {
  const minWidth = columnMinWidth(column);
  return { width: minWidth, minWidth };
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
          Rem column floors + min-width. A small window scrolls sideways
          instead of cramping columns.
        */}
        <Table
          containerClassName="overflow-visible"
          className="min-w-full text-left"
          style={{
            minWidth: tableMinWidth,
          }}
        >
          <colgroup>
            {displayColumns.map((column) => (
              <col
                key={String(column.key)}
                style={columnWidthStyle(column)}
              />
            ))}
          </colgroup>

          <TableHeader className="relative z-20 bg-elevated">
            <TableRow className="border-border hover:bg-transparent">
              {displayColumns.map((column, columnIndex) => {
                const isLastColumn = columnIndex === displayColumns.length - 1;
                const isGutter =
                  column.selectionColumn || column.reorderColumn;
                const align = resolveColumnAlign(column);

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
                    style={columnWidthStyle(column)}
                    className={cn(
                      "h-12 overflow-hidden bg-elevated px-4 py-3 align-middle text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle",
                      columnAlignClass(align),
                      columnTrailingPadClass(column, isLastColumn),
                      column.headerClassName
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex min-h-6 w-full items-center",
                        columnHeaderJustifyClass(align)
                      )}
                    >
                      {column.title}
                    </span>
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
                      const align = resolveColumnAlign(column);

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
                          style={columnWidthStyle(column)}
                          className={cn(
                            "align-middle whitespace-normal px-4 py-4",
                            columnAlignClass(align),
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
