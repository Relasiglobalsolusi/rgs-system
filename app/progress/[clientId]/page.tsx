import { notFound, redirect } from "next/navigation";

import { getProgressProjectsForClient } from "@/app/progress/directory";
import AppShell from "@/components/layout/AppShell";
import ProgressBreadcrumbs from "@/components/progress/ProgressBreadcrumbs";
import ProgressProjectDirectory from "@/components/progress/ProgressProjectDirectory";
import { createTranslator } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import { requireModule } from "@/lib/session";

type Props = {
  params: Promise<{ clientId: string }>;
};

export default async function ProgressClientPage({ params }: Props) {
  const session = await requireModule("progress");
  const { clientId } = await params;

  if (session.user.clientId) {
    redirect("/progress");
  }

  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const data = await getProgressProjectsForClient(clientId);
  if (!data) notFound();

  const clientLabel = data.isInternal
    ? t("pages.progress.internalSection")
    : data.clientName;

  return (
    <AppShell
      title={clientLabel}
    >
      <ProgressBreadcrumbs
        items={[
          { labelKey: "pages.progress.title", href: "/progress" },
          { label: clientLabel },
        ]}
      />
      <ProgressProjectDirectory projects={data.projects} />
    </AppShell>
  );
}
