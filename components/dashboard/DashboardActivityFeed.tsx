"use client";

import {
  Activity,
  CalendarOff,
  Camera,
} from "lucide-react";

import LeaveTypeLabel from "@/components/leaves/LeaveTypeLabel";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDisplayDate } from "@/lib/format-date";
import { localizeLeaveStatus } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";

type ProgressItem = {
  id: string;
  reportDate: Date;
  notes: string | null;
  stageLabel: string | null;
  project: { name: string };
  employee: { firstName: string; lastName: string };
  createdAt: Date;
  _count?: { photos: number };
};

type LeaveItem = {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
  employee: { firstName: string; lastName: string };
};

type TimelineEntry =
  | { kind: "progress"; sortDate: Date; data: ProgressItem }
  | { kind: "leave"; sortDate: Date; data: LeaveItem };

type Props = {
  recentProgress: ProgressItem[];
  recentLeaves: LeaveItem[];
  showProgress?: boolean;
  showLeaves?: boolean;
};

function buildTimeline(
  recentProgress: ProgressItem[],
  recentLeaves: LeaveItem[]
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...recentProgress.map((item) => ({
      kind: "progress" as const,
      sortDate: item.createdAt,
      data: item,
    })),
    ...recentLeaves.map((item) => ({
      kind: "leave" as const,
      sortDate: item.createdAt,
      data: item,
    })),
  ];

  return entries
    .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
    .slice(0, 8);
}

export default function DashboardActivityFeed({
  recentProgress,
  recentLeaves,
  showProgress = true,
  showLeaves = true,
}: Props) {
  const { t, locale } = useT();
  const timeline = buildTimeline(
    showProgress ? recentProgress : [],
    showLeaves ? recentLeaves : []
  );

  return (
    <SectionCard className="h-full max-lg:p-4">
      <div className="mb-4 flex items-center gap-2 lg:mb-6">
        <Activity size={18} className="text-cyan-400" />
        <h3 className="text-base font-semibold text-text lg:text-lg">
          {t("pages.dashboard.recentActivity")}
        </h3>
      </div>

      {timeline.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-inset px-4 py-10 text-center sm:px-6 sm:py-12">
          <Activity size={28} className="mx-auto text-muted" />
          <p className="mt-4 text-sm font-medium text-subtle">
            {t("pages.dashboard.noRecentActivityTitle")}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t("pages.dashboard.noRecentActivityDesc")}
          </p>
        </div>
      ) : (
        <div className="relative space-y-0">
          <div
            className="absolute bottom-2 left-[15px] top-2 hidden w-px bg-gradient-to-b from-cyan-500/30 via-white/10 to-transparent lg:block"
            aria-hidden
          />

          {timeline.map((entry) => {
            if (entry.kind === "progress") {
              const item = entry.data;
              const photoCount = item._count?.photos ?? 0;
              return (
                <div
                  key={`progress-${item.id}`}
                  className="relative flex gap-3 pb-3 last:pb-0 lg:gap-4 lg:pb-5"
                >
                  <div className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-500/30 bg-elevated text-cyan-400 lg:mt-0">
                    <Camera size={14} />
                  </div>

                  <div className="min-w-0 flex-1 rounded-xl border border-border bg-elevated px-3.5 py-3 lg:px-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-text">
                        {t("pages.dashboard.progressReport", {
                          project: item.project.name,
                        })}
                      </p>
                      <StatusBadge status="success" className="w-fit shrink-0">
                        {photoCount === 1
                          ? t("pages.dashboard.photoOne", { count: photoCount })
                          : t("pages.dashboard.photoOther", {
                              count: photoCount,
                            })}
                      </StatusBadge>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-subtle">
                      {item.employee.firstName} {item.employee.lastName} ·{" "}
                      {formatDisplayDate(item.reportDate)}
                      {item.stageLabel
                        ? ` · ${t("pages.dashboard.serviceArea")}: ${item.stageLabel}`
                        : ""}
                    </p>
                    {item.notes && (
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-subtle">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            const item = entry.data;
            const leaveStatus =
              item.status === "APPROVED"
                ? "success"
                : item.status === "REJECTED"
                  ? "danger"
                  : "warning";

            return (
              <div
                key={`leave-${item.id}`}
                className="relative flex gap-3 pb-3 last:pb-0 lg:gap-4 lg:pb-5"
              >
                <div className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-warning/35 bg-elevated text-warning lg:mt-0">
                  <CalendarOff size={14} />
                </div>

                <div className="min-w-0 flex-1 rounded-xl border border-border bg-elevated px-3.5 py-3 lg:px-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-text">
                      {t("pages.dashboard.leaveRequest")} ·{" "}
                      {item.employee.firstName} {item.employee.lastName}
                    </p>
                    <StatusBadge status={leaveStatus} className="w-fit shrink-0">
                      {localizeLeaveStatus(item.status, locale)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-subtle">
                    <LeaveTypeLabel type={item.type} /> ·{" "}
                    {formatDisplayDate(item.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
