import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";

import { prisma } from "@/lib/prisma";
import {
  annotateStaffPickerConflicts,
  assignableProjectCrewOrWhere,
  crewOptionsForSubCategory,
  findEmployeesOnOtherOpenProjects,
  releaseExpiredBackupCrew,
} from "@/lib/workforce-crew";
import { mapProjectTeamOption } from "@/lib/operations-teams";
import { teamsForProjectServiceArea } from "@/lib/operations-team-kind";
import {
  syncVisitCrewOccupancy,
  visitCrewBusyMapsForWindow,
  visitCrewConflictLabel,
  visitOccupiesToday,
} from "@/lib/project-visit-crew";
import ProjectVisitCrewSection, {
  type VisitCrewRow,
} from "@/components/projects/ProjectVisitCrewSection";
import {
  isBackupAssignmentOccupyingProject,
  processScheduledPettyCashPays,
} from "@/lib/petty-cash";
import { jakartaTodayAsUtcDateOnly } from "@/lib/leave-employment-status";
import { intakeKindOf } from "@/lib/catch-up-intake";
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
  isExtendableContractSubCategory,
  usesMonthDurationTimeline,
} from "@/lib/project-contract";
import {
  isRgsInternalProject,
  isServiceProjectSubCategory,
} from "@/lib/project-subcategory";
import {
  getProjectWorkflowStatusLabel,
  isPlanningProjectStatus,
  PROJECT_LIST_VIEW_PATHS,
  isProjectOpenForSiteWork,
} from "@/lib/project-status";
import {
  localizeBillingChipLines,
  localizeBillingMode,
  localizeBillingStatus,
  localizeLateDaysChipLines,
  localizeSubCategory,
  localizeSubCategoryChipLines,
  localizeWorkflowChipLines,
  localizeWorkflowStatus,
} from "@/lib/i18n/labels";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import ContractPriceEditor from "@/components/billing/ContractPriceEditor";
import {
  commercialTaxKindLabelKey,
  invoiceGrossFromExclusivePrice,
  projectChargedTaxKindFromRecord,
} from "@/lib/commercial-tax";
import {
  decimalToNumber,
  dedupeOnCompletionPeriods,
  formatContractPrice,
  formatInvoicePeriodLabel,
  isMilestoneSubCategory,
  usesInvoicePeriods,
} from "@/lib/project-billing";
import { formatProjectShiftLabel } from "@/lib/project-shifts";
import { shiftsProjectHref } from "@/lib/shifts-directory";
import { canAssignSiteCover } from "@/lib/om-approval";
import { canAccess } from "@/lib/permissions";
import {
  isPendingApprovalPeriod,
  isProjectFullyPaid,
  isUnpaidInvoiceStatus,
  OPEN_COLLECTION_STATUSES,
} from "@/lib/billing";
import { formatDateInput, getInvoicePaymentDisplay } from "@/lib/invoice-period";
import { formatDisplayDate } from "@/lib/format-date";
import { asProjectServiceArea } from "@/lib/service-area";
import { ensureProjectServiceCatalog } from "@/app/projects/catalog-actions";
import {
  invoicePeriodElementId,
  projectBillingHref,
  projectPeriodHref,
} from "@/lib/project-directory-rows";
import type { ProjectStatus } from "@prisma/client";

import AppShell from "@/components/layout/AppShell";
import BackLink from "@/components/ui/BackLink";
import { buttonVariants } from "@/components/ui/button";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge, {
  outlineChipTones,
} from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

import ContractExtensionsHistory from "@/components/projects/ContractExtensionsHistory";
import ProjectBankAccountRow from "@/components/projects/ProjectBankAccountRow";
import ProjectDetailActionBar from "@/components/projects/ProjectDetailActionBar";
import { listCompanyBankAccountOptions } from "@/lib/company-bank-accounts";
import { catchUpAsOfDate, loadBooksOpenDate } from "@/lib/books-open";
import { resolveCatchUpCompleteTarget } from "@/lib/project-catch-up-periods";
import { isVehicleItemType } from "@/lib/inventory-sku";
import ProjectEquipmentPicker, {
  type AssignedEquipmentAsset,
} from "@/components/projects/ProjectEquipmentPicker";
import ProjectInventoryPanel from "@/components/projects/ProjectInventoryPanel";
import ProjectLocationMap from "@/components/projects/ProjectLocationMap";
import ScrollToInvoicePeriod from "@/components/billing/ScrollToInvoicePeriod";
import HoOfflineClientReviewPanel from "@/components/billing/HoOfflineClientReviewPanel";
import { isAwaitingClientAction } from "@/lib/client-billing-review";
import { isClosedProject } from "@/lib/project-settlement";
import {
  listProjectEquipmentHistory,
  listProjectStaffHistory,
} from "@/lib/project-site-history";

const metaLabelClassName =
  "w-36 shrink-0 px-4 py-2.5 text-left align-top text-xs font-semibold uppercase tracking-[0.12em] text-subtle sm:w-44 sm:px-5";
const metaValueClassName =
  "min-w-0 break-words px-4 py-2.5 align-top text-text sm:px-5";
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
    case "OFF_SITE":
      return "warning";
    case "COMPLETED":
      return "success";
    case "PLANNED":
      return "pending";
    default:
      return "inactive";
  }
}

async function listProjectVisitsForDetail(projectId: string) {
  try {
    return await prisma.projectVisit.findMany({
      where: { projectId },
      orderBy: { visitIndex: "asc" },
      include: {
        assignments: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNo: true,
              },
            },
            team: {
              select: {
                id: true,
                name: true,
                members: {
                  include: {
                    employee: {
                      select: { firstName: true, lastName: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  } catch {
    return [];
  }
}

async function listCoveredEmployeesForAssignments(
  assignments: Array<{ coveredEmployeeId?: string | null } | object>
) {
  const ids = [
    ...new Set(
      assignments
        .map(
          (row) =>
            (row as { coveredEmployeeId?: string | null }).coveredEmployeeId
        )
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (ids.length === 0) return new Map<string, { firstName: string; lastName: string }>();
  try {
    const people = await prisma.employee.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true },
    });
    return new Map(people.map((person) => [person.id, person]));
  } catch {
    return new Map<string, { firstName: string; lastName: string }>();
  }
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ period?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const focusPeriodId =
    (await searchParams)?.period?.trim() || null;
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
    userId: session.user.id,
    username: session.user.username,
  });

  const allowed = await prisma.project.findFirst({
    where: { id, ...projectWhere },
    include: {
      client: true,
      assignments: {
        include: {
          employee: true,
          shift: {
            select: {
              id: true,
              number: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      },
      catchUpIntake: { select: { kind: true } },
      invoicePeriods: {
        orderBy: { periodStart: "desc" },
      },
      contractExtensions: {
        orderBy: { extendedOn: "desc" },
      },
      operationsTeamLinks: {
        select: { teamId: true },
      },
      shifts: {
        select: {
          number: true,
          startTime: true,
          endTime: true,
        },
        orderBy: { number: "asc" },
      },
      _count: {
        select: { progressReports: true },
      },
    },
  });

  // Missing, deleted, or out of scope — send to the list instead of a bare 404.
  if (!allowed) redirect(PROJECT_LIST_VIEW_PATHS.all);

  const [visitRows, coveredPeople] = await Promise.all([
    listProjectVisitsForDetail(id),
    listCoveredEmployeesForAssignments(allowed.assignments),
  ]);
  const project = {
    ...allowed,
    visits: visitRows,
    assignments: allowed.assignments.map((assignment) => ({
      ...assignment,
      coveredEmployee:
        coveredPeople.get(
          (assignment as { coveredEmployeeId?: string | null }).coveredEmployeeId ??
            ""
        ) ?? null,
    })),
  };
  const canAssignCover = await canAssignSiteCover({
    userId: session.user.id,
    username: session.user.username,
    permissionUser,
    projectServiceArea: project.serviceArea,
    projectId: project.id,
  });

  const showInventoryCosts =
    !isClientPortalUser(permissionUser) &&
    !isVendorPortalUser(permissionUser);
  const canAssignStock = showInventoryCosts
    ? await canAssignInventoryToProject(session.user.id, {
        ...permissionUser,
        username: session.user.username,
      })
    : false;

  const [employees, clients, inventoryCost, inventoryIssues, operationsTeams, serviceCatalog, bankAccounts] =
    await Promise.all([
      canManage
        ? prisma.employee.findMany({
            where: {
              companyId: project.companyId,
              status: "ACTIVE",
              OR: assignableProjectCrewOrWhere(project.companyId, {
                ...crewOptionsForSubCategory(project.subCategory),
                includeAssignedToProjectId: project.id,
              }),
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNo: true,
              category: { select: { name: true, prefix: true, slug: true } },
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
      canManage
        ? prisma.operationsTeam.findMany({
            where: { companyId: project.companyId },
            include: {
              serviceAreaCatalog: { select: { systemArea: true } },
              members: {
                include: {
                  employee: {
                    select: { firstName: true, lastName: true },
                  },
                },
              },
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          })
        : Promise.resolve([]),
      canManage
        ? ensureProjectServiceCatalog(project.companyId).catch(() => [])
        : Promise.resolve([]),
      listCompanyBankAccountOptions(project.companyId),
    ]);

  const teamOptions = operationsTeams.map(mapProjectTeamOption);

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

  const catchUpKind = intakeKindOf(project);
  const catchUpTarget =
    canManage && catchUpKind
      ? resolveCatchUpCompleteTarget({
          catchUpKind,
          status: project.status,
          isComplimentary: project.isComplimentary,
          isDemo: project.isDemo,
          subCategory: project.subCategory,
          billingMode: project.billingMode,
          startDate: project.startDate,
          endDate: project.endDate,
          basis: project.billingPeriodBasis,
          fromDay: project.billingCycleStartDay,
          toDay: project.billingCycleEndDay,
          asOf: catchUpAsOfDate(
            await loadBooksOpenDate(project.companyId),
            jakartaTodayAsUtcDateOnly()
          ),
          existingPeriods: project.invoicePeriods,
        })
      : null;

  const catchUpInventory: Array<{
    id: string;
    name: string;
    unit: string;
    itemType: string;
  }> = [];
  const catchUpPeople: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }> = [];
  if (catchUpTarget) {
    const [items, people] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: {
          companyId: project.companyId,
          active: true,
          deletedAt: null,
        },
        select: { id: true, name: true, unit: true, itemType: true },
        orderBy: { name: "asc" },
      }),
      prisma.employee.findMany({
        where: {
          companyId: project.companyId,
          archivedFromDirectory: false,
        },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
    ]);
    catchUpInventory.push(...items);
    catchUpPeople.push(...people);
  }

  if (canManage || canAssignCover) {
    await processScheduledPettyCashPays(prisma, project.companyId);
  }
  await releaseExpiredBackupCrew(prisma as never, project.companyId);
  if (canManage && project.billingMode === "MULTI_VISIT") {
    await prisma.$transaction((tx) =>
      syncVisitCrewOccupancy(tx, {
        companyId: project.companyId,
        projectId: project.id,
      })
    );
  }

  const liveFrom = jakartaTodayAsUtcDateOnly();
  const liveStaffAssignments = project.assignments.filter((assignment) =>
    isBackupAssignmentOccupyingProject(assignment)
  );
  const doubleShifts = await prisma.doubleShiftAssignment
    .findMany({
      where: { projectId: project.id, date: { gte: liveFrom } },
      select: {
        id: true,
        employeeId: true,
        date: true,
        coveringShift: {
          select: { number: true, startTime: true, endTime: true },
        },
        coveredEmployee: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { date: "asc" },
    })
    .catch(() =>
      prisma.doubleShiftAssignment.findMany({
        where: { projectId: project.id, date: { gte: liveFrom } },
        select: {
          id: true,
          employeeId: true,
          date: true,
          coveringShift: {
            select: { number: true, startTime: true, endTime: true },
          },
        },
        orderBy: { date: "asc" },
      })
    )
    .then((rows) =>
      rows.map((row) => ({
        ...row,
        coveredEmployee:
          "coveredEmployee" in row
            ? (row.coveredEmployee as {
                firstName: string;
                lastName: string;
              } | null)
            : null,
      }))
    );

  // Equipment issue/release/demob keep Inventory ↔ Projects in sync.
  // Never mint/assign on page load (caused ghost units like EQP-*-A6).
  // Repair: scripts/reconcile-equipment-stock.ts (release phantoms + hard-delete surplus).

  const workforceLocked = isClosedProject(project.status);

  // Assigned equipment for display / release (issue only via Inventory → Project Issues).
  const assignedEquipmentAssets =
    showInventoryCosts &&
    !workforceLocked &&
    isPlanningProjectStatus(project.status) === false
      ? await listProjectEquipmentAssets(project.companyId, project.id)
      : [];
  const [staffHistory, equipmentHistory] = workforceLocked
    ? await Promise.all([
        listProjectStaffHistory(project.id),
        showInventoryCosts
          ? listProjectEquipmentHistory(project.id, {
              companyId: project.companyId,
            })
          : Promise.resolve([]),
      ])
    : [[], []];

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

  const isInternal = isRgsInternalProject(project);
  const chargedTaxKind = projectChargedTaxKindFromRecord(project);
  const billingHref =
    !isInternal && project.clientId != null
      ? projectBillingHref(project.clientId, project.id, focusPeriodId)
      : isInternal
        ? null
        : "/billing";

  const contractPriceNum = decimalToNumber(project.contractPrice);
  const inProjectHistory =
    project.status === "COMPLETED" &&
    isProjectFullyPaid(project.invoicePeriods, project.subCategory);
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
  // Regular + Security (contract cycle) + Parking / Payroll Management (service).
  const canEndContract =
    canManage &&
    !isInternal &&
    project.status === "IN_PROGRESS" &&
    isExtendableContractSubCategory(project.subCategory);
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
  const focusPeriod =
    focusPeriodId
      ? (project.invoicePeriods.find((period) => period.id === focusPeriodId) ??
        null)
      : null;
  const listBackHref = inProjectHistory
    ? "/projects?view=completed"
    : inPlanning
      ? "/projects?view=planning"
      : focusPeriod && isPendingApprovalPeriod(focusPeriod)
        ? "/projects?view=pending-approval"
        : focusPeriod && isUnpaidInvoiceStatus(focusPeriod.status)
          ? "/projects?view=payment-due"
          : isProjectOpenForSiteWork(project.status)
            ? "/projects?view=in-progress"
            : "/projects";

  const invoicePeriodsForDisplay = dedupeOnCompletionPeriods(
    project.invoicePeriods,
    project.billingMode
  );
  const paymentsReceivedCount = invoicePeriodsForDisplay.filter(
    (period) => period.status === "PAID"
  ).length;
  const paymentsTotalCount = invoicePeriodsForDisplay.length;
  const downPaymentPeriod = [...invoicePeriodsForDisplay]
    .filter((period) => period.status === "PAID" && period.paidAt)
    .sort(
      (left, right) =>
        (left.paidAt?.getTime() ?? 0) - (right.paidAt?.getTime() ?? 0)
    )[0];
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const displayLocale = locale === "id" ? "id-ID" : "en-GB";
  const isMultiVisit = project.billingMode === "MULTI_VISIT";
  const visitCrewTeams = teamsForProjectServiceArea(teamOptions, {
    areaCatalogId: project.areaCatalogId,
    serviceArea: project.serviceArea,
    subCategory: project.subCategory,
  });
  const visitCrewRows: VisitCrewRow[] = isMultiVisit
    ? await Promise.all(
        project.visits.map(async (visit) => {
          const busy = await visitCrewBusyMapsForWindow(
            prisma,
            project.companyId,
            { start: visit.startDate, end: visit.endDate },
            visit.id
          );
          const assignment = visit.assignments[0] ?? null;
          const employeeConflicts: Record<string, string> = {};
          for (const employee of employees) {
            const conflict = busy.employees.get(employee.id);
            if (conflict) {
              employeeConflicts[employee.id] = visitCrewConflictLabel(
                conflict,
                locale
              );
            }
          }
          const teamConflicts: Record<string, string> = {};
          for (const team of visitCrewTeams) {
            const conflict =
              busy.teams.get(team.id) ??
              team.memberIds
                .map((memberId) => busy.employees.get(memberId))
                .find(Boolean);
            if (conflict) {
              teamConflicts[team.id] = visitCrewConflictLabel(conflict, locale);
            }
          }
          return {
            id: visit.id,
            visitIndex: visit.visitIndex,
            startLabel: formatDisplayDate(visit.startDate, undefined, displayLocale),
            endLabel: formatDisplayDate(visit.endDate, undefined, displayLocale),
            amountLabel:
              decimalToNumber(visit.amount) != null
                ? formatContractPrice(decimalToNumber(visit.amount))
                : null,
            current: visitOccupiesToday({
              startDate: visit.startDate,
              endDate: visit.endDate,
              projectStatus: project.status,
            }),
            assignment: assignment?.team
              ? {
                  kind: "team",
                  teamId: assignment.team.id,
                  teamName: assignment.team.name,
                  memberNames: assignment.team.members.map(
                    (member) =>
                      `${member.employee.firstName} ${member.employee.lastName}`.trim()
                  ),
                }
              : assignment?.employee
                ? {
                    kind: "employee",
                    employeeId: assignment.employee.id,
                    employeeName:
                      `${assignment.employee.firstName} ${assignment.employee.lastName}`.trim(),
                    employeeNo: assignment.employee.employeeNo,
                  }
                : null,
            employeeConflicts,
            teamConflicts,
          };
        })
      )
    : [];
  const canAssignVisitCrew =
    canManage &&
    (project.status === "PLANNED" ||
      project.status === "IN_PROGRESS" ||
      project.status === "WAITING_FOR_APPROVAL" ||
      project.status === "ON_HOLD");
  const pageTitle = project.name;
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
      : focusPeriod && isPendingApprovalPeriod(focusPeriod)
        ? t("pages.projects.pendingApprovalTitle")
        : focusPeriod && isUnpaidInvoiceStatus(focusPeriod.status)
          ? t("pages.projects.paymentDueTitle")
          : isProjectOpenForSiteWork(project.status)
            ? t("pages.projects.inProgressTitle")
            : t("pages.projects.filterAllProjects");
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
  const opensBillingPeriods = usesInvoicePeriods(project.subCategory);
  const billingSubtext = !opensBillingPeriods
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
  const projectDemoFlags = project as typeof project & {
    isDemo?: boolean;
    isComplimentary?: boolean;
  };

  return (
    <AppShell title={pageTitle}>
      <ScrollToInvoicePeriod periodId={focusPeriodId} />
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
        hasPortalAccess={project.client?.hasPortalAccess !== false}
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
          serviceArea:
            project.serviceArea === "OTHER"
              ? "OTHER"
              : asProjectServiceArea(project.serviceArea),
          areaCatalogId: project.areaCatalogId,
          subcategoryCatalogId: project.subcategoryCatalogId,
          billingMode: project.billingMode,
          billingPeriodBasis: project.billingPeriodBasis,
          billingCycleStartDay: project.billingCycleStartDay,
          billingCycleEndDay: project.billingCycleEndDay,
          requiresTaxInvoice: project.requiresTaxInvoice,
          chargedTaxKind: project.chargedTaxKind,
          isGovernmentContract: project.isGovernmentContract,
          isDemo: Boolean(projectDemoFlags.isDemo),
          isComplimentary: Boolean(projectDemoFlags.isComplimentary),
          pphRatePercent: decimalToNumber(project.pphRatePercent),
          otherTaxName: project.otherTaxName,
          contractPrice: contractPriceNum,
          setupCost: decimalToNumber(project.setupCost),
          profitSharePercent: decimalToNumber(project.profitSharePercent),
          monthlyClientFee: decimalToNumber(project.monthlyClientFee),
          memberParkingUnitFee: decimalToNumber(project.memberParkingUnitFee),
          memberParkingUnitCount: project.memberParkingUnitCount,
          parkingTaxPercent: decimalToNumber(project.parkingTaxPercent),
          serviceFeePercent: decimalToNumber(project.serviceFeePercent),
          paymentTermsDays: project.paymentTermsDays,
          bankAccountId: project.bankAccountId,
          payrollCutoffStartDay: project.payrollCutoffStartDay,
          payrollCutoffEndDay: project.payrollCutoffEndDay,
          payrollTaxPercent: decimalToNumber(project.payrollTaxPercent),
          clientId: project.clientId,
          status: project.status,
          shiftCount: project.shiftCount,
          shifts: project.shifts,
          assignments: project.assignments.map((a) => ({
            employeeId: a.employeeId,
          })),
          operationsTeamLinks: project.operationsTeamLinks,
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
        teams={teamOptions}
        assignedTeamIds={project.operationsTeamLinks.map((link) => link.teamId)}
        clients={clients}
        catalog={serviceCatalog}
        bankAccounts={bankAccounts}
        catchUpComplete={
          catchUpTarget
            ? {
                projectId: project.id,
                target: catchUpTarget,
                requirePayment: catchUpKind === "COMPLETED",
                inventoryItems: catchUpInventory
                  .filter((item) => !isVehicleItemType(item.itemType))
                  .map((item) => ({
                    id: item.id,
                    name: item.name,
                    unit: item.unit,
                  })),
                employees: catchUpPeople,
              }
            : null
        }
      >
        <div className="space-y-5">
          <SectionCard className="overflow-hidden p-0">
            <div className="space-y-3 border-b border-border px-4 py-3.5 sm:px-5">
              <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-2">
                <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-4">
                  <span className="text-xs font-semibold text-subtle">
                    {t("pages.projects.detail.status")}
                  </span>
                  <StatusBadge
                    size="lg"
                    status={statusTone(project.status)}
                    lines={statusLines ?? undefined}
                    className="!w-[9.75rem] !min-w-[9.75rem] !max-w-[9.75rem]"
                  >
                    {statusLines ? undefined : statusLabel}
                  </StatusBadge>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-4">
                  <span className="text-xs font-semibold text-subtle">
                    {t("pages.projects.detail.projectType")}
                  </span>
                  <StatusBadge
                    size="lg"
                    status="info"
                    lines={typeLines ?? undefined}
                    className="!w-[9.75rem] !min-w-[9.75rem] !max-w-[9.75rem]"
                  >
                    {typeLines ? undefined : typeLabel}
                  </StatusBadge>
                </div>
                {!inPlanning ? (
                  <Link
                    href={`/progress?projectId=${project.id}`}
                    className={cn(
                      buttonVariants({ variant: "infoBadge", size: "badgeLg" }),
                      "w-fit max-w-full shrink-0 whitespace-nowrap sm:ml-auto"
                    )}
                    aria-label={t("pages.projects.detail.viewProgressReports")}
                  >
                    {t("pages.projects.detail.viewProgressReports")}
                  </Link>
                ) : null}
              </div>
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
                {!isInternal ? (
                  <tr className="border-b border-border">
                    <th scope="row" className={`${metaLabelClassName} !align-top`}>
                      {t("pages.projects.detail.bankAccount")}
                    </th>
                    <td className={`${metaValueClassName} font-medium`}>
                      <ProjectBankAccountRow
                        projectId={project.id}
                        bankAccountId={project.bankAccountId}
                        accounts={bankAccounts}
                        canEdit={canManage && !workforceLocked}
                      />
                    </td>
                  </tr>
                ) : null}
                {!isInternal && chargedTaxKind ? (
                  <tr className="border-b border-border">
                    <th scope="row" className={metaLabelClassName}>
                      {t("pages.projects.detail.chargedTax")}
                    </th>
                    <td className={`${metaValueClassName} font-medium`}>
                      {chargedTaxKind === "OTHER" && project.otherTaxName
                        ? project.otherTaxName
                        : t(commercialTaxKindLabelKey(chargedTaxKind))}
                      {decimalToNumber(project.pphRatePercent) != null
                        ? ` · ${decimalToNumber(project.pphRatePercent)}%`
                        : ""}
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
                    <tr className="border-b border-border">
                      <th scope="row" className={metaLabelClassName}>
                        {t(
                          "pages.projects.serviceCommercial.memberParkingUnitFee"
                        )}
                      </th>
                      <td className={`${metaValueClassName} font-medium`}>
                        {formatContractPrice(
                          decimalToNumber(project.memberParkingUnitFee)
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <th scope="row" className={metaLabelClassName}>
                        {t(
                          "pages.projects.serviceCommercial.memberParkingUnitCount"
                        )}
                      </th>
                      <td className={`${metaValueClassName} font-medium`}>
                        {project.memberParkingUnitCount ?? "—"}
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <th scope="row" className={metaLabelClassName}>
                        {t(
                          "pages.projects.serviceCommercial.parkingTaxPercent"
                        )}
                      </th>
                      <td className={`${metaValueClassName} font-medium`}>
                        {decimalToNumber(project.parkingTaxPercent) != null
                          ? `${decimalToNumber(project.parkingTaxPercent)}%`
                          : "10%"}
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
                          "pages.projects.serviceCommercial.payrollTaxPercent"
                        )}
                      </th>
                      <td className={`${metaValueClassName} font-medium`}>
                        {decimalToNumber(project.payrollTaxPercent) != null
                          ? `${decimalToNumber(project.payrollTaxPercent)}%`
                          : "11%"}
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <th scope="row" className={metaLabelClassName}>
                        {t(
                          "pages.projects.serviceCommercial.payrollCutoffEndDay"
                        )}
                      </th>
                      <td className={`${metaValueClassName} font-medium`}>
                        {project.payrollCutoffEndDay ?? "—"}
                      </td>
                    </tr>
                  </>
                ) : null}
                {!isInternal && project.subCategory !== "PARKING" ? (
                  <tr className="border-b border-border">
                    <th scope="row" className={metaLabelClassName}>
                      {t("pages.projects.serviceCommercial.paymentTermsDays")}
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
              canVoidIssue={canAssignStock && !workforceLocked}
            />
          ) : null}

          {!isInternal && opensBillingPeriods && !inPlanning ? (
            <SectionCard className={sectionCardClassName}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className={sectionTitleClassName}>
                  {t("pages.projects.detail.invoicesPayments")}
                </h3>
                <p className="w-full text-sm text-subtle sm:w-auto">
                  {t("pages.projects.detail.downPaymentReceived")}:{" "}
                  {downPaymentPeriod ? (
                    <span className="font-medium text-text">
                      {t("pages.projects.detail.downPaymentReceivedYes", {
                        amount: formatContractPrice(
                          decimalToNumber(
                            downPaymentPeriod.revisedInvoiceAmount ??
                              downPaymentPeriod.amount
                          ) ?? 0
                        ),
                        date: downPaymentPeriod.paidAt
                          ? formatDisplayDate(downPaymentPeriod.paidAt)
                          : "—",
                      })}
                    </span>
                  ) : (
                    <span className="font-medium text-text">
                      {t("pages.projects.detail.downPaymentReceivedNo")}
                    </span>
                  )}
                </p>
                <p className="w-full text-xs text-subtle sm:w-auto">
                  {t("pages.projects.detail.downPaymentTaxInvoiceNote")}
                </p>
                {paymentsTotalCount > 0 ? (
                  <p className="text-sm text-subtle">
                    {t("pages.projects.detail.paymentsReceivedCount", {
                      paid: paymentsReceivedCount,
                      total: paymentsTotalCount,
                    })}
                  </p>
                ) : null}
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

              <div className="mb-4">
                <ContractPriceEditor
                  projectId={project.id}
                  contractPrice={contractPriceNum}
                  chargedTaxKind={chargedTaxKind}
                  requiresTaxInvoice={project.requiresTaxInvoice}
                  pphRatePercent={decimalToNumber(project.pphRatePercent)}
                  isGovernmentContract={project.isGovernmentContract}
                  canManage={canManage && !workforceLocked}
                  milestone={project.billingMode === "MILESTONE"}
                  lockedHint={
                    workforceLocked
                      ? t("pages.billing.contractPriceSettledHint")
                      : null
                  }
                />
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
                        <th className="px-3 py-3 text-left font-semibold">
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
                          paymentTermsDays: project.paymentTermsDays,
                        });
                        const amount =
                          decimalToNumber(period.amount) ??
                          invoiceGrossFromExclusivePrice(contractPriceNum, {
                            chargedTaxKind: project.chargedTaxKind,
                            requiresTaxInvoice: project.requiresTaxInvoice,
                            pphRatePercent: decimalToNumber(
                              project.pphRatePercent
                            ),
                            isGovernmentContract: project.isGovernmentContract,
                          });
                        const statusChipLines =
                          display.key === "LATE" &&
                          display.daysOverdue != null
                            ? localizeLateDaysChipLines(
                                display.daysOverdue,
                                locale
                              )
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
                          <tr
                            key={period.id}
                            id={invoicePeriodElementId(period.id)}
                            className={cn(
                              "border-b border-border last:border-0 hover:bg-elevated",
                              focusPeriodId === period.id &&
                                "bg-card-tint-amber"
                            )}
                          >
                            <td className="px-3 py-3.5">
                              <Link
                                href={projectPeriodHref(project.id, period.id)}
                                className="block"
                              >
                                <p className="font-medium text-text hover:text-accent-teal">
                                  {formatInvoicePeriodLabel(period, {
                                    projectName: project.name,
                                    billingMode: project.billingMode,
                                    locale,
                                  })}
                                </p>
                                <p className="mt-0.5 text-xs font-medium text-accent-teal">
                                  {t("pages.projects.periodPage.openHint")}
                                </p>
                              </Link>
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
              {canManage &&
              project.client?.hasPortalAccess === false
                ? invoicePeriodsForDisplay
                    .filter(
                      (period) =>
                        period.status === "AWAITING_CLIENT_REVIEW" &&
                        isAwaitingClientAction(period.clientReviewStatus)
                    )
                    .map((period) => (
                      <div key={`${period.id}-offline-review`} className="mt-4">
                        <p className="mb-2 text-sm font-medium text-text">
                          {formatInvoicePeriodLabel(period, {
                            projectName: project.name,
                            billingMode: project.billingMode,
                            locale,
                          })}
                        </p>
                        <HoOfflineClientReviewPanel
                          periodId={period.id}
                          proposedAmount={
                            decimalToNumber(period.amount) ?? contractPriceNum
                          }
                        />
                      </div>
                    ))
                : null}
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

          {isMultiVisit ? (
            <SectionCard className={sectionCardClassName}>
              <ProjectVisitCrewSection
                visits={visitCrewRows}
                employees={employees.map((employee) => ({
                  id: employee.id,
                  firstName: employee.firstName,
                  lastName: employee.lastName,
                  employeeNo: employee.employeeNo,
                }))}
                teams={visitCrewTeams.map((team) => ({
                  id: team.id,
                  name: team.name,
                  memberNames: team.memberNames,
                }))}
                canAssign={canAssignVisitCrew}
              />
            </SectionCard>
          ) : !inPlanning ? (
            <SectionCard className={sectionCardClassName}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className={sectionTitleClassName}>
                    {workforceLocked
                      ? t("pages.projects.detail.staffHistory")
                      : t("pages.projects.detail.staff")}
                  </h3>
                  {workforceLocked ? (
                    <p className="mt-1 max-w-2xl text-sm text-subtle">
                      {t("pages.projects.detail.staffHistoryHint")}
                    </p>
                  ) : null}
                </div>
                {!workforceLocked && canAccess(permissionUser, "shifts") ? (
                  <Link
                    href={shiftsProjectHref({
                      clientId: project.clientId,
                      projectId: project.id,
                      name: project.name,
                      serviceArea: project.serviceArea,
                      subCategory: project.subCategory,
                    })}
                    className={cn(
                      buttonVariants({ variant: "infoBadge", size: "badgeFlex" })
                    )}
                  >
                    {t("pages.shifts.manageShifts")}
                  </Link>
                ) : null}
              </div>

              {workforceLocked ? (
                staffHistory.length === 0 ? (
                  <p className="text-sm text-subtle">
                    {t("pages.projects.detail.noStaffHistory")}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {staffHistory.map((person) => (
                      <div
                        key={person.employeeId}
                        className={cn(
                          "w-auto max-w-full rounded-md px-3 py-2",
                          outlineChipTones.emerald
                        )}
                      >
                        <p className="text-sm font-semibold normal-case tracking-normal">
                          {person.firstName} {person.lastName}
                        </p>
                        <p className="text-xs font-medium normal-case tracking-normal text-primary-dark/70">
                          {person.employeeNo}
                        </p>
                        {person.shiftLabel ? (
                          <p className="mt-0.5 text-xs font-medium normal-case tracking-normal text-primary-dark/80">
                            {person.shiftLabel}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )
              ) : liveStaffAssignments.length === 0 ? (
                <p className="text-sm text-subtle">
                  {t("pages.projects.detail.noStaff")}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {liveStaffAssignments.map((assignment) => (
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
                      {assignment.isBackup ? (
                        <p className="mt-0.5 text-xs font-medium normal-case tracking-normal text-primary-dark/80">
                          {assignment.shift && assignment.coveredEmployee
                            ? t("pages.projects.detail.backupCoverChip", {
                                start: assignment.backupStartDate
                                  ? formatDateInput(assignment.backupStartDate)
                                  : "—",
                                end: assignment.backupEndDate
                                  ? formatDateInput(assignment.backupEndDate)
                                  : "—",
                                rate: formatContractPrice(
                                  decimalToNumber(assignment.dailyRate)
                                ),
                                shift: formatProjectShiftLabel(assignment.shift),
                                name: `${assignment.coveredEmployee.firstName} ${assignment.coveredEmployee.lastName}`.trim(),
                              })
                            : t("pages.projects.detail.backupChip", {
                                start: assignment.backupStartDate
                                  ? formatDateInput(assignment.backupStartDate)
                                  : "—",
                                end: assignment.backupEndDate
                                  ? formatDateInput(assignment.backupEndDate)
                                  : "—",
                                rate: formatContractPrice(
                                  decimalToNumber(assignment.dailyRate)
                                ),
                              })}
                        </p>
                      ) : assignment.shift ? (
                        <p className="mt-0.5 text-xs font-medium normal-case tracking-normal text-primary-dark/80">
                          {formatProjectShiftLabel(assignment.shift)}
                        </p>
                      ) : assignment.shiftStart && assignment.shiftEnd ? (
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
                      {doubleShifts
                        .filter((row) => row.employeeId === assignment.employeeId)
                        .map((row) => (
                          <div key={row.id} className="mt-1">
                            <p className="text-xs font-medium normal-case tracking-normal text-primary-dark/80">
                              {row.coveringShift && row.coveredEmployee
                                ? t("pages.projects.detail.doubleShiftCoverChip", {
                                    date: formatDateInput(row.date),
                                    shift: formatProjectShiftLabel(
                                      row.coveringShift
                                    ),
                                    name: `${row.coveredEmployee.firstName} ${row.coveredEmployee.lastName}`.trim(),
                                  })
                                : t("pages.projects.detail.doubleShiftChip", {
                                    date: formatDateInput(row.date),
                                  })}
                            </p>
                          </div>
                        ))}
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
                    {workforceLocked
                      ? t("pages.projects.detail.equipmentHistory")
                      : t("pages.projects.equipmentPicker.sectionTitle")}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-subtle">
                    {workforceLocked
                      ? t("pages.projects.detail.equipmentHistoryHint")
                      : t("pages.projects.equipmentPicker.noAssignedAssetsHint")}
                  </p>
                </div>
                {!workforceLocked && canAssignStock ? (
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
              {workforceLocked ? (
                equipmentHistory.length === 0 ? (
                  <p className="text-sm text-subtle">
                    {t("pages.projects.detail.noEquipmentHistory")}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {equipmentHistory.map((row) => (
                      <div
                        key={row.id}
                        className={cn(
                          "w-auto max-w-full rounded-md px-3 py-2",
                          outlineChipTones.warning
                        )}
                      >
                        <p className="text-sm font-semibold normal-case tracking-normal">
                          {row.assetCode ?? row.itemName}
                        </p>
                        <p className="text-xs font-medium normal-case tracking-normal text-warning/70">
                          {row.assetCode ? row.itemName : row.sku}
                        </p>
                        <p className="mt-0.5 text-xs font-medium normal-case tracking-normal text-warning/60">
                          {formatDisplayDate(row.assignedOn)}
                          {row.returned
                            ? ` · ${t("pages.projects.detail.equipmentReturned")}`
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <ProjectEquipmentPicker
                  projectId={project.id}
                  assignedAssets={
                    assignedEquipmentAssets as AssignedEquipmentAsset[]
                  }
                  canRelease={canAssignStock}
                />
              )}
            </SectionCard>
          ) : null}
        </div>
      </ProjectDetailActionBar>
    </AppShell>
  );
}
