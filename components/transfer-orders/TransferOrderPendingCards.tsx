"use client";

import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";

import type { TransferOrderPendingRow } from "@/lib/transfer-order-directory";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDisplayDate } from "@/lib/format-date";
import { formatInventoryQty } from "@/lib/inventory";
import { useT } from "@/lib/i18n/use-t";
import {
  transferOrderStatusKey,
  transferOrderStatusTone,
} from "@/lib/material-flow-status";

type Props = {
  orders: TransferOrderPendingRow[];
};

function itemSummary(
  order: TransferOrderPendingRow,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (!order.firstItemName || order.itemCount <= 0) {
    return t("pages.materialRequests.lineCount", { count: order.itemCount });
  }
  const qty = formatInventoryQty(order.firstItemQty);
  if (order.itemCount === 1) {
    return t("pages.transferOrders.itemSummary", {
      qty,
      unit: order.firstItemUnit,
      name: order.firstItemName,
    });
  }
  return t("pages.transferOrders.itemSummaryMore", {
    qty,
    unit: order.firstItemUnit,
    name: order.firstItemName,
    count: order.itemCount - 1,
  });
}

export default function TransferOrderPendingCards({ orders }: Props) {
  const { t } = useT();

  if (orders.length === 0) return null;

  return (
    <section className="mb-5 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-text">
          {t(
            orders.length === 1
              ? "pages.transferOrders.pendingTitle"
              : "pages.transferOrders.pendingTitleOther"
          )}
        </h2>
        <p className="mt-1 text-sm text-subtle">
          {t("pages.transferOrders.pendingDesc")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={order.href}
            className="group flex items-start gap-4 rounded-2xl border border-border bg-card px-4 py-4 transition hover:border-border-strong hover:bg-elevated/40"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-inset text-muted">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-subtle">
                {t("pages.transferOrders.pendingTitle")}
              </p>
              <p className="mt-0.5 truncate font-semibold text-text">
                {order.isInternal
                  ? t("pages.transferOrders.internalSection")
                  : order.clientName}
              </p>
              <p className="mt-0.5 truncate text-sm text-muted">
                {order.projectName}
              </p>
              <p className="mt-1 truncate text-xs text-subtle">
                {itemSummary(order, t)}
                {" · "}
                {formatDisplayDate(order.createdAt)}
              </p>
              <div className="mt-2">
                <StatusBadge
                  status={transferOrderStatusTone(order.status)}
                  compact
                >
                  {t(transferOrderStatusKey(order.status))}
                </StatusBadge>
              </div>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted transition group-hover:text-text" />
          </Link>
        ))}
      </div>
    </section>
  );
}
