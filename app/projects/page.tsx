import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import {
  annotateStaffPickerConflicts,
  assignableProjectCrewOrWhere,
  findEmployeesOnOtherOpenProjects,
} from "@/lib/workforce-crew";

import { requireSession, toPermissionUser } from "@/lib/session";

import { getProjectWhereForUser, canManageProjects } from "@/lib/project-access";
import { canAccess } from "@/lib/permissions";
import { formatDisplayDate } from "@/lib/format-date";
import { isInternalProjectSubCategory } from "@/lib/project-subcategory";
import {
  CLEANING_DIRECTORY_SUB_CHIPS,
  DIRECTORY_ALL_SECTION_ORDER,
  ONE_TIME_DIRECTORY_SUB_CHIPS,
  PROJECT_DIRECTORY_TOP_CHIPS,
  customChipId,
  directorySectionForProject,
  isSystemTopChip,
  projectWhereForDirectoryChips,
  resolveDirectoryChips,
  toCustomChip,
  type DirectorySectionKey,
} from "@/lib/project-directory-chips";
import {
  catalogDisplayName,
  type ProjectCatalogAreaDTO,
} from "@/lib/project-service-catalog";
import {
  ensureProjectServiceCatalog,
} from "@/app/projects/catalog-actions";
import { isContractCycleSubCategory } from "@/lib/project-contract";
import { mapProjectTeamOption } from "@/lib/operations-teams";
import { isMilestoneSubCategory } from "@/lib/project-billing";
import { localizeSubCategory } from "@/lib/i18n/labels";
import ProjectServiceAreaManageDialog from "@/components/projects/ProjectServiceAreaManageDialog";
import {
  getPaymentDueStage,
  paymentDueWhere,
  pendingApprovalWhere,
  projectHistoryWhere,
} from "@/lib/billing";
import {
  decimalToNumber,
  formatInvoicePeriodLabel,
} from "@/lib/project-billing";
import {
  isMonthlyPeriodAwaitingReconcile,
  isMonthlyPeriodReadyToInvoice,
} from "@/lib/invoice-period";
import {
  buildProjectDirectoryItems,
  formatDirectoryDateRange,
  isDirectoryPeriodRow,
  projectBillingHref,
  projectDetailHref,
  projectPeriodHref,
  serializeDirectoryDecimals,
  serializeDirectoryProject,
} from "@/lib/project-directory-rows";
import { processPendingEarlyEndReconciles } from "@/lib/project-early-end";
import {
  countDueMonthlyInvoiceReminders,
  syncDueMonthlyInvoicesOnLoad,
} from "@/app/projects/invoice-actions";
import {
  PROJECT_ALL_LIST_STATUSES,
  PROJECT_IN_PROGRESS_LIST_STATUSES,
  PROJECT_PLANNING_LIST_STATUSES,
  PROJECT_PLANNING_STATUS,
} from "@/lib/project-status";
import AppShell from "@/components/layout/AppShell";

import SectionCard from "@/components/ui/SectionCard";

import EmptyState from "@/components/ui/EmptyState";

import ProjectAddControl from "@/components/projects/ProjectAddControl";
import { listCompanyBankAccountOptions } from "@/lib/company-bank-accounts";
import ProjectHistoryClearAllDialog from "@/components/projects/ProjectHistoryClearAllDialog";
import ProjectsListHeader from "@/components/projects/ProjectsListHeader";
import ProjectTable, {
  type ProjectTableRow,
} from "@/components/projects/ProjectTable";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import type { MessageKey } from "@/lib/i18n/messages";

const PROJECT_LIST_VIEWS = [
  "planning",
  "in-progress",
  "pending-approval",
  "payment-due",
  "completed",
] as const;
type ProjectListView = (typeof PROJECT_LIST_VIEWS)[number];

/** Views that keep Regular / General / Facade chips (not Payment Due / Completed). */
const SUBCATEGORY_CHIP_VIEWS = new Set<ProjectListView | undefined>([
  undefined,
  "planning",
  "in-progress",
  "pending-approval",
]);

const TOP_CHIP_LABEL_KEYS = {
  all: "pages.projects.directoryChipAll",
  INTERNAL: "pages.projects.directoryChipInternal",
  ONE_TIME: "pages.projects.directoryChipOneTime",
  CLEANING: "pages.projects.directoryChipCleaning",
  SECURITY: "pages.projects.directoryChipSecurity",
  PARKING: "pages.projects.directoryChipParking",
  PAYROLL_MANAGEMENT: "pages.projects.directoryChipPayroll",
  LANDSCAPING: "pages.projects.directoryChipLandscaping",
} as const;

const CLEANING_SUB_LABEL_KEYS = {
  REGULAR: "pages.projects.directorySubRegular",
  GENERAL: "pages.projects.directorySubGeneral",
  FACADE: "pages.projects.directorySubFacade",
} as const;

const ONE_TIME_SUB_LABEL_KEYS = {
  LANDSCAPING: "pages.projects.directorySubLandscaping",
  SECURITY: "pages.projects.directorySubSecurity",
  CLEANING: "pages.projects.directorySubCleaning",
} as const;

function isProjectListView(value: string): value is ProjectListView {
  return (PROJECT_LIST_VIEWS as readonly string[]).includes(value);
}

/** Canonical view from query; `history` aliases to `completed`. */
function resolveProjectListView(
  raw: string | undefined
): ProjectListView | undefined {
  if (!raw) return undefined;
  if (raw === "history") return "completed";
  if (isProjectListView(raw)) return raw;
  return undefined;
}

function buildProjectsHref(opts: {
  clientId?: string;
  view?: ProjectListView;
  area?: string;
  sub?: string;
}) {
  const params = new URLSearchParams();
  if (opts.clientId) params.set("clientId", opts.clientId);
  if (opts.view) params.set("view", opts.view);
  if (opts.area && opts.area !== "all") params.set("area", opts.area);
  if (opts.sub) params.set("sub", opts.sub);
  const query = params.toString();
  return query ? `/projects?${query}` : "/projects";
}

function viewCopy(view: ProjectListView | undefined): {
  shellTitleKey: MessageKey;
  listTitleKey: MessageKey;
  emptyMessageKey: MessageKey;
} {
  if (view === "planning") {
    return {
      shellTitleKey: "pages.projects.planningTitle",
      listTitleKey: "pages.projects.planningTitle",
      emptyMessageKey: "pages.projects.emptyPlanning",
    };
  }
  if (view === "in-progress") {
    return {
      shellTitleKey: "pages.projects.inProgressTitle",
      listTitleKey: "pages.projects.inProgressTitle",
      emptyMessageKey: "pages.projects.emptyInProgress",
    };
  }
  if (view === "pending-approval") {
    return {
      shellTitleKey: "pages.projects.pendingApprovalTitle",
      listTitleKey: "pages.projects.pendingApprovalTitle",
      emptyMessageKey: "pages.projects.emptyPendingApproval",
    };
  }
  if (view === "payment-due") {
    return {
      shellTitleKey: "pages.projects.paymentDueTitle",
      listTitleKey: "pages.projects.paymentDueTitle",
      emptyMessageKey: "pages.projects.emptyPaymentDue",
    };
  }
  if (view === "completed") {
    return {
      shellTitleKey: "pages.projects.completedTitle",
      listTitleKey: "pages.projects.completedTitle",
      emptyMessageKey: "pages.projects.emptyCompleted",
    };
  }
  return {
    shellTitleKey: "pages.projects.allTitle",
    listTitleKey: "pages.projects.allTitle",
    emptyMessageKey: "pages.projects.emptyAll",
  };
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    subCategory?: string;
    view?: string;
    area?: string;
    sub?: string;
  }>;
}) {
  const session = await requireSession();
  const {
    clientId: filterClientId,
    subCategory: filterSubCategoryRaw,
    view: filterViewRaw,
    area: filterAreaRaw,
    sub: filterSubRaw,
  } = await searchParams;

  // Prefer ?view=completed; keep ?view=history as a redirect alias.
  if (filterViewRaw === "history") {
    const params = new URLSearchParams();
    params.set("view", "completed");
    if (filterClientId) params.set("clientId", filterClientId);
    if (filterAreaRaw) params.set("area", filterAreaRaw);
    if (filterSubRaw) params.set("sub", filterSubRaw);
    if (filterSubCategoryRaw) params.set("subCategory", filterSubCategoryRaw);
    redirect(`/projects?${params.toString()}`);
  }

  const filterView = resolveProjectListView(filterViewRaw);

  const directoryChips = SUBCATEGORY_CHIP_VIEWS.has(filterView)
    ? resolveDirectoryChips({
        area: filterAreaRaw,
        sub: filterSubRaw,
        subCategory: filterSubCategoryRaw,
      })
    : { area: "all" as const, sub: undefined };

  const permissionUser = toPermissionUser(session);
  const canManage = canManageProjects(permissionUser);
  const canOpenBilling = canAccess(permissionUser, "invoicing");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const copy = viewCopy(filterView);

  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });

  const company = await prisma.company.findFirst();
  let serviceCatalog: ProjectCatalogAreaDTO[] = [];
  if (company) {
    try {
      serviceCatalog = await ensureProjectServiceCatalog(company.id);
    } catch {
      serviceCatalog = [];
    }
  }

  const bankAccounts = company
    ? await listCompanyBankAccountOptions(company.id)
    : [];

  if (!company) {
    return (
      <AppShell titleKey="pages.projects.title">
        <SectionCard>
          <p className="text-text">{t("pages.projects.companyNotFound")}</p>
        </SectionCard>
      </AppShell>
    );
  }

  // Ensure Head Office / Warehouse Internal projects exist (and migrate legacy rows).
  if (!session.user.clientId && session.user.companyId) {
    try {
      const { ensureInternalAttendanceSites } = await import(
        "@/lib/ensure-internal-attendance-sites"
      );
      await ensureInternalAttendanceSites(session.user.companyId);
    } catch {
      // Directory still loads if ensure fails.
    }
  }

  if (
    canManage &&
    !session.user.clientId &&
    session.user.companyId
  ) {
    try {
      await processPendingEarlyEndReconciles({
        companyId: session.user.companyId,
        userId: session.user.id,
      });
    } catch {
      // List still loads if next-day early-end reconcile is not ready.
    }
  }

  // Auto-compile due Regular Cleaning anniversary invoices on stage views.
  if (
    canManage &&
    !session.user.clientId &&
    (filterView === "in-progress" ||
      filterView === "payment-due" ||
      filterView === undefined)
  ) {
    try {
      await syncDueMonthlyInvoicesOnLoad();
    } catch {
      // List still loads if period sync fails.
    }
  }

  // Lifecycle: All | Planning | In Progress | Pending Approval | Payment Due | History.
  // Planning is PLANNED-only so Move to In Progress removes the row immediately.
  const viewWhere =
    filterView === "planning"
      ? { status: { in: [...PROJECT_PLANNING_LIST_STATUSES] } }
      : filterView === "in-progress"
        ? { status: { in: [...PROJECT_IN_PROGRESS_LIST_STATUSES] } }
        : filterView === "pending-approval"
          ? pendingApprovalWhere()
          : filterView === "payment-due"
            ? paymentDueWhere()
            : filterView === "completed"
              ? projectHistoryWhere()
              : { status: { in: [...PROJECT_ALL_LIST_STATUSES] } };

  const [projectsFetched, employees, clients, filterClient, dueMonthlyReminders, operationsTeams] =
    await Promise.all([
      prisma.project.findMany({
        where: {
          ...projectWhere,
          ...viewWhere,
          // Portal clients are already scoped; ignore cross-client query filters.
          ...(!session.user.clientId && filterClientId
            ? { clientId: filterClientId }
            : {}),
          ...projectWhereForDirectoryChips(directoryChips),
        },
        include: {
          client: true,
          assignments: {
            select: { employeeId: true },
          },
          invoicePeriods: {
            select: {
              id: true,
              status: true,
              dueAt: true,
              submittedAt: true,
              paidAt: true,
              periodStart: true,
              periodEnd: true,
              label: true,
              milestonePercent: true,
              invoicePdfPath: true,
              reconciledAt: true,
              clientReviewStatus: true,
              clientReviewKind: true,
              amount: true,
              taxInvoiceRequired: true,
              taxInvoiceDoneAt: true,
              taxInvoiceDocumentPath: true,
            },
          },
          operationsTeamLinks: {
            select: { teamId: true },
          },
          areaCatalog: {
            select: {
              id: true,
              nameEn: true,
              nameId: true,
              systemArea: true,
            },
          },
          subcategoryCatalog: {
            select: {
              id: true,
              nameEn: true,
              nameId: true,
              isSystem: true,
              billingKind: true,
            },
          },
          _count: {
            select: { assignments: true, progressReports: true },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      }),
      canManage
        ? prisma.employee.findMany({
            where: {
              companyId: company.id,
              status: "ACTIVE",
              // Include In-House Cleaning for Internal project edits on this page.
              OR: assignableProjectCrewOrWhere(company.id, {
                includeInHouseCleaning: true,
                includeSecurityStaff: true,
                includeParkingStaff: true,
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
              { sortOrder: "asc" },
              { category: { sortOrder: "asc" } },
              { firstName: "asc" },
            ],
          })
        : Promise.resolve([]),
      canManage
        ? prisma.client.findMany({
            where: { companyId: company.id, active: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          })
        : Promise.resolve([]),
      filterClientId && !session.user.clientId
        ? prisma.client.findFirst({
            where: { id: filterClientId, companyId: company.id },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      canManage && !session.user.clientId
        ? countDueMonthlyInvoiceReminders()
        : Promise.resolve(0),
      canManage
        ? prisma.operationsTeam.findMany({
            where: { companyId: company.id },
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
    ]);

  const teamOptions = operationsTeams.map(mapProjectTeamOption);

  const staffConflicts =
    canManage && employees.length > 0
      ? await findEmployeesOnOtherOpenProjects(
          prisma,
          company.id,
          employees.map((employee) => employee.id)
        )
      : [];
  const staffEmployees = annotateStaffPickerConflicts(employees, staffConflicts);

  // Strip Prisma Decimal on the project and nested invoicePeriods so rows are
  // safe for Client Components (ProjectTable). Keep numeric amounts for
  // directory Reconcile suggested values.
  const projectsRaw = projectsFetched.map(serializeDirectoryProject);

  const now = new Date();
  const projectsSorted =
    filterView === "payment-due"
      ? [...projectsRaw].sort((a, b) => {
          const aStage = getPaymentDueStage(
            a.invoicePeriods.map((p) => ({
              ...p,
              paymentTermsDays: a.paymentTermsDays,
            })),
            now
          );
          const bStage = getPaymentDueStage(
            b.invoicePeriods.map((p) => ({
              ...p,
              paymentTermsDays: b.paymentTermsDays,
            })),
            now
          );
          if (aStage.kind !== bStage.kind) {
            return aStage.kind === "awaiting_payment" ? -1 : 1;
          }
          const aDue = aStage.dueAt;
          const bDue = bStage.dueAt;
          if (!aDue && !bDue) return a.sortOrder - b.sortOrder;
          if (!aDue) return 1;
          if (!bDue) return -1;
          const dueDiff = aDue.getTime() - bDue.getTime();
          if (dueDiff !== 0) return dueDiff;
          return a.sortOrder - b.sortOrder;
        })
      : projectsRaw;

  const directoryItems = buildProjectDirectoryItems(projectsSorted, filterView);
  const projects = projectsSorted;

  const tableRows: ProjectTableRow[] = serializeDirectoryDecimals(
    directoryItems.map(({ key, project, kind, focusPeriod }) => {
      const isPeriodRow = Boolean(
        isDirectoryPeriodRow(kind) && focusPeriod
      );
      const isPlanningCard = kind === "planning";
      const isInternal = isInternalProjectSubCategory(project.subCategory);
      const periodLine =
        isPeriodRow && focusPeriod
          ? formatDirectoryDateRange(
              focusPeriod.periodStart,
              focusPeriod.periodEnd,
              locale
            ) ??
            focusPeriod.label?.trim() ??
            null
          : null;
      const contractTimeline = isPlanningCard
        ? project.estimatedStartDate
          ? t("pages.projects.detail.estStart", {
              date: formatDisplayDate(project.estimatedStartDate),
            })
          : t("pages.projects.detail.estimateTbd")
        : isInternal && !project.startDate && !project.endDate
          ? t("pages.projects.internalOngoing")
          : `${
              project.startDate ? formatDisplayDate(project.startDate) : "-"
            } → ${project.endDate ? formatDisplayDate(project.endDate) : "-"}`;
      const timeline = isPeriodRow
        ? periodLine ?? contractTimeline
        : contractTimeline;

      const location = project.location?.trim() || null;
      const clientName = project.client?.name ?? null;
      const isLiveContractRow = kind === "in-progress";

      const stagePeriods = (
        kind === "payment-due" && focusPeriod
          ? [focusPeriod]
          : project.invoicePeriods
      ).map((p) => ({
        ...p,
        paymentTermsDays: project.paymentTermsDays,
      }));
      const paymentStage =
        kind === "payment-due" ? getPaymentDueStage(stagePeriods, now) : null;
      const dueLabel =
        paymentStage?.kind === "awaiting_payment" && paymentStage.dueAt != null
          ? t("pages.projects.dueOn", {
              date: formatDisplayDate(paymentStage.dueAt, { timeZone: "UTC" }),
            })
          : null;
      const stageLabel =
        paymentStage?.kind === "awaiting_invoice"
          ? t("pages.projects.awaitingInvoice")
          : paymentStage?.kind === "verifying"
            ? t("pages.projects.verifyingPayment")
            : dueLabel ??
              (paymentStage?.kind === "awaiting_payment"
                ? t("pages.projects.awaitingPayment")
                : null);

      const displayTitle = project.name;

      const hasOpenCollection = project.invoicePeriods.some((period) =>
        [
          "AWAITING_PAYMENT",
          "OVERDUE",
          "PENDING_VERIFICATION",
          "COMPILING",
          "AWAITING_CLIENT_REVIEW",
        ].includes(period.status)
      );
      const invoiceCycleDue =
        isLiveContractRow &&
        project.billingMode === "MONTHLY" &&
        project.status === "IN_PROGRESS" &&
        project.invoicePeriods.some((period) =>
          isMonthlyPeriodReadyToInvoice(
            { status: period.status, periodEnd: period.periodEnd },
            now
          )
        );
      const dueReconcilePeriod =
        isLiveContractRow &&
        project.billingMode === "MONTHLY" &&
        project.status === "IN_PROGRESS" &&
        canManage &&
        (filterView === "in-progress" || filterView === undefined)
          ? (project.invoicePeriods.find((period) =>
              isMonthlyPeriodAwaitingReconcile(
                {
                  status: period.status,
                  periodEnd: period.periodEnd,
                  reconciledAt: period.reconciledAt,
                },
                now
              )
            ) ?? null)
          : null;
      const regularBillingAction: "reconcile" | null = dueReconcilePeriod
        ? "reconcile"
        : null;
      const reconcileTarget = dueReconcilePeriod
        ? {
            periodId: dueReconcilePeriod.id,
            periodLabel:
              formatInvoicePeriodLabel(dueReconcilePeriod, {
                projectName: project.name,
                billingMode: project.billingMode,
                locale,
              }) ||
              dueReconcilePeriod.label ||
              t("pages.billing.thisBillingPeriod"),
            suggestedAmount:
              decimalToNumber(dueReconcilePeriod.amount) ??
              decimalToNumber(project.contractPrice),
          }
        : null;
      const canStart =
        canManage &&
        kind === "planning" &&
        (filterView === "planning" ||
          filterView === undefined ||
          filterView === "in-progress") &&
        project.status === PROJECT_PLANNING_STATUS;
      const canFinish =
        canManage &&
        isLiveContractRow &&
        !isInternal &&
        (filterView === "in-progress" || filterView === undefined) &&
        project.status === "IN_PROGRESS" &&
        isContractCycleSubCategory(project.subCategory);
      const canSubmitForApproval =
        canManage &&
        isLiveContractRow &&
        !isInternal &&
        (filterView === "in-progress" || filterView === undefined) &&
        project.status === "IN_PROGRESS" &&
        isMilestoneSubCategory(project.subCategory);
      const eligibleForMoveBack =
        canManage &&
        isLiveContractRow &&
        !isInternal &&
        (filterView === "in-progress" || filterView === undefined) &&
        project.status === "IN_PROGRESS";
      const canMoveToPlanning = eligibleForMoveBack && !hasOpenCollection;
      const moveBackBlockedByCollection =
        eligibleForMoveBack && hasOpenCollection;
      const canMarkPaid =
        canManage &&
        filterView === "payment-due" &&
        kind === "payment-due" &&
        paymentStage?.kind === "awaiting_payment" &&
        Boolean(paymentStage.unpaidPeriodId);
      const billingHref =
        filterView === "payment-due" && project.clientId
          ? projectBillingHref(project.clientId, project.id, focusPeriod?.id)
          : null;

      return {
        key,
        project,
        rowKind: kind,
        displayTitle,
        periodLine,
        timeline,
        location,
        clientName,
        dueLabel,
        stageLabel,
        paymentStage,
        invoiceCycleDue,
        regularBillingAction,
        reconcileTarget,
        canStart,
        canFinish,
        canSubmitForApproval,
        canMoveToPlanning,
        moveBackBlockedByCollection,
        canMarkPaid,
        billingHref,
        detailHref: focusPeriod?.id
          ? projectPeriodHref(project.id, focusPeriod.id)
          : projectDetailHref(project.id),
        typeLabel:
          project.subcategoryCatalog && !project.subcategoryCatalog.isSystem
            ? catalogDisplayName(project.subcategoryCatalog, locale)
            : localizeSubCategory(project.subCategory, locale),
      };
    })
  ) as ProjectTableRow[];

  const customAreas = serviceCatalog.filter((area) => !area.isSystem);
  const topChips = [
    ...PROJECT_DIRECTORY_TOP_CHIPS.map((key) => ({
      key,
      label: t(TOP_CHIP_LABEL_KEYS[key]),
      href: buildProjectsHref({
        clientId: filterClientId,
        view: filterView,
        area: key,
      }),
    })),
    ...customAreas.map((area) => ({
      key: toCustomChip(area.id),
      label: catalogDisplayName(area, locale),
      href: buildProjectsHref({
        clientId: filterClientId,
        view: filterView,
        area: toCustomChip(area.id),
      }),
    })),
  ];

  const selectedCatalogArea =
    customChipId(directoryChips.area)
      ? serviceCatalog.find((area) => area.id === customChipId(directoryChips.area))
      : serviceCatalog.find(
          (area) =>
            area.isSystem &&
            area.slug === directoryChips.area &&
            directoryChips.area !== "all" &&
            directoryChips.area !== "INTERNAL" &&
            directoryChips.area !== "ONE_TIME"
        );

  const subChips =
    directoryChips.area === "CLEANING"
      ? [
          ...CLEANING_DIRECTORY_SUB_CHIPS.map((row) => ({
            key: row.key,
            label: t(CLEANING_SUB_LABEL_KEYS[row.key]),
            href: buildProjectsHref({
              clientId: filterClientId,
              view: filterView,
              area: "CLEANING",
              sub: row.key,
            }),
          })),
          ...((
            serviceCatalog.find((area) => area.slug === "CLEANING")
              ?.subcategories ?? []
          )
            .filter((sub) => !sub.isSystem && sub.billingKind === "CONTRACT")
            .map((sub) => ({
              key: toCustomChip(sub.id),
              label: catalogDisplayName(sub, locale),
              href: buildProjectsHref({
                clientId: filterClientId,
                view: filterView,
                area: "CLEANING",
                sub: toCustomChip(sub.id),
              }),
            })) ?? []),
        ]
      : directoryChips.area === "ONE_TIME"
        ? [
            ...ONE_TIME_DIRECTORY_SUB_CHIPS.map((row) => ({
              key: row.key,
              label: t(ONE_TIME_SUB_LABEL_KEYS[row.key]),
              href: buildProjectsHref({
                clientId: filterClientId,
                view: filterView,
                area: "ONE_TIME",
                sub: row.key,
              }),
            })),
            ...serviceCatalog.flatMap((area) =>
              area.allowsOneTime
                ? area.subcategories
                    .filter(
                      (sub) => !sub.isSystem && sub.billingKind === "ONE_TIME"
                    )
                    .map((sub) => ({
                      key: toCustomChip(sub.id),
                      label:
                        sub.slug === "ONE_TIME"
                          ? catalogDisplayName(area, locale)
                          : catalogDisplayName(sub, locale),
                      href: buildProjectsHref({
                        clientId: filterClientId,
                        view: filterView,
                        area: "ONE_TIME",
                        sub: toCustomChip(sub.id),
                      }),
                    }))
                : []
            ),
          ]
        : directoryChips.area === "LANDSCAPING"
          ? [
              {
                key: "LANDSCAPING",
                label: t("pages.projects.directorySubLandscaping"),
                href: buildProjectsHref({
                  clientId: filterClientId,
                  view: filterView,
                  area: "LANDSCAPING",
                  sub: "LANDSCAPING",
                }),
              },
            ]
          : selectedCatalogArea && !selectedCatalogArea.isSystem
            ? selectedCatalogArea.subcategories
                .filter((sub) => sub.billingKind === "CONTRACT")
                .map((sub) => ({
                  key: toCustomChip(sub.id),
                  label: catalogDisplayName(sub, locale),
                  href: buildProjectsHref({
                    clientId: filterClientId,
                    view: filterView,
                    area: toCustomChip(selectedCatalogArea.id),
                    sub: toCustomChip(sub.id),
                  }),
                }))
            : [];

  // Planning + All Projects (same create affordance as the former first-row pattern on Planning).
  const showCreate =
    canManage && (filterView === "planning" || filterView === undefined);

  function sectionLabel(key: DirectorySectionKey): string {
    if (isSystemTopChip(key) && key !== "all") {
      return t(TOP_CHIP_LABEL_KEYS[key]);
    }
    const customId = customChipId(key);
    if (customId) {
      const area = serviceCatalog.find((item) => item.id === customId);
      if (area) return catalogDisplayName(area, locale);
    }
    return t("pages.projects.allTitle");
  }

  const sectionKeys: DirectorySectionKey[] =
    directoryChips.area === "all"
      ? [
          ...DIRECTORY_ALL_SECTION_ORDER,
          ...customAreas.map((area) => toCustomChip(area.id)),
        ]
      : directoryChips.area === "CLEANING" && !directoryChips.sub
        ? ["CLEANING"]
        : directoryChips.area === "ONE_TIME" && !directoryChips.sub
          ? ["ONE_TIME"]
          : [directoryChips.area as DirectorySectionKey];

  const typeSections = sectionKeys
    .map((key) => ({
      key,
      label: sectionLabel(key),
      rows: tableRows.filter((row) => {
        const section = directorySectionForProject({
          subCategory: row.project.subCategory,
          areaCatalogId: row.project.areaCatalogId,
          subcategoryCatalogIsSystem: row.project.subcategoryCatalog?.isSystem,
          subcategoryBillingKind: row.project.subcategoryCatalog?.billingKind,
          areaSystemArea: row.project.areaCatalog?.systemArea,
        });
        return section === key;
      }),
    }))
    .filter((section) => section.rows.length > 0);

  const usesItemCount =
    filterView === "payment-due" ||
    filterView === "pending-approval" ||
    directoryItems.some((item) => isDirectoryPeriodRow(item.kind));
  const sectionCountNoun = usesItemCount
    ? ("item" as const)
    : ("project" as const);
  const directoryCount = directoryItems.length;
  const filteredTitle =
    directoryChips.area === "all"
      ? null
      : isSystemTopChip(directoryChips.area)
        ? t(TOP_CHIP_LABEL_KEYS[directoryChips.area])
        : sectionLabel(directoryChips.area as DirectorySectionKey);
  const shellTitleKey = filterView
    ? copy.shellTitleKey
    : filteredTitle
      ? undefined
      : ("pages.projects.allTitle" as const);

  return (
    <AppShell
      titleKey={shellTitleKey}
      title={!shellTitleKey && filteredTitle ? filteredTitle : undefined}
    >
      <ProjectsListHeader
        listTitleKey={
          filterView
            ? copy.listTitleKey
            : filteredTitle
              ? undefined
              : "pages.projects.allTitle"
        }
        title={!filterView && filteredTitle ? filteredTitle : undefined}
        subCategory={undefined}
        count={directoryCount}
        countKind={sectionCountNoun}
        filterClient={
          filterClient
            ? {
                name: filterClient.name,
                clearHref: buildProjectsHref({
                  area: directoryChips.area,
                  sub: directoryChips.sub,
                  view: filterView,
                }),
              }
            : null
        }
        actions={
          canManage && filterView === "completed" && projects.length > 0 ? (
            <ProjectHistoryClearAllDialog
              projects={projects.map((project) => ({
                id: project.id,
                name: project.name,
                clientName: project.client?.name ?? null,
              }))}
            />
          ) : null
        }
      />

      {dueMonthlyReminders > 0 &&
      (filterView === "in-progress" ||
        filterView === "payment-due" ||
        filterView === undefined) ? (
        <SectionCard className="mb-4 border-amber-500/30 bg-card-tint-amber">
          <p className="font-medium text-amber-100">
            {t("pages.projects.cyclesReadyTitle", {
              count: dueMonthlyReminders,
            })}
          </p>
          {t("pages.projects.cyclesReadyDesc") ? (
            <p className="mt-1 text-sm text-muted">
              {t("pages.projects.cyclesReadyDesc")}
            </p>
          ) : null}
        </SectionCard>
      ) : null}

      {(SUBCATEGORY_CHIP_VIEWS.has(filterView) || showCreate) && (
        <div className="mb-5 space-y-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-4">
            {SUBCATEGORY_CHIP_VIEWS.has(filterView)
              ? topChips.map((pill) => {
                  const isActive =
                    pill.key === "all"
                      ? directoryChips.area === "all"
                      : directoryChips.area === pill.key;

                  return (
                    <DirectoryFilterTab
                      key={pill.key}
                      href={pill.href}
                      active={isActive}
                    >
                      {pill.label}
                    </DirectoryFilterTab>
                  );
                })
              : null}
            {canManage ? (
              <div className="ml-auto flex flex-wrap items-center justify-end gap-4">
                {showCreate ? (
                  <ProjectAddControl
                    employees={serializeDirectoryDecimals(staffEmployees)}
                    teams={serializeDirectoryDecimals(teamOptions)}
                    clients={serializeDirectoryDecimals(clients)}
                    catalog={serviceCatalog}
                    bankAccounts={bankAccounts}
                  />
                ) : null}
                <ProjectServiceAreaManageDialog catalog={serviceCatalog} />
              </div>
            ) : null}
          </div>
          {SUBCATEGORY_CHIP_VIEWS.has(filterView) && subChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {subChips.map((pill) => (
                <DirectoryFilterTab
                  key={pill.key}
                  href={pill.href}
                  active={directoryChips.sub === pill.key}
                >
                  {pill.label}
                </DirectoryFilterTab>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {typeSections.length === 0 ? (
        <SectionCard>
          <EmptyState
            titleKey={
              filterView === "planning"
                ? "pages.projects.emptyPlanning"
                : filterView === "in-progress"
                  ? "pages.projects.emptyInProgress"
                  : filterView === "pending-approval"
                    ? "pages.projects.emptyPendingApproval"
                    : filterView === "payment-due"
                      ? "pages.projects.emptyPaymentDue"
                      : filterView === "completed"
                        ? "pages.projects.emptyCompleted"
                        : "pages.projects.emptyAll"
            }
            descriptionKey={
              filterView === "planning"
                ? "pages.projects.emptyPlanningDesc"
                : filterView === "in-progress"
                  ? "pages.projects.emptyInProgressDesc"
                  : filterView === "pending-approval"
                    ? "pages.projects.emptyPendingApprovalDesc"
                    : filterView === "payment-due"
                      ? "pages.projects.emptyPaymentDueDesc"
                      : filterView === "completed"
                        ? "pages.projects.emptyCompletedDesc"
                        : "pages.projects.emptyAllDesc"
            }
          />
        </SectionCard>
      ) : (
        <div className="space-y-6">
          {typeSections.map((section) => (
            <section key={section.key}>
              <div className="mb-3">
                <h3 className="text-base font-semibold text-text">
                  {section.label}
                </h3>
                <p className="mt-0.5 text-sm text-muted">
                  {sectionCountNoun === "item"
                    ? t(
                        section.rows.length === 1
                          ? "pages.projects.itemOne"
                          : "pages.projects.itemOther",
                        { count: section.rows.length }
                      )
                    : t(
                        section.rows.length === 1
                          ? "pages.projects.projectOne"
                          : "pages.projects.projectOther",
                        { count: section.rows.length }
                      )}
                </p>
              </div>
              {(section.key === "CLEANING" || section.key === "LANDSCAPING") &&
              canManage &&
              (filterView === undefined ||
                filterView === "planning" ||
                filterView === "in-progress") ? (
                <p className="mb-3 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted">
                  {t("pages.projects.settleBeforePlanning")}
                </p>
              ) : null}
              <ProjectTable
                rows={section.rows}
                filterView={filterView}
                canManage={canManage}
                canOpenBilling={canOpenBilling}
                emptyMessage={t(copy.emptyMessageKey)}
                employees={serializeDirectoryDecimals(staffEmployees)}
                teams={serializeDirectoryDecimals(teamOptions)}
              />
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
