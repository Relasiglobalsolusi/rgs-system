import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import {
  countOpenInvoices,
  isBillingActiveProject,
  billingActiveProjectWhere,
  taxInvoicePendingWhere,
} from "@/lib/billing";
import { cn } from "@/lib/utils";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import {
  countDueMonthlyInvoiceReminders,
  syncDueMonthlyInvoicesOnLoad,
} from "@/app/projects/invoice-actions";

import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import BillingClientDirectory, {
  type BillingClientRow,
} from "@/components/billing/BillingClientDirectory";
import SectionCard from "@/components/ui/SectionCard";
import { buttonVariants } from "@/components/ui/button";

export default async function BillingPage() {
  const session = await requireModule("invoicing");
  const t = createTranslator(await getServerLocale());
  const portalClientId = session.user.clientId;

  // Vendor portal uses Purchases / Finance vendor views, not client AR billing.
  if (session.user.vendorId) {
    redirect("/billing/purchase-invoices");
  }

  if (!portalClientId) {
    try {
      await syncDueMonthlyInvoicesOnLoad();
    } catch {
      // Banner / directory still load if period sync fails.
    }
  }

  const [clients, pendingTaxInvoiceCount, dueMonthlyReminders] =
    await Promise.all([
      prisma.client.findMany({
        where: {
          companyId: session.user.companyId,
          active: true,
          ...(portalClientId ? { id: portalClientId } : {}),
          projects: {
            some: billingActiveProjectWhere(),
          },
        },
        include: {
          projects: {
            where: billingActiveProjectWhere(),
            include: {
              invoicePeriods: {
                select: {
                  status: true,
                  dueAt: true,
                  submittedAt: true,
                },
              },
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      portalClientId
        ? Promise.resolve(0)
        : prisma.projectInvoicePeriod.count({
            where: {
              project: { companyId: session.user.companyId },
              ...taxInvoicePendingWhere(),
            },
          }),
      portalClientId ? Promise.resolve(0) : countDueMonthlyInvoiceReminders(),
    ]);

  const now = new Date();
  const rows: BillingClientRow[] = clients
    .map((client) => {
      const activeProjects = client.projects.filter((p) =>
        isBillingActiveProject(p)
      );
      const allPeriods = activeProjects.flatMap((p) => p.invoicePeriods);
      const counts = countOpenInvoices(allPeriods, now);
      return {
        id: client.id,
        name: client.name,
        projectCount: activeProjects.length,
        openInvoices: counts.open,
        lateInvoices: counts.late,
        paidInvoices: counts.paid,
      };
    })
    .filter((row) => row.projectCount > 0);

  return (
    <AppShell
      titleKey="pages.billing.title"
      descriptionKey="pages.billing.description"
    >
      <BillingBreadcrumbs items={[{ label: t("pages.billing.title") }]} />

      {!portalClientId && dueMonthlyReminders > 0 ? (
        <SectionCard className="mb-5 border-amber-500/30 bg-card-tint-amber">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="font-medium text-amber-100">
                  {t("pages.billing.cyclesReadyTitle", {
                    count: dueMonthlyReminders,
                  })}
                </p>
                {t("pages.billing.cyclesReadyDesc") ? (
                  <p className="mt-1 text-sm text-muted">
                    {t("pages.billing.cyclesReadyDesc")}
                  </p>
                ) : null}
              </div>
            </div>
            <Link
              href="/projects?view=in-progress"
              className={cn(
                buttonVariants({ variant: "warningBadge", size: "badge" }),
                "!w-auto !min-w-[7.5rem] !max-w-none px-3"
              )}
            >
              {t("pages.billing.openInProgress")}
            </Link>
          </div>
        </SectionCard>
      ) : null}

      {!portalClientId && pendingTaxInvoiceCount > 0 ? (
        <SectionCard className="mb-5 border-amber-500/30 bg-card-tint-amber">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="font-medium text-amber-100">
                  {t("pages.billing.taxStillNeedTitle", {
                    count: pendingTaxInvoiceCount,
                  })}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t("pages.billing.taxStillNeedDesc")}
                </p>
              </div>
            </div>
            <Link
              href="/billing/tax-invoices"
              className={cn(
                buttonVariants({ variant: "warningBadge", size: "badge" }),
                "!w-auto !min-w-[7.5rem] !max-w-none px-3"
              )}
            >
              {t("pages.billing.openTaxChecklist")}
            </Link>
          </div>
        </SectionCard>
      ) : null}

      <BillingClientDirectory clients={rows} />
    </AppShell>
  );
}
