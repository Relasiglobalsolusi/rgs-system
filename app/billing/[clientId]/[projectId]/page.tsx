import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getProjectWhereForUser } from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";
import { canAccess } from "@/lib/permissions";
import { isPlanningProjectStatus } from "@/lib/project-status";
import {
  decimalToNumber,
  usesInvoicePeriods,
} from "@/lib/project-billing";
import { localizeSubCategory } from "@/lib/i18n/labels";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { syncProjectMonthlyPeriods } from "@/app/projects/invoice-actions";
import { computeParkingMonthEconomics } from "@/lib/parking-economics";
import { getPayrollManagementWorkspace } from "@/app/billing/payroll-management-actions";
import { jakartaYearMonth } from "@/lib/vat";
import { projectDetailHref } from "@/lib/project-directory-rows";

import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import ParkingWorkspace from "@/components/billing/ParkingWorkspace";
import PayrollManagementWorkspace from "@/components/billing/PayrollManagementWorkspace";
import ProjectBillingPanel from "@/components/billing/ProjectBillingPanel";
import BackLink from "@/components/ui/BackLink";
import SectionCard from "@/components/ui/SectionCard";

export default async function BillingProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string; projectId: string }>;
  searchParams?: Promise<{ year?: string; month?: string; period?: string }>;
}) {
  const session = await requireModule("invoicing");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const query = searchParams ? await searchParams : {};
  const highlightPeriodId = query.period?.trim() || null;
  const canManage =
    canAccess(toPermissionUser(session), "invoicing") &&
    !session.user.clientId;
  const { clientId, projectId } = await params;

  if (session.user.clientId && session.user.clientId !== clientId) {
    notFound();
  }

  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...projectWhere,
      clientId: session.user.clientId ?? clientId,
    },
    include: {
      client: { select: { id: true, name: true, hasPortalAccess: true } },
      invoicePeriods: {
        orderBy: { periodStart: "desc" },
      },
      contractExtensions: {
        orderBy: { extendedOn: "desc" },
      },
    },
  });

  if (!project || !project.client) notFound();
  const billingClient = project.client;
  const billingClientId = billingClient.id;

  const inPlanning = isPlanningProjectStatus(project.status);
  const pageTitle = project.name;
  const opensPeriods = usesInvoicePeriods(project.subCategory);

  if (inPlanning) {
    return (
      <AppShell
        title={pageTitle}
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
          <BackLink href={projectDetailHref(project.id, highlightPeriodId)} direction="forward">
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

  // Security uses Regular-like monthly periods (`opensPeriods` / usesInvoicePeriods).
  // Parking and Payroll Management have dedicated workspaces (no invoice-period loop).
  if (!opensPeriods) {
    const nowYm = jakartaYearMonth();
    const year = Math.max(2000, Math.min(2100, Number(query.year) || nowYm.year));
    const month = Math.max(1, Math.min(12, Number(query.month) || nowYm.month));

    return (
      <AppShell
        title={pageTitle}
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
            {project.subCategory === "PARKING"
              ? t("pages.billing.parking.workspaceHint")
              : t("pages.billing.payrollMgmt.workspaceHint")}
          </p>
          <BackLink href={projectDetailHref(project.id, highlightPeriodId)} direction="forward">
            {t("pages.billing.projectDetails")}
          </BackLink>
        </div>

        {project.subCategory === "PARKING" ? (
          await (async () => {
            const economics = await computeParkingMonthEconomics({
              companyId: session.user.companyId,
              projectId: project.id,
              year,
              month,
            });
            if (!economics) {
              return (
                <SectionCard>
                  <p className="text-sm text-muted">
                    {t("pages.billing.parking.unavailable")}
                  </p>
                </SectionCard>
              );
            }
            return (
              <ParkingWorkspace
                projectId={project.id}
                clientId={billingClientId}
                year={year}
                month={month}
                canManage={canManage}
                economics={economics}
              />
            );
          })()
        ) : (
          await (async () => {
            const workspace = await getPayrollManagementWorkspace(
              project.id,
              year,
              month
            );
            if (!workspace) {
              return (
                <SectionCard>
                  <p className="text-sm text-muted">
                    {t("pages.billing.payrollMgmt.unavailable")}
                  </p>
                </SectionCard>
              );
            }
            return (
              <div className="space-y-6">
                <PayrollManagementWorkspace
                  projectId={project.id}
                  clientId={billingClientId}
                  year={year}
                  month={month}
                  canManage={canManage}
                  canUnlock={workspace.canUnlock}
                  serviceFeePercent={workspace.serviceFeePercent}
                  taxPercent={workspace.taxPercent}
                  paymentTermsDays={workspace.paymentTermsDays}
                  cutoffStartDay={workspace.cutoffStartDay}
                  cutoffEndDay={workspace.cutoffEndDay}
                  cutoffLabel={workspace.cutoffLabel}
                  review={workspace.review}
                  lock={workspace.lock}
                  period={workspace.period}
                />
                {project.invoicePeriods.length > 0 ? (
                  <SectionCard>
                    <ProjectBillingPanel
                      projectId={project.id}
                      projectName={project.name}
                      highlightPeriodId={highlightPeriodId}
                      billingMode={project.billingMode}
                      billingPeriodBasis={project.billingPeriodBasis}
                      billingCycleStartDay={project.billingCycleStartDay}
                      billingCycleEndDay={project.billingCycleEndDay}
                      contractPrice={decimalToNumber(project.contractPrice)}
                      chargedTaxKind={project.chargedTaxKind}
                      requiresTaxInvoice={project.requiresTaxInvoice}
                      pphRatePercent={decimalToNumber(project.pphRatePercent)}
                      isGovernmentContract={project.isGovernmentContract}
                      hasPortalAccess={project.client?.hasPortalAccess !== false}
                      invoicingDay={project.invoicingDay}
                      startDate={project.startDate?.toISOString() ?? null}
                      paymentTermsDays={project.paymentTermsDays}
                      canManage={canManage}
                      isClientPortal={Boolean(session.user.clientId)}
                      projectStatus={project.status}
                      subCategory={project.subCategory}
                      contractExtensions={project.contractExtensions.map(
                        (row) => ({
                          id: row.id,
                          extendedOn: row.extendedOn.toISOString(),
                          previousEndDate: row.previousEndDate.toISOString(),
                          newEndDate: row.newEndDate.toISOString(),
                          proofUrl: row.proofUrl,
                          notes: row.notes,
                        })
                      )}
                      periods={project.invoicePeriods.map((p) => ({
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
                ) : null}
              </div>
            );
          })()
        )}
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
  const billingTitle = project.name;
  const invoicingDay = refreshedProject?.invoicingDay ?? project.invoicingDay;
  const startDateIso =
    (refreshedProject?.startDate ?? project.startDate)?.toISOString() ?? null;

  return (
    <AppShell
      title={billingTitle}
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
        <BackLink href={projectDetailHref(project.id, highlightPeriodId)} direction="forward">
          {t("pages.billing.projectDetails")}
        </BackLink>
      </div>

      <SectionCard>
        <ProjectBillingPanel
          projectId={project.id}
          projectName={project.name}
          highlightPeriodId={highlightPeriodId}
          billingMode={project.billingMode}
          billingPeriodBasis={
            refreshedProject?.billingPeriodBasis ?? project.billingPeriodBasis
          }
          billingCycleStartDay={
            refreshedProject?.billingCycleStartDay ??
            project.billingCycleStartDay
          }
          billingCycleEndDay={
            refreshedProject?.billingCycleEndDay ?? project.billingCycleEndDay
          }
          contractPrice={contractPriceNum}
          chargedTaxKind={project.chargedTaxKind}
          requiresTaxInvoice={project.requiresTaxInvoice}
          pphRatePercent={decimalToNumber(project.pphRatePercent)}
          isGovernmentContract={project.isGovernmentContract}
          hasPortalAccess={project.client?.hasPortalAccess !== false}
          invoicingDay={invoicingDay}
          startDate={startDateIso}
          paymentTermsDays={project.paymentTermsDays}
          canManage={canManage}
          isClientPortal={Boolean(session.user.clientId)}
          projectStatus={project.status}
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
