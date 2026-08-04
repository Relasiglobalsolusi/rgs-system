"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { checkIn, checkOut } from "@/app/cico/actions";
import ProgressDialog from "@/components/progress/ProgressDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/use-t";
import { resolveGeofenceRadiusMeters } from "@/lib/geo";
import { formatTimeRange } from "@/lib/operating-hours";
import {
  AlertTriangle,
  Camera,
  LogIn,
  LogOut,
  MapPin,
  Clock,
  X,
} from "lucide-react";

type AssignedProject = {
  id: string;
  name: string;
  location: string | null;
  locationRadiusMeters: number | null;
  shiftStart: string | null;
  shiftEnd: string | null;
};

type Props = {
  /** Read-only layout preview for head-office admin / managers (no check-in/out). */
  previewMode?: boolean;
  /** HO admin field preview — distinct empty-project copy when not in previewMode. */
  adminFieldMode?: boolean;
  todayRecord: {
    checkIn: Date | null;
    checkOut: Date | null;
    checkInPhotoUrl?: string | null;
    checkOutPhotoUrl?: string | null;
    project?: { id: string; name: string } | null;
    note?: string | null;
  } | null;
  assignedProjects: AssignedProject[];
  /** ≥1 Progress Report for today's checked-in project (blocks check-out when false). */
  hasProgressReport: boolean;
  /** YYYY-MM-DD for Progress Report submit default. */
  workDate: string;
  /** Cleaning staff positions only — Progress Report before check-out. */
  requiresProgress?: boolean;
};

function getCurrentPosition(unsupportedMessage: string) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error(unsupportedMessage));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

function projectSelectLabel(project: AssignedProject) {
  return project.location
    ? `${project.name} — ${project.location}`
    : project.name;
}

export default function CicoActions({
  previewMode = false,
  adminFieldMode = false,
  todayRecord,
  assignedProjects,
  hasProgressReport,
  workDate,
  requiresProgress = false,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [projectId, setProjectId] = useState(assignedProjects[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const selected = assignedProjects.find((project) => project.id === projectId);
  const projectSelectItems = assignedProjects.map((project) => ({
    value: project.id,
    label: projectSelectLabel(project),
  }));

  const checkedIn = !!todayRecord?.checkIn;
  const checkedOut = !!todayRecord?.checkOut;
  const needsProgressBeforeCheckout =
    requiresProgress && checkedIn && !checkedOut && !hasProgressReport;
  const checkInProject = todayRecord?.project
    ? [{ id: todayRecord.project.id, name: todayRecord.project.name }]
    : [];

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  function clearPhoto() {
    setPhotoFile(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  }

  function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setPhotoFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      showRejection({ reasons: t("pages.cico.chooseImageFile") });
      clearPhoto();
      return;
    }
    setPhotoFile(file);
  }

  async function handleCheckIn() {
    if (!photoFile) {
      showRejection({ reasons: t("pages.cico.photoRequiredAlert") });
      return;
    }

    setLocating(true);
    try {
      const position = await getCurrentPosition(
        t("pages.cico.geolocationUnsupported")
      );
      const formData = new FormData();
      formData.set("latitude", String(position.coords.latitude));
      formData.set("longitude", String(position.coords.longitude));
      formData.set("projectId", projectId);
      formData.set("photo", photoFile);

      startTransition(async () => {
        try {
          await checkIn(formData);
          clearPhoto();
          router.refresh();
        } catch (error) {
          showRejectionFromError(error, t("pages.cico.checkInFailed"));
        }
      });
    } catch (error) {
      showRejectionFromError(error, t("pages.cico.locationFailed"));
    } finally {
      setLocating(false);
    }
  }

  async function handleCheckOut() {
    // Guide staff to submit PR instead of a dead-end error only.
    if (needsProgressBeforeCheckout) {
      setProgressOpen(true);
      showRejection({
        title: t("pages.cico.progressRequiredTitle"),
        description: t("pages.cico.progressRequiredBody"),
        reasons: t("pages.cico.errors.progressRequiredBeforeCheckOut"),
      });
      return;
    }

    if (!photoFile) {
      showRejection({ reasons: t("pages.cico.checkOutPhotoRequiredAlert") });
      return;
    }

    setLocating(true);
    try {
      const position = await getCurrentPosition(
        t("pages.cico.geolocationUnsupported")
      );
      const formData = new FormData();
      formData.set("latitude", String(position.coords.latitude));
      formData.set("longitude", String(position.coords.longitude));
      formData.set("photo", photoFile);

      startTransition(async () => {
        try {
          await checkOut(formData);
          clearPhoto();
          router.refresh();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error ?? "");
          const progressBlocked =
            message.toLowerCase().includes("progress report") ||
            message.toLowerCase().includes("laporan progress");
          if (progressBlocked) {
            setProgressOpen(true);
            showRejection({
              title: t("pages.cico.progressRequiredTitle"),
              description: t("pages.cico.progressRequiredBody"),
              reasons:
                message || t("pages.cico.errors.progressRequiredBeforeCheckOut"),
            });
            return;
          }
          showRejectionFromError(error, t("pages.cico.checkOutFailed"));
        }
      });
    } catch (error) {
      showRejectionFromError(error, t("pages.cico.locationFailed"));
    } finally {
      setLocating(false);
    }
  }

  const hasProjects = assignedProjects.length > 0;
  const canCheckIn =
    !previewMode &&
    !pending &&
    !locating &&
    !checkedIn &&
    hasProjects &&
    !!projectId &&
    !!photoFile;
  const canCheckOutClick =
    !previewMode && !pending && !locating && checkedIn && !checkedOut;

  const photoLabel = checkedIn
    ? t("pages.cico.checkOutPhoto")
    : t("pages.cico.onSitePhoto");
  const photoHelp = checkedIn
    ? t("pages.cico.checkOutPhotoHelp")
    : t("pages.cico.photoHelp");
  const photoAlertEmpty = checkedIn
    ? t("pages.cico.noPhotoSelectedCheckOut")
    : t("pages.cico.noPhotoSelected");

  return (
    <div className="space-y-6">
      {previewMode && (
        <p className="rounded-xl border border-accent-slate/30 bg-card-tint-slate px-4 py-3 text-sm text-subtle">
          {t("pages.cico.adminPreview.controlsDisabled")}
        </p>
      )}
      {!checkedIn && (
        <div className="space-y-4">
          <div className="space-y-2.5">
            <label className="text-sm font-medium text-muted">
              {t("pages.cico.projectSite")}
            </label>
            {hasProjects ? (
              <Select
                value={projectId}
                onValueChange={(value) => setProjectId(value ?? "")}
                items={projectSelectItems}
                disabled={previewMode}
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder={t("pages.cico.selectProject")}>
                    {(value) => {
                      if (!value) return null;
                      const project = assignedProjects.find(
                        (p) => p.id === value
                      );
                      return project
                        ? projectSelectLabel(project)
                        : String(value);
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {assignedProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {projectSelectLabel(project)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-amber-400">
                {previewMode
                  ? t("pages.cico.adminPreview.noSampleProject")
                  : adminFieldMode
                    ? t("pages.cico.adminPreview.noSelectableProject")
                    : t("pages.cico.noProjectsAssigned")}
              </p>
            )}
          </div>

          {selected && (
            <div className="space-y-2.5 rounded-xl border border-border bg-elevated px-4 py-3.5 text-sm sm:px-5">
              <p className="flex items-start gap-2.5 text-muted">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  {t("pages.cico.checkingInAt")}{" "}
                  <span className="font-medium text-text">{selected.name}</span>
                  {selected.location ? (
                    <span className="text-subtle">
                      {" "}
                      — {selected.location}
                    </span>
                  ) : null}
                  <span className="mt-1.5 block text-xs leading-relaxed text-subtle">
                    {t("pages.cico.mustBeWithinMeters", {
                      meters: resolveGeofenceRadiusMeters(
                        selected.locationRadiusMeters
                      ),
                    })}
                  </span>
                </span>
              </p>
              {selected.shiftStart && selected.shiftEnd ? (
                <p className="flex items-start gap-2.5 text-muted">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    {t("pages.cico.yourShift")}{" "}
                    <span className="font-medium text-text">
                      {formatTimeRange(selected.shiftStart, selected.shiftEnd)}
                    </span>
                    <span className="mt-1.5 block text-xs leading-relaxed text-subtle">
                      {t("pages.cico.clockInBeforeHint", {
                        time: selected.shiftStart,
                      })}
                    </span>
                  </span>
                </p>
              ) : (
                <p className="flex items-start gap-2.5 text-xs leading-relaxed text-subtle">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  {t("pages.cico.noShiftAssigned")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {checkedIn && todayRecord?.project && (
        <p className="flex items-center gap-2.5 text-sm text-subtle">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          {t("pages.cico.checkedInAt")}{" "}
          <span className="font-medium text-text">
            {todayRecord.project.name}
          </span>
        </p>
      )}

      {needsProgressBeforeCheckout && (
        <div className="rounded-xl border border-amber-500/30 bg-card-tint-amber px-4 py-3.5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="font-medium text-amber-200">
                  {t("pages.cico.progressRequiredTitle")}
                </p>
                <p className="mt-1 text-sm text-subtle">
                  {t("pages.cico.progressRequiredBody")}
                </p>
              </div>
              <Button
                type="button"
                variant="successBadge"
                size="badge"
                className="!w-auto gap-1.5"
                onClick={() => setProgressOpen(true)}
              >
                <Camera className="h-4 w-4" />
                {t("pages.cico.uploadProgressNow")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {checkedIn && todayRecord?.checkInPhotoUrl && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted">
            {t("pages.cico.checkInPhoto")}
          </p>
          <div className="relative h-36 w-full max-w-xs overflow-hidden rounded-xl border border-border bg-inset sm:h-40">
            <Image
              src={todayRecord.checkInPhotoUrl}
              alt={t("pages.cico.checkInPhotoAlt")}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        </div>
      )}

      {checkedOut && todayRecord?.checkOutPhotoUrl && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted">
            {t("pages.cico.checkOutPhoto")}
          </p>
          <div className="relative h-36 w-full max-w-xs overflow-hidden rounded-xl border border-border bg-inset sm:h-40">
            <Image
              src={todayRecord.checkOutPhotoUrl}
              alt={t("pages.cico.checkOutPhotoAlt")}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        </div>
      )}

      {!checkedOut && (
        <div className="space-y-2.5">
          <label className="text-sm font-medium text-muted">
            {photoLabel}{" "}
            <span className="font-normal text-amber-400">
              {t("pages.cico.required")}
            </span>
          </label>
          <p className="text-xs leading-relaxed text-subtle">{photoHelp}</p>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={previewMode}
            onChange={onPhotoChange}
          />
          <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="badgeFlex"
                onClick={() => photoInputRef.current?.click()}
                disabled={
                  previewMode ||
                  pending ||
                  locating ||
                  (!checkedIn && !hasProjects)
                }
              >
              <Camera className="mr-1.5" />
              {photoFile
                ? t("pages.cico.retakePhoto")
                : t("pages.cico.takePhoto")}
            </Button>
            {photoFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearPhoto}
                disabled={previewMode || pending || locating}
                className="text-subtle"
              >
                <X className="mr-1" />
                {t("common.actions.clear")}
              </Button>
            )}
          </div>
          {photoPreview ? (
            <div className="relative mt-1 h-36 w-full max-w-xs overflow-hidden rounded-xl border border-border bg-inset sm:h-40">
              <Image
                src={photoPreview}
                alt={photoLabel}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex h-28 max-w-xs items-center justify-center rounded-xl border border-dashed border-border bg-inset px-4 text-center text-xs text-subtle">
              {photoAlertEmpty}
            </div>
          )}
        </div>
      )}

      {todayRecord?.note && (
        <p className="text-sm leading-relaxed text-amber-400">
          {todayRecord.note}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <Button
          onClick={handleCheckIn}
          disabled={!canCheckIn}
          variant="success"
          size="lg"
          className="h-12 w-full text-base [&_svg]:size-5"
        >
          <LogIn className="mr-2" />
          {locating && !checkedIn
            ? t("pages.cico.gettingLocation")
            : checkedIn
              ? t("pages.cico.checkedIn")
              : t("pages.cico.checkIn")}
        </Button>

        <Button
          onClick={handleCheckOut}
          disabled={!canCheckOutClick}
          variant="warning"
          size="lg"
          className="h-12 w-full text-base [&_svg]:size-5"
        >
          <LogOut className="mr-2" />
          {locating && checkedIn && !checkedOut
            ? t("pages.cico.gettingLocation")
            : checkedOut
              ? t("pages.cico.checkedOut")
              : t("pages.cico.checkOut")}
        </Button>
      </div>

      <p className="pt-1 text-xs leading-relaxed text-subtle">
        {previewMode
          ? t("pages.cico.adminPreview.footerNote")
          : adminFieldMode
            ? t("pages.cico.adminPreview.fieldFooterNote")
            : requiresProgress
              ? t("pages.cico.footerNote")
              : t("pages.cico.footerNoteCheckInOnly")}
      </p>

      {!previewMode && checkInProject.length > 0 ? (
        <ProgressDialog
          projects={checkInProject}
          defaultProjectId={checkInProject[0]?.id}
          defaultDate={workDate}
          openCicoLock={
            checkInProject[0]
              ? { projectId: checkInProject[0].id, workDate }
              : null
          }
          hideTrigger
          open={progressOpen}
          onOpenChange={(open) => {
            setProgressOpen(open);
            if (!open) router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
