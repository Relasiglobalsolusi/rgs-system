import { prisma } from "@/lib/prisma";
import { requireSession, getEmployeeForUser, toPermissionUser } from "@/lib/session";
import { getProjectWhereForUser } from "@/lib/project-access";
import {
  activeFieldStaffWhere,
  getAccessibleModules,
  getSessionAccountType,
  type ModuleKey,
} from "@/lib/permissions";
import { getMissingProgressReportsForEmployee } from "@/lib/progress-report-compliance";
import { getUnackedApprovedLeavesForEmployee } from "@/lib/leave-approval-notifications";
import {
  dueAtFromPaymentTerms,
  toUtcDateOnly,
} from "@/lib/invoice-period";

import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/ui/StatCard";
import DashboardSectionLabel from "@/components/dashboard/DashboardSectionLabel";
import DashboardCompactStat from "@/components/dashboard/DashboardCompactStat";
import DashboardAttendance from "@/components/dashboard/DashboardAttendance";
import DashboardActivityFeed from "@/components/dashboard/DashboardActivityFeed";
import DashboardProjectProgress from "@/components/dashboard/DashboardProjectProgress";
import MissingReportsWarning from "@/components/progress/MissingReportsWarning";
import LeaveApprovedNotification from "@/components/leaves/LeaveApprovedNotification";
import { buttonVariants } from "@/components/ui/button";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  FolderKanban,
  Users,
  ClipboardCheck,
  UserCog,
  Briefcase,
  Building2,
  FileText,
  Receipt,
  History,
  Wallet,
} from "lucide-react";

function hasModule(accessibleModules: ModuleKey[], module: ModuleKey) {
  return accessibleModules.includes(module);
}

/** Plain fields only — avoid Project.contractPrice (Prisma Decimal) at the client boundary. */
const activityFeedProgressSelect = {
  id: true,
  reportDate: true,
  notes: true,
  stageLabel: true,
  createdAt: true,
  project: { select: { name: true } },
  employee: { select: { firstName: true, lastName: true } },
  _count: { select: { photos: true } },
} as const;

export default async function DashboardPage() {
  const session = await requireSession();
  const t = createTranslator(await getServerLocale());
  const guestName = t("pages.dashboard.guestName");
  const employee = await getEmployeeForUser(session.user.id);
  const permissionUser = toPermissionUser(session);
  const accountType = getSessionAccountType({
    ...permissionUser,
    employee: employee
      ? {
          employeeNo: employee.employeeNo,
          employeeType: employee.employeeType,
        }
      : session.user.employee
        ? {
            employeeNo: session.user.employee.employeeNo,
            employeeType: session.user.employee.employeeType,
          }
        : null,
  });
  const isStaff = accountType === "Employee";

  const accessibleModules = getAccessibleModules({
    ...permissionUser,
    username: session.user.username,
    employee: employee
      ? {
          employeeNo: employee.employeeNo,
          employeeType: employee.employeeType,
        }
      : null,
  });

  const canViewProgress = hasModule(accessibleModules, "progress");
  const canViewLeaves = hasModule(accessibleModules, "leaves");
  const canViewCico = hasModule(accessibleModules, "cico");
  const canViewAttendance = hasModule(accessibleModules, "attendance");
  const canApprove = hasModule(accessibleModules, "approvals");
  const canViewProjects = hasModule(accessibleModules, "projects");
  const canViewEmployees = hasModule(accessibleModules, "employees");
  const canViewUsers = hasModule(accessibleModules, "users");
  const canViewClients = hasModule(accessibleModules, "clients");
  const canViewInvoicing = hasModule(accessibleModules, "invoicing");

  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
  });

  const today = toUtcDateOnly(new Date());

  if (isStaff) {
    const employeeId = employee?.id;
    const showWorkforcePresence = canViewAttendance;
    const showPersonalAttendance = canViewCico || canViewAttendance;
    const showActivityFeed = canViewProgress || canViewLeaves;

    const [
      pendingApprovals,
      fieldStaffCount,
      todayAttendances,
      todayAttendance,
      recentProgress,
      recentLeaves,
      myMissing,
      approvedLeaveNotices,
    ] = await Promise.all([
      canApprove
        ? prisma.leaveRequest.count({ where: { status: "PENDING" } })
        : canViewLeaves && employeeId
          ? prisma.leaveRequest.count({
              where: { employeeId, status: "PENDING" },
            })
          : Promise.resolve(0),
      showWorkforcePresence
        ? prisma.employee.count({ where: activeFieldStaffWhere })
        : Promise.resolve(0),
      showWorkforcePresence
        ? prisma.attendance.findMany({
            where: {
              date: today,
              employee: activeFieldStaffWhere,
            },
            select: { checkIn: true },
          })
        : Promise.resolve([]),
      showPersonalAttendance && employeeId
        ? prisma.attendance.findMany({
            where: { employeeId, date: today },
            select: {
              id: true,
              checkIn: true,
              checkOut: true,
              employee: {
                select: {
                  firstName: true,
                  lastName: true,
                  employeeNo: true,
                },
              },
            },
            take: 1,
          })
        : Promise.resolve([]),
      canViewProgress && employeeId
        ? prisma.progressReport.findMany({
            where: { employeeId },
            select: activityFeedProgressSelect,
            orderBy: { createdAt: "desc" },
            take: 8,
          })
        : Promise.resolve([]),
      canViewLeaves && employeeId
        ? prisma.leaveRequest.findMany({
            where: { employeeId },
            select: {
              id: true,
              type: true,
              status: true,
              createdAt: true,
              employee: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 8,
          })
        : Promise.resolve([]),
      canViewProgress && employeeId
        ? getMissingProgressReportsForEmployee(employeeId, session.user.id)
        : Promise.resolve([]),
      canViewLeaves && employeeId
        ? getUnackedApprovedLeavesForEmployee(employeeId, session.user.id)
        : Promise.resolve([]),
    ]);

    const staffPresentCount = todayAttendances.filter((a) => a.checkIn).length;
    const personalPresentCount = todayAttendance.filter((a) => a.checkIn).length;

    const statCards = [
      showWorkforcePresence ? (
        <StatCard
          key="staff-present"
          titleKey="pages.dashboard.staffPresentToday"
          value={`${staffPresentCount} / ${fieldStaffCount}`}
          subtitleKey="pages.dashboard.notCheckedIn"
          subtitleParams={{
            count: Math.max(fieldStaffCount - staffPresentCount, 0),
          }}
          icon={<Users size={24} />}
          accent="emerald"
        />
      ) : null,
      canApprove || canViewLeaves ? (
        <StatCard
          key="pending-approvals"
          titleKey="pages.dashboard.pendingApprovals"
          value={String(pendingApprovals)}
          subtitleKey={
            canApprove
              ? pendingApprovals > 0
                ? "pages.dashboard.requiresReview"
                : "pages.dashboard.allCaughtUp"
              : pendingApprovals > 0
                ? "pages.dashboard.awaitingManagerReview"
                : "pages.dashboard.noPendingRequests"
          }
          icon={<ClipboardCheck size={24} />}
          accent="amber"
        />
      ) : null,
    ].filter(Boolean);

    return (
      <AppShell
        titleKey="pages.dashboard.title"
        greetingName={session.user.name?.split(" ")[0] ?? guestName}
        descriptionKey="pages.dashboard.descriptionEmployee"
      >
        {myMissing.length > 0 && (
          <MissingReportsWarning warnings={myMissing} />
        )}
        {canViewLeaves && employee && (
          <LeaveApprovedNotification approvals={approvedLeaveNotices} />
        )}

        {statCards.length > 0 && (
          <>
            <DashboardSectionLabel
              titleKey="pages.dashboard.todaysOperations"
              descriptionKey="pages.dashboard.workforcePresence"
            />
            <div className="mb-6 grid grid-cols-1 gap-3 lg:mb-8 lg:grid-cols-2 lg:gap-4 xl:grid-cols-4">
              {statCards}
            </div>
          </>
        )}

        {(showPersonalAttendance || showActivityFeed) && (
          <div className="mb-6 flex flex-col gap-5 lg:mb-8 xl:grid xl:grid-cols-5 xl:gap-8">
            {showPersonalAttendance && (
              <div
                className={
                  showActivityFeed ? "xl:col-span-3" : "xl:col-span-5"
                }
              >
                <DashboardAttendance
                  records={todayAttendance}
                  presentCount={personalPresentCount}
                  totalEmployees={employee ? 1 : 0}
                  personal
                  canViewAttendanceReport={canViewAttendance}
                />
              </div>
            )}
            {showActivityFeed && (
              <div
                className={
                  showPersonalAttendance ? "xl:col-span-2" : "xl:col-span-5"
                }
              >
                <DashboardActivityFeed
                  recentProgress={recentProgress}
                  recentLeaves={recentLeaves}
                  showProgress={canViewProgress}
                  showLeaves={canViewLeaves}
                />
              </div>
            )}
          </div>
        )}
      </AppShell>
    );
  }

  // Client portal: only this client's projects and related site activity.
  if (accountType === "Client" && session.user.clientId) {
    const portalClientId = session.user.clientId;
    const showClientAttendance = canViewAttendance;
    const showClientProgress = canViewProgress;
    const showClientProjects = canViewProjects;

    const [
      activeProjects,
      totalProjects,
      siteStaffAssignments,
      todayAttendances,
      recentProgress,
      projects,
    ] = await Promise.all([
      showClientProjects
        ? prisma.project.count({
            where: { ...projectWhere, status: "IN_PROGRESS" },
          })
        : Promise.resolve(0),
      showClientProjects
        ? prisma.project.count({ where: projectWhere })
        : Promise.resolve(0),
      showClientProjects
        ? prisma.projectAssignment.findMany({
            where: {
              project: {
                ...projectWhere,
                status: { in: ["IN_PROGRESS", "PLANNED"] },
              },
              employee: activeFieldStaffWhere,
            },
            select: { employeeId: true },
            distinct: ["employeeId"],
          })
        : Promise.resolve([]),
      showClientAttendance
        ? prisma.attendance.findMany({
            where: {
              date: today,
              employee: activeFieldStaffWhere,
              project: { clientId: portalClientId },
            },
            select: {
              id: true,
              checkIn: true,
              checkOut: true,
              employee: {
                select: {
                  firstName: true,
                  lastName: true,
                  employeeNo: true,
                },
              },
            },
            orderBy: { checkIn: "desc" },
          })
        : Promise.resolve([]),
      showClientProgress
        ? prisma.progressReport.findMany({
            where: { project: { clientId: portalClientId } },
            select: activityFeedProgressSelect,
            orderBy: { createdAt: "desc" },
            take: 8,
          })
        : Promise.resolve([]),
      showClientProjects
        ? prisma.project.findMany({
            where: { ...projectWhere, status: { in: ["IN_PROGRESS", "PLANNED"] } },
            select: {
              id: true,
              name: true,
              location: true,
              status: true,
              _count: { select: { progressReports: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

    const siteStaffCount = siteStaffAssignments.length;
    const presentCount = todayAttendances.filter((a) => a.checkIn).length;

    const clientStatCards = [
      showClientAttendance ? (
        <StatCard
          key="staff-present"
          titleKey="pages.dashboard.staffPresentToday"
          value={`${presentCount} / ${siteStaffCount}`}
          subtitleKey="pages.dashboard.notCheckedInOnSites"
          subtitleParams={{
            count: Math.max(siteStaffCount - presentCount, 0),
          }}
          icon={<Users size={24} />}
          accent="emerald"
        />
      ) : null,
      showClientProjects ? (
        <StatCard
          key="active-projects"
          titleKey="pages.dashboard.activeProjects"
          value={String(activeProjects)}
          subtitleKey="pages.dashboard.totalForOrg"
          subtitleParams={{ count: totalProjects }}
          icon={<FolderKanban size={24} />}
          accent="cyan"
        />
      ) : null,
      showClientProjects ? (
        <StatCard
          key="site-staff"
          titleKey="pages.dashboard.siteStaffAssigned"
          value={String(siteStaffCount)}
          subtitleKey="pages.dashboard.fieldStaffOnSites"
          icon={<Users size={24} />}
          accent="sky"
        />
      ) : null,
    ].filter(Boolean);

    return (
      <AppShell
        titleKey="pages.dashboard.title"
        greetingName={session.user.name?.split(" ")[0] ?? guestName}
        descriptionKey="pages.dashboard.descriptionClient"
      >
        {clientStatCards.length > 0 && (
          <>
            <DashboardSectionLabel
              titleKey="pages.dashboard.yourProjects"
              descriptionKey="pages.dashboard.yourProjectsDesc"
            />
            <div className="mb-6 grid grid-cols-1 gap-3 lg:mb-8 lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
              {clientStatCards}
            </div>
          </>
        )}

        {(showClientAttendance || showClientProgress) && (
          <div className="mb-6 flex flex-col gap-5 lg:mb-8 xl:grid xl:grid-cols-5 xl:gap-8">
            {showClientAttendance && (
              <div
                className={
                  showClientProgress ? "xl:col-span-3" : "xl:col-span-5"
                }
              >
                <DashboardAttendance
                  records={todayAttendances.slice(0, 6)}
                  presentCount={presentCount}
                  totalEmployees={siteStaffCount}
                  canViewAttendanceReport={canViewAttendance}
                />
              </div>
            )}
            {showClientProgress && (
              <div
                className={
                  showClientAttendance ? "xl:col-span-2" : "xl:col-span-5"
                }
              >
                <DashboardActivityFeed
                  recentProgress={recentProgress}
                  recentLeaves={[]}
                  showProgress
                  showLeaves={false}
                />
              </div>
            )}
          </div>
        )}

        {showClientProjects && <DashboardProjectProgress projects={projects} />}
      </AppShell>
    );
  }

  // Vendor portal: Finance-scoped metrics for this vendor only (no HO-wide stats).
  if (accountType === "Vendor" && session.user.vendorId) {
    const portalVendorId = session.user.vendorId;

    if (!canViewInvoicing) {
      return (
        <AppShell
          titleKey="pages.dashboard.title"
          greetingName={session.user.name?.split(" ")[0] ?? guestName}
          descriptionKey="pages.dashboard.descriptionVendor"
        >
          {null}
        </AppShell>
      );
    }

    const invoices = await prisma.purchaseInvoice.findMany({
      where: {
        companyId: session.user.companyId,
        vendorId: portalVendorId,
      },
      select: {
        id: true,
        invoiceDate: true,
        includesPpn: true,
        taxInvoiceFilePath: true,
        vendor: { select: { paymentTermsDays: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const dueToday = toUtcDateOnly(new Date());
    let awaitingTax = 0;
    let taxUploaded = 0;
    let openBills = 0;
    let overdueBills = 0;

    for (const invoice of invoices) {
      if (invoice.taxInvoiceFilePath) {
        taxUploaded += 1;
      } else if (invoice.includesPpn) {
        awaitingTax += 1;
      }

      const termsDays = invoice.vendor?.paymentTermsDays ?? null;
      if (termsDays == null) {
        openBills += 1;
        continue;
      }
      const dueAt = dueAtFromPaymentTerms(invoice.invoiceDate, termsDays);
      if (dueAt.getTime() < dueToday.getTime()) {
        overdueBills += 1;
      } else {
        openBills += 1;
      }
    }

    const vendorStatCards = [
      <StatCard
        key="invoices"
        titleKey="pages.dashboard.vendorInvoices"
        value={String(invoices.length)}
        subtitleKey="pages.dashboard.vendorInvoicesDesc"
        icon={<FileText size={24} />}
        accent="cyan"
      />,
      <StatCard
        key="awaiting-tax"
        titleKey="pages.dashboard.vendorAwaitingTax"
        value={String(awaitingTax)}
        subtitleKey="pages.dashboard.vendorAwaitingTaxDesc"
        icon={<Receipt size={24} />}
        accent="amber"
      />,
      <StatCard
        key="tax-uploaded"
        titleKey="pages.dashboard.vendorTaxUploaded"
        value={String(taxUploaded)}
        subtitleKey="pages.dashboard.vendorTaxUploadedDesc"
        icon={<History size={24} />}
        accent="emerald"
      />,
      <StatCard
        key="payments"
        titleKey="pages.dashboard.vendorPayments"
        value={`${overdueBills} / ${openBills + overdueBills}`}
        subtitleKey="pages.dashboard.vendorPaymentsDesc"
        icon={<Wallet size={24} />}
        accent="sky"
      />,
    ];

    return (
      <AppShell
        titleKey="pages.dashboard.title"
        greetingName={session.user.name?.split(" ")[0] ?? guestName}
        descriptionKey="pages.dashboard.descriptionVendor"
      >
        <DashboardSectionLabel
          titleKey="pages.dashboard.yourBilling"
          descriptionKey="pages.dashboard.yourBillingDesc"
        />
        <div className="mb-6 grid grid-cols-1 gap-3 lg:mb-8 lg:grid-cols-2 lg:gap-4 xl:grid-cols-4">
          {vendorStatCards}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/billing/purchase-invoices"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {t("pages.dashboard.vendorOpenInvoices")}
          </Link>
          <Link
            href="/billing/purchase-invoices?view=tax"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {t("pages.dashboard.vendorOpenTax")}
          </Link>
          <Link
            href="/billing/purchase-invoices?view=payments"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {t("pages.dashboard.vendorOpenPayments")}
          </Link>
        </div>
      </AppShell>
    );
  }

  const showAdminAttendance = canViewAttendance;
  const showAdminProgress = canViewProgress;
  const showAdminLeaves = canViewLeaves;
  const showAdminProjects = canViewProjects;
  const showAdminEmployees = canViewEmployees;
  const showAdminUsers = canViewUsers;
  const showAdminClients = canViewClients;
  const showSystemOverview =
    showAdminUsers || showAdminClients || showAdminEmployees || showAdminProjects;

  const [
    activeProjects,
    totalEmployees,
    fieldStaffCount,
    todayAttendances,
    pendingLeaves,
    recentProgress,
    recentLeaves,
    adminStats,
    myMissing,
  ] = await Promise.all([
    showAdminProjects
      ? prisma.project.count({
          where: { ...projectWhere, status: "IN_PROGRESS" },
        })
      : Promise.resolve(0),
    showAdminEmployees
      ? prisma.employee.count({ where: { status: "ACTIVE" } })
      : Promise.resolve(0),
    showAdminAttendance
      ? prisma.employee.count({ where: activeFieldStaffWhere })
      : Promise.resolve(0),
    showAdminAttendance
      ? prisma.attendance.findMany({
          where: {
            date: today,
            employee: activeFieldStaffWhere,
          },
          select: {
            id: true,
            checkIn: true,
            checkOut: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeNo: true,
              },
            },
          },
          orderBy: { checkIn: "desc" },
        })
      : Promise.resolve([]),
    canApprove
      ? prisma.leaveRequest.count({ where: { status: "PENDING" } })
      : Promise.resolve(0),
    showAdminProgress
      ? prisma.progressReport.findMany({
          select: activityFeedProgressSelect,
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    showAdminLeaves
      ? prisma.leaveRequest.findMany({
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            employee: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    showSystemOverview
      ? Promise.all([
          showAdminUsers ? prisma.user.count() : Promise.resolve(0),
          showAdminClients
            ? prisma.client.count({ where: { active: true } })
            : Promise.resolve(0),
          showAdminEmployees ? prisma.employeeCategory.count() : Promise.resolve(0),
          showAdminProjects ? prisma.project.count() : Promise.resolve(0),
        ]).then(([users, clients, departments, projects]) => ({
          users,
          clients,
          departments,
          projects,
        }))
      : Promise.resolve({ users: 0, clients: 0, departments: 0, projects: 0 }),
    canViewProgress && employee
      ? getMissingProgressReportsForEmployee(employee.id, session.user.id)
      : Promise.resolve([]),
  ]);

  const presentCount = todayAttendances.filter((a) => a.checkIn).length;

  const projects = showAdminProjects
    ? await prisma.project.findMany({
        where: { ...projectWhere, status: { in: ["IN_PROGRESS", "PLANNED"] } },
        select: {
          id: true,
          name: true,
          location: true,
          status: true,
          _count: { select: { progressReports: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      })
    : [];

  const adminStatCards = [
    showAdminAttendance ? (
      <StatCard
        key="staff-present"
        titleKey="pages.dashboard.staffPresentToday"
        value={`${presentCount} / ${fieldStaffCount}`}
        subtitleKey="pages.dashboard.notCheckedIn"
        subtitleParams={{
          count: Math.max(fieldStaffCount - presentCount, 0),
        }}
        icon={<Users size={24} />}
        accent="emerald"
      />
    ) : null,
    canApprove ? (
      <StatCard
        key="pending-approvals"
        titleKey="pages.dashboard.pendingApprovals"
        value={String(pendingLeaves)}
        subtitleKey={
          pendingLeaves > 0
            ? "pages.dashboard.requiresReview"
            : "pages.dashboard.allCaughtUp"
        }
        icon={<ClipboardCheck size={24} />}
        accent="amber"
      />
    ) : null,
    showAdminProjects ? (
      <StatCard
        key="active-projects"
        titleKey="pages.dashboard.activeProjects"
        value={String(activeProjects)}
        subtitleKey="pages.dashboard.totalInSystem"
        subtitleParams={{ count: adminStats.projects }}
        icon={<FolderKanban size={24} />}
        accent="cyan"
      />
    ) : null,
    showAdminEmployees ? (
      <StatCard
        key="active-employees"
        titleKey="pages.dashboard.activeEmployees"
        value={String(totalEmployees)}
        subtitleKey="pages.dashboard.currentlyOnPayroll"
        icon={<Users size={24} />}
        accent="sky"
      />
    ) : null,
  ].filter(Boolean);

  const systemOverviewStats = [
    showAdminUsers ? (
      <DashboardCompactStat
        key="users"
        labelKey="pages.dashboard.systemUsers"
        value={adminStats.users}
        hintKey="pages.dashboard.loginAccounts"
        icon={<UserCog size={18} />}
        iconClassName="bg-card-tint-sky text-sky-300"
      />
    ) : null,
    showAdminClients ? (
      <DashboardCompactStat
        key="clients"
        labelKey="pages.dashboard.activeClients"
        value={adminStats.clients}
        hintKey="pages.dashboard.availableForProjects"
        icon={<Briefcase size={18} />}
        iconClassName="bg-card-tint-emerald text-emerald-300"
      />
    ) : null,
    showAdminEmployees ? (
      <DashboardCompactStat
        key="departments"
        labelKey="pages.dashboard.departments"
        value={adminStats.departments}
        hintKey="pages.dashboard.employeeCategories"
        icon={<Building2 size={18} />}
        iconClassName="bg-card-tint-teal text-primary"
      />
    ) : null,
    showAdminProjects ? (
      <DashboardCompactStat
        key="projects"
        labelKey="pages.dashboard.totalProjects"
        value={adminStats.projects}
        hintKey="pages.dashboard.inProgressCount"
        hintParams={{ count: activeProjects }}
        icon={<FolderKanban size={18} />}
        iconClassName="bg-card-tint-cyan text-teal-300"
      />
    ) : null,
  ].filter(Boolean);

  const showAdminActivityFeed = showAdminProgress || showAdminLeaves;

  return (
    <AppShell
      titleKey="pages.dashboard.title"
      greetingName={session.user.name?.split(" ")[0] ?? guestName}
      descriptionKey="pages.dashboard.descriptionAdmin"
    >
      {myMissing.length > 0 && (
        <MissingReportsWarning warnings={myMissing} />
      )}

      {adminStatCards.length > 0 && (
        <>
          <DashboardSectionLabel
            titleKey="pages.dashboard.todaysOperations"
            descriptionKey="pages.dashboard.todaysOperationsDesc"
          />
          <div className="mb-6 grid grid-cols-1 gap-3 lg:mb-8 lg:grid-cols-2 lg:gap-4 xl:grid-cols-4">
            {adminStatCards}
          </div>
        </>
      )}

      {systemOverviewStats.length > 0 && (
        <>
          <DashboardSectionLabel
            titleKey="pages.dashboard.systemOverview"
            descriptionKey="pages.dashboard.systemOverviewDesc"
          />
          <div className="mb-6 grid grid-cols-1 gap-3 lg:mb-8 lg:grid-cols-2 lg:gap-4 xl:grid-cols-4">
            {systemOverviewStats}
          </div>
        </>
      )}

      {(showAdminAttendance || showAdminActivityFeed) && (
        <div className="mb-6 flex flex-col gap-5 lg:mb-8 xl:grid xl:grid-cols-5 xl:gap-8">
          {showAdminAttendance && (
            <div
              className={
                showAdminActivityFeed ? "xl:col-span-3" : "xl:col-span-5"
              }
            >
              <DashboardAttendance
                records={todayAttendances.slice(0, 6)}
                presentCount={presentCount}
                totalEmployees={fieldStaffCount}
                canViewAttendanceReport={canViewAttendance}
              />
            </div>
          )}
          {showAdminActivityFeed && (
            <div
              className={
                showAdminAttendance ? "xl:col-span-2" : "xl:col-span-5"
              }
            >
              <DashboardActivityFeed
                recentProgress={recentProgress}
                recentLeaves={recentLeaves}
                showProgress={showAdminProgress}
                showLeaves={showAdminLeaves}
              />
            </div>
          )}
        </div>
      )}

      {showAdminProjects && <DashboardProjectProgress projects={projects} />}
    </AppShell>
  );
}
