import { notFound } from "next/navigation";

import { getAttendanceProjectsForClient } from "@/app/attendance/actions";
import { requireModule } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import AttendanceBreadcrumbs from "@/components/attendance/AttendanceBreadcrumbs";
import AttendanceProjectDirectory from "@/components/attendance/AttendanceProjectDirectory";

type Props = {
  params: Promise<{ clientId: string }>;
};

export default async function AttendanceClientPage({ params }: Props) {
  await requireModule("attendance");
  const { clientId } = await params;
  const result = await getAttendanceProjectsForClient(clientId);

  if (!result) notFound();

  return (
    <AppShell
      title={result.clientName}
      descriptionKey="pages.attendance.clientProjectsDesc"
    >
      <AttendanceBreadcrumbs
        items={[
          { labelKey: "pages.attendance.title", href: "/attendance" },
          { label: result.clientName },
        ]}
      />
      <AttendanceProjectDirectory
        clientId={clientId}
        projects={result.projects}
      />
    </AppShell>
  );
}
