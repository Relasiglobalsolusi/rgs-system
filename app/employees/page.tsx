import { prisma } from "@/lib/prisma";

import { canManageEmployees } from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import PageIntro from "@/components/i18n/PageIntro";
import T from "@/components/i18n/T";

import EmployeeDirectory from "@/components/employees/EmployeeDirectory";

const ASSIGNABLE_STATUSES = ["PLANNED", "IN_PROGRESS", "ON_HOLD"] as const;

export default async function EmployeesPage() {
  const session = await requireModule("employees");
  const permissionUser = toPermissionUser(session);
  const canManage = canManageEmployees(permissionUser);
  const canArchive = canManage;

  const company = await prisma.company.findFirst();

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
          },
        },
        _count: {
          select: {
            employees: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.project.findMany({
      where: {
        companyId: company.id,
        status: { in: [...ASSIGNABLE_STATUSES] },
      },
      select: {
        id: true,
        name: true,
        location: true,
        status: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

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
        employees={employees}
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
        positions={positionOptions}
        managePositions={canManage ? positions : undefined}
        projects={projects}
        canManage={canManage}
        canArchive={canArchive}
      />
    </AppShell>
  );
}
