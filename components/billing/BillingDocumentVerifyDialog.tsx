"use client";

import { useRef, type FormEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ShieldCheck, Upload } from "lucide-react";

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
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useT();

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold text-text">
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-elevated px-4 py-4 text-sm transition",
          "hover:border-primary/40 hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50",
          fileName ? "text-text" : "text-muted"
        )}
      >
        <Upload className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {fileName ?? t("pages.billing.paymentReceivedDropOrBrowse")}
        </span>
      </button>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          onPick(event.target.files?.[0] ?? null);
        }}
      />
    </div>
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
  fileInputId: string;
  fileLabel: string;
  fileName: string | null;
  onFilePick: (file: File | null) => void;
  /** Optional compact note under the dropzone (AI verify hint, PPN note, etc.). */
  callout?: string;
  calloutIcon?: LucideIcon;
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
  callout,
  calloutIcon,
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

            <BillingDocumentFilePick
              id={fileInputId}
              label={fileLabel}
              required
              fileName={fileName}
              onPick={onFilePick}
              disabled={pending}
            />

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
              "mt-0 shrink-0 flex-col gap-0 rounded-none border-t border-border bg-strip py-6 sm:flex-col sm:py-7",
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
