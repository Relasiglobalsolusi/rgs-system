import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";

import { prisma } from "@/lib/prisma";
import {
  annotateStaffPickerConflicts,
  assignableProjectCrewOrWhere,
  findEmployeesOnOtherOpenProjects,
} from "@/lib/workforce-crew";
import { resolveGeofenceRadiusMeters } from "@/lib/geo";

import {
  requireSession,
  toPermissionUser,
} from "@/lib/session";

import {
  getProjectWhereForUser,
  canManageProjects,
  canDeleteActiveStageProjects,
  getInProgressCleaningProjectDeleteBlockReason,
  isAdminDeletableProjectStatus,
  isClientPortalUser,
  isInProgressCleaningProjectDeleteBlocked,
  isVendorPortalUser,
} from "@/lib/project-access";
import { canAssignInventoryToProject } from "@/lib/inventory-access";
import {
  getProjectInventoryCost,
  listProjectInventoryIssues,
} from "@/lib/inventory";
import { listProjectEquipmentAssets } from "@/lib/equipment-asset";
import {
  daysBetweenDates,
  isContractSubCategory,
  usesMonthDurationTimeline,
} from "@/lib/project-contract";
import {
  isInternalProjectSubCategory,
  isServiceProjectSubCategory,
} from "@/lib/project-subcategory";
import { isMilestoneSubCategory } from "@/lib/project-billing";
import {
  getProjectWorkflowStatusLabel,
  isPlanningProjectStatus,
  PROJECT_LIST_VIEW_PATHS,
} from "@/lib/project-status";
import {
  localizeBillingChipLines,
  localizeBillingMode,
  localizeBillingStatus,
  localizeSubCategory,
  localizeSubCategoryChipLines,
  localizeWorkflowChipLines,
  localizeWorkflowStatus,
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
import { canAccess } from "@/lib/permissions";
import {
  getMostUrgentUnpaidPeriod,
  isProjectFullyPaid,
  OPEN_COLLECTION_STATUSES,
} from "@/lib/billing";
import { getInvoicePaymentDisplay } from "@/lib/invoice-period";
import { formatDisplayDate } from "@/lib/format-date";
import { asProjectServiceArea } from "@/lib/service-area";
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
import ProjectEquipmentPicker, {
  type AssignedEquipmentAsset,
} from "@/components/projects/ProjectEquipmentPicker";
import ProjectInventoryPanel from "@/components/projects/ProjectInventoryPanel";
import ProjectLocationMap from "@/components/projects/ProjectLocationMap";

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
    case "ON_HOLD":
      return "active";
    case "WAITING_FOR_APPROVAL":
      return "warning";
    case "COMPLETED":
      return "success";
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
  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
  });

  const allowed = await prisma.project.findFirst({
    where: { id, ...projectWhere },
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

  // Missing, deleted, or out of scope — send to the list instead of a bare 404.
  if (!allowed) redirect(PROJECT_LIST_VIEW_PATHS.all);

  const project = allowed;

  const showInventoryCosts =
    !isClientPortalUser(permissionUser) &&
    !isVendorPortalUser(permissionUser);
  const canAssignStock = showInventoryCosts
    ? await canAssignInventoryToProject(session.user.id, {
        ...permissionUser,
        username: session.user.username,
      })
    : false;

  const [employees, clients, inventoryCost, inventoryIssues] =
    await Promise.all([
      canManage
        ? prisma.employee.findMany({
            where: {
              companyId: project.companyId,
              status: "ACTIVE",
              OR: assignableProjectCrewOrWhere(project.companyId, {
                includeInHouseCleaning: isInternalProjectSubCategory(
                  project.subCategory
                ),
                includeAssignedToProjectId: project.id,
              }),
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
      showInventoryCosts
        ? getProjectInventoryCost(project.id, {
            companyId: project.companyId,
          })
        : Promise.resolve(0),
      showInventoryCosts
        ? listProjectInventoryIssues(project.id, {
            companyId: project.companyId,
            take: 50,
          })
        : Promise.resolve([]),
    ]);

  const staffConflicts =
    canManage && employees.length > 0
      ? await findEmployeesOnOtherOpenProjects(
          prisma,
          project.companyId,
          employees.map((employee) => employee.id),
          project.id
        )
      : [];
  const staffEmployees = annotateStaffPickerConflicts(employees, staffConflicts);

  // Equipment issue/release/demob keep Inventory ↔ Projects in sync.
  // Never mint/assign on page load (caused ghost units like EQP-*-A6).
  // Repair: scripts/reconcile-equipment-stock.ts (release phantoms + hard-delete surplus).

  // Assigned equipment for display / release (issue only via Inventory → Project Issues).
  const assignedEquipmentAssets =
    showInventoryCosts && isPlanningProjectStatus(project.status) === false
      ? await listProjectEquipmentAssets(project.companyId, project.id)
      : [];

  const canViewInventory = canAccess(permissionUser, "inventory");
  const inventoryIssueViews = inventoryIssues.map((row) => ({
    id: row.id,
    movedAt:
      row.movedAt instanceof Date
        ? row.movedAt.toISOString()
        : String(row.movedAt),
    quantity: row.quantity,
    unitCost: row.unitCost,
    totalCost: row.totalCost,
    item: row.item,
  }));

  const isInternal = isInternalProjectSubCategory(project.subCategory);
  const billingHref =
    !isInternal && project.clientId != null
      ? `/billing/${project.clientId}/${project.id}`
      : isInternal
        ? null
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
    canManage && !isInternal && project.status === "IN_PROGRESS";
  const canMoveBackToPlanning = eligibleForMoveBack && !hasOpenCollection;
  const moveBackBlockedByCollection =
    eligibleForMoveBack && hasOpenCollection;
  const deleteBlockedByInProgress =
    !isInternal &&
    isInProgressCleaningProjectDeleteBlocked({
      status: project.status,
      subCategory: project.subCategory,
    });
  const deleteBlockedReason = isInternal
    ? null
    : getInProgressCleaningProjectDeleteBlockReason({
        status: project.status,
        subCategory: project.subCategory,
      });
  const canDelete =
    canDeleteActiveStage &&
    isAdminDeletableProjectStatus(project.status) &&
    !deleteBlockedByInProgress;
  const isRegularContract = isContractSubCategory(project.subCategory);
  const isService = isServiceProjectSubCategory(project.subCategory);
  const isMonthTimeline = usesMonthDurationTimeline(project.subCategory);
  // Regular Cleaning + Security / Parking / Payroll Management (commercial terms, no periods).
  const canEndContract =
    canManage &&
    !isInternal &&
    project.status === "IN_PROGRESS" &&
    (isRegularContract || isService);
  // G3: General / Facade In Progress only — not Security / Parking / Payroll.
  const showSubmitForApproval =
    canManage &&
    !isInternal &&
    isMilestoneSubCategory(project.subCategory) &&
    project.status === "IN_PROGRESS";
  const showCompletedJobDuration =
    project.status === "COMPLETED" &&
    !isRegularContract &&
    !isService &&
    !isMonthTimeline;
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
      : project.status === "WAITING_FOR_APPROVAL"
        ? "/projects?view=pending-approval"
        : project.status === "IN_PROGRESS"
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
      : project.status === "WAITING_FOR_APPROVAL"
        ? t("pages.projects.pendingApprovalTitle")
        : project.status === "IN_PROGRESS"
          ? t("pages.projects.inProgressTitle")
          : t("pages.projects.filterAllProjects");
  // Map legacy ON_HOLD / CANCELLED to workflow labels (no product chrome for those enums).
  const workflowStatus = getProjectWorkflowStatusLabel({
    status: project.status,
  });
  const statusLabel = localizeWorkflowStatus(
    { status: project.status },
    locale
  );
  const statusLines = localizeWorkflowChipLines(workflowStatus, locale);
  const typeLabel = localizeSubCategory(project.subCategory, locale);
  const typeLines = localizeSubCategoryChipLines(project.subCategory, locale);
  const pageDescription = isInternal
    ? typeLabel
    : [project.client?.name, typeLabel].filter(Boolean).join(" · ");
  const billingSubtext = isService
    ? t("pages.projects.detail.serviceBillingNote")
    : (project.billingMode === "MONTHLY"
        ? t("pages.projects.detail.anniversaryInvoiceDay", {
            day: project.invoicingDay,
          })
        : t("pages.projects.detail.contractPriceAndInvoices")) +
      (inPlanning ? t("pages.projects.detail.availableAfterInProgress") : "");
  const hasSiteCoords =
    project.latitude != null && project.longitude != null;
  const geofenceRadiusMeters = resolveGeofenceRadiusMeters(
    project.locationRadiusMeters
  );
  const coordinatesLabel = hasSiteCoords
    ? `${project.latitude!.toFixed(6)}, ${project.longitude!.toFixed(6)}`
    : null;

  return (
    <AppShell title={pageTitle} description={pageDescription || undefined}>
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
        showMoveToInProgress={!isInternal && inPlanning}
        showSubmitForApproval={showSubmitForApproval}
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
          serviceArea: asProjectServiceArea(project.serviceArea),
          billingMode: project.billingMode,
          billingPeriodBasis: project.billingPeriodBasis,
          requiresTaxInvoice: project.requiresTaxInvoice,
          contractPrice: contractPriceNum,
          setupCost: decimalToNumber(project.setupCost),
          profitSharePercent: decimalToNumber(project.profitSharePercent),
          monthlyClientFee: decimalToNumber(project.monthlyClientFee),
          serviceFeePercent: decimalToNumber(project.serviceFeePercent),
          paymentTermsDays: project.paymentTermsDays,
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
        employees={staffEmployees}
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
                {!isInternal ? (
                  <tr className="border-b border-border">
                    <th scope="row" className={metaLabelClassName}>
                      {t("pages.projects.detail.client")}
                    </th>
                    <td className={`${metaValueClassName} font-medium`}>
                      {project.client?.name ?? "—"}
                    </td>
                  </tr>
                ) : null}
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
                {isInternal ? (
                  <>
                    <tr className="border-b border-border">
                      <th scope="row" className={metaLabelClassName}>
                        {t("pages.projects.detail.cicoCoordinates")}
                      </th>
                      <td className={`${metaValueClassName} font-medium`}>
                        {coordinatesLabel ??
                          t("pages.projects.detail.cicoGpsNotSet")}
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <th scope="row" className={metaLabelClassName}>
                        {t("pages.projects.detail.cicoGeofenceRadius")}
                      </th>
                      <td className={`${metaValueClassName} font-medium`}>
                        {t("pages.projects.detail.cicoGeofenceRadiusValue", {
                          meters: geofenceRadiusMeters,
                        })}
                      </td>
                    </tr>
                  </>
                ) : null}
                {!isInternal && inPlanning ? (
                  <tr className="border-b border-border">
                    <th scope="row" className={metaLabelClassName}>
                      {t("pages.projects.detail.estimatedStart")}
                    </th>
                    <td className={`${metaValueClassName} font-medium`}>
                      {timeline}
                    </td>
                  </tr>
                ) : null}
                {!isInternal && !inPlanning ? (
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
                ) : null}
                {!isInternal && showCompletedJobDuration ? (
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
                {!isInternal && project.subCategory === "SECURITY" ? (
                  <tr className="border-b border-border">
                    <th scope="row" className={metaLabelClassName}>
                      {t("pages.projects.serviceCommercial.monthlyFee")}
                    </th>
                    <td className={`${metaValueClassName} font-medium`}>
                      {formatContractPrice(contractPriceNum)}
                    </td>
                  </tr>
                ) : null}
                {!isInternal && project.subCategory === "PARKING" ? (
                  <>
                    <tr className="border-b border-border">
                      <th scope="row" className={metaLabelClassName}>
                        {t("pages.projects.serviceCommercial.setupCost")}
                      </th>
                      <td className={`${metaValueClassName} font-medium`}>
                        {formatContractPrice(
                          decimalToNumber(project.setupCost)
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <th scope="row" className={metaLabelClassName}>
                        {t(
                          "pages.projects.serviceCommercial.profitSharePercent"
                        )}
                      </th>
                      <td className={`${metaValueClassName} font-medium`}>
                        {decimalToNumber(project.profitSharePercent) != null
                          ? `${decimalToNumber(project.profitSharePercent)}%`
                          : "—"}
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <th scope="row" className={metaLabelClassName}>
                        {t(
                          "pages.projects.serviceCommercial.monthlyClientFee"
                        )}
                      </th>
                      <td className={`${metaValueClassName} font-medium`}>
                        {formatContractPrice(
                          decimalToNumber(project.monthlyClientFee)
                        )}
                      </td>
                    </tr>
                  </>
                ) : null}
                {!isInternal &&
                project.subCategory === "PAYROLL_MANAGEMENT" ? (
                  <>
                    <tr className="border-b border-border">
                      <th scope="row" className={metaLabelClassName}>
                        {t(
                          "pages.projects.serviceCommercial.serviceFeePercent"
                        )}
                      </th>
                      <td className={`${metaValueClassName} font-medium`}>
                        {decimalToNumber(project.serviceFeePercent) != null
                          ? `${decimalToNumber(project.serviceFeePercent)}%`
                          : "—"}
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <th scope="row" className={metaLabelClassName}>
                        {t(
                          "pages.projects.serviceCommercial.paymentTermsDays"
                        )}
                      </th>
                      <td className={`${metaValueClassName} font-medium`}>
                        {project.paymentTermsDays === 0
                          ? t("common.paymentTerms.cashShort")
                          : project.paymentTermsDays != null
                            ? t("common.paymentTerms.netShort", {
                                days: project.paymentTermsDays,
                              })
                            : "—"}
                      </td>
                    </tr>
                  </>
                ) : null}
                {!isInternal && !isService ? (
                  <tr className="border-b border-border">
                    <th scope="row" className={metaLabelClassName}>
                      {t("pages.projects.detail.contractPrice")}
                    </th>
                    <td className={`${metaValueClassName} font-medium`}>
                      {formatContractPrice(contractPriceNum)}
                    </td>
                  </tr>
                ) : null}
                {showInventoryCosts ? (
                  <tr className={isInternal ? undefined : "border-b border-border"}>
                    <th scope="row" className={metaLabelClassName}>
                      {t("pages.projects.detail.inventoryCost")}
                    </th>
                    <td className={`${metaValueClassName} font-medium`}>
                      {formatContractPrice(inventoryCost)}
                    </td>
                  </tr>
                ) : null}
                {!isInternal ? (
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
                ) : null}
              </tbody>
            </table>
          </SectionCard>

          {(hasSiteCoords || isInternal) && (
            <SectionCard className={sectionCardClassName}>
              <h3
                className={`${sectionTitleClassName} ${
                  isInternal ? "mb-1" : "mb-3"
                }`}
              >
                {isInternal
                  ? t("pages.projects.detail.cicoSiteLocation")
                  : t("pages.projects.detail.siteLocation")}
              </h3>
              {isInternal ? (
                <p className="mb-3 text-sm leading-relaxed text-subtle">
                  {t("pages.projects.detail.cicoSiteLocationHint")}
                </p>
              ) : null}
              {hasSiteCoords ? (
                <ProjectLocationMap
                  latitude={project.latitude!}
                  longitude={project.longitude!}
                  location={project.location}
                  radiusMeters={geofenceRadiusMeters}
                />
              ) : (
                <p className="rounded-xl border border-border bg-elevated/60 px-4 py-3 text-sm leading-relaxed text-subtle">
                  {canManage
                    ? t("pages.projects.detail.cicoGpsEmptyManage")
                    : t("pages.projects.detail.cicoGpsEmptyView")}
                </p>
              )}
            </SectionCard>
          )}

          {showInventoryCosts ? (
            <ProjectInventoryPanel
              projectId={project.id}
              issues={inventoryIssueViews}
              canViewInventoryModule={canViewInventory}
              canVoidIssue={canAssignStock}
            />
          ) : null}

          {!isInternal && !isService && !inPlanning ? (
            <SectionCard className={sectionCardClassName}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className={sectionTitleClassName}>
                  {t("pages.projects.detail.invoicesPayments")}
                </h3>
                {billingHref ? (
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
                ) : null}
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
                      estimatedStartDate: project.estimatedStartDate,
                      estimatedDurationDays: project.estimatedDurationDays,
                      startDate: project.startDate,
                      endDate: project.endDate,
                      progress: project.progress,
                      subCategory: project.subCategory,
                      serviceArea: asProjectServiceArea(project.serviceArea),
                      billingMode: project.billingMode,
                      billingPeriodBasis: project.billingPeriodBasis,
                      requiresTaxInvoice: project.requiresTaxInvoice,
                      contractPrice: contractPriceNum,
                      setupCost: decimalToNumber(project.setupCost),
                      profitSharePercent: decimalToNumber(
                        project.profitSharePercent
                      ),
                      monthlyClientFee: decimalToNumber(
                        project.monthlyClientFee
                      ),
                      serviceFeePercent: decimalToNumber(
                        project.serviceFeePercent
                      ),
                      paymentTermsDays: project.paymentTermsDays,
                      clientId: project.clientId,
                      status: project.status,
                      assignments: project.assignments.map((a) => ({
                        employeeId: a.employeeId,
                      })),
                    }}
                    employees={staffEmployees}
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

          {/* ── Equipment Assets section — mirrors staff section ── */}
          {!inPlanning && showInventoryCosts ? (
            <SectionCard className={sectionCardClassName}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className={sectionTitleClassName}>
                    {t("pages.projects.equipmentPicker.sectionTitle")}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-subtle">
                    {t("pages.projects.equipmentPicker.noAssignedAssetsHint")}
                  </p>
                </div>
                {canAssignStock ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={cn(
                        buttonVariants({ variant: "infoBadge", size: "badge" }),
                        "pointer-events-none gap-1"
                      )}
                      aria-live="polite"
                    >
                      {assignedEquipmentAssets.length}{" "}
                      {t("pages.projects.equipmentPicker.assigned")}
                    </span>
                  </div>
                ) : null}
              </div>
              <ProjectEquipmentPicker
                projectId={project.id}
                assignedAssets={assignedEquipmentAssets as AssignedEquipmentAsset[]}
                canRelease={canAssignStock}
              />
            </SectionCard>
          ) : null}
        </div>
      </ProjectDetailActionBar>
    </AppShell>
  );
}
