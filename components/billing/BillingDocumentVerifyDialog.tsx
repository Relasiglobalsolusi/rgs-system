"use client";

import { type FormEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ShieldCheck } from "lucide-react";

import {
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogInsetClass,
} from "@/components/employees/employee-dialog-ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DOCUMENT_FILE_ACCEPT,
  FileDropField,
  preventBrowserFileNavigation,
} from "@/components/ui/FileDropField";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export function BillingDocumentFilePick({
  id,
  label,
  required,
  fileName,
  onPick,
  disabled,
}: {
  id: string;
  label: string;
  required?: boolean;
  fileName: string | null;
  onPick: (file: File | null) => void;
  disabled?: boolean;
}) {
  return (
    <FileDropField
      id={id}
      label={label}
      required={required}
      fileName={fileName}
      onPick={onPick}
      disabled={disabled}
      accept={DOCUMENT_FILE_ACCEPT}
    />
  );
}

function DocumentCallout({
  icon: Icon = ShieldCheck,
  children,
}: {
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-elevated px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="text-xs leading-5 text-muted">{children}</p>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: string;
  description: string;
  contextLabel: string;
  contextValue: string;
  fileInputId?: string;
  fileLabel?: string;
  fileName?: string | null;
  onFilePick?: (file: File | null) => void;
  showFilePick?: boolean;
  requireReason?: boolean;
  reasonValue?: string;
  onReasonChange?: (value: string) => void;
  /** Optional compact note under the dropzone (PPN note, payment hint, etc.). */
  callout?: string;
  calloutIcon?: LucideIcon;
  /** Extra fields between file pick and callout (e.g. editable PPN rate). */
  children?: ReactNode;
  /** Hide the Relasi Global Solusi server banner. */
  showServerBanner?: boolean;
  error: string | null;
  pending: boolean;
  canSubmit: boolean;
  confirmLabel: string;
  pendingLabel: string;
  onSubmit: (event: FormEvent) => void | Promise<void>;
};

/**
 * Shared panel chrome for billing document upload dialogs
 * (tax invoice / payment proof / purchase tax invoice).
 * Matches Add Employee / Add Client: opaque bg-panel, icon header, strip footer.
 */
export default function BillingDocumentVerifyDialog({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  contextLabel,
  contextValue,
  fileInputId,
  fileLabel,
  fileName,
  onFilePick,
  showFilePick = true,
  requireReason = false,
  reasonValue = "",
  onReasonChange,
  callout,
  calloutIcon,
  children,
  showServerBanner = true,
  error,
  pending,
  canSubmit,
  confirmLabel,
  pendingLabel,
  onSubmit,
}: Props) {
  const { t } = useT();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={!pending}
        onDragOver={preventBrowserFileNavigation}
        onDrop={preventBrowserFileNavigation}
        className={cn(
          "flex max-h-[min(94vh,40rem)] w-[calc(100%-1.5rem)] min-w-[min(100%,20rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-panel p-0 text-text ring-0",
          "sm:w-full sm:min-w-[min(100%,28rem)] sm:max-w-md"
        )}
      >
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div
            className={cn("shrink-0 bg-panel pt-6 pb-5", employeeDialogInsetClass)}
          >
            <DialogHeader className="gap-3 text-left">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-elevated ring-1 ring-border">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-xl font-semibold text-text">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted">
                {description}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 space-y-5 overflow-y-auto pb-6",
              employeeDialogInsetClass
            )}
          >
            <div className="rounded-xl border border-border bg-elevated px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-subtle">
                {contextLabel}
              </p>
              <p className="mt-1 text-sm font-medium text-text">{contextValue}</p>
            </div>

            {showFilePick && fileInputId && fileLabel && onFilePick ? (
              <BillingDocumentFilePick
                id={fileInputId}
                label={fileLabel}
                required
                fileName={fileName ?? null}
                onPick={onFilePick}
                disabled={pending}
              />
            ) : null}

            {children}

            {requireReason ? (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text">
                  {t("pages.billing.inHouseVerifyReason")}
                  <span className="text-red-400"> *</span>
                </label>
                <Textarea
                  value={reasonValue}
                  onChange={(event) => onReasonChange?.(event.target.value)}
                  disabled={pending}
                  required
                  placeholder={t("pages.billing.inHouseVerifyReasonPlaceholder")}
                />
              </div>
            ) : null}

            {showServerBanner ? (
              <DocumentCallout>
                {t("pages.billing.inHouseVerifyBanner")}
              </DocumentCallout>
            ) : null}

            {callout ? (
              <DocumentCallout icon={calloutIcon}>{callout}</DocumentCallout>
            ) : null}

            {error ? (
              <p
                className="whitespace-pre-line text-sm text-red-400"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter
            className={cn(
              "mt-0 shrink-0 flex-col gap-3 rounded-none border-t border-border bg-strip py-6 sm:flex-col sm:py-7",
              employeeDialogInsetClass
            )}
          >
            <div className="flex w-full flex-col gap-3">
              <EmployeePrimaryButton
                type="submit"
                disabled={pending || !canSubmit}
              >
                {pending ? pendingLabel : confirmLabel}
              </EmployeePrimaryButton>
              <EmployeeSecondaryButton
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                {t("common.actions.cancel")}
              </EmployeeSecondaryButton>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
