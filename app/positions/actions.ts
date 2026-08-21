"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { canManageEmployees } from "@/lib/project-access";
import { positionSlugFromName } from "@/lib/positions";
import { requireSession, toPermissionUser } from "@/lib/session";
import { titleCaseWords } from "@/lib/text-case";

async function assertCanManage() {
  const session = await requireSession();
  const user = toPermissionUser(session);
  if (!canManageEmployees(user)) {
    throw new Error("You do not have permission to manage positions.");
  }
  return session;
}

export async function createPosition(formData: FormData) {
  await assertCanManage();

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error("Company not found.");

  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const name = titleCaseWords(String(formData.get("name") ?? "").trim());
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw ? titleCaseWords(descriptionRaw) : null;

  if (!categoryId) throw new Error("Department is required.");
  if (!name) throw new Error("Position name is required.");

  const category = await prisma.employeeCategory.findFirst({
    where: { id: categoryId, companyId: company.id, active: true },
  });
  if (!category) throw new Error("Department not found.");

  const top = await prisma.position.findFirst({
    where: { categoryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  let slug = positionSlugFromName(name);
  const slugTaken = await prisma.position.findFirst({
    where: { categoryId, slug },
    select: { id: true },
  });
  if (slugTaken) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  await prisma.position.create({
    data: {
      companyId: company.id,
      categoryId,
      name,
      slug,
      description,
      sortOrder: (top?.sortOrder ?? 0) + 10,
      active: true,
    },
  });

  revalidatePath("/employees");
}

export async function updatePosition(id: string, formData: FormData) {
  await assertCanManage();

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error("Company not found.");

  const name = titleCaseWords(String(formData.get("name") ?? "").trim());
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw ? titleCaseWords(descriptionRaw) : null;
  const activeRaw = String(formData.get("active") ?? "true").trim();
  const active = activeRaw !== "false" && activeRaw !== "0";

  if (!name) throw new Error("Position name is required.");

  const existing = await prisma.position.findFirst({
    where: { id, companyId: company.id },
  });
  if (!existing) throw new Error("Position not found.");

  await prisma.position.update({
    where: { id },
    data: {
      name,
      description,
      active,
    },
  });

  // Keep denormalized employee.position in sync
  await prisma.employee.updateMany({
    where: { positionId: id },
    data: { position: name },
  });

  revalidatePath("/employees");
}

export async function deletePosition(id: string, reassignToId?: string) {
  await assertCanManage();

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error("Company not found.");

  const position = await prisma.position.findFirst({
    where: { id, companyId: company.id },
    include: { _count: { select: { employees: true } } },
  });
  if (!position) throw new Error("Position not found.");

  if (position._count.employees > 0) {
    if (!reassignToId) {
      throw new Error(
        "Reassign employees to another position before deleting."
      );
    }
    const target = await prisma.position.findFirst({
      where: {
        id: reassignToId,
        companyId: company.id,
        categoryId: position.categoryId,
        active: true,
      },
    });
    if (!target) {
      throw new Error("Reassignment position not found in the same department.");
    }
    await prisma.employee.updateMany({
      where: { positionId: id },
      data: { positionId: target.id, position: target.name },
    });
  }

  await prisma.position.delete({ where: { id } });
  revalidatePath("/employees");
}

export async function reorderPositions(ids: string[]) {
  await assertCanManage();

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error("Company not found.");

  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const rows = await prisma.position.findMany({
    where: { id: { in: uniqueIds }, companyId: company.id },
    select: { id: true },
  });
  if (rows.length !== uniqueIds.length) {
    throw new Error("One or more positions are invalid for reorder.");
  }

  await prisma.$transaction(
    uniqueIds.map((id, index) =>
      prisma.position.update({
        where: { id },
        data: { sortOrder: (index + 1) * 10 },
      })
    )
  );

  revalidatePath("/employees");
}
