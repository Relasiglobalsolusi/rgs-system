"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createDepartment(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  const description = String(
    formData.get("description") ?? ""
  ).trim();

  if (!name) {
    throw new Error("Department name is required.");
  }

  if (!code) {
    throw new Error("Department code is required.");
  }

  const company = await prisma.company.findFirst();

  if (!company) {
    throw new Error("Company not found.");
  }

  const exists = await prisma.department.findFirst({
    where: {
      companyId: company.id,
      code,
    },
  });

  if (exists) {
    throw new Error("Department code already exists.");
  }

  await prisma.department.create({
    data: {
      name,
      code,
      description,
      companyId: company.id,
      active: true,
    },
  });

  revalidatePath("/departments");
}

export async function updateDepartment(
  id: string,
  formData: FormData
) {
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  const description = String(
    formData.get("description") ?? ""
  ).trim();
  const active = formData.get("active") === "true";

  const department = await prisma.department.findUnique({
    where: {
      id,
    },
  });

  if (!department) {
    throw new Error("Department not found.");
  }

  const duplicate = await prisma.department.findFirst({
    where: {
      companyId: department.companyId,
      code,
      NOT: {
        id,
      },
    },
  });

  if (duplicate) {
    throw new Error("Department code already exists.");
  }

  await prisma.department.update({
    where: {
      id,
    },
    data: {
      name,
      code,
      description,
      active,
    },
  });

  revalidatePath("/departments");
}

export async function deleteDepartment(id: string) {
  const employeeCount = await prisma.employee.count({
    where: {
      departmentId: id,
    },
  });

  if (employeeCount > 0) {
    throw new Error(
      "Cannot delete a department that still has employees."
    );
  }

  await prisma.department.delete({
    where: {
      id,
    },
  });

  revalidatePath("/departments");
}