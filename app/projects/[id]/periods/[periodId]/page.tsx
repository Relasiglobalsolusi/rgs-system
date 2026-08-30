import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { PageDocumentActions } from "@/components/ui/PageDocumentActions";

import { prisma } from "@/lib/prisma";
import { requireSession, toPermissionUser } from "@/lib/session";
import {
  canManageProjects,
  getProjectWhereForUser,
  isClientPortalUser,
} from "@/lib/project-access";
import { canAccess } from "@/lib/permissions";
import { PROJECT_LIST_VIEW_PATHS } from "@/lib/project-status";
import {
  decimalToNumber,
  formatContractPrice,
  formatInvoicePeriodLabel,
} from "@/lib/project-billing";
import {
  getInvoicePaymentDisplay,
  isMonthlyPeriodAwaitingReconcile,
} from "@/lib/invoice-period";
import { formatDisplayDate } from "@/lib/format-date";
import {
  localizeBillingChipLines,
  localizeBillingMode,
  localizeBillingStatus,
  localizeLateDaysChipLines,
  localizeSubCategory,
} from "@/lib/i18n/labels";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import {
  projectBillingHref,
  projectDetailHref,
} from "@/lib/project-directory-rows";
import { isInternalProjectSubCategory } from "@/lib/project-subcategory";
import { isAwaitingClientAction } from "@/lib/client-billing-review";
import HoOfflineClientReviewPanel from "@/components/billing/HoOfflineClientReviewPanel";

import AppShell from "@/components/layout/AppShell";
import BackLink from "@/components/ui/BackLink";
import { buttonVariants } from "@/components/ui/button";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

const sectionTitleClassName =
  "text-base font-semibold tracking-tight text-text";
const sectionCardClassName = "p-5 sm:p-6";
const metaLabelClassName =
  "w-36 shrink-0 px-4 py-2.5 text-left align-top text-xs font-semibold uppercase tracking-[0.12em] text-subtle sm:w-44 sm:px-5";
const metaValueClassName =
  "min-w-0 break-words px-4 py-2.5 align-top text-text sm:px-5";

export default async function ProjectPeriodPage({
  params,
}: {
  params: Promise<{ id: string; periodId: string }>;
}) {
  const session = await requireSession();
  const { id, periodId } = await params;
  const permissionUser = toPermissionUser(session);
  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });

  const project = await prisma.project.findFirst({
    where: { id, ...projectWhere },
    include: {
      client: { select: { id: true, name: true, hasPortalAccess: true } },
    },
  });

  if (!project) redirect(PROJECT_LIST_VIEW_PATHS.all);

  const period = await prisma.projectInvoicePeriod.findFirst({
    where: { id: periodId, projectId: project.id },
  });

  if (!period) redirect(projectDetailHref(project.id));

  const reports = await prisma.progressReport.findMany({
    where:
      project.billingMode === "MILESTONE"
        ? {
            projectId: project.id,
            OR: [
              { invoicePeriodId: period.id },
              {
                invoicePeriodId: null,
                reportDate: { lte: period.periodEnd },
              },
            ],
          }
        : {
            projectId: project.id,
            OR: [
              { invoicePeriodId: period.id },
              {
                reportDate: {
                  gte: period.periodStart,
                  lte: period.periodEnd,
                },
              },
            ],
          },
    include: {
      employee: {
        select: { firstName: true, lastName: true, employeeNo: true },
      },
      photos: { select: { id: true, url: true, caption: true } },
    },
    orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }],
  });

  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const isInternal = isInternalProjectSubCategory(project.subCategory);
  const periodLabel = formatInvoicePeriodLabel(period, {
    projectName: project.name,
    billingMode: project.billingMode,
    locale,
  });
  const startLabel = formatDisplayDate(period.periodStart, {
    timeZone: "UTC",
  });
  const endLabel = formatDisplayDate(period.periodEnd, { timeZone: "UTC" });
  const contractPriceNum = decimalToNumber(project.contractPrice);
  const periodAmount = decimalToNumber(period.amount);
  const amount = periodAmount ?? contractPriceNum;
  const amountFromContract =
    periodAmount == null &&
    contractPriceNum != null &&
    (period.status === "ONGOING" ||
      period.status === "COMPILING" ||
      period.status === "AWAITING_CLIENT_REVIEW");
  const display = getInvoicePaymentDisplay({
    status: period.status,
    submittedAt: period.submittedAt,
    dueAt: period.dueAt,
    paidAt: period.paidAt,
    paymentTermsDays: project.paymentTermsDays,
  });
  const monthlyAwaitingReconcile = isMonthlyPeriodAwaitingReconcile({
    status: period.status,
    periodEnd: period.periodEnd,
    reconciledAt: period.reconciledAt,
  });
  const pendingApproval = period.status === "AWAITING_CLIENT_REVIEW";
  const issuedInvoice = [
    "AWAITING_PAYMENT",
    "OVERDUE",
    "PENDING_VERIFICATION",
    "PAID",
  ].includes(period.status);
  const taxPending =
    (period.taxInvoiceRequired || issuedInvoice) && !period.taxInvoiceDoneAt;
  const typeLabel = localizeSubCategory(project.subCategory, locale);
  const modeLabel = localizeBillingMode(project.billingMode, locale);
  const billingHref =
    !isInternal && project.clientId != null
      ? projectBillingHref(project.clientId, project.id, period.id)
      : null;
  const canOpenProgress = canAccess(permissionUser, "progress");
  const canManage =
    canManageProjects(permissionUser) && !isClientPortalUser(permissionUser);
  const showOfflineHoReview =
    canManage &&
    project.client?.hasPortalAccess === false &&
    pendingApproval &&
    isAwaitingClientAction(period.clientReviewStatus);
  const reportCount = Math.max(period.reportCount, reports.length);

  const whatThisIs =
    project.billingMode === "MILESTONE" && period.milestonePercent != null
      ? t("pages.projects.periodPage.whatThisIsMilestone", {
          project: project.name,
          percent: period.milestonePercent,
        })
      : project.billingMode === "ON_COMPLETION"
        ? t("pages.projects.periodPage.whatThisIsCompletion", {
            project: project.name,
            start: startLabel,
            end: endLabel,
          })
        : project.billingMode === "MONTHLY"
          ? t("pages.projects.periodPage.whatThisIsMonthly", {
              project: project.name,
              start: startLabel,
              end: endLabel,
            })
          : t("pages.projects.periodPage.whatThisIsGeneric", {
              project: project.name,
              start: startLabel,
              end: endLabel,
            });

  const why: string[] = [];
  if (!period.submittedAt && !issuedInvoice) {
    why.push(t("pages.projects.periodPage.emptyInvoiceDates"));
  }
  if (monthlyAwaitingReconcile) {
    why.push(t("pages.projects.periodPage.reconcileWhy"));
  } else if (pendingApproval) {
    if (period.clientReviewStatus === "CLIENT_REVISED") {
      why.push(t("pages.projects.periodPage.pendingApprovalClientRevised"));
    } else if (period.clientReviewStatus === "HO_REJECTED_REVISION") {
      why.push(t("pages.projects.periodPage.pendingApprovalHoRejected"));
    } else if (project.client?.hasPortalAccess === false) {
      why.push(t("pages.projects.periodPage.pendingApprovalNoPortalWhy"));
    } else {
      why.push(t("pages.projects.periodPage.pendingApprovalWhy"));
    }
  } else if (period.status === "ONGOING") {
    why.push(t("pages.projects.periodPage.ongoingWhy"));
  } else if (period.status === "COMPILING") {
    why.push(t("pages.projects.periodPage.compilingWhy"));
  } else if (period.status === "PENDING_VERIFICATION") {
    why.push(t("pages.projects.periodPage.verifyingWhy"));
  } else if (period.status === "PAID") {
    why.push(
      t("pages.projects.periodPage.paidWhy", {
        date: period.paidAt ? formatDisplayDate(period.paidAt) : "—",
      })
    );
  } else if (display.key === "LATE" || period.status === "OVERDUE") {
    why.push(
      t("pages.projects.periodPage.overdueWhy", {
        date: display.dueAt
          ? formatDisplayDate(display.dueAt, { timeZone: "UTC" })
          : "—",
      })
    );
  } else if (period.status === "AWAITING_PAYMENT") {
    why.push(
      t("pages.projects.periodPage.awaitingPaymentWhy", {
        date: display.dueAt
          ? formatDisplayDate(display.dueAt, { timeZone: "UTC" })
          : "—",
      })
    );
  }
  if (taxPending) {
    why.push(t("pages.projects.periodPage.taxPendingWhy"));
  } else if (period.taxInvoiceRequired && period.taxInvoiceDoneAt) {
    why.push(t("pages.projects.periodPage.taxDoneWhy"));
  }

  const documents = [
    period.reviewReportPdfPath
      ? {
          href: period.reviewReportPdfPath,
          label: t("pages.projects.periodPage.viewReviewReport"),
          icon: "file" as const,
        }
      : null,
    period.invoicePdfPath
      ? {
          href: period.invoicePdfPath,
          label: t("pages.projects.detail.downloadInvoice"),
          icon: "download" as const,
        }
      : null,
    period.taxInvoiceDocumentPath
      ? {
          href: period.taxInvoiceDocumentPath,
          label: t("pages.billing.viewTaxInvoice"),
          icon: "file" as const,
        }
      : null,
    period.paymentProofPath
      ? {
          href: period.paymentProofPath,
          label: t("pages.billing.viewProof"),
          icon: "file" as const,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row != null);

  const statusChipLines = pendingApproval
    ? localizeBillingChipLines("awaitingClientReview", locale)
    : monthlyAwaitingReconcile
      ? localizeBillingChipLines("readyToReconcile", locale)
      : display.key === "LATE" && display.daysOverdue != null
        ? localizeLateDaysChipLines(display.daysOverdue, locale)
        : display.chipLines
          ? localizeBillingChipLines(
              display.key === "PENDING_VERIFICATION"
                ? "verifyingPayment"
                : display.key === "AWAITING_CLIENT_REVIEW"
                  ? "awaitingClientReview"
                  : "awaitingPayment",
              locale
            )
          : undefined;

  return (
    <AppShell title={periodLabel}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BackLink href={projectDetailHref(project.id)}>
          {t("pages.projects.periodPage.backToProject")}
        </BackLink>
        {billingHref ? (
          <Link
            href={billingHref}
            className={buttonVariants({
              variant: "infoBadge",
              size: "badgeFlex",
            })}
          >
            {t("pages.projects.periodPage.openBilling")}
          </Link>
        ) : null}
        {canOpenProgress ? (
          <Link
            href={`/progress?projectId=${project.id}`}
            className={buttonVariants({
              variant: "infoBadge",
              size: "badgeFlex",
            })}
          >
            {t("pages.projects.periodPage.openAllReports")}
          </Link>
        ) : null}
        <PageDocumentActions documents={documents} />
      </div>

      <div className="space-y-5">
        <SectionCard className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-border px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                {t("pages.projects.detail.status")}
              </span>
              <StatusBadge
                status={
                  monthlyAwaitingReconcile
                    ? "warning"
                    : pendingApproval
                      ? "pending"
                      : display.tone
                }
                compact
                lines={statusChipLines}
              >
                {statusChipLines
                  ? undefined
                  : localizeBillingStatus(display.key, locale)}
              </StatusBadge>
              {taxPending ? (
                <StatusBadge
                  status="pending"
                  compact
                  lines={localizeBillingChipLines("taxInvoiceDue", locale)}
                />
              ) : period.taxInvoiceRequired && period.taxInvoiceDoneAt ? (
                <StatusBadge
                  status="success"
                  compact
                  lines={localizeBillingChipLines("taxInvoiceDone", locale)}
                />
              ) : null}
            </div>
          </div>

          <div className="space-y-4 px-4 py-5 sm:px-5">
            <div>
              <h3 className={sectionTitleClassName}>
                {t("pages.projects.periodPage.whatThisIsTitle")}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {whatThisIs}
              </p>
            </div>
            {why.length > 0 ? (
              <div>
                <h3 className={sectionTitleClassName}>
                  {t("pages.projects.periodPage.whyTitle")}
                </h3>
                <div className="mt-2 space-y-2">
                  {why.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-sm leading-relaxed text-muted"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>

        {showOfflineHoReview ? (
          <SectionCard className={sectionCardClassName}>
            <HoOfflineClientReviewPanel
              periodId={period.id}
              proposedAmount={amount}
            />
          </SectionCard>
        ) : null}

        <SectionCard className={`${sectionCardClassName} overflow-hidden p-0`}>
          <h3 className={`${sectionTitleClassName} px-4 pt-5 sm:px-5`}>
            {t("pages.projects.periodPage.factsTitle")}
          </h3>
          <table className="mt-3 w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.projects.periodPage.project")}
                </th>
                <td className={`${metaValueClassName} font-medium`}>
                  <Link
                    href={projectDetailHref(project.id)}
                    className="text-accent-teal hover:underline"
                  >
                    {project.name}
                  </Link>
                </td>
              </tr>
              {!isInternal ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.projects.periodPage.client")}
                  </th>
                  <td className={`${metaValueClassName} font-medium`}>
                    {project.client?.name ?? "—"}
                  </td>
                </tr>
              ) : null}
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.projects.periodPage.type")}
                </th>
                <td className={`${metaValueClassName} font-medium`}>
                  {typeLabel}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.projects.periodPage.billingMode")}
                </th>
                <td className={`${metaValueClassName} font-medium`}>
                  {modeLabel}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.projects.periodPage.amount")}
                </th>
                <td className={`${metaValueClassName} font-medium`}>
                  {amount != null ? formatContractPrice(amount) : "—"}
                  {amountFromContract ? (
                    <p className="mt-1 text-xs font-normal text-subtle">
                      {t("pages.projects.periodPage.fromContractPrice")}
                    </p>
                  ) : null}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.projects.periodPage.invoiceSent")}
                </th>
                <td className={`${metaValueClassName} font-medium`}>
                  {period.submittedAt
                    ? formatDisplayDate(period.submittedAt)
                    : t("pages.projects.periodPage.notYet")}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.projects.periodPage.dueDate")}
                </th>
                <td className={`${metaValueClassName} font-medium`}>
                  {display.dueAt
                    ? formatDisplayDate(display.dueAt, { timeZone: "UTC" })
                    : t("pages.projects.periodPage.notYet")}
                </td>
              </tr>
              <tr>
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.projects.periodPage.paidOn")}
                </th>
                <td className={`${metaValueClassName} font-medium`}>
                  {period.paidAt
                    ? formatDisplayDate(period.paidAt)
                    : t("pages.projects.periodPage.notYet")}
                </td>
              </tr>
            </tbody>
          </table>
        </SectionCard>

        <SectionCard className={sectionCardClassName}>
          <h3 className={sectionTitleClassName}>
            {t("pages.projects.periodPage.reportsTitle")}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {t("pages.projects.periodPage.reportsHint", {
              count: reportCount,
            })}
          </p>

          {reports.length === 0 ? (
            <p className="mt-4 text-sm text-subtle">
              {t("pages.projects.periodPage.reportsEmpty")}
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {reports.map((report) => {
                const employeeName =
                  `${report.employee.firstName} ${report.employee.lastName}`.trim();
                return (
                  <article
                    key={report.id}
                    className="rounded-xl border border-border bg-elevated/40 p-4"
                  >
                    <p className="font-medium text-text">
                      {formatDisplayDate(report.reportDate, {
                        timeZone: "UTC",
                      })}
                    </p>
                    <p className="mt-0.5 text-sm text-subtle">
                      {employeeName}
                      {report.employee.employeeNo
                        ? ` · ${report.employee.employeeNo}`
                        : ""}
                      {" · "}
                      {t(
                        report.photos.length === 1
                          ? "pages.projects.periodPage.photoCountOne"
                          : "pages.projects.periodPage.photoCountOther",
                        { count: report.photos.length }
                      )}
                    </p>
                    {report.stageLabel ? (
                      <p className="mt-2 text-sm text-text">
                        <span className="text-subtle">
                          {t("pages.projects.periodPage.serviceArea")}:{" "}
                        </span>
                        {report.stageLabel}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {report.notes?.trim() ||
                        t("pages.projects.periodPage.noNotes")}
                    </p>
                    {report.photos.length > 0 ? (
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {report.photos.map((photo) => (
                          <a
                            key={photo.id}
                            href={photo.url}
                            target="_blank"
                            rel="noreferrer"
                            className="relative aspect-square overflow-hidden rounded-xl border border-border bg-inset"
                          >
                            <Image
                              src={photo.url}
                              alt={
                                photo.caption?.trim() ||
                                t("pages.progress.progressPhoto")
                              }
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard className={sectionCardClassName}>
          <h3 className={sectionTitleClassName}>
            {t("pages.projects.periodPage.documentsTitle")}
          </h3>
          {documents.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">
              {t("pages.projects.periodPage.noDocuments")}
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {documents.map((doc) => (
                <a
                  key={doc.href}
                  href={doc.href}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({
                      variant:
                        doc.icon === "download"
                          ? "permissionsBadge"
                          : "infoBadge",
                      size: "badgeFlex",
                    })
                  )}
                >
                  {doc.icon === "download" ? (
                    <Download className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {doc.label}
                </a>
              ))}
            </div>
          )}
          {period.clientRevisionNote?.trim() ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                {t("pages.projects.periodPage.clientRevisionNote")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {period.clientRevisionNote}
              </p>
            </div>
          ) : null}
          {period.hoReviewNote?.trim() ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                {t("pages.projects.periodPage.hoReviewNote")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {period.hoReviewNote}
              </p>
            </div>
          ) : null}
          {period.compileNote?.trim() ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                {t("pages.projects.periodPage.compileNote")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {period.compileNote}
              </p>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </AppShell>
  );
}
