/**
 * Live dropdown sources for Excel bulk-import templates.
 *
 * Every template download must call these (or equivalent) so Lists values
 * match the current directory — never bake mutable entity names into
 * ColumnDef defaults. Soft-deleted / inactive rows use the same filters as
 * the ERP UI (active: true, status: ACTIVE, assignable project statuses).
 */
import type { ProjectStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Projects staff can still be assigned to (same as employee form / import). */
export const EMPLOYEE_TEMPLATE_ASSIGNABLE_PROJECT_STATUSES: ProjectStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
];

/** Active departments (EmployeeCategory) — excludes inactive / soft-off. */
export async function loadActiveEmployeeCategoriesForTemplate(
  companyId: string
) {
  return prisma.employeeCategory.findMany({
    where: {
      companyId,
      active: true,
      NOT: {
        OR: [
          { slug: "unassign" },
          { slug: "unassigned" },
          { prefix: { equals: "UNA", mode: "insensitive" } },
        ],
      },
    },
    select: { id: true, name: true, prefix: true, slug: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/** Active positions for active departments — excludes the legacy UNA category. */
export async function loadActivePositionsForTemplate(companyId: string) {
  return prisma.position.findMany({
    where: {
      companyId,
      active: true,
      category: {
        active: true,
        NOT: {
          OR: [
            { slug: "unassign" },
            { slug: "unassigned" },
            { prefix: { equals: "UNA", mode: "insensitive" } },
          ],
        },
      },
    },
    select: { name: true, categoryId: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

/** Assignable project names for employee import Project Names dropdown. */
export async function loadAssignableProjectNamesForTemplate(companyId: string) {
  const projects = await prisma.project.findMany({
    where: {
      companyId,
      status: { in: EMPLOYEE_TEMPLATE_ASSIGNABLE_PROJECT_STATUSES },
    },
    select: { name: true },
    orderBy: [{ name: "asc" }],
  });
  return projects.map((project) => project.name);
}

/** Active clients for project import Client dropdown (+ tax lookup). */
export async function loadActiveClientsForProjectTemplate(companyId: string) {
  return prisma.client.findMany({
    where: { companyId, active: true },
    select: { name: true, npwp: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/**
 * Active employees for project Staff Assigned lists.
 * Only staff on an active department (or no category) — matches UI roster.
 */
export async function loadActiveEmployeesForProjectTemplate(companyId: string) {
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      OR: [
        { categoryId: null },
        { category: { active: true } },
      ],
    },
    select: {
      employeeNo: true,
      firstName: true,
      lastName: true,
      category: { select: { name: true } },
    },
    orderBy: [
      { category: { sortOrder: "asc" } },
      { firstName: "asc" },
      { lastName: "asc" },
    ],
  });

  return employees.map((employee) => ({
    employeeNo: employee.employeeNo,
    firstName: employee.firstName,
    lastName: employee.lastName,
    categoryName: employee.category?.name ?? null,
  }));
}

export async function loadEmployeeImportTemplateLists(companyId: string) {
  const [categories, positions, projectNames] = await Promise.all([
    loadActiveEmployeeCategoriesForTemplate(companyId),
    loadActivePositionsForTemplate(companyId),
    loadAssignableProjectNamesForTemplate(companyId),
  ]);
  return { categories, positions, projectNames };
}

export async function loadProjectImportTemplateLists(companyId: string) {
  const [clients, categories, employees] = await Promise.all([
    loadActiveClientsForProjectTemplate(companyId),
    loadActiveEmployeeCategoriesForTemplate(companyId),
    loadActiveEmployeesForProjectTemplate(companyId),
  ]);
  return { clients, categories, employees };
}
