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
import { checkIn, checkOut } from "@/app/cico/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/use-t";
import { formatTimeRange } from "@/lib/operating-hours";
import { Camera, LogIn, LogOut, MapPin, Clock, X } from "lucide-react";

type AssignedProject = {
  id: string;
  name: string;
  location: string | null;
  locationRadiusMeters: number | null;
  shiftStart: string | null;
  shiftEnd: string | null;
};

type Props = {
  todayRecord: {
    checkIn: Date | null;
    checkOut: Date | null;
    checkInPhotoUrl?: string | null;
    project?: { name: string } | null;
    note?: string | null;
  } | null;
  assignedProjects: AssignedProject[];
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

export default function CicoActions({ todayRecord, assignedProjects }: Props) {
  const { t } = useT();
  const [projectId, setProjectId] = useState(assignedProjects[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const selected = assignedProjects.find((project) => project.id === projectId);
  // Base UI Select.Value shows the raw value unless `items` maps id → label.
  const projectSelectItems = assignedProjects.map((project) => ({
    value: project.id,
    label: projectSelectLabel(project),
  }));

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
    setLocating(true);
    try {
      const position = await getCurrentPosition(
        t("pages.cico.geolocationUnsupported")
      );
      const formData = new FormData();
      formData.set("latitude", String(position.coords.latitude));
      formData.set("longitude", String(position.coords.longitude));

      startTransition(async () => {
        try {
          await checkOut(formData);
        } catch (error) {
          showRejectionFromError(error, t("pages.cico.checkOutFailed"));
        }
      });
    } catch (error) {
      showRejectionFromError(error, t("pages.cico.locationFailed"));
    } finally {
      setLocating(false);
    }
  }

  const checkedIn = !!todayRecord?.checkIn;
  const checkedOut = !!todayRecord?.checkOut;
  const hasProjects = assignedProjects.length > 0;
  const canCheckIn =
    !pending &&
    !locating &&
    !checkedIn &&
    hasProjects &&
    !!projectId &&
    !!photoFile;

  return (
    <div className="space-y-6">
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
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder={t("pages.cico.selectProject")}>
                    {(value) => {
                      if (!value) return null;
                      const project = assignedProjects.find((p) => p.id === value);
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
                {t("pages.cico.noProjectsAssigned")}
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
                      meters: selected.locationRadiusMeters ?? 50,
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

          <div className="space-y-2.5">
            <label className="text-sm font-medium text-muted">
              {t("pages.cico.onSitePhoto")}{" "}
              <span className="font-normal text-amber-400">
                {t("pages.cico.required")}
              </span>
            </label>
            <p className="text-xs leading-relaxed text-subtle">
              {t("pages.cico.photoHelp")}
            </p>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={onPhotoChange}
            />
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="badgeFlex"
                onClick={() => photoInputRef.current?.click()}
                disabled={pending || locating || !hasProjects}
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
                  disabled={pending || locating}
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
                  alt={t("pages.cico.checkInPhoto")}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex h-28 max-w-xs items-center justify-center rounded-xl border border-dashed border-border bg-inset px-4 text-center text-xs text-subtle">
                {t("pages.cico.noPhotoSelected")}
              </div>
            )}
          </div>
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
          {locating
            ? t("pages.cico.gettingLocation")
            : checkedIn
              ? t("pages.cico.checkedIn")
              : t("pages.cico.checkIn")}
        </Button>

        <Button
          onClick={handleCheckOut}
          disabled={pending || locating || !checkedIn || checkedOut}
          variant="warning"
          size="lg"
          className="h-12 w-full text-base [&_svg]:size-5"
        >
          <LogOut className="mr-2" />
          {locating
            ? t("pages.cico.gettingLocation")
            : checkedOut
              ? t("pages.cico.checkedOut")
              : t("pages.cico.checkOut")}
        </Button>
      </div>

      <p className="pt-1 text-xs leading-relaxed text-subtle">
        {t("pages.cico.footerNote")}
      </p>
    </div>
  );
}
