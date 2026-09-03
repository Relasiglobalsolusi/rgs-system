"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Boxes, Loader2 } from "lucide-react";

import {
  getInventoryStockItemDetail,
  type InventoryStockItemDetail,
} from "@/app/inventory/actions";
import type { InventoryCatalogItem } from "@/components/inventory/inventory-types";
import {
  EmployeeDialogShell,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/dialog";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import InventoryLifetimeStats from "@/components/inventory/InventoryLifetimeStats";
import { isBelowMinStock, formatInventoryQtyWithUnit } from "@/lib/inventory";
import { formatDisplayDate } from "@/lib/format-date";
import { localizeInventoryItemType } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryCatalogItem | null;
};

const labelClass =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle";

function SoftPill({ children }: { children: ReactNode }) {
  return <StatusBadge status="info" compact>{children}</StatusBadge>;
}

export default function InventoryStockItemDetailDialog({
  open,
  onOpenChange,
  item,
}: Props) {
  const { t, locale } = useT();
  const [detail, setDetail] = useState<InventoryStockItemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item?.id) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    void getInventoryStockItemDetail(item.id)
      .then((row) => {
        if (cancelled) return;
        setDetail(row);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not load stock item detail."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, item?.id]);

  if (!item) {
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }

  const unit = detail?.item.unit ?? item.unit;
  const itemTypeRaw = (detail?.item.itemType ?? item.itemType).trim();
  const itemTypeLabel = itemTypeRaw
    ? localizeInventoryItemType(itemTypeRaw, locale)
    : null;

  const currentStock = detail?.item.currentStock ?? item.currentStock;
  const lowStock = isBelowMinStock(
    currentStock,
    detail?.item.minStock ?? item.minStock
  );

  const assignmentColumns: DataTableColumn<
    InventoryStockItemDetail["projectAssignments"][number]
  >[] = [
    {
      key: "projectName",
      title: t("pages.inventory.columns.project"),
      share: 2,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{row.projectName}</p>
          {row.clientName ? (
            <p className="truncate text-xs text-muted">{row.clientName}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "quantity",
      title: t("pages.inventory.columns.qty"),
      width: "8rem",
      align: "right",
      render: (row) => formatInventoryQtyWithUnit(row.quantity, unit),
    },
  ];

  const saleColumns: DataTableColumn<
    InventoryStockItemDetail["sales"][number]
  >[] = [
    {
      key: "soldAt",
      title: t("pages.inventory.stockDetailSoldAt"),
      share: 1,
      render: (row) => formatDisplayDate(row.soldAt),
    },
    {
      key: "buyer",
      title: t("pages.inventory.stockDetailSoldTo"),
      share: 2,
      render: (row) => row.buyer?.trim() || "—",
    },
    {
      key: "quantity",
      title: t("pages.inventory.columns.qty"),
      width: "8rem",
      align: "right",
      render: (row) => formatInventoryQtyWithUnit(row.quantity, unit),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={Boxes}
        title={t("pages.inventory.stockDetailTitle")}
        description={t("pages.inventory.stockDetailDesc")}
        maxWidth="lg"
        footer={
          <EmployeeSecondaryButton onClick={() => onOpenChange(false)}>
            {t("common.actions.close")}
          </EmployeeSecondaryButton>
        }
      >
        <div className="space-y-3">
          <SectionCard className="overflow-hidden p-0">
            <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold tracking-tight text-text">
                    {detail?.item.name ?? item.name}
                  </h3>
                  {itemTypeLabel ? <SoftPill>{itemTypeLabel}</SoftPill> : null}
                </div>
                <p className="mt-1.5 text-sm text-subtle">
                  <span className="font-mono font-medium text-muted">
                    {detail?.item.sku ?? item.sku}
                  </span>
                  <span className="mx-1.5 text-border-strong">·</span>
                  {t("pages.inventory.form.unit")}: {unit}
                </p>
              </div>
              <div
                className={cn(
                  "shrink-0 rounded-xl px-4 py-3 text-right ring-1 ring-border/60",
                  lowStock ? "bg-card-tint-amber/70" : "bg-card-tint-cyan/50"
                )}
              >
                <p className={labelClass}>
                  {t("pages.inventory.stockDetailInStock")}
                </p>
                <p
                  className={cn(
                    "mt-1 text-2xl font-bold tabular-nums tracking-tight",
                    lowStock ? "text-warning" : "text-text"
                  )}
                >
                  {formatInventoryQtyWithUnit(currentStock, unit)}
                </p>
              </div>
            </div>

            <InventoryLifetimeStats
              unit={unit}
              loading={loading || !detail}
              totalBought={detail?.totalBought ?? null}
              currentStock={currentStock}
              totalAssigned={detail?.totalAssigned ?? null}
              totalSold={detail?.totalSold ?? null}
              totalWrittenOff={detail?.totalWrittenOff ?? null}
              lowStock={lowStock}
            />

            {(detail?.item.avgUnitCost != null ||
              detail?.item.lastUnitCost != null ||
              item.avgUnitCost != null ||
              item.lastUnitCost != null) && (
              <div className="grid grid-cols-2 border-t border-border">
                <div className="border-r border-border px-4 py-3 sm:px-5">
                  <p className={labelClass}>
                    {t("pages.inventory.columns.avgCost")}
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-text">
                    {(detail?.item.avgUnitCost ?? item.avgUnitCost) != null
                      ? formatContractPrice(
                          detail?.item.avgUnitCost ?? item.avgUnitCost!
                        )
                      : "—"}
                  </p>
                </div>
                <div className="px-4 py-3 sm:px-5">
                  <p className={labelClass}>
                    {t("pages.inventory.columns.lastCost")}
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-text">
                    {(detail?.item.lastUnitCost ?? item.lastUnitCost) != null
                      ? formatContractPrice(
                          detail?.item.lastUnitCost ?? item.lastUnitCost!
                        )
                      : "—"}
                  </p>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard className="space-y-3 p-4 sm:p-5">
            <div>
              <h4 className="text-sm font-semibold text-text">
                {t("pages.inventory.stockDetailAssignmentsTitle")}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {t("pages.inventory.stockDetailAssignmentsDesc")}
              </p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t("pages.inventory.stockDetailLoading")}
              </div>
            ) : error ? (
              <EmptyState
                title={t("pages.inventory.stockDetailLoadFailed")}
                description={error}
              />
            ) : !detail || detail.projectAssignments.length === 0 ? (
              <EmptyState
                title={t("pages.inventory.stockDetailEmptyAssignments")}
                description={t(
                  "pages.inventory.stockDetailEmptyAssignmentsDesc"
                )}
              />
            ) : (
              <DataTable
                columns={assignmentColumns}
                data={detail.projectAssignments}
                getRowKey={(row) => row.projectId}
              />
            )}
          </SectionCard>

          <SectionCard className="space-y-3 p-4 sm:p-5">
            <div>
              <h4 className="text-sm font-semibold text-text">
                {t("pages.inventory.stockDetailSalesTitle")}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {t("pages.inventory.stockDetailSalesDesc")}
              </p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t("pages.inventory.stockDetailLoading")}
              </div>
            ) : error ? (
              <EmptyState
                title={t("pages.inventory.stockDetailLoadFailed")}
                description={error}
              />
            ) : !detail || detail.sales.length === 0 ? (
              <EmptyState
                title={t("pages.inventory.stockDetailEmptySales")}
                description={t("pages.inventory.stockDetailEmptySalesDesc")}
              />
            ) : (
              <DataTable
                columns={saleColumns}
                data={detail.sales}
                getRowKey={(row) => row.id}
              />
            )}
          </SectionCard>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
