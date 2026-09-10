"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/permissions";
import { parseContractPrice } from "@/lib/project-billing";
import { parseDateInput } from "@/lib/invoice-period";
import { requireModule, toPermissionUser } from "@/lib/session";

async function requireParkingManage() {
  const session = await requireModule("invoicing");
  if (session.user.clientId || session.user.vendorId) {
    throw new Error("Not authorized to manage parking billing.");
  }
  if (!canAccess(toPermissionUser(session), "invoicing")) {
    throw new Error("Not authorized to manage parking billing.");
  }
  return session;
}

export async function saveParkingMonthlyRevenue(formData: FormData) {
  const session = await requireParkingManage();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const revenueRaw = String(formData.get("revenueAmount") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const creditedAtRaw = String(formData.get("creditedAt") ?? "").trim();
  const bankAccountId = String(formData.get("bankAccountId") ?? "").trim();

  if (!projectId) throw new Error("Project is required.");
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Select a valid year.");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Select a valid month.");
  }

  const revenue = parseContractPrice(revenueRaw);
  if (revenue == null || revenue < 0) {
    throw new Error("Enter the actual monthly revenue.");
  }
  if (!creditedAtRaw) {
    throw new Error("Enter the date the bank credited this parking income.");
  }
  let creditedAt: Date;
  try {
    creditedAt = parseDateInput(creditedAtRaw);
  } catch {
    throw new Error("Enter the date the bank credited this parking income.");
  }
  if (!bankAccountId) {
    throw new Error("Choose the company bank that received this parking income.");
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      companyId: session.user.companyId,
      subCategory: "PARKING",
    },
    select: { id: true, clientId: true },
  });
  if (!project) throw new Error("Parking project not found.");

  const bank = await prisma.companyBankAccount.findFirst({
    where: { id: bankAccountId, companyId: session.user.companyId },
    select: { id: true },
  });
  if (!bank) {
    throw new Error("Choose the company bank that received this parking income.");
  }

  await prisma.parkingMonthlyLog.upsert({
    where: {
      projectId_year_month: { projectId, year, month },
    },
    update: {
      revenueAmount: new Prisma.Decimal(Math.round(revenue)),
      notes,
      creditedAt,
      bankAccountId: bank.id,
    },
    create: {
      projectId,
      year,
      month,
      revenueAmount: new Prisma.Decimal(Math.round(revenue)),
      notes,
      creditedAt,
      bankAccountId: bank.id,
      createdById: session.user.id,
    },
  });

  revalidatePath(`/billing/${project.clientId}/${projectId}`);
  revalidatePath("/billing/financial-report");
  return { year, month };
}
