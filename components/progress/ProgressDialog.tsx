"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import Image from "next/image";
import { useEffect, useMemo, useState, useTransition } from "react";
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
} from "@/components/employees/employee-dialog-ui";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDropField } from "@/components/ui/FileDropField";
import { Input } from "@/components/ui/input";
import SearchableProjectSelect from "@/components/ui/SearchableProjectSelect";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n/use-t";
import { todayDateInput } from "@/lib/project-contract";
import { sortProjectSelectOptions } from "@/lib/project-select";
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

type OpenCicoLock = {
  projectId: string;
  /** YYYY-MM-DD Asia/Jakarta CICO work day */
  workDate: string;
};

type Props = {
  projects: Project[];
  defaultDate?: string;
  defaultProjectId?: string;
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  /** When set, dialog edits this report instead of creating a new one. */
  editReport?: EditableProgressReport | null;
  /**
   * Open CICO for this employee — when the selected project matches, report
   * date is forced to that work day (read-only).
   */
  openCicoLock?: OpenCicoLock | null;
  /**
   * Security (and similar): allow create without open CICO — staff may report
   * anytime; managers handle cadence offline. Cleaning create still needs CICO.
   */
  allowWithoutCico?: boolean;
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
  openCicoLock = null,
  allowWithoutCico = false,
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
  /** Local file picks — survives React form-action resets on failed submits. */
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const urls = selectedFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [selectedFiles]);

  const dateDefault =
    editReport?.reportDate || defaultDate || todayDateInput();

  // Cleaning create needs open CICO; Security anytime path sets allowWithoutCico.
  const createNeedsCheckIn = !isEdit && !openCicoLock && !allowWithoutCico;
  const cicoLockedDate =
    !isEdit && openCicoLock ? openCicoLock.workDate : null;
  // Staff edit: date is always locked. Create: locked to open CICO work day.
  const lockedDate = isEdit
    ? (editReport?.reportDate ?? dateDefault)
    : cicoLockedDate;
  const dateLocked = Boolean(lockedDate);
  const effectiveDate = lockedDate ?? dateDefault;

  const createProjects = useMemo(() => {
    const list =
      !isEdit && openCicoLock
        ? projects.filter((p) => p.id === openCicoLock.projectId)
        : projects;
    return sortProjectSelectOptions(list);
  }, [isEdit, openCicoLock, projects]);

  const editProjects =
    isEdit && editReport
      ? [{ id: editReport.projectId, name: editReport.projectName }]
      : createProjects;

  const lockedCreateProjectId =
    !isEdit && openCicoLock ? openCicoLock.projectId : null;

  const canSubmit =
    !createNeedsCheckIn &&
    Boolean((lockedCreateProjectId ?? projectId).trim()) &&
    Boolean(stageLabel.trim()) &&
    Boolean(notes.trim());

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
    setSelectedFiles([]);
  }

  async function submit(formData: FormData) {
    const nextProjectId = (lockedCreateProjectId ?? projectId).trim();
    const nextStageLabel = stageLabel.trim();
    const nextNotes = notes.trim();

    if (!isEdit && !openCicoLock && !allowWithoutCico) {
      showRejection({
        reasons: t("pages.progress.errors.checkInRequired"),
      });
      return;
    }
    if (!nextProjectId) {
      showRejection({ reasons: t("pages.progress.projectRequired") });
      return;
    }
    if (
      !isEdit &&
      openCicoLock &&
      nextProjectId !== openCicoLock.projectId
    ) {
      showRejection({
        reasons: t("pages.progress.errors.checkInRequiredForProject"),
      });
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
    if (dateLocked && lockedDate) {
      formData.set("date", lockedDate);
    } else if (!isEdit && openCicoLock) {
      formData.set("date", openCicoLock.workDate);
    }

    // Prefer local File state — native <input type="file"> is cleared when a
    // React form action returns before/without awaiting the server work.
    formData.delete("photos");
    for (const file of selectedFiles) {
      if (file && file.size > 0) formData.append("photos", file);
    }

    if (isEdit && editReport) {
      if (editReport.reportDate !== todayDateInput()) {
        showRejection({
          reasons: t("pages.progress.errors.editDayLocked"),
        });
        return;
      }
      formData.set("reportId", editReport.id);
      formData.delete("keepPhotoIds");
      for (const id of keptPhotoIds) {
        formData.append("keepPhotoIds", id);
      }
      if (keptPhotoIds.length === 0 && selectedFiles.length === 0) {
        showRejection({ reasons: t("pages.progress.photoRequired") });
        return;
      }
    } else if (selectedFiles.length === 0) {
      showRejection({ reasons: t("pages.progress.photoRequired") });
      return;
    }

    // Await the server action so React does not treat the form as finished
    // (and wipe the file input) while the upload is still in flight.
    await new Promise<void>((resolve) => {
      startTransition(() => {
        void (async () => {
          try {
            if (isEdit) {
              await updateProgressReport(formData);
            } else {
              await createProgressReport(formData);
            }
            setOpen(false);
            if (!isEdit) resetFormFields();
            else setSelectedFiles([]);
            router.refresh();
            resolve();
          } catch (error) {
            showRejectionFromError(
              error,
              isEdit
                ? t("pages.progress.editFailed")
                : t("pages.progress.submitFailed")
            );
            // Keep selectedFiles so the user does not lose the photo pick.
            resolve();
          }
        })();
      });
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
            setProjectId(
              openCicoLock?.projectId ?? defaultProjectId ?? ""
            );
            setStageLabel("");
            setNotes("");
            setKeptPhotoIds([]);
            setSelectedFiles([]);
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
            : createNeedsCheckIn
              ? t("pages.progress.checkInRequiredMessage")
              : allowWithoutCico && !openCicoLock
                ? t("pages.progress.dialogDescription")
                : t("pages.progress.dialogDescriptionCicoLocked")
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
          {createNeedsCheckIn ? (
            <p className="text-sm text-amber-200/90">
              {t("pages.progress.errors.checkInRequired")}
            </p>
          ) : null}

          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-medium text-text">
              {t("pages.progress.selectProject")}{" "}
              <span className="text-amber-400">
                {t("pages.progress.required")}
              </span>
            </label>
            {isEdit || lockedCreateProjectId ? (
              <>
                <input
                  type="hidden"
                  name="projectId"
                  value={lockedCreateProjectId ?? projectId}
                />
                <Input
                  type="text"
                  value={
                    editProjects.find(
                      (p) => p.id === (lockedCreateProjectId ?? projectId)
                    )?.name ?? (lockedCreateProjectId ?? projectId)
                  }
                  readOnly
                  className={employeeInputClass}
                />
              </>
            ) : (
              <SearchableProjectSelect
                value={projectId}
                onValueChange={setProjectId}
                projects={editProjects}
                placeholder={t("pages.progress.selectProject")}
                required
              />
            )}
          </div>

          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-medium text-text">
              {t("common.labels.date")}
            </label>
            {dateLocked && lockedDate ? (
              <>
                <input type="hidden" name="date" value={lockedDate} />
                <Input
                  type="date"
                  value={lockedDate}
                  readOnly
                  className={cn(employeeInputClass, "bg-inset text-muted")}
                />
                <p className="text-xs text-subtle">
                  {isEdit
                    ? t("pages.progress.dateLockedEditHint")
                    : t("pages.progress.dateLockedCicoHint")}
                </p>
              </>
            ) : (
              <Input
                name="date"
                type="date"
                defaultValue={effectiveDate}
                key={`${editReport?.id ?? "new"}-${projectId}-${effectiveDate}`}
                required
                disabled={createNeedsCheckIn}
                className={employeeInputClass}
              />
            )}
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
            <FileDropField
              id="progress-photos"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              capture="environment"
              emptyLabel={t("common.labels.dropFilesOrBrowse")}
              invalidMessage={t("common.labels.fileMustBeImage")}
              onPickMany={setSelectedFiles}
            />
            {selectedFiles.length > 0 ? (
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                    className="relative aspect-square overflow-hidden rounded-xl border border-border bg-inset"
                  >
                    {previewUrls[index] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- blob preview
                      <img
                        src={previewUrls[index]}
                        alt={file.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedFiles((prev) =>
                          prev.filter((_, i) => i !== index)
                        )
                      }
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white transition hover:bg-black/90"
                      aria-label={t("pages.progress.removePhoto")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <p className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-[0.625rem] text-white">
                      {file.name}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-subtle">
              {t("pages.progress.photoUploadHint")}
            </p>
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
