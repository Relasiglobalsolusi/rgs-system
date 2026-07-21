"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { formatDateForInput } from "@/lib/format-tenure";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";

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

export const employeeInputClass =
  "h-11 w-full rounded-xl border border-border bg-elevated px-4 text-sm text-text shadow-none placeholder:text-subtle focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/10";

export const employeeSelectTriggerClass =
  "h-11 w-full rounded-xl border border-border bg-elevated px-4 text-sm text-text shadow-none data-placeholder:text-subtle focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/10";

/** High-contrast field label for bright dialog surfaces. */
export const employeeDialogLabelClass = "text-sm font-semibold text-text";

/** Supporting hint / helper under a field. */
export const employeeDialogHintClass = "text-xs leading-5 text-muted";

/** Shared horizontal inset â€” header, body, and footer stay aligned. */
export const employeeDialogInsetClass = "px-6 sm:px-10";

/** Vertical stack for form fields inside the shell body (padding comes from the shell). */
export const employeeDialogFormClass = "flex flex-col gap-6";

/** Spacing between major form sections (e.g. Organization / Contact person). */
export const employeeDialogSectionsClass = "flex flex-col gap-8";

/** Spacing within a section (heading â†’ field grid). */
export const employeeDialogSectionClass = "flex flex-col gap-6";

/** Label â†’ control gap for a single field. */
export const employeeDialogFieldClass = "flex flex-col gap-2.5";

/** Two-column paired fields with wider gutters than outer margins alone. */
export const employeeDialogGridClass =
  "grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-5";

/** Section title block used above field grids. */
export const employeeDialogSectionHeadingClass =
  "flex flex-col gap-1.5 border-b border-border pb-4";

export type EmployeeDialogOpenChangeDetails = {
  cancel: () => void;
};

export function handleEmployeeDialogOpenChange(
  nextOpen: boolean,
  eventDetails: EmployeeDialogOpenChangeDetails | undefined,
  {
    isDirty,
    onOpen,
    onClose,
    onRequestExitConfirm,
  }: {
    isDirty: boolean;
    onOpen: () => void;
    onClose: () => void;
    onRequestExitConfirm: () => void;
  }
) {
  if (nextOpen) {
    onOpen();
    return;
  }

  if (!isDirty) {
    onClose();
    return;
  }

  eventDetails?.cancel();
  onRequestExitConfirm();
}

export type HtmlFormDirtyBaseline = {
  form: string;
  controlled: string;
};

export function serializeHtmlForm(form: HTMLFormElement): string {
  const entries: [string, string][] = [];
  const formData = new FormData(form);

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      entries.push([key, value]);
    } else {
      entries.push([key, `file:${value.name}:${value.size}:${value.type}`]);
    }
  }

  entries.sort((left, right) => {
    const keyCmp = left[0].localeCompare(right[0]);
    return keyCmp !== 0 ? keyCmp : left[1].localeCompare(right[1]);
  });

  return JSON.stringify(entries);
}

export function captureHtmlFormBaseline(
  formId: string,
  controlledSignature: string
): HtmlFormDirtyBaseline | null {
  if (typeof window === "undefined") {
    return null;
  }

  const form = document.getElementById(formId);
  if (!(form instanceof HTMLFormElement)) {
    return null;
  }

  return {
    form: serializeHtmlForm(form),
    controlled: controlledSignature,
  };
}

export function useHtmlFormDirty(
  formId: string,
  controlledSignature: string,
  baseline: HtmlFormDirtyBaseline | null
) {
  const [formRevision, setFormRevision] = useState(0);

  useEffect(() => {
    setFormRevision((current) => current + 1);
  }, [controlledSignature]);

  const handleFormInput = useCallback(() => {
    setFormRevision((current) => current + 1);
  }, []);

  const isDirty = useMemo(() => {
    if (!baseline || typeof window === "undefined") {
      return false;
    }

    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) {
      return false;
    }

    void formRevision;
    return (
      serializeHtmlForm(form) !== baseline.form ||
      controlledSignature !== baseline.controlled
    );
  }, [baseline, controlledSignature, formId, formRevision]);

  return {
    isDirty,
    handleFormInput,
    resetDirtyTracking: () => setFormRevision(0),
  };
}

type EmployeeDialogShellProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
};

export function EmployeeDialogShell({
  icon: Icon,
  title,
  description,
  children,
  footer,
  maxWidth = "xl",
}: EmployeeDialogShellProps) {
  // sm/md stay compact for confirms; lg/xl are form create/edit panels.
  const widthClass =
    maxWidth === "sm"
      ? "sm:max-w-md"
      : maxWidth === "md"
        ? "sm:max-w-lg"
        : maxWidth === "lg"
          ? "sm:max-w-6xl"
          : "sm:max-w-7xl";

  const isFormPanel = maxWidth === "lg" || maxWidth === "xl";

  return (
    <DialogContent
      className={cn(
        // Header + footer stay put; only the body scrolls so the close X remains visible.
        "flex flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-panel p-0 text-text ring-0",
        isFormPanel
          ? "max-h-[min(96vh,72rem)]"
          : "max-h-[min(94vh,64rem)]",
        "w-[calc(100%-1.5rem)] min-w-[min(100%,20rem)] sm:w-full",
        isFormPanel
          ? maxWidth === "xl"
            ? "sm:min-w-[min(100%,64rem)]"
            : "sm:min-w-[min(100%,56rem)]"
          : "sm:min-w-[min(100%,28rem)]",
        widthClass
      )}
    >
      <div
        className={cn(
          "shrink-0 bg-panel pt-6 pb-5",
          employeeDialogInsetClass
        )}
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
          // Bottom padding is intentional: keeps last fields clear of the sticky footer
          // and prevents section margins from visually collapsing into the strip.
          "min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
          employeeDialogInsetClass,
          isFormPanel ? "pt-3 pb-14" : "pb-8"
        )}
      >
        {children}
      </div>

      <DialogFooter
        className={cn(
          "mt-0 shrink-0 flex-col gap-0 rounded-none border-t border-border bg-strip py-6 sm:flex-col sm:py-7",
          employeeDialogInsetClass
        )}
      >
        {footer}
      </DialogFooter>
    </DialogContent>
  );
}

export function EmployeePrimaryButton({
  children,
  disabled,
  type = "submit",
  variant = "primary",
  form,
  onClick,
  className,
  title,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  variant?: "primary" | "danger" | "muted";
  form?: string;
  onClick?: () => void;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type={type}
      form={form}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "danger"
          ? "border border-danger/40 bg-card-tint-red text-danger hover:bg-[color-mix(in_srgb,var(--color-card-tint-red),var(--color-danger)_12%)]"
          : variant === "muted"
            ? "border border-accent-slate/40 bg-card-tint-slate text-accent-slate hover:bg-[color-mix(in_srgb,var(--color-card-tint-slate),var(--color-accent-slate)_12%)]"
            : "bg-primary text-neutral-950 hover:bg-primary-dark",
        className
      )}
    >
      {children}
    </button>
  );
}

export function EmployeeSecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-elevated text-sm font-medium text-text transition hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export type EmployeeControlledFormState = {
  categoryId: string;
  positionId: string;
  employmentType: "FULL_TIME" | "PART_TIME";
};

export type EmployeeFormSnapshot = EmployeeControlledFormState & {
  firstName: string;
  lastName: string;
  position: string;
  hiredAt: string;
  email: string;
  phone: string;
  hasFile: boolean;
};

function readFormField(form: HTMLFormElement, name: string): string {
  const field = form.elements.namedItem(name);
  if (!field) {
    return "";
  }

  if (field instanceof RadioNodeList) {
    const selected = Array.from(field).find(
      (element) => element instanceof HTMLInputElement && element.checked
    ) as HTMLInputElement | undefined;
    return selected?.value ?? "";
  }

  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    return field.value;
  }

  if (field instanceof HTMLSelectElement) {
    return field.value;
  }

  return "";
}

export function captureEmployeeFormSnapshot(
  form: HTMLFormElement | null,
  controlled: EmployeeControlledFormState
): EmployeeFormSnapshot | null {
  if (!form) {
    return null;
  }

  const fileField = form.elements.namedItem("idDocument");
  const hasFile =
    fileField instanceof HTMLInputElement &&
    fileField.type === "file" &&
    fileField.files !== null &&
    fileField.files.length > 0;

  return {
    categoryId: controlled.categoryId,
    positionId: controlled.positionId,
    employmentType: controlled.employmentType,
    firstName: readFormField(form, "firstName"),
    lastName: readFormField(form, "lastName"),
    position: readFormField(form, "position"),
    hiredAt: readFormField(form, "hiredAt"),
    email: readFormField(form, "email"),
    phone: readFormField(form, "phone"),
    hasFile,
  };
}

export function areEmployeeFormSnapshotsEqual(
  left: EmployeeFormSnapshot,
  right: EmployeeFormSnapshot
): boolean {
  return (
    left.categoryId === right.categoryId &&
    left.positionId === right.positionId &&
    left.employmentType === right.employmentType &&
    left.firstName === right.firstName &&
    left.lastName === right.lastName &&
    left.position === right.position &&
    left.hiredAt === right.hiredAt &&
    left.email === right.email &&
    left.phone === right.phone &&
    left.hasFile === right.hasFile
  );
}

export function useEmployeeFormDirty(
  formId: string,
  controlled: EmployeeControlledFormState,
  baseline: EmployeeFormSnapshot | null
) {
  const [formRevision, setFormRevision] = useState(0);
  const controlledSignature = useMemo(
    () =>
      JSON.stringify({
        categoryId: controlled.categoryId,
        positionId: controlled.positionId,
        employmentType: controlled.employmentType,
      }),
    [controlled]
  );

  useEffect(() => {
    setFormRevision((current) => current + 1);
  }, [controlledSignature]);

  const handleFormInput = useCallback(() => {
    setFormRevision((current) => current + 1);
  }, []);

  const handleFormChange = useCallback((event: FormEvent<HTMLFormElement>) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement &&
      target.type === "file" &&
      target.name === "idDocument"
    ) {
      setFormRevision((current) => current + 1);
    }
  }, []);

  const isDirty = useMemo(() => {
    if (!baseline || typeof window === "undefined") {
      return false;
    }

    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) {
      return false;
    }

    const current = captureEmployeeFormSnapshot(form, controlled);
    if (!current) {
      return false;
    }

    void formRevision;
    return !areEmployeeFormSnapshotsEqual(baseline, current);
  }, [baseline, controlled, formId, formRevision]);

  return {
    isDirty,
    handleFormInput,
    handleFormChange,
    resetDirtyTracking: () => setFormRevision(0),
  };
}

type EmployeeUnsavedExitDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function buildEmployeeFormBaseline(
  controlled: EmployeeControlledFormState,
  fields: {
    firstName?: string;
    lastName?: string;
    position?: string | null;
    hiredAt?: Date | string | null;
    email?: string;
    phone?: string;
  } = {}
): EmployeeFormSnapshot {
  return {
    categoryId: controlled.categoryId,
    positionId: controlled.positionId,
    employmentType: controlled.employmentType,
    firstName: fields.firstName ?? "",
    lastName: fields.lastName ?? "",
    position: fields.position ?? "",
    hiredAt: formatDateForInput(fields.hiredAt),
    email: fields.email ?? "",
    phone: fields.phone ?? "",
    hasFile: false,
  };
}

export function EmployeeUnsavedExitDialog({
  open,
  onConfirm,
  onCancel,
}: EmployeeUnsavedExitDialogProps) {
  const { t } = useT();

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-2xl border border-border bg-panel p-0 text-text ring-0 sm:max-w-sm"
      >
        <div className="px-8 pt-8 pb-7 sm:px-10">
          <DialogHeader className="items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card-tint-amber ring-1 ring-amber-500/25">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>

            <div className="space-y-2.5">
              <DialogTitle className="text-lg font-semibold text-text">
                {t("common.confirm.unsavedTitle")}
              </DialogTitle>

              <DialogDescription className="text-sm leading-6 text-muted">
                {t("common.confirm.unsavedDescription")}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <DialogFooter
          className={cn(
            // Cancel DialogFooterâ€™s default -mx-4/-mb-4 (meant for p-4 content).
            "mx-0 mb-0 mt-0 flex-col gap-3 rounded-none border-t border-border bg-strip px-8 py-6 sm:flex-col sm:justify-stretch sm:px-10"
          )}
        >
          <EmployeePrimaryButton type="button" variant="danger" onClick={onConfirm}>
            {t("common.confirm.exitWithoutSaving")}
          </EmployeePrimaryButton>
          <EmployeeSecondaryButton onClick={onCancel}>
            {t("common.confirm.keepEditing")}
          </EmployeeSecondaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
