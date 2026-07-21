"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import { ClipboardCheck, Upload } from "lucide-react";

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
import ProjectOptionPills from "@/components/projects/ProjectOptionPills";
import { Button } from "@/components/ui/button";
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

function isAcceptedProofFile(file: File) {
  if (file.type.startsWith("image/") || file.type === "application/pdf") {
    return true;
  }

  const name = file.name.toLowerCase();
  return (
    name.endsWith(".pdf") ||
    /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif|avif|tiff?)$/i.test(name)
  );
}

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
  const [proofFileName, setProofFileName] = useState<string | null>(null);
  const [proofDragActive, setProofDragActive] = useState(false);
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

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
    setProofFileName(null);
    setProofDragActive(false);
    if (proofInputRef.current) {
      proofInputRef.current.value = "";
    }
    resetDirtyTracking();
  }

  function assignProofFile(file: File | null | undefined) {
    const input = proofInputRef.current;
    if (!input) return;

    if (!file) {
      input.value = "";
      setProofFileName(null);
      handleFormInput();
      return;
    }

    if (!isAcceptedProofFile(file)) {
      input.value = "";
      setProofFileName(null);
      showRejection({ reasons: t("pages.leaves.proofMustBeImageOrPdf") });
      handleFormInput();
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    setProofFileName(file.name);
    handleFormInput();
  }

  function handleProofDragEnter(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setProofDragActive(true);
  }

  function handleProofDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setProofDragActive(true);
  }

  function handleProofDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setProofDragActive(false);
  }

  function handleProofDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setProofDragActive(false);
    assignProofFile(event.dataTransfer.files?.[0]);
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
            className="text-xs tracking-[0.06em]"
          >
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
            <ProjectOptionPills
              label={t("pages.leaves.requestType")}
              value={type}
              options={leaveTypeOptions}
              onChange={setType}
              columns={2}
            />

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

            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="leave-proof"
                className="text-sm font-medium text-text"
              >
                {t("pages.leaves.proofDocument")}{" "}
                <span className="font-normal text-muted">
                  {t("pages.leaves.proofOptional")}
                </span>
              </label>
              <button
                type="button"
                onClick={() => proofInputRef.current?.click()}
                onDragEnter={handleProofDragEnter}
                onDragOver={handleProofDragOver}
                onDragLeave={handleProofDragLeave}
                onDrop={handleProofDrop}
                className={cn(
                  employeeInputClass,
                  "flex w-full cursor-pointer items-center justify-center gap-2 border-dashed text-center transition",
                  proofDragActive
                    ? "border-primary/60 bg-primary/10 text-text"
                    : "text-muted hover:border-primary/40 hover:text-text"
                )}
              >
                <Upload className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {proofFileName ?? t("pages.leaves.dropFileOrBrowse")}
                </span>
              </button>
              <input
                ref={proofInputRef}
                id="leave-proof"
                name="proof"
                type="file"
                accept="image/*,.pdf"
                className="sr-only"
                onChange={(event) => {
                  assignProofFile(event.target.files?.[0] ?? null);
                }}
              />
            </div>
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
