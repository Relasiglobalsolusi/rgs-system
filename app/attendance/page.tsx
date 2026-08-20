import { redirect } from "next/navigation";

import {
  getAttendanceDirectory,
  getEarlyCheckOutCount,
  getEarlyCheckOutReport,
} from "@/app/attendance/actions";
import { requireModule } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import AttendanceBreadcrumbs from "@/components/attendance/AttendanceBreadcrumbs";
import AttendanceClientDirectory from "@/components/attendance/AttendanceClientDirectory";
import AttendanceEarlyCheckoutSection, {
  AttendanceEarlyCheckoutCard,
} from "@/components/attendance/AttendanceEarlyCheckoutSection";

export default async function AttendanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await requireModule("attendance");
  const { view } = await searchParams;
  const showEarly = view === "checked-out-before-shift-end";
  const directory = await getAttendanceDirectory();

  if (session.user.clientId && directory.clients.length === 1 && !showEarly) {
    redirect(`/attendance/${directory.clients[0]!.id}`);
  }

  const isClientPortal = Boolean(session.user.clientId);
  const earlyCount = await getEarlyCheckOutCount();
  const earlyReport = showEarly ? await getEarlyCheckOutReport() : null;

  return (
    <AppShell
      titleKey="pages.attendance.title"
      descriptionKey={
        isClientPortal
          ? "pages.attendance.descriptionClient"
          : "pages.attendance.descriptionAdmin"
      }
    >
      <AttendanceBreadcrumbs items={[{ labelKey: "pages.attendance.title" }]} />
      <div className="mb-5 max-w-sm">
        <AttendanceEarlyCheckoutCard
          count={earlyCount}
          selected={showEarly}
        />
      </div>
      {earlyReport ? (
        <AttendanceEarlyCheckoutSection rows={earlyReport.rows} />
      ) : (
        <AttendanceClientDirectory
          clients={directory.clients}
          internalSites={directory.internalSites}
        />
      )}
    </AppShell>
  );
}
