import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import {
  countOpenInvoices,
  getMostUrgentUnpaidPeriod,
  isBillingActiveProject,
  subcategorySortIndex,
} from "@/lib/billing";
import { decimalToNumber, formatProjectTitle } from "@/lib/project-billing";
import { getServerLocale } from "@/lib/i18n/locale";
import type { BillingMode, ProjectSubCategory } from "@prisma/client";

import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import BillingProjectDirectory, {
  type BillingProjectRow,
} from "@/components/billing/BillingProjectDirectory";

export default async function BillingClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const session = await requireModule("invoicing");
  const locale = await getServerLocale();
  const { clientId } = await params;

  if (session.user.clientId && session.user.clientId !== clientId) {
    notFound();
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId: session.user.companyId },
    include: {
      projects: {
        include: {
          invoicePeriods: {
            select: {
              status: true,
              dueAt: true,
              submittedAt: true,
              label: true,
              milestonePercent: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!client) notFound();

  const now = new Date();
  const projects: BillingProjectRow[] = client.projects
    .filter((p) => isBillingActiveProject(p))
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        subcategorySortIndex(a.subCategory) -
          subcategorySortIndex(b.subCategory) ||
        a.name.localeCompare(b.name)
    )
    .map((project) => {
      const counts = countOpenInvoices(project.invoicePeriods, now);
      const unpaid = getMostUrgentUnpaidPeriod(project.invoicePeriods, now);
      return {
        id: project.id,
        name: project.name,
        displayName: formatProjectTitle(project.name, unpaid, locale),
        location: project.location,
        status: project.status,
        subCategory: project.subCategory as ProjectSubCategory,
        billingMode: project.billingMode as BillingMode,
        contractPrice: decimalToNumber(project.contractPrice),
        openInvoices: counts.open,
        lateInvoices: counts.late,
      };
    });

  return (
    <AppShell
      title={client.name}
      descriptionKey="pages.billing.clientProjectsDesc"
    >
      <BillingBreadcrumbs
        items={[
          {
            labelKey: "pages.billing.title",
            href: "/billing",
          },
          { label: client.name },
        ]}
      />

      <BillingProjectDirectory clientId={client.id} projects={projects} />
    </AppShell>
  );
}
