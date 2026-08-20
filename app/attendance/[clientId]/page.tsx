import { notFound } from "next/navigation";

import {
  getAttendanceProjectsForClient,
  getEarlyCheckOutCount,
  getEarlyCheckOutReport,
} from "@/app/attendance/actions";
import { requireModule } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import AttendanceBreadcrumbs from "@/components/attendance/AttendanceBreadcrumbs";
import AttendanceEarlyCheckoutSection, {
  AttendanceEarlyCheckoutCard,
} from "@/components/attendance/AttendanceEarlyCheckoutSection";
import AttendanceProjectDirectory from "@/components/attendance/AttendanceProjectDirectory";

type Props = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function AttendanceClientPage({
  params,
  searchParams,
}: Props) {
  await requireModule("attendance");
  const { clientId } = await params;
  const { view } = await searchParams;
  const showEarly = view === "checked-out-before-shift-end";
  const result = await getAttendanceProjectsForClient(clientId);

  if (!result) notFound();

  const earlyCount = await getEarlyCheckOutCount();
  const earlyReport = showEarly ? await getEarlyCheckOutReport() : null;

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
      <div className="mb-5 max-w-sm">
        <AttendanceEarlyCheckoutCard
          count={earlyCount}
          selected={showEarly}
          href={`/attendance/${clientId}?view=checked-out-before-shift-end`}
          selectedHref={`/attendance/${clientId}`}
        />
      </div>
      {earlyReport ? (
        <AttendanceEarlyCheckoutSection rows={earlyReport.rows} />
      ) : (
        <AttendanceProjectDirectory
          clientId={clientId}
          projects={result.projects}
        />
      )}
    </AppShell>
  );
}
