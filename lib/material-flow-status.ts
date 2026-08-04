/** Status → StatusBadge tone for Material Requests / Transfer Orders. */

export type FlowBadgeTone =
  | "pending"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "inactive";

export function materialRequestStatusTone(
  status: string
): FlowBadgeTone {
  switch (status) {
    case "REQUESTED":
      return "pending";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
    case "CANCELLED":
      return "inactive";
    default:
      return "info";
  }
}

export function transferOrderStatusTone(status: string): FlowBadgeTone {
  switch (status) {
    case "PENDING_SEND":
      return "warning";
    case "SENT":
      return "info";
    case "RECEIVED":
      return "success";
    case "CANCELLED":
      return "inactive";
    default:
      return "info";
  }
}

export function materialRequestStatusKey(status: string): string {
  switch (status) {
    case "REQUESTED":
      return "pages.materialRequests.status.requested";
    case "APPROVED":
      return "pages.materialRequests.status.approved";
    case "REJECTED":
      return "pages.materialRequests.status.rejected";
    case "CANCELLED":
      return "pages.materialRequests.status.cancelled";
    default:
      return "pages.materialRequests.status.requested";
  }
}

export function transferOrderStatusKey(status: string): string {
  switch (status) {
    case "PENDING_SEND":
      return "pages.transferOrders.status.pendingSend";
    case "SENT":
      return "pages.transferOrders.status.sent";
    case "RECEIVED":
      return "pages.transferOrders.status.received";
    case "CANCELLED":
      return "pages.transferOrders.status.cancelled";
    default:
      return "pages.transferOrders.status.pendingSend";
  }
}
