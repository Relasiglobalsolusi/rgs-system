import { redirect } from "next/navigation";
import type { ProjectSubCategory } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { requireSession, toPermissionUser } from "@/lib/session";

import { getProjectWhereForUser, canManageProjects } from "@/lib/project-access";
import { formatDisplayDate } from "@/lib/format-date";
import {
  isProjectSubCategory,
  PROJECT_SUB_CATEGORIES,
} from "@/lib/project-subcategory";
import {
  localizeSubCategory,
  localizeSubCategoryShort,
} from "@/lib/i18n/labels";
import {
  getMostUrgentUnpaidPeriod,
  getPaymentDueStage,
  isUnpaidInvoiceStatus,
  paymentDueWhere,
  projectHistoryWhere,
} from "@/lib/billing";
import {
  decimalToNumber,
  formatInvoicePeriodLabel,
  formatProjectTitle,
} from "@/lib/project-billing";
import {
  isMonthlyPeriodAwaitingReconcile,
  isMonthlyPeriodReadyToInvoice,
} from "@/lib/invoice-period";
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
  "payment-due",
  "completed",
] as const;
type ProjectListView = (typeof PROJECT_LIST_VIEWS)[number];

/** Views that keep Regular / General / Facade chips (not Payment Due / Completed). */
const SUBCATEGORY_CHIP_VIEWS = new Set<ProjectListView | undefined>([
  undefined,
  "planning",
  "in-progress",
]);

/** Directory tables: Regular → Facade → General (empty types hidden). */
const PROJECT_DIRECTORY_TYPE_ORDER = [
  "REGULAR_CLEANING",
  "FACADE_CLEANING",
  "GENERAL_CLEANING",
] as const satisfies readonly ProjectSubCategory[];

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
  subCategory?: string;
  view?: ProjectListView;
}) {
  const params = new URLSearchParams();
  if (opts.clientId) params.set("clientId", opts.clientId);
  if (opts.view) params.set("view", opts.view);
  if (opts.subCategory) params.set("subCategory", opts.subCategory);
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
  }>;
}) {
  const session = await requireSession();
  const {
    clientId: filterClientId,
    subCategory: filterSubCategoryRaw,
    view: filterViewRaw,
  } = await searchParams;

  // Prefer ?view=completed; keep ?view=history as a redirect alias.
  if (filterViewRaw === "history") {
    const params = new URLSearchParams();
    params.set("view", "completed");
    if (filterClientId) params.set("clientId", filterClientId);
    if (filterSubCategoryRaw) params.set("subCategory", filterSubCategoryRaw);
    redirect(`/projects?${params.toString()}`);
  }

  const filterView = resolveProjectListView(filterViewRaw);

  const filterSubCategory =
    SUBCATEGORY_CHIP_VIEWS.has(filterView) &&
    filterSubCategoryRaw &&
    isProjectSubCategory(filterSubCategoryRaw)
      ? filterSubCategoryRaw
      : undefined;

  const permissionUser = toPermissionUser(session);
  const canManage = canManageProjects(permissionUser);
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const copy = viewCopy(filterView);

  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
  });

  const company = await prisma.company.findFirst();

  if (!company) {
    return (
      <AppShell titleKey="pages.projects.title">
        <SectionCard>
          <p className="text-text">{t("pages.projects.companyNotFound")}</p>
        </SectionCard>
      </AppShell>
    );
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

  // Lifecycle: All | Planning | In Progress | Payment Due | History.
  // Planning is PLANNED-only so Move to In Progress removes the row immediately.
  const viewWhere =
    filterView === "planning"
      ? { status: { in: [...PROJECT_PLANNING_LIST_STATUSES] } }
      : filterView === "in-progress"
        ? { status: { in: [...PROJECT_IN_PROGRESS_LIST_STATUSES] } }
        : filterView === "payment-due"
          ? paymentDueWhere()
          : filterView === "completed"
            ? projectHistoryWhere()
            : { status: { in: [...PROJECT_ALL_LIST_STATUSES] } };

  const [projectsFetched, employees, clients, filterClient, dueMonthlyReminders] =
    await Promise.all([
      prisma.project.findMany({
        where: {
          ...projectWhere,
          ...viewWhere,
          // Portal clients are already scoped; ignore cross-client query filters.
          ...(!session.user.clientId && filterClientId
            ? { clientId: filterClientId }
            : {}),
          ...(filterSubCategory ? { subCategory: filterSubCategory } : {}),
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
              amount: true,
              taxInvoiceRequired: true,
              taxInvoiceDoneAt: true,
              taxInvoiceDocumentPath: true,
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
              ],
            },
            include: {
              category: { select: { name: true, prefix: true, slug: true } },
              jobPosition: { select: { name: true, slug: true } },
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
    ]);

  // Strip Prisma Decimal so project rows are safe for Client Components
  // (ProjectDirectoryActions / ProjectEditDialog). Keep numeric contract price
  // for directory Reconcile suggested amounts.
  const projectsRaw = projectsFetched.map(
    ({ contractPrice, ...rest }) => ({
      ...rest,
      contractPrice: decimalToNumber(contractPrice),
    })
  );

  const now = new Date();
  const projectsSorted =
    filterView === "payment-due"
      ? [...projectsRaw].sort((a, b) => {
          const aStage = getPaymentDueStage(
            a.invoicePeriods.map((p) => ({
              ...p,
              paymentTermsDays: a.client?.paymentTermsDays,
            })),
            now
          );
          const bStage = getPaymentDueStage(
            b.invoicePeriods.map((p) => ({
              ...p,
              paymentTermsDays: b.client?.paymentTermsDays,
            })),
            now
          );
          // Unpaid / late first (by due date); awaiting invoice last.
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

  /**
   * Payment Due: one row per unpaid milestone installment.
   * Active / Completed: one row per project (completed never expands by period).
   */
  type DirectoryItem = {
    key: string;
    project: (typeof projectsSorted)[number];
    focusPeriod:
      | (typeof projectsSorted)[number]["invoicePeriods"][number]
      | null;
  };

  const directoryItems: DirectoryItem[] = [];
  for (const project of projectsSorted) {
    if (filterView === "payment-due" && project.billingMode === "MILESTONE") {
      const unpaid = project.invoicePeriods
        .filter((p) => isUnpaidInvoiceStatus(p.status))
        .sort((a, b) => {
          const aDue = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
          const bDue = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
          if (aDue !== bDue) return aDue - bDue;
          return (a.milestonePercent ?? 0) - (b.milestonePercent ?? 0);
        });
      if (unpaid.length > 0) {
        for (const period of unpaid) {
          directoryItems.push({
            key: `${project.id}:${period.id}`,
            project,
            focusPeriod: period,
          });
        }
        continue;
      }
    }

    directoryItems.push({
      key: project.id,
      project,
      focusPeriod:
        filterView === "completed"
          ? null
          : getMostUrgentUnpaidPeriod(
              project.invoicePeriods.map((p) => ({
                ...p,
                paymentTermsDays: project.client?.paymentTermsDays,
              })),
              now
            ),
    });
  }

  const projects = projectsSorted;

  const tableRows: ProjectTableRow[] = directoryItems.map(
    ({ key, project, focusPeriod }) => {
      const isPlanningCard = project.status === PROJECT_PLANNING_STATUS;
      const timeline = isPlanningCard
        ? project.estimatedStartDate
          ? `Est. start ${formatDisplayDate(project.estimatedStartDate)}`
          : "Estimate TBD"
        : `${
            project.startDate ? formatDisplayDate(project.startDate) : "-"
          } → ${project.endDate ? formatDisplayDate(project.endDate) : "-"}`;

      const location = project.location?.trim() || null;
      const clientName = project.client?.name ?? null;

      const stagePeriods = (
        filterView === "payment-due" && focusPeriod
          ? [focusPeriod]
          : project.invoicePeriods
      ).map((p) => ({
        ...p,
        paymentTermsDays: project.client?.paymentTermsDays,
      }));
      const paymentStage =
        filterView === "payment-due"
          ? getPaymentDueStage(stagePeriods, now)
          : null;
      const dueLabel =
        paymentStage?.kind === "awaiting_payment" && paymentStage.dueAt != null
          ? `Due ${formatDisplayDate(paymentStage.dueAt, { timeZone: "UTC" })}`
          : null;
      const stageLabel =
        paymentStage?.kind === "awaiting_invoice"
          ? "Awaiting Invoice"
          : paymentStage?.kind === "verifying"
            ? "Verifying Payment"
            : dueLabel ??
              (paymentStage?.kind === "awaiting_payment"
                ? "Awaiting Payment"
                : null);

      const displayTitle = formatProjectTitle(
        project.name,
        filterView === "completed" ? null : focusPeriod,
        locale
      );

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
        project.billingMode === "MONTHLY" &&
        project.status === "IN_PROGRESS" &&
        project.invoicePeriods.some((period) =>
          isMonthlyPeriodReadyToInvoice(
            { status: period.status, periodEnd: period.periodEnd },
            now
          )
        );
      const dueReconcilePeriod =
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
              project.contractPrice,
          }
        : null;
      const canStart =
        canManage &&
        (filterView === "planning" ||
          filterView === undefined ||
          filterView === "in-progress") &&
        project.status === PROJECT_PLANNING_STATUS;
      const canFinish =
        canManage &&
        (filterView === "in-progress" || filterView === undefined) &&
        project.status === "IN_PROGRESS";
      const eligibleForMoveBack =
        canManage &&
        (filterView === "in-progress" || filterView === undefined) &&
        (project.status === "IN_PROGRESS" || project.status === "ON_HOLD");
      const canMoveToPlanning = eligibleForMoveBack && !hasOpenCollection;
      const moveBackBlockedByCollection =
        eligibleForMoveBack && hasOpenCollection;
      const canMarkPaid =
        canManage &&
        filterView === "payment-due" &&
        paymentStage?.kind === "awaiting_payment" &&
        Boolean(paymentStage.unpaidPeriodId);
      const billingHref =
        filterView === "payment-due" && project.clientId
          ? `/billing/${project.clientId}/${project.id}`
          : null;

      return {
        key,
        project,
        displayTitle,
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
        canMoveToPlanning,
        moveBackBlockedByCollection,
        canMarkPaid,
        billingHref,
        detailHref: `/projects/${project.id}`,
      };
    }
  );

  const filterPills = [
    {
      key: "all",
      label: t("common.actions.all"),
      href: buildProjectsHref({
        clientId: filterClientId,
        view: filterView,
      }),
    },
    ...PROJECT_SUB_CATEGORIES.map((value) => ({
      key: value,
      label: localizeSubCategoryShort(value, locale),
      href: buildProjectsHref({
        clientId: filterClientId,
        view: filterView,
        subCategory: value,
      }),
    })),
  ];

  // Planning + All Projects (same create affordance as the former first-row pattern on Planning).
  const showCreate =
    canManage && (filterView === "planning" || filterView === undefined);

  const typeSections = PROJECT_DIRECTORY_TYPE_ORDER.map((subCategory) => {
    const rows = tableRows.filter(
      (row) => row.project.subCategory === subCategory
    );
    return {
      key: subCategory,
      label: localizeSubCategoryShort(subCategory, locale),
      rows,
    };
  }).filter((section) => section.rows.length > 0);

  const sectionCountNoun =
    filterView === "payment-due" ? ("item" as const) : ("project" as const);
  const directoryCount =
    filterView === "payment-due" ? directoryItems.length : projects.length;
  const shellTitleKey = filterView
    ? copy.shellTitleKey
    : filterSubCategory
      ? undefined
      : ("pages.projects.allTitle" as const);

  return (
    <AppShell
      titleKey={shellTitleKey}
      title={
        !shellTitleKey && filterSubCategory
          ? localizeSubCategory(filterSubCategory, locale)
          : undefined
      }
    >
      <ProjectsListHeader
        listTitleKey={
          filterView
            ? copy.listTitleKey
            : filterSubCategory
              ? undefined
              : "pages.projects.allTitle"
        }
        subCategory={filterView ? undefined : filterSubCategory}
        count={directoryCount}
        countKind={sectionCountNoun}
        filterClient={
          filterClient
            ? {
                name: filterClient.name,
                clearHref: buildProjectsHref({
                  subCategory: filterSubCategory,
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {SUBCATEGORY_CHIP_VIEWS.has(filterView)
            ? filterPills.map((pill) => {
                const isActive =
                  pill.key === "all"
                    ? !filterSubCategory
                    : filterSubCategory === pill.key;

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
          {showCreate ? (
            <ProjectAddControl employees={employees} clients={clients} />
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
              {section.key === "REGULAR_CLEANING" &&
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
                emptyMessage={t(copy.emptyMessageKey)}
                employees={employees}
              />
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
