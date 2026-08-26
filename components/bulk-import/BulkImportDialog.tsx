"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Download, FileSpreadsheet, Plus, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import {
  formatBulkImportPreviewSummary,
  formatBulkImportSummary,
  type BulkImportPreview,
  type BulkImportPreviewRow,
  type BulkImportPreviewStatus,
  type BulkImportResult,
} from "@/lib/bulk-import/types";
import { localizeInventoryItemType } from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/locale";
import { useLocale } from "@/lib/i18n/use-locale";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

const MAX_REJECTION_REASONS = 25;

type BulkImportBusyAction = "review" | "confirm" | "template" | null;

function isBulkImportPreview(value: unknown): value is BulkImportPreview {
  if (!value || typeof value !== "object") return false;
  const candidate = value as BulkImportPreview;
  return (
    Array.isArray(candidate.rows) &&
    typeof candidate.readyCount === "number" &&
    typeof candidate.warningCount === "number" &&
    typeof candidate.skippedCount === "number" &&
    typeof candidate.invalidCount === "number"
  );
}

function formatRowRejectionReasons(
  rows: Array<{ row: number; message: string }>,
  t: (key: string, params?: Record<string, string | number>) => string
): string[] {
  return rows.slice(0, MAX_REJECTION_REASONS).map((issue) =>
    t("bulkImport.rowIssue", {
      row: issue.row,
      message: issue.message,
    })
  );
}

function statusLabel(
  status: BulkImportPreviewStatus,
  t: (key: string) => string
) {
  switch (status) {
    case "ready":
      return t("bulkImport.willAdd");
    case "warning":
      return t("bulkImport.willAddWithWarning");
    case "duplicate":
      return t("bulkImport.duplicate");
    case "invalid":
      return t("bulkImport.invalid");
  }
}

function statusClass(status: BulkImportPreviewStatus) {
  switch (status) {
    case "ready":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
    case "warning":
      return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
    case "duplicate":
      return "bg-slate-500/20 text-muted ring-slate-500/30";
    case "invalid":
      return "bg-rose-500/15 text-rose-300 ring-rose-500/30";
  }
}

function primaryField(row: BulkImportPreviewRow) {
  return row.fields["Item Name"] ?? "—";
}

function secondaryField(row: BulkImportPreviewRow, locale: AppLocale) {
  const itemType = row.fields["Item Type"]?.trim();
  return [
    itemType ? localizeInventoryItemType(itemType, locale) : null,
    row.fields.Description,
  ]
    .filter((value) => value && value !== "—")
    .join(" · ");
}

function IssueList({
  title,
  issues,
  t,
}: {
  title: string;
  issues: BulkImportResult["errors"];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (issues.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-elevated px-4 py-3">
      <p className="text-sm font-medium text-text">{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm leading-5 text-muted">
        {issues.map((issue) => (
          <li key={`${issue.row}-${issue.message}`}>
            {t("bulkImport.rowIssue", {
              row: issue.row,
              message: issue.message,
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewList({
  preview,
  t,
  locale,
}: {
  preview: BulkImportPreview;
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: AppLocale;
}) {
  return (
    <div className="flex max-h-[22rem] flex-col gap-2 overflow-y-auto pr-1">
      {preview.rows.map((row) => (
        <div
          key={`${row.rowNumber}-${row.status}-${primaryField(row)}`}
          className="rounded-xl border border-border bg-elevated px-3.5 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-medium text-text">
                {t("bulkImport.rowLabel", {
                  row: row.rowNumber,
                  name: primaryField(row),
                })}
              </p>
              <p className="truncate text-xs leading-5 text-muted">
                {secondaryField(row, locale) || t("bulkImport.noExtraDetails")}
              </p>
              {row.message ? (
                <p
                  className={cn(
                    "text-xs leading-5",
                    row.status === "warning"
                      ? "text-amber-200/90"
                      : "text-muted"
                  )}
                >
                  {row.message}
                </p>
              ) : null}
            </div>
            <span
              className={cn(
                "shrink-0 rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset",
                statusClass(row.status)
              )}
            >
              {statusLabel(row.status, t)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateUrl: string;
  onPreview: (formData: FormData) => Promise<BulkImportPreview>;
  onConfirm: (formData: FormData) => Promise<BulkImportResult>;
};

export default function BulkImportDialog({
  open,
  onOpenChange,
  templateUrl,
  onPreview,
  onConfirm,
}: Props) {
  const { t } = useT();
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<BulkImportPreview | null>(null);
  const [lastResult, setLastResult] = useState<BulkImportResult | null>(null);
  const [busyAction, setBusyAction] = useState<BulkImportBusyAction>(null);

  const pending = busyAction !== null;
  const plural = t("pages.itemCatalog.title").toLowerCase();
  const step: "upload" | "preview" | "done" = lastResult
    ? "done"
    : preview
      ? "preview"
      : "upload";

  function clearFileInput() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function resetState() {
    setFile(null);
    setDragActive(false);
    setPreview(null);
    setLastResult(null);
    setBusyAction(null);
    setFileInputKey((key) => key + 1);
    clearFileInput();
  }

  function resetToUploadStep() {
    setPreview(null);
    setLastResult(null);
    setBusyAction(null);
    setFileInputKey((key) => key + 1);
    clearFileInput();
  }

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      resetState();
    }
    onOpenChange(next);
  }

  function acceptFile(next: File | null | undefined) {
    if (!next) return;
    const name = next.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      showRejection({
        title: t("ui.rejectionNotice.validationTitle"),
        description: t("ui.rejectionNotice.validationDescription"),
        reasons: t("bulkImport.uploadExcelRequired"),
      });
      return;
    }
    setFile(next);
    setPreview(null);
    setLastResult(null);
    setBusyAction(null);
    clearFileInput();
  }

  function handleDownloadTemplate(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (pending) return;

    void (async () => {
      setBusyAction("template");
      try {
        const url = new URL(templateUrl, window.location.origin);
        url.searchParams.set("locale", locale);
        const response = await fetch(url.toString(), {
          method: "GET",
          credentials: "same-origin",
        });

        if (!response.ok) {
          let message = t("bulkImport.templateDownloadFailed");
          try {
            const payload = (await response.json()) as { error?: string };
            if (payload.error) message = payload.error;
          } catch {
            // non-JSON error body
          }
          showRejection({
            title: t("ui.rejectionNotice.validationTitle"),
            reasons: message,
          });
          return;
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          showRejection({
            title: t("ui.rejectionNotice.validationTitle"),
            reasons: t("bulkImport.templateEmpty"),
          });
          return;
        }

        const disposition = response.headers.get("Content-Disposition") ?? "";
        const matched = /filename="([^"]+)"/i.exec(disposition);
        const filename =
          matched?.[1] ?? "rgs-inventory-items-import-template.xlsx";

        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      } catch (error) {
        showRejectionFromError(
          error,
          t("bulkImport.templateDownloadFailed"),
          { title: t("ui.rejectionNotice.validationTitle") }
        );
      } finally {
        setBusyAction(null);
      }
    })();
  }

  function handleReview() {
    if (pending) return;
    if (!file) {
      showRejection({
        title: t("ui.rejectionNotice.validationTitle"),
        description: t("ui.rejectionNotice.validationDescription"),
        reasons: t("bulkImport.chooseExcel"),
      });
      return;
    }

    void (async () => {
      setBusyAction("review");
      try {
        const formData = new FormData();
        formData.set("file", file);
        const nextPreview = await onPreview(formData);

        if (!isBulkImportPreview(nextPreview)) {
          showRejectionFromError(
            new Error(t("bulkImport.invalidReviewResponse")),
            t("bulkImport.reviewFailed", { plural }),
            {
              title: t("ui.rejectionNotice.importTitle"),
              description: t("ui.rejectionNotice.importDescription"),
            }
          );
          return;
        }

        setPreview(nextPreview);
        setLastResult(null);

        if (nextPreview.rows.length === 0) {
          showRejection({
            title: t("ui.rejectionNotice.importTitle"),
            description: t("ui.rejectionNotice.importDescription"),
            reasons: t("bulkImport.noDataRows"),
          });
          return;
        }

        const invalidRows = nextPreview.rows
          .filter((row) => row.status === "invalid")
          .map((row) => ({
            row: row.rowNumber,
            message: row.message?.trim() || t("bulkImport.invalidRow"),
          }));

        if (invalidRows.length > 0) {
          showRejection({
            title: t("ui.rejectionNotice.importTitle"),
            description: t("ui.rejectionNotice.importDescription"),
            reasons: formatRowRejectionReasons(invalidRows, t),
          });
        } else if (nextPreview.readyCount === 0) {
          showRejection({
            title: t("ui.rejectionNotice.importTitle"),
            description: t("ui.rejectionNotice.importDescription"),
            reasons: formatBulkImportPreviewSummary(nextPreview),
          });
        }
      } catch (error) {
        showRejectionFromError(
          error,
          t("bulkImport.reviewFailed", { plural }),
          {
            title: t("ui.rejectionNotice.importTitle"),
            description: t("ui.rejectionNotice.importDescription"),
          }
        );
      } finally {
        setBusyAction(null);
      }
    })();
  }

  function handleConfirm() {
    if (pending) return;
    if (!file) {
      showRejection({
        title: t("ui.rejectionNotice.validationTitle"),
        description: t("ui.rejectionNotice.validationDescription"),
        reasons: t("bulkImport.chooseExcel"),
      });
      return;
    }

    void (async () => {
      setBusyAction("confirm");
      try {
        const formData = new FormData();
        formData.set("file", file);
        const result = await onConfirm(formData);
        setLastResult(result);

        const summary = formatBulkImportSummary(result);

        if (result.failedCount === 0 && result.skippedCount === 0) {
          toast.success(summary);
          handleOpenChange(false);
          return;
        }

        const rejectReasons = [
          ...formatRowRejectionReasons(result.errors, t),
          ...formatRowRejectionReasons(result.skips, t),
        ];

        if (rejectReasons.length > 0) {
          showRejection({
            title: t("ui.rejectionNotice.importTitle"),
            description: `${summary}. ${t("ui.rejectionNotice.importDescription")}`,
            reasons: rejectReasons,
          });
          return;
        }

        if (result.createdCount === 0 && result.failedCount > 0) {
          showRejection({
            title: t("ui.rejectionNotice.importTitle"),
            description: t("ui.rejectionNotice.importDescription"),
            reasons: summary,
          });
          return;
        }

        toast.warning(summary);
      } catch (error) {
        showRejectionFromError(
          error,
          t("bulkImport.importFailed", { plural }),
          { title: t("ui.rejectionNotice.importTitle") }
        );
      } finally {
        setBusyAction(null);
      }
    })();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <EmployeeDialogShell
        icon={FileSpreadsheet}
        title={t("bulkImport.inventoryItemsTitle")}
        description={
          step === "preview"
            ? t("bulkImport.previewDescription")
            : t("bulkImport.uploadDescription", { plural })
        }
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            {step === "upload" ? (
              <EmployeePrimaryButton
                type="button"
                disabled={pending || !file}
                onClick={handleReview}
              >
                {busyAction === "review"
                  ? t("bulkImport.readingFile")
                  : t("bulkImport.reviewImport")}
              </EmployeePrimaryButton>
            ) : null}

            {step === "preview" ? (
              <>
                <EmployeePrimaryButton
                  type="button"
                  disabled={pending || !preview || preview.readyCount === 0}
                  onClick={handleConfirm}
                >
                  {busyAction === "confirm"
                    ? t("common.actions.adding")
                    : preview
                      ? t("bulkImport.confirmAddCount", {
                          count: preview.readyCount,
                        })
                      : t("bulkImport.confirmAdd")}
                </EmployeePrimaryButton>
                <EmployeeSecondaryButton
                  closesDialog={false}
                  disabled={pending}
                  onClick={resetToUploadStep}
                >
                  {t("common.actions.back")}
                </EmployeeSecondaryButton>
              </>
            ) : null}

            {step === "done" ? (
              <EmployeePrimaryButton
                type="button"
                disabled={pending}
                onClick={() => handleOpenChange(false)}
              >
                {t("common.actions.done")}
              </EmployeePrimaryButton>
            ) : null}

            {step !== "done" ? (
              <EmployeeSecondaryButton
                disabled={pending}
                onClick={() => handleOpenChange(false)}
              >
                {t("common.actions.cancel")}
              </EmployeeSecondaryButton>
            ) : null}
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          {step === "upload" ? (
            <>
              <input
                key={fileInputKey}
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="sr-only"
                onChange={(event) => acceptFile(event.target.files?.[0])}
              />

              <button
                type="button"
                disabled={pending}
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  acceptFile(event.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition",
                  dragActive
                    ? "border-primary/60 bg-primary/10"
                    : "border-border bg-elevated hover:border-border-strong hover:bg-card-hover",
                  pending && "pointer-events-none opacity-60"
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated ring-1 ring-border">
                  {file ? (
                    <Upload className="h-5 w-5 text-primary" />
                  ) : (
                    <Plus className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-text">
                    {file ? file.name : t("bulkImport.dropFile")}
                  </p>
                  <p className="text-xs leading-5 text-muted">
                    {file
                      ? t("bulkImport.chooseDifferent")
                      : t("bulkImport.acceptsXlsx")}
                  </p>
                </div>
              </button>

              <a
                href={`${templateUrl}${templateUrl.includes("?") ? "&" : "?"}locale=${locale}`}
                download
                onClick={handleDownloadTemplate}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-elevated text-sm font-medium text-text transition hover:bg-card-hover"
              >
                <Download className="h-4 w-4" />
                {busyAction === "template"
                  ? t("bulkImport.preparingTemplate")
                  : t("bulkImport.downloadExcelTemplate")}
              </a>
            </>
          ) : null}

          {step === "preview" && preview ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-border bg-elevated px-4 py-3">
                <p className="text-sm font-medium text-text">
                  {formatBulkImportPreviewSummary(preview)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t("bulkImport.invalidSkipped")}
                </p>
              </div>
              <PreviewList preview={preview} t={t} locale={locale} />
            </div>
          ) : null}

          {step === "done" && lastResult ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-border bg-elevated px-4 py-3">
                <p className="text-sm font-medium text-text">
                  {formatBulkImportSummary(lastResult)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t("bulkImport.createdInventoryItemsNote")}
                </p>
              </div>
              <IssueList
                title={t("bulkImport.skipped")}
                issues={lastResult.skips}
                t={t}
              />
              <IssueList
                title={t("bulkImport.failed")}
                issues={lastResult.errors}
                t={t}
              />
            </div>
          ) : null}
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
