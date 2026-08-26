"use client";

import Link from "next/link";
import { ArrowRight, FolderKanban, Info, MapPin } from "lucide-react";

import AttendanceCheckInTable, {
  type AttendanceCheckInRow,
} from "@/components/attendance/AttendanceCheckInTable";
import CicoActions from "@/components/cico/CicoActions";
import SectionCard from "@/components/ui/SectionCard";
import { useT } from "@/lib/i18n/use-t";
import { formatDisplayTime } from "@/lib/format-date";
import { formatTimeRange } from "@/lib/operating-hours";

type SelectableProject = {
  id: string;
  name: string;
  location: string | null;
  locationRadiusMeters: number | null;
  shiftStart: string | null;
  shiftEnd: string | null;
};

type TodayRecord = {
  checkIn: Date | null;
  checkOut: Date | null;
  checkInPhotoUrl?: string | null;
  checkOutPhotoUrl?: string | null;
  project?: { id: string; name: string } | null;
  note?: string | null;
  projectId?: string | null;
};

type Props = {
  attendanceRows: AttendanceCheckInRow[];
  openCheckInCount: number;
  /** Read-only sample project for desk managers (disabled preview). */
  previewProject: SelectableProject | null;
  workDate: string;
  /** HO admin interactive field flow — real CICO against a selected project. */
  adminFieldMode?: boolean;
  selectableProjects?: SelectableProject[];
  todayRecord?: TodayRecord | null;
  todaySessions?: TodayRecord[];
  hasProgressReport?: boolean;
  /** Cleaning positions only — matches operational CICO checkout gate. */
  requiresProgress?: boolean;
  hasEmployeeProfile?: boolean;
};

export default function CicoAdminPreview({
  attendanceRows,
  openCheckInCount,
  previewProject,
  workDate,
  adminFieldMode = false,
  selectableProjects = [],
  todayRecord = null,
  todaySessions = [],
  hasProgressReport = false,
  requiresProgress = false,
  hasEmployeeProfile = true,
}: Props) {
  const { t } = useT();

  const previewProjects = previewProject ? [previewProject] : [];
  const fieldProjects = adminFieldMode ? selectableProjects : previewProjects;

  return (
    <div className="flex w-full flex-col gap-8 pb-8">
      <div
        className={
          adminFieldMode
            ? "rounded-xl border border-amber-500/40 bg-card-tint-amber px-4 py-4 sm:px-5"
            : "rounded-xl border border-accent-cyan/30 bg-card-tint-cyan px-4 py-4 sm:px-5"
        }
      >
        <div className="flex items-start gap-3">
          <Info
            className={
              adminFieldMode
                ? "mt-0.5 h-5 w-5 shrink-0 text-amber-400"
                : "mt-0.5 h-5 w-5 shrink-0 text-accent-teal"
            }
          />
          <div className="min-w-0 space-y-1">
            <p className="font-medium text-text">
              {adminFieldMode
                ? t("pages.cico.adminPreview.fieldBannerTitle")
                : t("pages.cico.adminPreview.bannerTitle")}
            </p>
            <p className="text-sm leading-relaxed text-subtle">
              {adminFieldMode
                ? t("pages.cico.adminPreview.fieldBannerBody")
                : t("pages.cico.adminPreview.bannerBody")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SectionCard>
          <p className="text-sm text-subtle">
            {t("pages.cico.adminPreview.checkedInToday")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-400">
            {attendanceRows.filter((row) => row.checkIn).length}
          </p>
        </SectionCard>
        <SectionCard>
          <p className="text-sm text-subtle">
            {t("pages.cico.adminPreview.openCheckIns")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-400">
            {openCheckInCount}
          </p>
        </SectionCard>
        <SectionCard>
          <p className="text-sm text-subtle">
            {t("pages.cico.adminPreview.sitesWithActivity")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-text">
            {
              new Set(
                attendanceRows
                  .map((row) => row.project?.name)
                  .filter(Boolean)
              ).size
            }
          </p>
        </SectionCard>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/progress"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-sm font-medium text-text transition hover:bg-elevated"
        >
          {t("pages.cico.adminPreview.viewAttendanceReport")}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/projects"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-sm font-medium text-text transition hover:bg-elevated"
        >
          <FolderKanban className="h-4 w-4" />
          {t("pages.cico.adminPreview.viewProjects")}
        </Link>
      </div>

      <SectionCard className="px-6 py-7 sm:px-8 sm:py-8">
        <h3 className="mb-5 text-lg font-semibold tracking-tight text-text">
          {t("pages.cico.adminPreview.todaysSiteCheckIns")}
        </h3>
        {attendanceRows.length === 0 ? (
          <p className="text-sm text-subtle">
            {t("pages.cico.adminPreview.noCheckInsToday")}
          </p>
        ) : (
          <AttendanceCheckInTable data={attendanceRows} />
        )}
      </SectionCard>

      <SectionCard className="px-6 py-7 sm:px-8 sm:py-8">
        <div className="mb-6">
          <h3 className="text-lg font-semibold tracking-tight text-text">
            {adminFieldMode
              ? t("pages.cico.adminPreview.fieldWorkerFlow")
              : t("pages.cico.adminPreview.fieldWorkerPreview")}
          </h3>
          <p className="mt-1 text-sm text-subtle">
            {adminFieldMode
              ? t("pages.cico.adminPreview.fieldWorkerFlowHint")
              : t("pages.cico.adminPreview.fieldWorkerPreviewHint")}
          </p>
        </div>

        {adminFieldMode && !hasEmployeeProfile ? (
          <p className="rounded-xl border border-amber-500/30 bg-card-tint-amber px-4 py-3 text-sm text-subtle">
            {t("pages.cico.adminPreview.noEmployeeProfile")}
          </p>
        ) : (
          <>
            <CicoActions
              previewMode={!adminFieldMode}
              adminFieldMode={adminFieldMode}
              todayRecord={adminFieldMode ? todayRecord : null}
              todaySessions={adminFieldMode ? todaySessions : []}
              assignedProjects={fieldProjects}
              hasProgressReport={adminFieldMode ? hasProgressReport : false}
              requiresProgress={adminFieldMode ? requiresProgress : false}
              workDate={workDate}
            />
            {adminFieldMode && todayRecord && (
              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-5 text-sm text-subtle">
                <span>
                  {t("pages.cico.columns.checkIn")}:{" "}
                  <span className="font-medium text-text">
                    {todayRecord.checkIn
                      ? formatDisplayTime(todayRecord.checkIn)
                      : "-"}
                  </span>
                </span>
                <span>
                  {t("pages.cico.columns.checkOut")}:{" "}
                  <span className="font-medium text-text">
                    {todayRecord.checkOut
                      ? formatDisplayTime(todayRecord.checkOut)
                      : "-"}
                  </span>
                </span>
                {todayRecord.project && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium text-text">
                      {todayRecord.project.name}
                    </span>
                  </span>
                )}
                {fieldProjects.find((p) => p.id === todayRecord.projectId)
                  ?.shiftStart && (
                  <span>
                    {t("pages.cico.shiftLabel")}:{" "}
                    <span className="font-medium text-text">
                      {formatTimeRange(
                        fieldProjects.find(
                          (p) => p.id === todayRecord.projectId
                        )?.shiftStart,
                        fieldProjects.find(
                          (p) => p.id === todayRecord.projectId
                        )?.shiftEnd
                      )}
                    </span>
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}
