"use client";

import type { ReactNode } from "react";

import MaterialRequestLinesTable, {
  type MaterialFlowLineView,
} from "@/components/material-requests/MaterialRequestLinesTable";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";
import {
  materialRequestStatusKey,
  materialRequestStatusTone,
  transferOrderStatusKey,
  transferOrderStatusTone,
} from "@/lib/material-flow-status";
import { cn } from "@/lib/utils";

export type MaterialRequestDetailView = {
  id: string;
  status: string;
  notes: string | null;
  reviewNote: string | null;
  createdAt: string | Date;
  reviewedAt: string | Date | null;
  project: { id: string; name: string };
  requestedByName?: string | null;
  requestedByNo?: string | null;
  reviewedByName?: string | null;
  lines: MaterialFlowLineView[];
  transferOrder?: {
    id: string;
    status: string;
    sentAt?: string | Date | null;
    receivedAt?: string | Date | null;
  } | null;
};

type Props = {
  request: MaterialRequestDetailView;
  /** Show warehouse stock column on lines. */
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
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-text">{value}</dd>
    </div>
  );
}

export default function MaterialRequestDetailCard({
  request,
  showStock = false,
  actions,
  className,
}: Props) {
  const { t } = useT();
  const lineCount = request.lines.length;
  const to = request.transferOrder;

  return (
    <SectionCard className={cn("p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-text">
            {request.project.name}
          </h3>
          <p className="text-sm text-subtle">
            {t("pages.materialRequests.lineCount", { count: lineCount })}
            {" · "}
            {t("pages.materialRequests.submittedOn", {
              date: formatDisplayDate(request.createdAt),
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={materialRequestStatusTone(request.status)}
            compact
          >
            {t(materialRequestStatusKey(request.status))}
          </StatusBadge>
          {to ? (
            <StatusBadge
              status={transferOrderStatusTone(to.status)}
              compact
            >
              {t(transferOrderStatusKey(to.status))}
            </StatusBadge>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {request.requestedByName ? (
          <MetaRow
            label={t("pages.materialRequests.columns.requester")}
            value={
              <span>
                <span className="font-medium">{request.requestedByName}</span>
                {request.requestedByNo ? (
                  <span className="mt-0.5 block text-xs text-subtle">
                    {request.requestedByNo}
                  </span>
                ) : null}
              </span>
            }
          />
        ) : null}
        {request.reviewedByName || request.reviewedAt ? (
          <MetaRow
            label={t("pages.materialRequests.columns.reviewed")}
            value={
              <span>
                {request.reviewedByName ? (
                  <span className="font-medium">{request.reviewedByName}</span>
                ) : null}
                {request.reviewedAt ? (
                  <span className="mt-0.5 block text-xs text-subtle">
                    {formatDisplayDateTime(request.reviewedAt)}
                  </span>
                ) : null}
              </span>
            }
          />
        ) : null}
        {to?.sentAt ? (
          <MetaRow
            label={t("pages.transferOrders.columns.sentAt")}
            value={formatDisplayDateTime(to.sentAt)}
          />
        ) : null}
        {to?.receivedAt ? (
          <MetaRow
            label={t("pages.transferOrders.columns.receivedAt")}
            value={formatDisplayDateTime(to.receivedAt)}
          />
        ) : null}
        {request.notes ? (
          <MetaRow
            label={t("pages.materialRequests.columns.notes")}
            value={request.notes}
          />
        ) : null}
        {request.reviewNote ? (
          <MetaRow
            label={t("pages.materialRequests.columns.reviewNote")}
            value={request.reviewNote}
          />
        ) : null}
      </dl>

      <div className="mt-4">
        <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
          {t("pages.materialRequests.columns.requestedItems")}
        </p>
        <MaterialRequestLinesTable
          lines={request.lines}
          showStock={showStock}
        />
      </div>

      {actions ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          {actions}
        </div>
      ) : null}
    </SectionCard>
  );
}
