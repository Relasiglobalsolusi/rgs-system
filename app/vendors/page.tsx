import { prisma } from "@/lib/prisma";
import { canManageVendors } from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import VendorDirectory from "@/components/vendors/VendorDirectory";
import PageIntro from "@/components/i18n/PageIntro";
import T from "@/components/i18n/T";

export default async function VendorsPage() {
  const session = await requireModule("vendors");
  const canManage = canManageVendors(toPermissionUser(session));

  const company = await prisma.company.findFirst();
  if (!company) {
    return (
      <AppShell
        titleKey="pages.vendors.title"
        descriptionKey="pages.vendors.description"
      >
        <p className="rounded-3xl border border-border bg-elevated p-8 text-text">
          <T k="pages.vendors.companyNotFound" />
        </p>
      </AppShell>
    );
  }

  const vendors = await prisma.vendor.findMany({
    where: { companyId: company.id },
    include: {
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
      titleKey="pages.vendors.title"
      descriptionKey={
        canManage
          ? "pages.vendors.descriptionManage"
          : "pages.vendors.descriptionReadonly"
      }
    >
      <PageIntro
        titleKey="pages.vendors.directoryTitle"
        descriptionKey="pages.vendors.directoryDesc"
      />

      <VendorDirectory vendors={vendors} canManage={canManage} />
    </AppShell>
  );
}
