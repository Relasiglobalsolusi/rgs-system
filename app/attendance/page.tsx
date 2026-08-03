import { redirect } from "next/navigation";

import { getAttendanceClients } from "@/app/attendance/actions";
import { requireModule } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import AttendanceBreadcrumbs from "@/components/attendance/AttendanceBreadcrumbs";
import AttendanceClientDirectory from "@/components/attendance/AttendanceClientDirectory";

export default async function AttendanceReportPage() {
  const session = await requireModule("attendance");
  const clients = await getAttendanceClients();

  if (session.user.clientId && clients.length === 1) {
    redirect(`/attendance/${clients[0]!.id}`);
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
      <AttendanceClientDirectory clients={clients} />
    </AppShell>
  );
}
