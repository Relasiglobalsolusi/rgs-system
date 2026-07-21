export type BulkImportIssue = {
  row: number;
  message: string;
};

export type BulkImportResult = {
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  errors: BulkImportIssue[];
  skips: BulkImportIssue[];
};

export type BulkImportPreviewStatus =
  | "ready"
  | "warning"
  | "duplicate"
  | "invalid";

export type BulkImportPreviewRow = {
  rowNumber: number;
  status: BulkImportPreviewStatus;
  message?: string;
  /** Short labels for the preview table (entity-specific). */
  fields: Record<string, string>;
};

export type BulkImportPreview = {
  rows: BulkImportPreviewRow[];
  /** Rows that can be confirmed (ready + warning). */
  readyCount: number;
  warningCount: number;
  skippedCount: number;
  invalidCount: number;
};

export function createBulkImportResult(): BulkImportResult {
  return {
    createdCount: 0,
    skippedCount: 0,
    failedCount: 0,
    errors: [],
    skips: [],
  };
}

export function createBulkImportPreview(
  rows: BulkImportPreviewRow[]
): BulkImportPreview {
  const readyOnlyCount = rows.filter((row) => row.status === "ready").length;
  const warningCount = rows.filter((row) => row.status === "warning").length;
  return {
    rows,
    // Warning rows are still confirmable (soft notice, not invalid).
    readyCount: readyOnlyCount + warningCount,
    warningCount,
    skippedCount: rows.filter((row) => row.status === "duplicate").length,
    invalidCount: rows.filter((row) => row.status === "invalid").length,
  };
}

const MAX_ISSUES = 50;

export function recordImportCreated(result: BulkImportResult) {
  result.createdCount += 1;
}

export function recordImportSkipped(
  result: BulkImportResult,
  row: number,
  message: string
) {
  result.skippedCount += 1;
  if (result.skips.length < MAX_ISSUES) {
    result.skips.push({ row, message });
  }
}

export function recordImportFailed(
  result: BulkImportResult,
  row: number,
  message: string
) {
  result.failedCount += 1;
  if (result.errors.length < MAX_ISSUES) {
    result.errors.push({ row, message });
  }
}

export function formatBulkImportSummary(
  entityLabel: string,
  result: BulkImportResult
): string {
  const parts = [
    `${result.createdCount} ${entityLabel}${result.createdCount === 1 ? "" : "s"} created`,
  ];

  if (result.skippedCount > 0) {
    parts.push(`${result.skippedCount} skipped`);
  }

  if (result.failedCount > 0) {
    parts.push(`${result.failedCount} failed`);
  }

  return parts.join(" · ");
}

function bulkImportPlural(entityLabel: string): string {
  if (entityLabel === "client") return "clients";
  if (entityLabel === "vendor") return "vendors";
  if (entityLabel === "project") return "projects";
  return "employees";
}

export function formatBulkImportPreviewSummary(
  entityLabel: string,
  preview: BulkImportPreview
): string {
  const plural = bulkImportPlural(entityLabel);
  const parts = [
    `${preview.readyCount} ${preview.readyCount === 1 ? entityLabel : plural} ready to add`,
  ];

  if (preview.warningCount > 0) {
    parts.push(`${preview.warningCount} with warnings`);
  }

  if (preview.skippedCount > 0) {
    parts.push(`${preview.skippedCount} will be skipped`);
  }

  if (preview.invalidCount > 0) {
    parts.push(`${preview.invalidCount} invalid`);
  }

  return parts.join(" · ");
}
