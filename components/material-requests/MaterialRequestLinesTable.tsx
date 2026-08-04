"use client";

import { formatInventoryQtyWithUnit } from "@/lib/inventory";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type MaterialFlowLineView = {
  id: string;
  quantity: number;
  item: {
    sku: string;
    name: string;
    unit: string;
    currentStock?: number | null;
  };
};

type Props = {
  lines: MaterialFlowLineView[];
  /** Show warehouse on-hand next to requested qty (Approvals / Transfer Orders). */
  showStock?: boolean;
  /** Slightly denser cell padding; table stays full width. */
  compact?: boolean;
  className?: string;
};

export default function MaterialRequestLinesTable({
  lines,
  showStock = false,
  compact = false,
  className,
}: Props) {
  const { t } = useT();

  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted">{t("pages.materialRequests.noLines")}</p>
    );
  }

  const cellPad = compact ? "px-3 py-2.5" : "px-4 py-3";

  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-xl border border-border bg-elevated/20",
        className
      )}
    >
      <table className="w-full min-w-[28rem] text-sm">
        <thead className="bg-elevated/60 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
          <tr>
            <th className={cn(cellPad, "font-semibold")}>
              {t("pages.materialRequests.columns.item")}
            </th>
            <th className={cn(cellPad, "w-[1%] whitespace-nowrap font-semibold")}>
              {t("pages.materialRequests.columns.sku")}
            </th>
            <th
              className={cn(
                cellPad,
                "w-[1%] whitespace-nowrap text-right font-semibold"
              )}
            >
              {t("pages.materialRequests.columns.qty")}
            </th>
            {showStock ? (
              <th
                className={cn(
                  cellPad,
                  "w-[1%] whitespace-nowrap text-right font-semibold"
                )}
              >
                {t("pages.materialRequests.columns.onHand")}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const stock = line.item.currentStock;
            const short =
              showStock &&
              stock != null &&
              Number.isFinite(stock) &&
              stock < line.quantity;
            return (
              <tr key={line.id} className="border-t border-border">
                <td className={cn(cellPad, "font-medium text-text")}>
                  {line.item.name}
                </td>
                <td
                  className={cn(
                    cellPad,
                    "w-[1%] whitespace-nowrap tabular-nums text-subtle"
                  )}
                >
                  {line.item.sku}
                </td>
                <td
                  className={cn(
                    cellPad,
                    "w-[1%] whitespace-nowrap text-right tabular-nums text-text"
                  )}
                >
                  {formatInventoryQtyWithUnit(line.quantity, line.item.unit)}
                </td>
                {showStock ? (
                  <td
                    className={cn(
                      cellPad,
                      "w-[1%] whitespace-nowrap text-right tabular-nums",
                      short ? "font-semibold text-danger" : "text-muted"
                    )}
                  >
                    {stock == null
                      ? "—"
                      : formatInventoryQtyWithUnit(stock, line.item.unit)}
                    {short ? (
                      <span className="mt-0.5 block text-[0.6875rem] font-medium normal-case tracking-normal text-danger">
                        {t("pages.materialRequests.stockShort")}
                      </span>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
