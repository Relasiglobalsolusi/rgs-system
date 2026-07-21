import type {
  ClientReviewKind,
  ClientReviewStatus,
  InvoicePeriodStatus,
} from "@prisma/client";

/** Periods waiting on the client portal (Approve / Revise). */
export const CLIENT_PENDING_REVIEW_STATUSES: ClientReviewStatus[] = [
  "AWAITING_CLIENT",
  "HO_REJECTED_REVISION",
];

/** Revised by client — HO Finance → Reconciliation (Revised tab). */
export const HO_REVISED_QUEUE_STATUSES: ClientReviewStatus[] = [
  "CLIENT_REVISED",
];

/** Client already approved (or HO accepted a revision) — ready / done for invoice. */
export const APPROVED_REVIEW_STATUSES: ClientReviewStatus[] = [
  "CLIENT_APPROVED",
  "HO_APPROVED_REVISION",
];

export function isAwaitingClientAction(
  status: ClientReviewStatus | string | null | undefined
): boolean {
  return CLIENT_PENDING_REVIEW_STATUSES.includes(
    status as ClientReviewStatus
  );
}

export function isInHoRevisedQueue(
  status: ClientReviewStatus | string | null | undefined
): boolean {
  return HO_REVISED_QUEUE_STATUSES.includes(status as ClientReviewStatus);
}

export function canIssueInvoiceAfterReview(
  status: ClientReviewStatus | string | null | undefined
): boolean {
  return APPROVED_REVIEW_STATUSES.includes(status as ClientReviewStatus);
}

export function isClientReviewPeriodStatus(
  status: InvoicePeriodStatus | string | null | undefined
): boolean {
  return status === "AWAITING_CLIENT_REVIEW";
}

export function reviewKindLabel(
  kind: ClientReviewKind | string | null | undefined
): string {
  if (kind === "PROGRESS") return "Progress";
  if (kind === "RECONCILIATION") return "Reconciliation";
  return "Review";
}

/** Proof / note uploads for client↔HO review rounds. */
export const CLIENT_REVIEW_PROOF_FOLDER = "uploads/client-review-proofs";
export const CLIENT_REVIEW_PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const CLIENT_REVIEW_PROOF_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);
