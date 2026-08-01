import type { ProjectStatus } from "@prisma/client";

export const PROJECT_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
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

/** Field operations (CICO, progress) — only once work order is received. */
export const PROJECT_FIELD_STATUSES = [
  "IN_PROGRESS",
] as const satisfies readonly ProjectStatus[];

/**
 * In Progress sidebar view — work-order active only.
 * Legacy ON_HOLD is not listed here (find under All Projects).
 */
export const PROJECT_IN_PROGRESS_LIST_STATUSES = [
  "IN_PROGRESS",
] as const satisfies readonly ProjectStatus[];

/** Canonical Projects sidebar view URLs (for navigation + revalidation). */
export const PROJECT_LIST_VIEW_PATHS = {
  all: "/projects",
  planning: "/projects?view=planning",
  inProgress: "/projects?view=in-progress",
  paymentDue: "/projects?view=payment-due",
  /** Canonical Completed Projects list. */
  completed: "/projects?view=completed",
  /** @deprecated Alias kept for old links / revalidation — prefer `completed`. */
  history: "/projects?view=history",
} as const;

/**
 * All Projects overview — live projects except History (COMPLETED).
 * Excludes CANCELLED from the product surface. Legacy ON_HOLD may still appear
 * with a clear On Hold label; app actions no longer write ON_HOLD / CANCELLED.
 */
export const PROJECT_ALL_LIST_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
] as const satisfies readonly ProjectStatus[];

/** @deprecated Prefer PROJECT_IN_PROGRESS_LIST_STATUSES */
export const PROJECT_ACTIVE_LIST_STATUSES = PROJECT_IN_PROGRESS_LIST_STATUSES;

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNED: "Planning",
  IN_PROGRESS: "In Progress",
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
  "Payment Due",
  "Completed",
] as const;

export type ProjectWorkflowStatusLabel =
  (typeof PROJECT_WORKFLOW_STATUS_LABELS)[number];

/**
 * Map DB status (+ payment-due context) to directory workflow labels.
 * Legacy ON_HOLD / CANCELLED keep distinct labels when they appear; subcategory
 * is never included.
 */
export function getProjectWorkflowStatusLabel(opts: {
  status: ProjectStatus | string | null | undefined;
  paymentDue?: boolean;
}): ProjectWorkflowStatusLabel | string {
  if (opts.paymentDue) return "Payment Due";

  switch (opts.status) {
    case "PLANNED":
      return "Planning";
    case "IN_PROGRESS":
      return "In Progress";
    case "ON_HOLD":
      return "On Hold";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
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
      return "warning";
    case "On Hold":
      return "inactive";
    case "Cancelled":
      return "danger";
    case "Planning":
    default:
      return "pending";
  }
}

/**
 * Two-line chip lines for long workflow labels inside the fixed StatusBadge.
 * Single-word labels (Planning, Completed) return null — use children as-is.
 */
export function projectWorkflowStatusChipLines(
  label: string
): readonly [string, string] | null {
  switch (label) {
    case "In Progress":
      return ["In", "Progress"];
    case "Payment Due":
      return ["Payment", "Due"];
    default:
      return null;
  }
}

export function isPlanningProjectStatus(
  value: ProjectStatus | string | null | undefined
): boolean {
  return value === PROJECT_PLANNING_STATUS;
}

export function isFieldOpsProjectStatus(
  value: ProjectStatus | string | null | undefined
): boolean {
  return (
    !!value &&
    (PROJECT_FIELD_STATUSES as readonly string[]).includes(value)
  );
}
