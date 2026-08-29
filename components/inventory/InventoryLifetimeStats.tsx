"use client";

import { formatInventoryQtyWithUnit } from "@/lib/inventory";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

const labelClass =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle";

function QtyStat({
  label,
  value,
  emphasize,
  tone,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  tone?: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3 sm:px-5">
      <p className={labelClass}>{label}</p>
      <p
        className={cn(
          "mt-1 tabular-nums tracking-tight",
          emphasize ? "text-lg font-bold sm:text-xl" : "text-sm font-semibold",
          tone ?? "text-text"
        )}
      >
        {value}
      </p>
    </div>
  );
}

type Props = {
  unit: string;
  loading?: boolean;
  totalBought: number | null;
  currentStock: number;
  totalAssigned: number | null;
  totalSold: number | null;
  totalWrittenOff: number | null;
  lowStock?: boolean;
};

/** Bought → In Stock → Assigned → Sold → Written Off. */
export default function InventoryLifetimeStats({
  unit,
  loading = false,
  totalBought,
  currentStock,
  totalAssigned,
  totalSold,
  totalWrittenOff,
  lowStock = false,
}: Props) {
  const { t } = useT();
  const qty = (value: number | null) =>
    loading || value == null ? "—" : formatInventoryQtyWithUnit(value, unit);

  return (
    <div className="border-t border-border">
      <div className="grid grid-cols-2">
        <div className="border-b border-r border-border">
          <QtyStat
            label={t("pages.inventory.stockDetailBought")}
            value={qty(totalBought)}
            emphasize
          />
        </div>
        <div className="border-b border-border">
          <QtyStat
            label={t("pages.inventory.stockDetailInStock")}
            value={formatInventoryQtyWithUnit(currentStock, unit)}
            emphasize
            tone={lowStock ? "text-warning" : undefined}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3">
        <div className="border-b border-border sm:border-b-0 sm:border-r">
          <QtyStat
            label={t("pages.inventory.stockDetailAssigned")}
            value={qty(totalAssigned)}
            emphasize
          />
        </div>
        <div className="border-b border-border sm:border-b-0 sm:border-r">
          <QtyStat
            label={t("pages.inventory.stockDetailSold")}
            value={qty(totalSold)}
          />
        </div>
        <div>
          <QtyStat
            label={t("pages.inventory.stockDetailWrittenOff")}
            value={qty(totalWrittenOff)}
          />
        </div>
      </div>
    </div>
  );
}
