import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";

import { prisma } from "@/lib/prisma";

import {
  requireSession,
  toPermissionUser,
  getEmployeeForUser,
} from "@/lib/session";

import {
  getProjectWhereForUser,
  canManageProjects,
  canDeleteActiveStageProjects,
  getInProgressCleaningProjectDeleteBlockReason,
  isAdminDeletableProjectStatus,
  isInProgressCleaningProjectDeleteBlocked,
} from "@/lib/project-access";
import {
  daysBetweenDates,
  isContractSubCategory,
} from "@/lib/project-contract";
import {
  getProjectWorkflowStatusLabel,
  isPlanningProjectStatus,
  PROJECT_LIST_VIEW_PATHS,
} from "@/lib/project-status";
import {
  localizeBillingChipLines,
  localizeBillingMode,
  localizeBillingStatus,
  localizeProjectStatus,
  localizeSubCategory,
  localizeSubCategoryChipLines,
  localizeWorkflowChipLines,
} from "@/lib/i18n/labels";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import {
  decimalToNumber,
  dedupeOnCompletionPeriods,
  formatContractPrice,
  formatInvoicePeriodLabel,
  formatProjectTitle,
} from "@/lib/project-billing";
import {
  getMostUrgentUnpaidPeriod,
  isProjectFullyPaid,
  OPEN_COLLECTION_STATUSES,
} from "@/lib/billing";
import { getInvoicePaymentDisplay } from "@/lib/invoice-period";
import { formatDisplayDate } from "@/lib/format-date";
import type { ProjectStatus } from "@prisma/client";

import AppShell from "@/components/layout/AppShell";
import BackLink from "@/components/ui/BackLink";
import { buttonVariants } from "@/components/ui/button";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge, {
  largeStackedChipLabelClassName,
  outlineChipTones,
  StackedChipLabel,
} from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

import ContractExtensionsHistory from "@/components/projects/ContractExtensionsHistory";
import ProjectAssignStaffChip from "@/components/projects/ProjectAssignStaffChip";
import ProjectDetailActionBar from "@/components/projects/ProjectDetailActionBar";
import ProjectLocationMap from "@/components/projects/ProjectLocationMap";
import MissingReportsWarning from "@/components/progress/MissingReportsWarning";
import { getMissingProgressReportsForEmployee } from "@/lib/progress-report-compliance";

const metaLabelClassName =
  "w-36 shrink-0 px-4 py-2.5 text-left align-top text-xs font-semibold uppercase tracking-[0.12em] text-subtle sm:w-44 sm:px-5";
const metaValueClassName = "px-4 py-2.5 align-top text-text sm:px-5";
const sectionTitleClassName = "text-base font-semibold tracking-tight text-text";
const sectionCardClassName = "p-5 sm:p-6";

function statusTone(
  status: ProjectStatus | string
): "active" | "success" | "warning" | "inactive" | "pending" {
  switch (status) {
    case "IN_PROGRESS":
      return "active";
    case "COMPLETED":
      return "success";
    case "ON_HOLD":
      return "warning";
    case "PLANNED":
      return "pending";
    default:
      return "inactive";
  }
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const permissionUser = toPermissionUser(session);
  const canManage = canManageProjects(permissionUser);
  const canDeleteActiveStage = canDeleteActiveStageProjects({
    ...permissionUser,
    username: session.user.username,
    employee: session.user.employee,
    employeeType: session.user.employeeType,
  });
  const employee = await getEmployeeForUser(session.user.id);

  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
  });

  const allowed = await prisma.project.findFirst({
    where: { id, ...projectWhere },
  });

  // Missing, deleted, or out of scope — send to the list instead of a bare 404.
  if (!allowed) redirect(PROJECT_LIST_VIEW_PATHS.all);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      assignments: {
        include: { employee: true },
      },
      invoicePeriods: {
        orderBy: { periodStart: "desc" },
      },
      contractExtensions: {
        orderBy: { extendedOn: "desc" },
      },
      _count: {
        select: { progressReports: true },
      },
    },
  });

  if (!project) redirect(PROJECT_LIST_VIEW_PATHS.all);

  const [employees, clients, myMissing] = await Promise.all([
    canManage
      ? prisma.employee.findMany({
          where: {
            companyId: project.companyId,
            status: "ACTIVE",
            OR: [
              {
                employmentType: "FULL_TIME",
                placement: "AVAILABLE",
                category: { slug: "operations", active: true },
                jobPosition: {
                  active: true,
                  slug: { in: ["cleaning-staff", "gc-staff"] },
                },
              },
              { employmentType: "PART_TIME" },
              // Already on this project (edit / reassign)
              {
                projectAssignments: { some: { projectId: project.id } },
              },
            ],
          },
          include: {
            category: { select: { name: true, prefix: true, slug: true } },
            jobPosition: { select: { name: true, slug: true } },
          },
          orderBy: [
            { employmentType: "asc" },
            { category: { sortOrder: "asc" } },
            { firstName: "asc" },
          ],
        })
      : Promise.resolve([]),
    canManage
      ? prisma.client.findMany({
          where: { companyId: project.companyId, active: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    employee
      ? getMissingProgressReportsForEmployee(employee.id, session.user.id)
      : Promise.resolve([]),
  ]);

  const billingHref =
    project.clientId != null
      ? `/billing/${project.clientId}/${project.id}`
      : "/billing";

  const contractPriceNum = decimalToNumber(project.contractPrice);
  const inProjectHistory =
    project.status === "COMPLETED" &&
    isProjectFullyPaid(project.invoicePeriods);
  const inPlanning = isPlanningProjectStatus(project.status);
  const hasOpenCollection = project.invoicePeriods.some((period) =>
    (OPEN_COLLECTION_STATUSES as readonly string[]).includes(period.status)
  );
  const eligibleForMoveBack =
    canManage &&
    (project.status === "IN_PROGRESS" || project.status === "ON_HOLD");
  const canMoveBackToPlanning = eligibleForMoveBack && !hasOpenCollection;
  const moveBackBlockedByCollection =
    eligibleForMoveBack && hasOpenCollection;
  const deleteBlockedByInProgress =
    isInProgressCleaningProjectDeleteBlocked({
      status: project.status,
      subCategory: project.subCategory,
    });
  const deleteBlockedReason = getInProgressCleaningProjectDeleteBlockReason({
    status: project.status,
    subCategory: project.subCategory,
  });
  const canDelete =
    canDeleteActiveStage &&
    isAdminDeletableProjectStatus(project.status) &&
    !deleteBlockedByInProgress;
  const isRegularContract = isContractSubCategory(project.subCategory);
  const canEndContract =
    canManage && project.status === "IN_PROGRESS" && isRegularContract;
  const showCompletedJobDuration =
    project.status === "COMPLETED" && !isRegularContract;
  const actualDurationDays = showCompletedJobDuration
    ? daysBetweenDates(project.startDate, project.endDate)
    : null;
  const initialEstimatedDurationDays = showCompletedJobDuration
    ? project.estimatedDurationDays
    : null;

  const listBackHref = inProjectHistory
    ? "/projects?view=completed"
    : inPlanning
      ? "/projects?view=planning"
      : project.status === "IN_PROGRESS" || project.status === "ON_HOLD"
        ? "/projects?view=in-progress"
        : "/projects";

  const unpaidMilestone = getMostUrgentUnpaidPeriod(project.invoicePeriods);
  const invoicePeriodsForDisplay = dedupeOnCompletionPeriods(
    project.invoicePeriods,
    project.billingMode
  );
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  // History / fully paid: plain project name. Unpaid milestone: installment title.
  const pageTitle = formatProjectTitle(
    project.name,
    inProjectHistory ? null : unpaidMilestone,
    locale
  );
  const modeLabel = localizeBillingMode(project.billingMode, locale);
  const timeline = inPlanning
    ? project.estimatedStartDate
      ? project.endDate && !isRegularContract
        ? `${formatDisplayDate(project.estimatedStartDate)} → ${formatDisplayDate(project.endDate)}`
        : t("pages.projects.detail.estStart", {
            date: formatDisplayDate(project.estimatedStartDate),
          })
      : t("pages.projects.detail.estimateTbd")
    : `${
        project.startDate ? formatDisplayDate(project.startDate) : "-"
      } → ${project.endDate ? formatDisplayDate(project.endDate) : "-"}`;
  const listBackLabel = inProjectHistory
    ? t("pages.projects.completedTitle")
    : inPlanning
      ? t("pages.projects.planningTitle")
      : project.status === "IN_PROGRESS" || project.status === "ON_HOLD"
        ? t("pages.projects.inProgressTitle")
        : t("pages.projects.filterAllProjects");
  const statusLabel = localizeProjectStatus(project.status, locale);
  const statusLines = localizeWorkflowChipLines(
    getProjectWorkflowStatusLabel({ status: project.status }),
    locale
  );
  const typeLabel = localizeSubCategory(project.subCategory, locale);
  const typeLines = localizeSubCategoryChipLines(project.subCategory, locale);
  const pageDescription = [project.client?.name, typeLabel]
    .filter(Boolean)
    .join(" · ");
  const billingSubtext =
    (project.billingMode === "MONTHLY"
      ? t("pages.projects.detail.anniversaryInvoiceDay", {
          day: project.invoicingDay,
        })
      : t("pages.projects.detail.contractPriceAndInvoices")) +
    (inPlanning ? t("pages.projects.detail.availableAfterInProgress") : "");

  return (
    <AppShell title={pageTitle} description={pageDescription || undefined}>
      {myMissing.length > 0 && (
        <MissingReportsWarning warnings={myMissing} />
      )}

      <div className="mb-4">
        <BackLink href={listBackHref}>{listBackLabel}</BackLink>
      </div>

      <ProjectDetailActionBar
        canManage={canManage}
        canDelete={canDelete}
        deleteBlockedReason={
          canDeleteActiveStage &&
          isAdminDeletableProjectStatus(project.status) &&
          deleteBlockedReason
            ? deleteBlockedReason
            : null
        }
        canEndContract={canEndContract}
        inPlanning={inPlanning}
        showMoveToInProgress={inPlanning}
        canMoveBackToPlanning={canMoveBackToPlanning}
        moveBackBlockedByCollection={moveBackBlockedByCollection}
        billingHref={billingHref}
        projectId={project.id}
        projectName={project.name}
        subCategory={project.subCategory}
        estimatedStartDate={project.estimatedStartDate}
        estimatedDurationDays={project.estimatedDurationDays}
        startDate={project.startDate}
        endDate={project.endDate}
        editProject={{
          id: project.id,
          name: project.name,
          location: project.location,
          latitude: project.latitude,
          longitude: project.longitude,
          locationRadiusMeters: project.locationRadiusMeters,
          estimatedStartDate: project.estimatedStartDate,
          estimatedDurationDays: project.estimatedDurationDays,
          startDate: project.startDate,
          endDate: project.endDate,
          progress: project.progress,
          subCategory: project.subCategory,
          serviceArea: project.serviceArea,
          billingMode: project.billingMode,
          billingPeriodBasis: project.billingPeriodBasis,
          requiresTaxInvoice: project.requiresTaxInvoice,
          clientId: project.clientId,
          status: project.status,
          assignments: project.assignments.map((a) => ({
            employeeId: a.employeeId,
          })),
        }}
        deleteProject={{
          id: project.id,
          name: project.name,
          clientName: project.client?.name ?? null,
          invoiceCount: project.invoicePeriods.length,
          reportCount: project._count.progressReports,
        }}
        deleteRedirectHref={listBackHref}
        employees={employees}
        clients={clients}
      >
        <div className="space-y-5">
          <SectionCard className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-border px-4 py-3.5 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                  {t("pages.projects.detail.status")}
                </span>
                <StatusBadge
                  size="lg"
                  status={statusTone(project.status)}
                  lines={statusLines ?? undefined}
                >
                  {statusLines ? undefined : statusLabel}
                </StatusBadge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                  {t("pages.projects.detail.projectType")}
                </span>
                <StatusBadge
                  size="lg"
                  status="info"
                  lines={typeLines ?? undefined}
                >
                  {typeLines ? undefined : typeLabel}
                </StatusBadge>
              </div>
              {!inPlanning ? (
                <Link
                  href={`/progress?projectId=${project.id}`}
                  className={cn(
                    buttonVariants({ variant: "infoBadge", size: "badgeLg" }),
                    "ml-auto"
                  )}
                  aria-label={t("pages.projects.detail.viewProgressReports")}
                >
                  <StackedChipLabel
                    lines={[
                      t("pages.projects.detail.viewProgressReportsChip1"),
                      t("pages.projects.detail.viewProgressReportsChip2"),
                    ]}
                    className={largeStackedChipLabelClassName}
                  />
                </Link>
              ) : null}
            </div>

            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.projects.detail.client")}
                  </th>
                  <td className={`${metaValueClassName} font-medium`}>
                    {project.client?.name ?? "—"}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.projects.detail.location")}
                  </th>
                  <td
                    className={`${metaValueClassName} font-medium whitespace-normal break-words`}
                  >
                    {project.location?.trim() || "—"}
                  </td>
                </tr>
                {inPlanning ? (
                  <tr className="border-b border-border">
                    <th scope="row" className={metaLabelClassName}>
                      {t("pages.projects.detail.estimatedStart")}
                    </th>
                    <td className={`${metaValueClassName} font-medium`}>
                      {timeline}
                    </td>
                  </tr>
                ) : (
                  <tr className="border-b border-border">
                    <th
                      scope="row"
                      className={`${metaLabelClassName} !align-middle`}
                    >
                      {t("pages.projects.detail.contractPeriod")}
                    </th>
                    <td
                      className={`${metaValueClassName} !align-middle`}
                    >
                      <div className="grid grid-cols-1 items-center gap-x-4 gap-y-2 sm:grid-cols-3">
                        <div className="font-medium">{timeline}</div>
                        <div className="inline-flex items-center gap-x-4">
                          {project.estimatedStartDate ? (
                            <>
                              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                                {t(
                                  "pages.projects.detail.planningEstimate"
                                )}
                              </span>
                              <span className="font-medium">
                                {formatDisplayDate(
                                  project.estimatedStartDate
                                )}
                              </span>
                            </>
                          ) : null}
                        </div>
                        <div className="inline-flex items-center gap-x-4">
                          {project.startDate ? (
                            <>
                              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                                {t(
                                  "pages.projects.detail.contractStarted"
                                )}
                              </span>
                              <span className="font-medium">
                                {formatDisplayDate(project.startDate)}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {showCompletedJobDuration ? (
                  <tr className="border-b border-border">
                    <th scope="row" className={metaLabelClassName}>
                      {t("pages.projects.detail.actualDurationDays")}
                    </th>
                    <td className={`${metaValueClassName} font-medium`}>
                      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-6">
                        <span>
                          {actualDurationDays != null
                            ? t("pages.projects.detail.durationDaysValue", {
                                count: actualDurationDays,
                              })
                            : "—"}
                        </span>
                        <span className="inline-flex flex-wrap items-baseline gap-x-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                            {t("pages.projects.detail.estimatedDurationDays")}
                          </span>
                          <span>
                            {initialEstimatedDurationDays != null
                              ? t("pages.projects.detail.durationDaysValue", {
                                  count: initialEstimatedDurationDays,
                                })
                              : "—"}
                          </span>
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : null}
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.projects.detail.contractPrice")}
                  </th>
                  <td className={`${metaValueClassName} font-medium`}>
                    {formatContractPrice(contractPriceNum)}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.projects.detail.billing")}
                  </th>
                  <td className={metaValueClassName}>
                    <div className="space-y-1">
                      <p className="font-medium">{modeLabel}</p>
                      <p className="text-sm leading-snug text-subtle">
                        {billingSubtext}
                      </p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </SectionCard>

          {project.latitude != null && project.longitude != null && (
            <SectionCard className={sectionCardClassName}>
              <h3 className={`${sectionTitleClassName} mb-3`}>
                {t("pages.projects.detail.siteLocation")}
              </h3>
              <ProjectLocationMap
                latitude={project.latitude}
                longitude={project.longitude}
                location={project.location}
                radiusMeters={project.locationRadiusMeters}
              />
            </SectionCard>
          )}

          {!inPlanning ? (
            <SectionCard className={sectionCardClassName}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className={sectionTitleClassName}>
                  {t("pages.projects.detail.invoicesPayments")}
                </h3>
                <Link
                  href={billingHref}
                  className={cn(
                    buttonVariants({
                      variant: "successBadge",
                      size: "badgeFlex",
                    }),
                    "text-xs tracking-[0.06em]"
                  )}
                >
                  {t("pages.projects.detail.fullBilling")}
                </Link>
              </div>

              {invoicePeriodsForDisplay.length === 0 ? (
                <p className="text-sm text-subtle">
                  {t("pages.projects.detail.noInvoicePeriods")}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-[0.12em] text-subtle">
                        <th className="px-3 py-3 font-semibold">
                          {t("pages.projects.detail.period")}
                        </th>
                        <th className="px-3 py-3 font-semibold">
                          {t("pages.projects.detail.amount")}
                        </th>
                        <th className="px-3 py-3 font-semibold">
                          {t("pages.projects.detail.status")}
                        </th>
                        <th className="px-3 py-3 font-semibold">
                          {t("pages.projects.detail.paid")}
                        </th>
                        <th className="px-3 py-3 text-right font-semibold">
                          {t("pages.projects.detail.invoice")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicePeriodsForDisplay.map((period) => {
                        const display = getInvoicePaymentDisplay({
                          status: period.status,
                          submittedAt: period.submittedAt,
                          dueAt: period.dueAt,
                          paidAt: period.paidAt,
                          paymentTermsDays: project.client?.paymentTermsDays,
                        });
                        const amount =
                          decimalToNumber(period.amount) ?? contractPriceNum;
                        const statusChipLines = display.chipLines
                          ? localizeBillingChipLines(
                              display.key === "LATE"
                                ? "latePayment"
                                : display.key === "PENDING_VERIFICATION"
                                  ? "verifyingPayment"
                                  : "awaitingPayment",
                              locale
                            )
                          : undefined;

                        return (
                          <tr
                            key={period.id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-3 py-3.5">
                              <p className="font-medium text-text">
                                {formatInvoicePeriodLabel(period, {
                                  projectName: project.name,
                                  billingMode: project.billingMode,
                                  locale,
                                })}
                              </p>
                            </td>
                            <td className="px-3 py-3.5 text-text">
                              {formatContractPrice(amount)}
                            </td>
                            <td className="px-3 py-3.5">
                              <StatusBadge
                                status={display.tone}
                                compact
                                lines={statusChipLines}
                              >
                                {statusChipLines
                                  ? undefined
                                  : localizeBillingStatus(display.key, locale)}
                              </StatusBadge>
                            </td>
                            <td className="px-3 py-3.5 text-muted">
                              {period.paidAt
                                ? formatDisplayDate(period.paidAt)
                                : "—"}
                            </td>
                            <td className="px-3 py-3.5 text-right">
                              {period.invoicePdfPath ? (
                                <a
                                  href={period.invoicePdfPath}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={buttonVariants({
                                    variant: "infoBadge",
                                    size: "badgeFlex",
                                  })}
                                >
                                  <Download className="h-3.5 w-3.5 shrink-0" />
                                  {t("pages.projects.detail.downloadPdf")}
                                </a>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          ) : null}

          {isRegularContract ? (
            <SectionCard className={sectionCardClassName}>
              <ContractExtensionsHistory
                extensions={project.contractExtensions.map((row) => ({
                  id: row.id,
                  extendedOn: row.extendedOn.toISOString(),
                  previousEndDate: row.previousEndDate.toISOString(),
                  newEndDate: row.newEndDate.toISOString(),
                  proofUrl: row.proofUrl,
                  notes: row.notes,
                }))}
              />
            </SectionCard>
          ) : null}

          {!inPlanning ? (
            <SectionCard className={sectionCardClassName}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className={sectionTitleClassName}>
                  {t("pages.projects.detail.staff")}
                </h3>
                {canManage ? (
                  <ProjectAssignStaffChip
                    project={{
                      id: project.id,
                      name: project.name,
                      location: project.location,
                      latitude: project.latitude,
                      longitude: project.longitude,
                      locationRadiusMeters: project.locationRadiusMeters,
                      startDate: project.startDate,
                      endDate: project.endDate,
                      progress: project.progress,
                      subCategory: project.subCategory,
                      billingMode: project.billingMode,
                      requiresTaxInvoice: project.requiresTaxInvoice,
                      clientId: project.clientId,
                      status: project.status,
                      assignments: project.assignments.map((a) => ({
                        employeeId: a.employeeId,
                      })),
                    }}
                    employees={employees}
                    clients={clients}
                  />
                ) : null}
              </div>

              {project.assignments.length === 0 ? (
                <p className="text-sm text-subtle">
                  {t("pages.projects.detail.noStaff")}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {project.assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className={cn(
                        "w-auto max-w-full rounded-md px-3 py-2",
                        outlineChipTones.emerald
                      )}
                    >
                      <p className="text-sm font-semibold normal-case tracking-normal">
                        {assignment.employee.firstName}{" "}
                        {assignment.employee.lastName}
                      </p>
                      <p className="text-xs font-medium normal-case tracking-normal text-primary-dark/70">
                        {assignment.employee.employeeNo}
                      </p>
                      {assignment.shiftStart && assignment.shiftEnd ? (
                        <p className="mt-0.5 text-xs font-medium normal-case tracking-normal text-primary-dark/80">
                          {t("pages.projects.detail.shiftRange", {
                            start: assignment.shiftStart,
                            end: assignment.shiftEnd,
                          })}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs font-medium normal-case tracking-normal text-primary-dark/55">
                          {t("pages.projects.detail.noShiftSet")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          ) : null}
        </div>
      </ProjectDetailActionBar>
    </AppShell>
  );
}
