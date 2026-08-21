import type { ProjectSubCategory, TransferOrderStatus } from "@prisma/client";

import { ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID } from "@/lib/attendance-internal-sites";
import type { EnsuredInternalSiteRow } from "@/lib/ensure-internal-attendance-sites";

/** Open warehouse queue statuses (actionable, in transit, or item return). */
export const TRANSFER_ORDER_OPEN_STATUSES = [
  "PENDING_SEND",
  "SENT",
  "NOT_RECEIVED",
] as const satisfies readonly TransferOrderStatus[];

/** Warehouse first (send / item return), then in-transit waiting for site receipt. */
export function transferOrderPendingRank(status: TransferOrderStatus): number {
  switch (status) {
    case "PENDING_SEND":
      return 0;
    case "NOT_RECEIVED":
      return 1;
    case "SENT":
      return 2;
    default:
      return 9;
  }
}

export function transferOrderAnchorId(orderId: string): string {
  return `to-${orderId}`;
}

export function transferOrderQueueHref(input: {
  clientId: string;
  projectId: string;
  orderId?: string;
}): string {
  const base = `/transfer-orders/${input.clientId}/${input.projectId}`;
  return input.orderId ? `${base}#${transferOrderAnchorId(input.orderId)}` : base;
}

export type TransferOrderPendingRow = {
  id: string;
  status: TransferOrderStatus;
  createdAt: Date;
  href: string;
  isInternal: boolean;
  clientName: string;
  projectName: string;
  firstItemName: string | null;
  firstItemQty: number;
  firstItemUnit: string;
  itemCount: number;
};

export type TransferOrderClientRow = {
  id: string;
  name: string;
  projectCount: number;
  pendingSendCount: number;
  inTransitCount: number;
};

export type TransferOrderProjectRow = {
  id: string;
  name: string;
  location: string | null;
  subCategory: ProjectSubCategory;
  serviceArea: string;
  pendingSendCount: number;
  inTransitCount: number;
};

export type TransferOrderInternalSiteRow = EnsuredInternalSiteRow & {
  pendingSendCount: number;
  inTransitCount: number;
};

export type TransferOrderDirectory = {
  clients: TransferOrderClientRow[];
  internalSites: TransferOrderInternalSiteRow[];
  /** Open TOs that still need warehouse or site action. */
  pendingOrders: TransferOrderPendingRow[];
  /** Company-wide open counts for the home header. */
  totals: {
    pendingSend: number;
    inTransit: number;
  };
};

/** Route segment for TO drill-down: real client id, or `internal` for null-client sites. */
export function transferOrderRouteClientId(project: {
  clientId?: string | null;
}): string {
  return project.clientId ?? ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID;
}
