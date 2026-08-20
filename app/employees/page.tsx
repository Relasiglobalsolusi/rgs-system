import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";

import {
  filterPositionsForEmployeeCreateActor,
  resolveEmployeeCreateActorTier,
} from "@/lib/employee-create-hierarchy";
import {
  backfillSecurityDepositRequiredForSiteRoles,
  ensureWorkforceDepartments,
} from "@/lib/positions";
import { applyResignIfLastDayReachedMany } from "@/lib/employee-resign";
import { canManageEmployees, canResignEmployees } from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import PageIntro from "@/components/i18n/PageIntro";
import T from "@/components/i18n/T";

import EmployeeDirectory from "@/components/employees/EmployeeDirectory";

const AREA_MANAGER_PROJECT_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "WAITING_FOR_APPROVAL",
  "OFF_SITE",
  "ON_HOLD",
  "COMPLETED",
] as const;

export default async function EmployeesPage() {
  const session = await requireModule("employees");
  const permissionUser = toPermissionUser(session);
  const canManage = canManageEmployees(permissionUser);
  const canResign = canResignEmployees(permissionUser);
  const canArchive = canManage;
  const createActorTier = await resolveEmployeeCreateActorTier(session);

  const company = await prisma.company.findFirst();

  if (company) {
    // Keep Corporate / Warehouse (WRH) / Operations + default positions present.
    await ensureWorkforceDepartments(prisma, company.id);
    await backfillSecurityDepositRequiredForSiteRoles(prisma, company.id);
  }

  if (!company) {
    return (
      <AppShell
        titleKey="pages.employees.title"
        descriptionKey="pages.employees.description"
      >
        <p className="rounded-2xl border border-border bg-elevated p-8 text-text">
          <T k="pages.employees.companyNotFound" />
        </p>
      </AppShell>
    );
  }

  const [employees, categories, positions, projects] = await Promise.all([
    prisma.employee.findMany({
      where: {
        companyId: company.id,
        archivedFromDirectory: false,
      },
      include: {
        category: true,
        jobPosition: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        areaManagedProjects: {
          select: {
            projectId: true,
          },
        },
        operationsTeamMembership: {
          select: {
            team: { select: { name: true } },
          },
        },
        projectAssignments: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
          orderBy: {
            project: {
              name: "asc",
            },
          },
        },
        user: {
          select: {
            username: true,
            active: true,
          },
        },
        _count: {
          select: {
            leaveRequests: { where: { status: "PENDING" } },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { employeeNo: "asc" }],
    }),
    prisma.employeeCategory.findMany({
      where: {
        companyId: company.id,
      },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.position.findMany({
      where: {
        companyId: company.id,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            prefix: true,
            sortOrder: true,
          },
        },
        _count: {
          select: {
            employees: true,
          },
        },
      },
      orderBy: [
        { category: { sortOrder: "asc" } },
        { category: { name: "asc" } },
        { sortOrder: "asc" },
        { name: "asc" },
      ],
    }),
    prisma.project.findMany({
      where: {
        companyId: company.id,
        subCategory: { not: "INTERNAL" },
        status: { in: [...AREA_MANAGER_PROJECT_STATUSES] },
      },
      select: {
        id: true,
        name: true,
        location: true,
        status: true,
        client: { select: { name: true } },
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  await applyResignIfLastDayReachedMany(
    prisma,
    employees.map((employee) => employee.id)
  );

  const employeeRows = employees.map((employee) => ({
    ...employee,
    basePay: decimalToNumber(employee.basePay),
    jkkPercent: decimalToNumber(employee.jkkPercent),
    depositHeldAmount: decimalToNumber(employee.depositHeldAmount) ?? 0,
    hasPendingLeaveRequest: employee._count.leaveRequests > 0,
  }));

  const categoryOptions = categories
    .filter(
      (category) =>
        category.active &&
        category.slug !== "finance" &&
        category.prefix.toUpperCase() !== "FIN"
    )
    .map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      prefix: category.prefix,
      active: category.active,
      sortOrder: category.sortOrder,
    }));

  const positionOptions = positions.map((position) => ({
    id: position.id,
    categoryId: position.categoryId,
    slug: position.slug,
    name: position.name,
    description: position.description,
    active: position.active,
    sortOrder: position.sortOrder,
  }));

  const assignablePositions = filterPositionsForEmployeeCreateActor(
    createActorTier,
    positionOptions
  );

  return (
    <AppShell
      titleKey="pages.employees.title"
      descriptionKey={
        canManage
          ? "pages.employees.descriptionManage"
          : "pages.employees.descriptionReadonly"
      }
    >
      <PageIntro
        titleKey="pages.employees.directoryTitle"
        descriptionKey="pages.employees.directoryDesc"
      />

      <EmployeeDirectory
        employees={employeeRows}
        categories={categoryOptions}
        manageCategories={
          canManage
            ? categories.filter(
                (category) =>
                  category.slug !== "finance" &&
                  category.prefix.toUpperCase() !== "FIN"
              )
            : undefined
        }
        positions={assignablePositions}
        managePositions={canManage ? positions : undefined}
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          location: project.location,
          status: project.status,
          clientName: project.client?.name ?? null,
        }))}
        canManage={canManage}
        canResign={canResign}
        canArchive={canArchive}
        createActorTier={createActorTier}
      />
    </AppShell>
  );
}
