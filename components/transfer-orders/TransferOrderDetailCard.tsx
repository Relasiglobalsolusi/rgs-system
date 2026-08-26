"use client";

import { useEffect, type ReactNode } from "react";

import MaterialRequestLinesTable, {
  type MaterialFlowLineView,
} from "@/components/material-requests/MaterialRequestLinesTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";
import { transferOrderAnchorId } from "@/lib/transfer-order-directory";
import {
  transferOrderStatusKey,
  transferOrderStatusTone,
} from "@/lib/material-flow-status";
import { cn } from "@/lib/utils";

export type TransferOrderDetailView = {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string | Date;
  sentAt: string | Date | null;
  receivedAt: string | Date | null;
  project: { id: string; name: string };
  requestedByName: string;
  requestedByNo?: string | null;
  sentByName?: string | null;
  receivedByName?: string | null;
  reviewNote?: string | null;
  lines: MaterialFlowLineView[];
};

type Props = {
  order: TransferOrderDetailView;
  showStock?: boolean;
  actions?: ReactNode;
  className?: string;
};

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="min-w-0">
      <dt className="text-[0.625rem] font-medium uppercase tracking-[0.1em] text-subtle">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-text">{value}</dd>
    </div>
  );
}

export default function TransferOrderDetailCard({
  order,
  showStock = false,
  actions,
  className,
}: Props) {
  const { t } = useT();
  const anchorId = transferOrderAnchorId(order.id);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== `#${anchorId}`) return;
    document.getElementById(anchorId)?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [anchorId]);

  return (
    <article
      id={anchorId}
      className={cn(
        "scroll-mt-24 rounded-2xl border border-border-strong/65 bg-elevated p-4 shadow-[0_12px_28px_-20px_rgba(0,0,0,0.72)] sm:p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0 space-y-2">
          <h3 className="text-base font-semibold tracking-tight text-text">
            {order.project.name}
          </h3>
          <p className="text-sm text-subtle">
            {t("pages.transferOrders.requestedBy", {
              name: order.requestedByName,
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="info" compact>
              {t("pages.materialRequests.lineCount", {
                count: order.lines.length,
              })}
            </StatusBadge>
            <span className="text-sm text-muted">
              {formatDisplayDate(order.createdAt)}
            </span>
          </div>
        </div>
        <StatusBadge status={transferOrderStatusTone(order.status)} compact>
          {t(transferOrderStatusKey(order.status))}
        </StatusBadge>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {order.requestedByNo ? (
          <MetaRow
            label={t("pages.materialRequests.columns.requester")}
            value={
              <span>
                <span className="font-medium">{order.requestedByName}</span>
                <span className="mt-0.5 block text-xs text-subtle">
                  {order.requestedByNo}
                </span>
              </span>
            }
          />
        ) : null}
        <MetaRow
          label={t("pages.transferOrders.columns.createdAt")}
          value={formatDisplayDateTime(order.createdAt)}
        />
        {order.sentAt ? (
          <MetaRow
            label={t("pages.transferOrders.columns.sentAt")}
            value={
              <span>
                {formatDisplayDateTime(order.sentAt)}
                {order.sentByName ? (
                  <span className="mt-0.5 block text-xs text-subtle">
                    {t("pages.transferOrders.sentBy", {
                      name: order.sentByName,
                    })}
                  </span>
                ) : null}
              </span>
            }
          />
        ) : null}
        {order.receivedAt ? (
          <MetaRow
            label={t("pages.transferOrders.columns.receivedAt")}
            value={
              <span>
                {formatDisplayDateTime(order.receivedAt)}
                {order.receivedByName ? (
                  <span className="mt-0.5 block text-xs text-subtle">
                    {t("pages.transferOrders.receivedBy", {
                      name: order.receivedByName,
                    })}
                  </span>
                ) : null}
              </span>
            }
          />
        ) : null}
        {order.notes ? (
          <MetaRow
            label={t("pages.materialRequests.columns.notes")}
            value={order.notes}
          />
        ) : null}
        {order.reviewNote ? (
          <MetaRow
            label={t("pages.materialRequests.columns.reviewNote")}
            value={order.reviewNote}
          />
        ) : null}
      </dl>

      <div className="mt-5">
        <p className="mb-2.5 text-sm font-semibold text-muted">
          {t("pages.transferOrders.columns.itemsToSend")}
        </p>
        <MaterialRequestLinesTable
          lines={order.lines}
          showStock={showStock && order.status === "PENDING_SEND"}
          className="w-full"
        />
      </div>

      {actions ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          {actions}
        </div>
      ) : null}
    </article>
  );
}
