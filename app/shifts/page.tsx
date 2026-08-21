import { redirect } from "next/navigation";

import {
  getShiftsDirectory,
  resolveShiftsProjectHref,
} from "@/app/shifts/data";
import AppShell from "@/components/layout/AppShell";
import ShiftsBreadcrumbs from "@/components/shifts/ShiftsBreadcrumbs";
import ShiftsClientDirectory from "@/components/shifts/ShiftsClientDirectory";
import { requireModule } from "@/lib/session";

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await requireModule("shifts");
  const { projectId: projectIdRaw } = await searchParams;
  const projectId = projectIdRaw?.trim() || null;

  if (projectId && session.user.companyId) {
    const href = await resolveShiftsProjectHref(
      {
        companyId: session.user.companyId,
        userId: session.user.id,
        username: session.user.username,
        clientId: session.user.clientId,
      },
      projectId
    );
    if (href) redirect(href);
  }

  const directory = session.user.companyId
    ? await getShiftsDirectory({
        companyId: session.user.companyId,
        userId: session.user.id,
        username: session.user.username,
        clientId: session.user.clientId,
      })
    : { clients: [], internal: null };

  return (
    <AppShell
      titleKey="pages.shifts.title"
      descriptionKey="pages.shifts.description"
    >
      <ShiftsBreadcrumbs items={[{ labelKey: "pages.shifts.title" }]} />
      <ShiftsClientDirectory
        clients={directory.clients}
        internal={directory.internal}
      />
    </AppShell>
  );
}
