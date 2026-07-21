"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useState, useTransition } from "react";
import { createProgressReport } from "@/app/progress/actions";

import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/use-t";
import { todayDateInput } from "@/lib/project-contract";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
};

type Props = {
  projects: Project[];
  defaultDate?: string;
  defaultProjectId?: string;
  triggerLabel?: string;
  /** @deprecated No longer changes trigger styling; kept for call-site compat. */
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

const FORM_ID = "progress-report-form";

export default function ProgressDialog({
  projects,
  defaultDate,
  defaultProjectId,
  triggerLabel,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: Props) {
  const { t } = useT();
  const resolvedTriggerLabel =
    triggerLabel ?? t("pages.progress.submitReport");
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [stageLabel, setStageLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const dateDefault = defaultDate || todayDateInput();

  const canSubmit =
    Boolean(projectId.trim()) &&
    Boolean(stageLabel.trim()) &&
    Boolean(notes.trim());

  // Base UI Select.Value shows the raw value unless `items` maps id → label.
  const projectSelectItems = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }));

  function resetFormFields() {
    setProjectId(defaultProjectId ?? "");
    setStageLabel("");
    setNotes("");
  }

  async function submit(formData: FormData) {
    const nextProjectId = projectId.trim();
    const nextStageLabel = stageLabel.trim();
    const nextNotes = notes.trim();

    if (!nextProjectId) {
      showRejection({ reasons: t("pages.progress.projectRequired") });
      return;
    }
    if (!nextStageLabel) {
      showRejection({ reasons: t("pages.progress.serviceAreaRequired") });
      return;
    }
    if (!nextNotes) {
      showRejection({ reasons: t("pages.progress.notesRequired") });
      return;
    }

    formData.set("projectId", nextProjectId);
    formData.set("stageLabel", nextStageLabel);
    formData.set("notes", nextNotes);

    startTransition(async () => {
      try {
        await createProgressReport(formData);
        setOpen(false);
        resetFormFields();
      } catch (error) {
        showRejectionFromError(error, t("pages.progress.submitFailed"));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setProjectId(defaultProjectId ?? "");
          setStageLabel("");
          setNotes("");
        }
      }}
    >
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            variant="successBadge"
            size="badge"
            className="!w-auto !min-w-[7.5rem] !max-w-none gap-1.5 px-3"
          >
            <Plus className="h-4 w-4" />
            {resolvedTriggerLabel}
          </Button>
        </DialogTrigger>
      )}

      <EmployeeDialogShell
        icon={Camera}
        title={t("pages.progress.dialogTitle")}
        description={t("pages.progress.dialogDescription")}
        maxWidth="lg"
        footer={
          <EmployeePrimaryButton
            form={FORM_ID}
            disabled={pending || !canSubmit}
          >
            {pending
              ? t("common.actions.uploading")
              : t("pages.progress.submitReport")}
          </EmployeePrimaryButton>
        }
      >
        <form id={FORM_ID} action={submit} className={employeeDialogFormClass}>
          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-medium text-text">
              {t("pages.progress.selectProject")}{" "}
              <span className="text-amber-400">
                {t("pages.progress.required")}
              </span>
            </label>
            <Select
              value={projectId}
              onValueChange={(value) => setProjectId(value ?? "")}
              items={projectSelectItems}
              required
            >
              <SelectTrigger className={employeeSelectTriggerClass}>
                <SelectValue placeholder={t("pages.progress.selectProject")}>
                  {(value) => {
                    if (!value) return null;
                    const project = projects.find((p) => p.id === value);
                    return project?.name ?? String(value);
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-medium text-text">
              {t("common.labels.date")}
            </label>
            <Input
              name="date"
              type="date"
              defaultValue={dateDefault}
              required
              className={employeeInputClass}
            />
          </div>

          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-medium text-text">
              {t("pages.progress.serviceArea")}{" "}
              <span className="text-amber-400">
                {t("pages.progress.required")}
              </span>
            </label>
            <Input
              name="stageLabel"
              type="text"
              value={stageLabel}
              onChange={(event) => setStageLabel(event.target.value)}
              placeholder={t("pages.progress.serviceAreaPlaceholder")}
              required
              className={employeeInputClass}
            />
          </div>

          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-medium text-text">
              {t("pages.progress.columns.notes")}{" "}
              <span className="text-amber-400">
                {t("pages.progress.required")}
              </span>
            </label>
            <Textarea
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("pages.progress.notesPlaceholder")}
              rows={3}
              required
              className={cn(
                employeeInputClass,
                "min-h-[5.5rem] resize-none py-3"
              )}
            />
          </div>

          <div className={employeeDialogFieldClass}>
            <label className="text-sm text-muted">
              {t("pages.progress.columns.photos")}{" "}
              <span className="text-amber-400">
                {t("pages.progress.required")}
              </span>
            </label>
            <Input
              name="photos"
              type="file"
              accept="image/*"
              multiple
              required
              capture="environment"
              className={cn(
                employeeInputClass,
                "cursor-pointer file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text"
              )}
            />
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
