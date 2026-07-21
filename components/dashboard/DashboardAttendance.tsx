"use client";

import Link from "next/link";
import { Clock, UserCheck } from "lucide-react";

import SectionCard from "@/components/ui/SectionCard";
import { formatDisplayTime } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";

type AttendanceRecord = {
  id: string;
  checkIn: Date | null;
  checkOut: Date | null;
  employee: {
    firstName: string;
    lastName: string;
    employeeNo: string;
  };
};

type Props = {
  records: AttendanceRecord[];
  presentCount: number;
  totalEmployees: number;
  /** Staff view: only the signed-in user's today record (no team stats / report link). */
  personal?: boolean;
  canViewAttendanceReport?: boolean;
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export default function DashboardAttendance({
  records,
  presentCount,
  totalEmployees,
  personal = false,
  canViewAttendanceReport = true,
}: Props) {
  const absentCount = Math.max(totalEmployees - presentCount, 0);
  const attendanceRate =
    totalEmployees > 0
      ? Math.round((presentCount / totalEmployees) * 100)
      : 0;

  const { t } = useT();
  const personalRecord = personal ? records[0] : null;
  const isCheckedIn = Boolean(personalRecord?.checkIn);
  const isCheckedOut = Boolean(personalRecord?.checkOut);

  return (
    <SectionCard className="h-full max-lg:p-4">
      <div className="mb-4 flex flex-col gap-3 lg:mb-6 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between lg:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="shrink-0 text-cyan-400" />
            <h3 className="text-base font-semibold text-text lg:text-lg">
              {personal
                ? t("pages.dashboard.myAttendanceToday")
                : t("pages.dashboard.todaysAttendance")}
            </h3>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-subtle lg:mt-1 lg:text-sm">
            {personal
              ? !personalRecord
                ? t("pages.dashboard.notCheckedInYet")
                : isCheckedOut
                  ? t("pages.dashboard.checkedInAndOut")
                  : isCheckedIn
                    ? t("pages.dashboard.checkedIn")
                    : t("pages.dashboard.notCheckedInYet")
              : t("pages.dashboard.todaysAttendanceStats", {
                  present: presentCount,
                  absent: absentCount,
                  rate: attendanceRate,
                })}
          </p>
        </div>
        {!personal && canViewAttendanceReport && (
          <Link
            href="/attendance"
            className="inline-flex min-h-10 items-center self-start rounded-lg border border-accent-cyan/25 bg-card-tint-cyan px-3 py-2 text-sm font-medium text-cyan-300 transition hover:border-accent-cyan/40 hover:text-cyan-200 lg:min-h-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-cyan-400 lg:hover:text-cyan-300"
          >
            {t("pages.dashboard.attendanceReport")}
          </Link>
        )}
      </div>

      {records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-inset px-4 py-10 text-center sm:px-6 sm:py-12">
          <UserCheck size={28} className="mx-auto text-muted" />
          <p className="mt-4 text-sm font-medium text-subtle">
            {personal
              ? t("pages.attendance.noCheckInToday")
              : t("pages.attendance.noCheckInsYet")}
          </p>
          <p className="mt-1 text-xs text-muted">
            {personal
              ? t("pages.dashboard.personalCheckInHint")
              : t("pages.dashboard.teamCheckInHint")}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border bg-elevated">
          {records.map((record) => (
            <div
              key={record.id}
              className="flex flex-col gap-3 px-3.5 py-3.5 transition hover:bg-card sm:flex-row sm:items-center sm:gap-4 sm:px-5"
            >
              <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/85 to-teal-600/85 text-xs font-bold text-white">
                  {getInitials(
                    record.employee.firstName,
                    record.employee.lastName
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text sm:text-base">
                    {record.employee.firstName} {record.employee.lastName}
                  </p>
                  <p className="truncate text-xs text-subtle">
                    {record.employee.employeeNo}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center sm:gap-4 sm:text-sm">
                <div className="rounded-lg border border-border/80 bg-inset/60 px-3 py-2 text-left sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                    {t("pages.dashboard.attendanceIn")}
                  </p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums text-emerald-400">
                    {record.checkIn ? formatDisplayTime(record.checkIn) : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-inset/60 px-3 py-2 text-left sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                    {t("pages.dashboard.attendanceOut")}
                  </p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums text-orange-400">
                    {record.checkOut ? formatDisplayTime(record.checkOut) : "—"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!personal && records.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted lg:mt-4">
          <Clock size={12} />
          {t("pages.dashboard.showingLatestCheckIns", {
            count: records.length,
          })}
        </p>
      )}
    </SectionCard>
  );
}
