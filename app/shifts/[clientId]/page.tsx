import { notFound } from "next/navigation";

import { getShiftsProjectsForClient } from "@/app/shifts/data";
import AppShell from "@/components/layout/AppShell";
import ShiftsBreadcrumbs from "@/components/shifts/ShiftsBreadcrumbs";
import ShiftsProjectDirectory from "@/components/shifts/ShiftsProjectDirectory";
import { createTranslator } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import { requireModule } from "@/lib/session";

type Props = {
  params: Promise<{ clientId: string }>;
};

export default async function ShiftsClientPage({ params }: Props) {
  const session = await requireModule("shifts");
  const { clientId } = await params;
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  if (!session.user.companyId) notFound();

  const data = await getShiftsProjectsForClient(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      username: session.user.username,
      clientId: session.user.clientId,
    },
    clientId
  );
  if (!data) notFound();

  const clientLabel = data.isInternal
    ? t("pages.shifts.internalSection")
    : data.clientName;

  return (
    <AppShell
      title={clientLabel}
      descriptionKey="pages.shifts.clientProjectsDesc"
    >
      <ShiftsBreadcrumbs
        items={[
          { labelKey: "pages.shifts.title", href: "/shifts" },
          { label: clientLabel },
        ]}
      />
      <ShiftsProjectDirectory
        clientId={data.routeClientId}
        projects={data.projects}
      />
    </AppShell>
  );
}
