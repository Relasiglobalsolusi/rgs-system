import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireModule, toPermissionUser } from "@/lib/session";
import { canAccess } from "@/lib/permissions";
import { isPlanningProjectStatus } from "@/lib/project-status";
import { getMostUrgentUnpaidPeriod } from "@/lib/billing";
import {
  decimalToNumber,
  formatContractPrice,
  formatProjectTitle,
  usesInvoicePeriods,
} from "@/lib/project-billing";
import { isServiceProjectSubCategory } from "@/lib/project-subcategory";
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
  const isService = isServiceProjectSubCategory(project.subCategory);
  const opensPeriods = usesInvoicePeriods(project.subCategory);

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

  // Security / Parking / Payroll Management: commercial terms only — never sync periods.
  if (isService || !opensPeriods) {
    const monthlyFee = decimalToNumber(project.contractPrice);
    const setupCost = decimalToNumber(project.setupCost);
    const profitShare = decimalToNumber(project.profitSharePercent);
    const monthlyClientFee = decimalToNumber(project.monthlyClientFee);
    const serviceFee = decimalToNumber(project.serviceFeePercent);

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
            {t("pages.projects.detail.serviceBillingNote")}
          </p>
          <BackLink href={`/projects/${project.id}`} direction="forward">
            {t("pages.billing.projectDetails")}
          </BackLink>
        </div>

        <SectionCard>
          <h3 className="mb-4 text-lg font-semibold text-text">
            {t("pages.billing.serviceCommercialTitle")}
          </h3>
          <dl
            className={
              project.subCategory === "PARKING"
                ? "grid gap-4 text-sm sm:grid-cols-3"
                : project.subCategory === "PAYROLL_MANAGEMENT"
                  ? "grid gap-4 text-sm sm:grid-cols-2"
                  : "grid gap-4 text-sm"
            }
          >
            {project.subCategory === "SECURITY" ? (
              <div>
                <dt className="text-subtle">
                  {t("pages.projects.serviceCommercial.monthlyFee")}
                </dt>
                <dd className="mt-1 font-medium text-text">
                  {formatContractPrice(monthlyFee)}
                </dd>
              </div>
            ) : null}
            {project.subCategory === "PARKING" ? (
              <>
                <div>
                  <dt className="text-subtle">
                    {t("pages.projects.serviceCommercial.setupCost")}
                  </dt>
                  <dd className="mt-1 font-medium text-text">
                    {formatContractPrice(setupCost)}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle">
                    {t("pages.projects.serviceCommercial.profitSharePercent")}
                  </dt>
                  <dd className="mt-1 font-medium text-text">
                    {profitShare != null ? `${profitShare}%` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle">
                    {t("pages.projects.serviceCommercial.monthlyClientFee")}
                  </dt>
                  <dd className="mt-1 font-medium text-text">
                    {formatContractPrice(monthlyClientFee)}
                  </dd>
                </div>
              </>
            ) : null}
            {project.subCategory === "PAYROLL_MANAGEMENT" ? (
              <>
                <div>
                  <dt className="text-subtle">
                    {t("pages.projects.serviceCommercial.serviceFeePercent")}
                  </dt>
                  <dd className="mt-1 font-medium text-text">
                    {serviceFee != null ? `${serviceFee}%` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle">
                    {t("pages.projects.serviceCommercial.paymentTermsDays")}
                  </dt>
                  <dd className="mt-1 font-medium text-text">
                    {project.paymentTermsDays === 0
                      ? t("common.paymentTerms.cashShort")
                      : project.paymentTermsDays != null
                        ? t("common.paymentTerms.netShort", {
                            days: project.paymentTermsDays,
                          })
                        : "—"}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
        </SectionCard>
      </AppShell>
    );
  }

  // Sync anniversary cycles for cleaning projects only (no auto-issue).
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

  const refreshedProject = await prisma.project.findUnique({
    where: { id: project.id },
    include: {
      invoicePeriods: {
        orderBy: { periodStart: "desc" },
      },
    },
  });

  const refreshed = refreshedProject?.invoicePeriods ?? project.invoicePeriods;
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
