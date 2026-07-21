import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireModule, toPermissionUser } from "@/lib/session";
import { canAccess } from "@/lib/permissions";
import { isPlanningProjectStatus } from "@/lib/project-status";
import { getMostUrgentUnpaidPeriod } from "@/lib/billing";
import { decimalToNumber, formatProjectTitle } from "@/lib/project-billing";
import { localizeSubCategory } from "@/lib/i18n/labels";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import {
  syncDueMonthlyInvoicesOnLoad,
  syncProjectMonthlyPeriods,
} from "@/app/projects/invoice-actions";

import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import ProjectBillingPanel from "@/components/billing/ProjectBillingPanel";
import BackLink from "@/components/ui/BackLink";
import SectionCard from "@/components/ui/SectionCard";

export default async function BillingProjectPage({
  params,
}: {
  params: Promise<{ clientId: string; projectId: string }>;
}) {
  const session = await requireModule("invoicing");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const canManage =
    canAccess(toPermissionUser(session), "invoicing") &&
    !session.user.clientId;
  const { clientId, projectId } = await params;

  if (session.user.clientId && session.user.clientId !== clientId) {
    notFound();
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      companyId: session.user.companyId,
      clientId: session.user.clientId ?? clientId,
    },
    include: {
      client: { select: { id: true, name: true, paymentTermsDays: true } },
      invoicePeriods: {
        orderBy: { periodStart: "desc" },
      },
      contractExtensions: {
        orderBy: { extendedOn: "desc" },
      },
    },
  });

  if (!project || !project.client) notFound();

  const inPlanning = isPlanningProjectStatus(project.status);
  const pageTitle = formatProjectTitle(project.name, null, locale);

  if (inPlanning) {
    return (
      <AppShell
        title={pageTitle}
        description={`${localizeSubCategory(project.subCategory, locale)} · ${project.client.name}`}
      >
        <BillingBreadcrumbs
          items={[
            { label: t("pages.billing.title"), href: "/billing" },
            { label: project.client.name, href: `/billing/${clientId}` },
            { label: pageTitle },
          ]}
        />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-subtle">
            {t("pages.billing.planningInvoicingHint")}
          </p>
          <BackLink href={`/projects/${project.id}`} direction="forward">
            {t("pages.billing.projectDetails")}
          </BackLink>
        </div>

        <SectionCard>
          <h3 className="text-lg font-semibold text-text">
            {t("pages.billing.stillInPlanning")}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {t("pages.billing.planningUnlockDesc", {
              action: t("pages.billing.moveToInProgress"),
            })}
          </p>
        </SectionCard>
      </AppShell>
    );
  }

  // Sync anniversary cycles for this project (no auto-issue — reconcile then submit).
  if (
    project.billingMode === "MONTHLY" &&
    project.status !== "COMPLETED" &&
    project.status !== "CANCELLED" &&
    canManage
  ) {
    try {
      await syncProjectMonthlyPeriods(project.id);
      await syncDueMonthlyInvoicesOnLoad();
    } catch {
      // Page still loads; staff can reconcile / submit manually.
    }
  }

  const [refreshed, refreshedProject] = await Promise.all([
    prisma.projectInvoicePeriod.findMany({
      where: { projectId: project.id },
      orderBy: { periodStart: "desc" },
    }),
    prisma.project.findUnique({
      where: { id: project.id },
      select: { invoicingDay: true, startDate: true },
    }),
  ]);

  const contractPriceNum = decimalToNumber(project.contractPrice);
  const unpaidMilestone = getMostUrgentUnpaidPeriod(refreshed);
  const billingTitle = formatProjectTitle(project.name, unpaidMilestone, locale);
  const invoicingDay = refreshedProject?.invoicingDay ?? project.invoicingDay;
  const startDateIso =
    (refreshedProject?.startDate ?? project.startDate)?.toISOString() ?? null;

  return (
    <AppShell
      title={billingTitle}
      description={`${localizeSubCategory(project.subCategory, locale)} · ${project.client.name}`}
    >
      <BillingBreadcrumbs
        items={[
          { label: t("pages.billing.title"), href: "/billing" },
          { label: project.client.name, href: `/billing/${clientId}` },
          { label: billingTitle },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-subtle">
          {canManage
            ? t("pages.billing.paymentHistoryDesc")
            : t("pages.billing.invoiceDownloadDesc")}
        </p>
        <BackLink href={`/projects/${project.id}`} direction="forward">
          {t("pages.billing.projectDetails")}
        </BackLink>
      </div>

      <SectionCard>
        <ProjectBillingPanel
          projectId={project.id}
          projectName={project.name}
          billingMode={project.billingMode}
          billingPeriodBasis={project.billingPeriodBasis}
          contractPrice={contractPriceNum}
          invoicingDay={invoicingDay}
          startDate={startDateIso}
          paymentTermsDays={project.client.paymentTermsDays}
          canManage={canManage}
          isClientPortal={Boolean(session.user.clientId)}
          subCategory={project.subCategory}
          contractExtensions={project.contractExtensions.map((row) => ({
            id: row.id,
            extendedOn: row.extendedOn.toISOString(),
            previousEndDate: row.previousEndDate.toISOString(),
            newEndDate: row.newEndDate.toISOString(),
            proofUrl: row.proofUrl,
            notes: row.notes,
          }))}
          periods={refreshed.map((p) => ({
            id: p.id,
            label: p.label,
            periodStart: p.periodStart.toISOString(),
            periodEnd: p.periodEnd.toISOString(),
            status: p.status,
            invoicePdfPath: p.invoicePdfPath,
            reportCount: p.reportCount,
            submittedAt: p.submittedAt?.toISOString() ?? null,
            dueAt: p.dueAt?.toISOString() ?? null,
            paidAt: p.paidAt?.toISOString() ?? null,
            amount: decimalToNumber(p.amount),
            milestonePercent: p.milestonePercent,
            compileNote: p.compileNote,
            taxInvoiceRequired: p.taxInvoiceRequired,
            taxInvoiceDoneAt: p.taxInvoiceDoneAt?.toISOString() ?? null,
            taxInvoiceDocumentPath: p.taxInvoiceDocumentPath,
            paymentProofPath: p.paymentProofPath,
            paymentProofUploadedAt:
              p.paymentProofUploadedAt?.toISOString() ?? null,
            reconciledAt: p.reconciledAt?.toISOString() ?? null,
            clientReviewStatus: p.clientReviewStatus,
            reviewReportPdfPath: p.reviewReportPdfPath,
            hoReviewNote: p.hoReviewNote,
            hoReviewProofPath: p.hoReviewProofPath,
          }))}
        />
      </SectionCard>
    </AppShell>
  );
}
