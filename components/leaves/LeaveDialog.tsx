"use client";

import { showRejectionFromError } from "@/components/ui/rejection-notice";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { ClipboardCheck, Plus } from "lucide-react";

import { createLeaveRequest } from "@/app/leaves/actions";
import {
  captureHtmlFormBaseline,
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeUnsavedExitDialog,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogGridClass,
  employeeInputClass,
  handleEmployeeDialogOpenChange,
  useHtmlFormDirty,
  type HtmlFormDirtyBaseline,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { FileDropField } from "@/components/ui/FileDropField";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getLeaveTypeOptions,
  type LeaveRequestType,
} from "@/lib/i18n/leave-type";
import { useLocale } from "@/lib/i18n/use-locale";
import { useT } from "@/lib/i18n/use-t";
import { todayDateInput } from "@/lib/project-contract";
import { cn } from "@/lib/utils";

const FORM_ID = "create-leave-request-form";

export default function LeaveDialog() {
  const { t } = useT();
  const locale = useLocale();
  const leaveTypeOptions = useMemo(
    () => getLeaveTypeOptions(locale),
    [locale]
  );
  const [open, setOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [type, setType] = useState<LeaveRequestType>("PERMISSION");
  const [startDate, setStartDate] = useState(todayDateInput);
  const [endDate, setEndDate] = useState(todayDateInput);
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const controlledSignature = useMemo(
    () => JSON.stringify({ type, startDate, endDate }),
    [type, startDate, endDate]
  );
  const controlledSignatureRef = useRef(controlledSignature);
  controlledSignatureRef.current = controlledSignature;

  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    FORM_ID,
    controlledSignature,
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function resetForm() {
    const today = todayDateInput();
    setType("PERMISSION");
    setStartDate(today);
    setEndDate(today);
    resetDirtyTracking();
  }

  function closeDialog() {
    setOpen(false);
    resetForm();
    setBaseline(null);
  }

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails?: { cancel: () => void }
  ) {
    handleEmployeeDialogOpenChange(nextOpen, eventDetails, {
      isDirty: isDirtyRef.current,
      onOpen: () => {
        setOpen(true);
        resetForm();
      },
      onClose: closeDialog,
      onRequestExitConfirm: () => setExitConfirmOpen(true),
    });
  }

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (value && endDate && endDate < value) {
      setEndDate(value);
    }
  }

  function handleEndDateChange(value: string) {
    if (value && startDate && value < startDate) {
      setEndDate(startDate);
      return;
    }
    setEndDate(value);
  }

  useEffect(() => {
    if (!open) {
      setBaseline(null);
      return;
    }

    const frame = requestAnimationFrame(() => {
      setBaseline(
        captureHtmlFormBaseline(FORM_ID, controlledSignatureRef.current)
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  async function submit(formData: FormData) {
    formData.set("type", type);
    formData.set("startDate", startDate);
    formData.set("endDate", endDate);

    startTransition(async () => {
      try {
        await createLeaveRequest(formData);
        setExitConfirmOpen(false);
        closeDialog();
      } catch (error) {
        showRejectionFromError(error, t("pages.leaves.submitFailed"));
      }
    });
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        disablePointerDismissal
      >
        <DialogTrigger asChild>
          <Button
            variant="successBadge"
            size="badgeFlex"
            className="w-fit max-w-full shrink-0"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            {t("pages.leaves.newRequest")}
          </Button>
        </DialogTrigger>

        <EmployeeDialogShell
          icon={ClipboardCheck}
          title={t("pages.leaves.dialogTitle")}
          description={t("pages.leaves.dialogDescription")}
          maxWidth="lg"
          footer={
            <EmployeePrimaryButton form={FORM_ID} disabled={pending}>
              {pending
                ? t("common.actions.submitting")
                : t("pages.leaves.submitRequest")}
            </EmployeePrimaryButton>
          }
        >
          <form
            id={FORM_ID}
            key={open ? "open" : "closed"}
            action={submit}
            className={cn(employeeDialogFormClass, "gap-7")}
            onInput={handleFormInput}
          >
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-text">
                {t("pages.leaves.requestType")}
              </label>
              <div
                className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                role="radiogroup"
                aria-label={t("pages.leaves.requestType")}
              >
                {leaveTypeOptions.map((option) => {
                  const selected = type === option.value;
                  const isSick = option.value === "SICK";
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setType(option.value)}
                      className={cn(
                        "flex min-h-11 items-center justify-center rounded-xl border px-3 py-3 text-sm font-semibold tracking-wide transition",
                        selected &&
                          !isSick &&
                          outlineChipTones.emeraldInteractive,
                        selected && isSick && outlineChipTones.warningInteractive,
                        !selected &&
                          "border-border bg-elevated text-muted hover:border-border-strong hover:text-text"
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={employeeDialogGridClass}>
              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor="leave-start-date"
                  className="text-sm font-medium text-text"
                >
                  {t("pages.leaves.startDate")}
                </label>
                <Input
                  id="leave-start-date"
                  name="startDate"
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) =>
                    handleStartDateChange(event.target.value)
                  }
                  className={employeeInputClass}
                />
              </div>

              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor="leave-end-date"
                  className="text-sm font-medium text-text"
                >
                  {t("pages.leaves.endDate")}
                </label>
                <Input
                  id="leave-end-date"
                  name="endDate"
                  type="date"
                  required
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => handleEndDateChange(event.target.value)}
                  className={employeeInputClass}
                />
              </div>
            </div>

            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="leave-reason"
                className="text-sm font-medium text-text"
              >
                {t("pages.leaves.reason")}
              </label>
              <Textarea
                id="leave-reason"
                name="reason"
                placeholder={t("pages.leaves.reasonPlaceholder")}
                rows={4}
                required
                className={cn(
                  employeeInputClass,
                  "min-h-[6.5rem] resize-none py-3"
                )}
              />
            </div>

            <FileDropField
              id="leave-proof"
              name="proof"
              multiple
              accept="image/*,.pdf"
              label={
                <>
                  {t("pages.leaves.proofDocument")}{" "}
                  <span className="font-normal text-muted">
                    {t("pages.leaves.proofOptional")}
                  </span>
                </>
              }
            />
          </form>
        </EmployeeDialogShell>
      </Dialog>

      <EmployeeUnsavedExitDialog
        open={exitConfirmOpen}
        onConfirm={() => {
          setExitConfirmOpen(false);
          closeDialog();
        }}
        onCancel={() => setExitConfirmOpen(false)}
      />
    </>
  );
}
