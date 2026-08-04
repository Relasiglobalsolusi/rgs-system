import { redirect } from "next/navigation";

import { getAttendanceDirectory } from "@/app/attendance/actions";
import { requireModule } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import AttendanceBreadcrumbs from "@/components/attendance/AttendanceBreadcrumbs";
import AttendanceClientDirectory from "@/components/attendance/AttendanceClientDirectory";

export default async function AttendanceReportPage() {
  const session = await requireModule("attendance");
  const directory = await getAttendanceDirectory();

  if (session.user.clientId && directory.clients.length === 1) {
    redirect(`/attendance/${directory.clients[0]!.id}`);
  }

  const isClientPortal = Boolean(session.user.clientId);

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
      <AttendanceClientDirectory
        clients={directory.clients}
        internalSites={directory.internalSites}
      />
    </AppShell>
  );
}
