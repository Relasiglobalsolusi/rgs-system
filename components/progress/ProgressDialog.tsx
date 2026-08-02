"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProgressReport,
  updateProgressReport,
} from "@/app/progress/actions";

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
import { Camera, Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n/use-t";
import { todayDateInput } from "@/lib/project-contract";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
};

export type EditableProgressReport = {
  id: string;
  projectId: string;
  projectName: string;
  stageLabel: string | null;
  notes: string | null;
  reportDate: string;
  photos: { id: string; url: string }[];
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
  /** When set, dialog edits this report instead of creating a new one. */
  editReport?: EditableProgressReport | null;
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
  editReport = null,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const isEdit = Boolean(editReport);
  const resolvedTriggerLabel =
    triggerLabel ??
    (isEdit
      ? t("pages.progress.editReport")
      : t("pages.progress.submitReport"));
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [projectId, setProjectId] = useState(
    editReport?.projectId ?? defaultProjectId ?? ""
  );
  const [stageLabel, setStageLabel] = useState(editReport?.stageLabel ?? "");
  const [notes, setNotes] = useState(editReport?.notes ?? "");
  const [keptPhotoIds, setKeptPhotoIds] = useState<string[]>(
    () => editReport?.photos.map((p) => p.id) ?? []
  );
  const [pending, startTransition] = useTransition();

  const dateDefault =
    editReport?.reportDate || defaultDate || todayDateInput();

  const editProjects =
    isEdit && editReport
      ? [{ id: editReport.projectId, name: editReport.projectName }]
      : projects;

  const canSubmit =
    Boolean(projectId.trim()) &&
    Boolean(stageLabel.trim()) &&
    Boolean(notes.trim());

  const projectSelectItems = editProjects.map((project) => ({
    value: project.id,
    label: project.name,
  }));

  function syncFromEdit(report: EditableProgressReport | null | undefined) {
    setProjectId(report?.projectId ?? defaultProjectId ?? "");
    setStageLabel(report?.stageLabel ?? "");
    setNotes(report?.notes ?? "");
    setKeptPhotoIds(report?.photos.map((p) => p.id) ?? []);
  }

  function resetFormFields() {
    setProjectId(defaultProjectId ?? "");
    setStageLabel("");
    setNotes("");
    setKeptPhotoIds([]);
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

    if (isEdit && editReport) {
      formData.set("reportId", editReport.id);
      formData.delete("keepPhotoIds");
      for (const id of keptPhotoIds) {
        formData.append("keepPhotoIds", id);
      }
      const newPhotos = formData.getAll("photos") as File[];
      const hasNew = newPhotos.some((p) => p && p.size > 0);
      if (keptPhotoIds.length === 0 && !hasNew) {
        showRejection({ reasons: t("pages.progress.photoRequired") });
        return;
      }
    }

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateProgressReport(formData);
        } else {
          await createProgressReport(formData);
        }
        setOpen(false);
        if (!isEdit) resetFormFields();
        router.refresh();
      } catch (error) {
        showRejectionFromError(
          error,
          isEdit
            ? t("pages.progress.editFailed")
            : t("pages.progress.submitFailed")
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          if (editReport) {
            syncFromEdit(editReport);
          } else {
            setProjectId(defaultProjectId ?? "");
            setStageLabel("");
            setNotes("");
            setKeptPhotoIds([]);
          }
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
        title={
          isEdit
            ? t("pages.progress.editDialogTitle")
            : t("pages.progress.dialogTitle")
        }
        description={
          isEdit
            ? t("pages.progress.editDialogDescription")
            : t("pages.progress.dialogDescription")
        }
        maxWidth="lg"
        footer={
          <EmployeePrimaryButton
            form={FORM_ID}
            disabled={pending || !canSubmit}
          >
            {pending
              ? t("common.actions.saving")
              : isEdit
                ? t("pages.progress.saveChanges")
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
            {isEdit ? (
              <>
                <input type="hidden" name="projectId" value={projectId} />
                <Input
                  type="text"
                  value={
                    editProjects.find((p) => p.id === projectId)?.name ??
                    projectId
                  }
                  readOnly
                  className={employeeInputClass}
                />
              </>
            ) : (
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
                      const project = editProjects.find((p) => p.id === value);
                      return project?.name ?? String(value);
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {editProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-medium text-text">
              {t("common.labels.date")}
            </label>
            <Input
              name="date"
              type="date"
              defaultValue={dateDefault}
              key={`${editReport?.id ?? "new"}-${dateDefault}`}
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

          {isEdit && editReport ? (
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-text">
                {t("pages.progress.existingPhotos")}{" "}
                <span className="text-amber-400">
                  {t("pages.progress.required")}
                </span>
              </label>
              <p className="text-xs text-subtle">
                {t("pages.progress.existingPhotosHint")}
              </p>
              {editReport.photos.filter((p) => keptPhotoIds.includes(p.id))
                .length === 0 ? (
                <p className="mt-2 text-sm text-amber-200/90">
                  {t("pages.progress.noPhotosKept")}
                </p>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {editReport.photos
                    .filter((photo) => keptPhotoIds.includes(photo.id))
                    .map((photo) => (
                      <div
                        key={photo.id}
                        className="relative aspect-square overflow-hidden rounded-xl border border-border bg-inset"
                      >
                        <Image
                          src={photo.url}
                          alt={t("pages.progress.progressPhoto")}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setKeptPhotoIds((prev) =>
                              prev.filter((id) => id !== photo.id)
                            )
                          }
                          className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white transition hover:bg-black/90"
                          aria-label={t("pages.progress.removePhoto")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : null}

          <div className={employeeDialogFieldClass}>
            <label className="text-sm text-muted">
              {isEdit
                ? t("pages.progress.addPhotos")
                : t("pages.progress.columns.photos")}{" "}
              {!isEdit ? (
                <span className="text-amber-400">
                  {t("pages.progress.required")}
                </span>
              ) : null}
            </label>
            <Input
              name="photos"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              required={!isEdit}
              capture="environment"
              className={cn(
                employeeInputClass,
                "cursor-pointer file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text"
              )}
            />
            <p className="text-xs text-subtle">
              {t("pages.progress.photoUploadHint")}
            </p>
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
