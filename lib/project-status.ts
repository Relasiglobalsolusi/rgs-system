import type { ProjectStatus } from "@prisma/client";

export const PROJECT_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "WAITING_FOR_APPROVAL",
  "OFF_SITE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly ProjectStatus[];

/** Agreed / lobby projects waiting for a work order (Planning stage). */
export const PROJECT_PLANNING_STATUS = "PLANNED" as const satisfies ProjectStatus;

/**
 * Planning sidebar view — PLANNED only (never IN_PROGRESS / ON_HOLD).
 */
export const PROJECT_PLANNING_LIST_STATUSES = [
  PROJECT_PLANNING_STATUS,
] as const satisfies readonly ProjectStatus[];

/**
 * Site work stays open while a billing period is with the client.
 * Pending Approval is a period status on the project page — not a list stage.
 * WAITING_FOR_APPROVAL is kept for leftover rows and treated as In Progress.
 */
export const PROJECT_SITE_WORK_STATUSES = [
  "IN_PROGRESS",
  "WAITING_FOR_APPROVAL",
] as const satisfies readonly ProjectStatus[];

/**
 * Projects awaiting mutual client + HO approval before invoice issue.
 * Regular Cleaning: reconcile → review. General / Facade: Submit for Approval.
 */
export const PROJECT_WAITING_FOR_APPROVAL_STATUS =
  "WAITING_FOR_APPROVAL" as const satisfies ProjectStatus;

/**
 * In Progress sidebar view — work-order active field ops only.
 * Legacy ON_HOLD is excluded from product lists (DB enum retained).
 */
export const PROJECT_IN_PROGRESS_LIST_STATUSES = [
  "IN_PROGRESS",
  "WAITING_FOR_APPROVAL",
] as const satisfies readonly ProjectStatus[];

/**
 * Pending Approval sidebar view — projects in the client + HO review loop.
 */
export const PROJECT_PENDING_APPROVAL_LIST_STATUSES = [
  PROJECT_WAITING_FOR_APPROVAL_STATUS,
] as const satisfies readonly ProjectStatus[];

/** Canonical Projects sidebar view URLs (for navigation + revalidation). */
export const PROJECT_LIST_VIEW_PATHS = {
  all: "/projects",
  planning: "/projects?view=planning",
  inProgress: "/projects?view=in-progress",
  pendingApproval: "/projects?view=pending-approval",
  paymentDue: "/projects?view=payment-due",
  /** Canonical Completed Projects list. */
  completed: "/projects?view=completed",
  /** @deprecated Alias kept for old links / revalidation — prefer `completed`. */
  history: "/projects?view=history",
} as const;

/**
 * All Projects overview — live projects except History (COMPLETED).
 * Excludes CANCELLED and legacy ON_HOLD from the product surface.
 */
export const PROJECT_ALL_LIST_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "WAITING_FOR_APPROVAL",
  "OFF_SITE",
] as const satisfies readonly ProjectStatus[];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNED: "Planning",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_APPROVAL: "Pending Approval",
  OFF_SITE: "Off-site",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function isProjectStatus(value: string): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value);
}

export function getProjectStatusLabel(
  value: ProjectStatus | string | null | undefined
): string {
  if (!value || !isProjectStatus(value)) return "-";
  return PROJECT_STATUS_LABELS[value];
}

/** Workflow labels used in Projects directory tables (sidebar stages). */
export const PROJECT_WORKFLOW_STATUS_LABELS = [
  "Planning",
  "In Progress",
  "Pending Approval",
  "Off-site",
  "Awaiting payment",
  "Payment Due",
  "Completed",
] as const;

export type ProjectWorkflowStatusLabel =
  (typeof PROJECT_WORKFLOW_STATUS_LABELS)[number];

/**
 * Map DB status (+ payment-due context) to directory workflow labels.
 * Legacy ON_HOLD / CANCELLED map to nearest live stages (no product chrome).
 */
export function getProjectWorkflowStatusLabel(opts: {
  status: ProjectStatus | string | null | undefined;
  paymentDue?: boolean;
  /** Last GC/Facade part invoiced, unpaid — show Awaiting payment, not In Progress. */
  awaitingPayment?: boolean;
}): ProjectWorkflowStatusLabel | string {
  if (opts.awaitingPayment) return "Awaiting payment";
  if (opts.paymentDue) return "Payment Due";

  switch (opts.status) {
    case "PLANNED":
      return "Planning";
    case "IN_PROGRESS":
    case "ON_HOLD":
    case "WAITING_FOR_APPROVAL":
      return "In Progress";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Planning";
    default:
      return getProjectStatusLabel(opts.status);
  }
}

export function projectWorkflowStatusBadge(
  label: string
): "active" | "inactive" | "pending" | "success" | "warning" | "danger" {
  switch (label) {
    case "In Progress":
      return "active";
    case "Completed":
      return "success";
    case "Payment Due":
    case "Awaiting payment":
      return "warning";
    case "Pending Approval":
    case "Off-site":
      return "warning";
    case "Planning":
    default:
      return "pending";
  }
}

export function isPlanningProjectStatus(
  value: ProjectStatus | string | null | undefined
): boolean {
  return value === PROJECT_PLANNING_STATUS;
}

/** CICO / progress may run — review of one period does not stop the site. */
export function isProjectOpenForSiteWork(
  value: ProjectStatus | string | null | undefined
): boolean {
  return (
    !!value &&
    (PROJECT_SITE_WORK_STATUSES as readonly string[]).includes(value)
  );
}
