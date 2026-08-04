import type { ProjectSubCategory, TransferOrderStatus } from "@prisma/client";

import { ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID } from "@/lib/attendance-internal-sites";
import type { EnsuredInternalSiteRow } from "@/lib/ensure-internal-attendance-sites";

/** Open warehouse queue statuses (actionable or in transit). */
export const TRANSFER_ORDER_OPEN_STATUSES = [
  "PENDING_SEND",
  "SENT",
] as const satisfies readonly TransferOrderStatus[];

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
