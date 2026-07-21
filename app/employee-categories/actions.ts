"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { reassignEmployeeNumber } from "@/lib/employee-number";
import {
  nextCompanyScopedSortOrder,
  persistCompanyScopedReorder,
} from "@/lib/persist-reorder";
import { slugify } from "@/lib/slug";
import { requireModule } from "@/lib/session";

async function assertCanManageCategories() {
  await requireModule("employees");
}

function parsePrefix(value: FormDataEntryValue | null): string {
  const prefix = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!prefix) {
    throw new Error("Department prefix is required.");
  }

  if (prefix.length < 2 || prefix.length > 6) {
    throw new Error("Department prefix must be 2-6 letters or numbers.");
  }

  return prefix;
}

async function resolveUniqueSlug(companyId: string, name: string, excludeId?: string) {
  const base = slugify(name) || "category";
  let slug = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.employeeCategory.findFirst({
      where: {
        companyId,
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (!existing) {
      return slug;
    }

    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function assertPrefixAvailable(
  companyId: string,
  prefix: string,
  excludeId?: string
) {
  const existing = await prisma.employeeCategory.findFirst({
    where: {
      companyId,
      prefix,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });

  if (existing) {
    throw new Error("Department prefix already in use.");
  }
}

export async function createEmployeeCategory(formData: FormData) {
  await assertCanManageCategories();

  const name = String(formData.get("name") ?? "").trim();
  const prefix = parsePrefix(formData.get("prefix"));

  if (!name) {
    throw new Error("Department name is required.");
  }

  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Company not found.");
  }

  await assertPrefixAvailable(company.id, prefix);

  const slug = await resolveUniqueSlug(company.id, name);
  const sortOrder = await nextCompanyScopedSortOrder(
    "employeeCategory",
    company.id
  );

  await prisma.employeeCategory.create({
    data: {
      name,
      slug,
      prefix,
      companyId: company.id,
      active: true,
      sortOrder,
    },
  });

  revalidatePath("/employees");
}

export async function reorderEmployeeCategories(ids: string[]) {
  await assertCanManageCategories();

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    throw new Error("Company not found.");
  }

  await persistCompanyScopedReorder("employeeCategory", {
    companyId: company.id,
    ids,
    mismatchError: "One or more departments are invalid for reorder.",
  });

  revalidatePath("/employees");
}

export async function updateEmployeeCategory(id: string, formData: FormData) {
  await assertCanManageCategories();

  const name = String(formData.get("name") ?? "").trim();
  const prefix = parsePrefix(formData.get("prefix"));
  const active = formData.get("active") === "true";

  if (!name) {
    throw new Error("Department name is required.");
  }

  const category = await prisma.employeeCategory.findUnique({
    where: { id },
  });

  if (!category) {
    throw new Error("Department not found.");
  }

  await assertPrefixAvailable(category.companyId, prefix, id);

  const slug = await resolveUniqueSlug(category.companyId, name, id);

  await prisma.employeeCategory.update({
    where: { id },
    data: {
      name,
      slug,
      prefix,
      active,
    },
  });

  revalidatePath("/employees");
}

export async function deleteEmployeeCategory(
  id: string,
  reassignToCategoryId: string | null = null
) {
  await assertCanManageCategories();

  const category = await prisma.employeeCategory.findUnique({
    where: { id },
  });

  if (!category) {
    throw new Error("Department not found.");
  }

  const assignedEmployees = await prisma.employee.findMany({
    where: { categoryId: id },
    select: { id: true },
  });

  if (assignedEmployees.length > 0) {
    if (!reassignToCategoryId) {
      throw new Error(
        "Choose another active department before deleting a department with employees."
      );
    }

    if (reassignToCategoryId === id) {
      throw new Error("Cannot reassign employees to the department being deleted.");
    }

    const target = await prisma.employeeCategory.findFirst({
      where: {
        id: reassignToCategoryId,
        companyId: category.companyId,
        active: true,
      },
    });

    if (!target) {
      throw new Error(
        "Choose another active department before deleting a department with employees."
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const employee of assignedEmployees) {
      const employeeNo = await reassignEmployeeNumber(
        employee.id,
        reassignToCategoryId!,
        tx
      );

      await tx.employee.update({
        where: { id: employee.id },
        data: {
          categoryId: reassignToCategoryId!,
          employeeNo,
        },
      });
    }

    await tx.employeeCategory.delete({
      where: { id },
    });
  });

  revalidatePath("/employees");
}
