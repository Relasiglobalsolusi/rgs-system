"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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

/**
 * Centers chip / button / badge content in a table cell.
 * Use for custom (non-DataTable) tables — center the matching `<th>` too
 * so the title sits over the chip.
 */
export function ChipCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-center justify-center text-center",
        className
      )}
    >
      {children}
    </div>
  );
}

export type DataTableColumn<T> = {
  key: keyof T | string;
  title: ReactNode;
  render?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  /**
   * Alignment for both `<th>` and `<td>` so the title sits over the content.
   * Alias of `cellAlign` — existing columns keep working.
   * Default is left. Use `center` for chips / buttons / badges.
   * Use `right` for numbers / money. Action columns (`actions`)
   * default to centered even without this flag.
   */
  align?: DataTableColumnAlign;
  /**
   * Same as `align`. Takes precedence when both are set.
   * `center` centers the header over chips / buttons / badges.
   */
  cellAlign?: DataTableColumnAlign;
  /**
   * Hard column floor (e.g. `"11rem"`). Used for `<col>` min-width and the
   * table `min-width` sum so narrow viewports scroll instead of crushing.
   */
  width?: string;
  /**
   * Relative share of leftover table width after rem floors.
   * Primary identity columns (name/address) should use a higher share.
   * Chip / status columns should stay at `1` so they grow enough for
   * centered chips. Use `0` to lock a rem `width` (tight Actions).
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

/** Header title justification matches the column (title over chip / money). */
function columnHeaderJustifyClass(align: DataTableColumnAlign) {
  if (align === "right") return "justify-end";
  if (align === "center") return "justify-center";
  return "justify-start";
}

function resolveBodyAlign<T>(
  column: DataTableColumn<T>
): DataTableColumnAlign | undefined {
  return column.cellAlign ?? column.align;
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
    resolveBodyAlign(column) === "right" ||
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
  /** When true, the row is not clickable and uses a muted disabled style. */
  isRowDisabled?: (row: T) => boolean;
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
 * Floor for left-aligned columns without an explicit rem `width`.
 * Kept modest so directories with many columns still fit a wide window;
 * leftover share grows them. A 12rem default on every column forced
 * horizontal scroll even on desktop.
 */
const MIN_FLEX_COLUMN_WIDTH = "5.5rem";
/**
 * Floor for centered chip / badge columns that omit a rem `width`.
 * Matches a compact status chip plus cell padding.
 */
const CHIP_COLUMN_MIN_WIDTH = "8rem";
/**
 * Subpixel / border slack so leftover shares never sum past 100%.
 * Dark overlay scrollbars appear if `overflow-x: auto` is even 1px over.
 */
const LEFTOVER_WIDTH_SLACK = "2px";
/**
 * Treat this much extra scrollWidth as “fits” so a 1px rounding error
 * does not paint a desktop slider.
 */
const OVERFLOW_SCROLL_TOLERANCE_PX = 1;
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
 * Header alignment matches the body so the title shares the chip’s
 * center (or sits over right-aligned money). Gutters stay centered.
 */
function resolveHeaderAlign<T>(
  column: DataTableColumn<T>
): DataTableColumnAlign {
  return resolveCellAlign(column);
}

/**
 * Body cells: honor `cellAlign` / `align` (right = money). Action
 * columns and gutters are centered. Everything else stays left.
 */
function resolveCellAlign<T>(
  column: DataTableColumn<T>
): DataTableColumnAlign {
  if (isGutterColumn(column) || isActionsColumn(column)) return "center";
  return resolveBodyAlign(column) ?? "left";
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
  if (resolveCellAlign(column) === "center") return CHIP_COLUMN_MIN_WIDTH;
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

function allMinWidthSum<T>(columns: DataTableColumn<T>[]) {
  return columns.map(columnMinWidth).join(" + ");
}

function totalShareWeight<T>(columns: DataTableColumn<T>[]) {
  return columns.reduce((sum, column) => sum + columnShareWeight(column), 0);
}

/**
 * Rem floor plus a share of leftover table width. Chip columns with
 * share ≥ 1 grow on wide screens so ChipCell centering is visible.
 * Locked columns (gutters / share 0) stay on their rem floor.
 *
 * Leftover is `max(0px, 100% − floors − slack)` so column widths never
 * exceed the table (negative leftover / subpixel rounding used to make
 * `overflow-x: auto` show a slider on every desktop width).
 */
function columnWidthStyle<T>(
  column: DataTableColumn<T>,
  columns: DataTableColumn<T>[]
): CSSProperties {
  const minWidth = columnMinWidth(column);
  const share = columnShareWeight(column);
  const totalShare = totalShareWeight(columns);

  if (share <= 0 || totalShare <= 0 || isFixedWidthColumn(column)) {
    return { width: minWidth };
  }

  const leftover = `max(0px, 100% - (${allMinWidthSum(columns)}) - ${LEFTOVER_WIDTH_SLACK})`;
  return {
    width: `calc(${minWidth} + (${leftover}) * ${share} / ${totalShare})`,
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
  isRowDisabled,
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [needsHScroll, setNeedsHScroll] = useState(false);

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

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scroller = el;

    function measure() {
      const next =
        scroller.scrollWidth > scroller.clientWidth + OVERFLOW_SCROLL_TOLERANCE_PX;
      setNeedsHScroll((prev) => (prev === next ? prev : next));
    }

    measure();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const table = el.querySelector("table");
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, [displayColumns, rows, tableMinWidth]);

  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, row: T) {
    if (!onRowClick) return;
    if (isRowDisabled?.(row)) return;
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
    <div className={cn("min-w-0 max-w-full space-y-3", className)}>
      {toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {toolbar}
        </div>
      ) : null}

      {/*
        Border lives outside the scrollport so 1px edges are not part of
        the overflow measurement. Inner min-w-0 lets flex parents shrink
        the table to the card instead of growing with column floors.
      */}
      <div className="min-w-0 max-w-full rounded-xl border border-border bg-card">
        <div
          ref={scrollRef}
          className={cn(
            "min-w-0 max-w-full overscroll-x-contain [-webkit-overflow-scrolling:touch]",
            needsHScroll ? "overflow-x-auto" : "overflow-x-hidden"
          )}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/*
            width / max-width 100% + box-border: fill the card when rem
            floors fit (no slider). min-width is the floor sum so a
            narrow window still scrolls. Leftover share lives on <col>
            only — min-width / overflow-visible on tds used to make
            scrollWidth exceed clientWidth by a few pixels.
          */}
          <Table
            containerClassName="min-w-0 max-w-full overflow-visible"
            className="box-border w-full max-w-full min-w-0 table-fixed text-left"
            style={{
              width: "100%",
              maxWidth: "100%",
              minWidth: tableMinWidth,
              boxSizing: "border-box",
              tableLayout: "fixed",
            }}
          >
          <colgroup>
            {displayColumns.map((column) => (
              <col
                key={String(column.key)}
                style={columnWidthStyle(column, displayColumns)}
              />
            ))}
          </colgroup>

          <TableHeader className="relative z-20 bg-elevated">
            <TableRow className="border-border hover:bg-transparent">
              {displayColumns.map((column, columnIndex) => {
                const isLastColumn = columnIndex === displayColumns.length - 1;
                const isGutter =
                  column.selectionColumn || column.reorderColumn;
                const headerAlign = resolveHeaderAlign(column);

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
                    className={cn(
                      "h-12 bg-elevated px-4 py-3 align-middle text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle",
                      column.headerClassName,
                      columnTrailingPadClass(column, isLastColumn),
                      // Chip / actions: center title over the chip. Money: right.
                      columnAlignClass(headerAlign),
                      "overflow-hidden"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex min-h-6 w-full items-center",
                        columnHeaderJustifyClass(headerAlign),
                        columnAlignClass(headerAlign)
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
                const disabled = isRowDisabled?.(row) ?? false;
                const isDragging = dragIndex === index;
                const isDropTarget =
                  dropIndex === index && dragIndex !== null && dragIndex !== index;

                return (
                  <TableRow
                    key={resolveRowKey(row, index, getRowKey)}
                    data-state={selected ? "selected" : undefined}
                    aria-disabled={disabled || undefined}
                    className={cn(
                      "border-border transition duration-300",
                      interactive &&
                        !disabled &&
                        "cursor-pointer hover:bg-card-hover",
                      disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
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
                      const cellAlign = resolveCellAlign(column);
                      const cellContent = column.render
                        ? column.render(row)
                        : String(row[column.key as keyof T] ?? "");

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
                          className={cn(
                            "align-middle whitespace-normal px-4 py-4",
                            column.className,
                            columnTrailingPadClass(column, isLastColumn),
                            // Wins over column.className so chips stay centered.
                            columnAlignClass(cellAlign),
                            // Visible overflow of nowrap chips inflates
                            // the scrollport even when <col> widths fit.
                            "overflow-hidden"
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
                          ) : cellAlign === "center" && !isGutter ? (
                            <ChipCell>{cellContent}</ChipCell>
                          ) : (
                            cellContent
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
    </div>
  );
}
