import { prisma } from "@/lib/prisma";
import { canManageClients } from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import ClientDirectory from "@/components/clients/ClientDirectory";
import PageIntro from "@/components/i18n/PageIntro";
import T from "@/components/i18n/T";

export default async function ClientsPage() {
  const session = await requireModule("clients");
  const canManage = canManageClients(toPermissionUser(session));

  const company = await prisma.company.findFirst();
  if (!company) {
    return (
      <AppShell
        titleKey="pages.clients.title"
        descriptionKey="pages.clients.description"
      >
        <p className="rounded-3xl border border-border bg-elevated p-8 text-text">
          <T k="pages.clients.companyNotFound" />
        </p>
      </AppShell>
    );
  }

  const clients = await prisma.client.findMany({
    where: { companyId: company.id },
    include: {
      _count: { select: { projects: true, users: true } },
      users: {
        select: {
          id: true,
          username: true,
          active: true,
        },
        orderBy: { username: "asc" },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <AppShell
      titleKey="pages.clients.title"
      descriptionKey={
        canManage
          ? "pages.clients.descriptionManage"
          : "pages.clients.descriptionReadonly"
      }
    >
      <PageIntro
        titleKey="pages.clients.directoryTitle"
        descriptionKey="pages.clients.directoryDesc"
      />

      <ClientDirectory clients={clients} canManage={canManage} />
    </AppShell>
  );
}
