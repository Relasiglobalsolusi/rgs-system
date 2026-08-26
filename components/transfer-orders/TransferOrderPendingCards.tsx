"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import type { TransferOrderPendingRow } from "@/lib/transfer-order-directory";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
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
  const router = useRouter();

  const columns = useMemo(() => {
    const cols: DataTableColumn<TransferOrderPendingRow>[] = [
      {
        key: "destination",
        title: t("pages.transferOrders.columns.destination"),
        width: "12rem",
        share: 1.2,
        className: "min-w-[12rem]",
        render: (order) => (
          <p className="font-semibold text-text">
            {order.isInternal
              ? t("pages.transferOrders.internalSection")
              : order.clientName}
          </p>
        ),
      },
      {
        key: "project",
        title: t("pages.transferOrders.columns.project"),
        width: "12rem",
        share: 1.2,
        className: "min-w-[12rem]",
        render: (order) => (
          <p className="min-w-0 text-text">{order.projectName}</p>
        ),
      },
      {
        key: "items",
        title: t("pages.transferOrders.columns.items"),
        width: "12rem",
        share: 1.2,
        className: "min-w-[12rem]",
        render: (order) => (
          <p className="min-w-0 text-sm text-muted">{itemSummary(order, t)}</p>
        ),
      },
      {
        key: "date",
        title: t("pages.transferOrders.columns.date"),
        width: "9rem",
        share: 1,
        className: "min-w-[9rem] whitespace-nowrap",
        render: (order) => (
          <span className="text-muted">{formatDisplayDate(order.createdAt)}</span>
        ),
      },
      {
        key: "status",
        title: t("pages.transferOrders.columns.status"),
        width: "10rem",
        share: 1,
        cellAlign: "center",
        className: "min-w-[10rem] overflow-visible",
        render: (order) => (
          <StatusBadge status={transferOrderStatusTone(order.status)} compact>
            {t(transferOrderStatusKey(order.status))}
          </StatusBadge>
        ),
      },
    ];
    return cols;
  }, [t]);

  if (orders.length === 0) return null;

  return (
    <section className="mb-5 space-y-3">
      <h2 className="text-base font-semibold text-text">
        {t(
          orders.length === 1
            ? "pages.transferOrders.pendingTitle"
            : "pages.transferOrders.pendingTitleOther"
        )}{" "}
        <span className="font-medium text-subtle">({orders.length})</span>
      </h2>
      <DataTable
        columns={columns}
        data={orders}
        getRowKey={(order) => order.id}
        onRowClick={(order) => router.push(order.href)}
        emptyMessage={t("pages.transferOrders.emptyTitle")}
      />
    </section>
  );
}
