"use server";

import { revalidatePath } from "next/cache";

import {
  getIdulFitriDate,
  listKnownIdulFitriYears,
  resolveThrTargetYear,
} from "@/lib/employee-thr";
import { prisma } from "@/lib/prisma";
import { requireModule, toPermissionUser } from "@/lib/session";
import { isClientPortalUser, isVendorPortalUser } from "@/lib/project-access";
import { generateThrPaymentsForCompany } from "@/lib/thr-generate";

async function assertCanManageThr() {
  const session = await requireModule("invoicing");
  const user = toPermissionUser(session);
  if (isClientPortalUser(user) || isVendorPortalUser(user)) {
    throw new Error("You do not have permission to manage THR.");
  }
  return session;
}

export async function generateThrForYear(year?: number) {
  const session = await assertCanManageThr();
  const targetYear = year ?? resolveThrTargetYear();
  if (targetYear == null) {
    throw new Error("No Idul Fitri date is configured for the target year.");
  }
  if (!getIdulFitriDate(targetYear)) {
    throw new Error(`Idul Fitri date is not configured for ${targetYear}.`);
  }
  if (!listKnownIdulFitriYears().includes(targetYear)) {
    throw new Error(`Idul Fitri date is not configured for ${targetYear}.`);
  }

  const result = await generateThrPaymentsForCompany(session.user.companyId, {
    year: targetYear,
    forceOutsideWindow: true,
  });

  revalidatePath("/billing/thr");
  return result;
}

export async function markThrPaymentPaid(id: string) {
  const session = await assertCanManageThr();

  const row = await prisma.thrPayment.findFirst({
    where: { id, companyId: session.user.companyId },
    select: { id: true, status: true },
  });
  if (!row) {
    throw new Error("THR payment not found.");
  }

  await prisma.thrPayment.update({
    where: { id },
    data: {
      status: "PAID",
      paidAt: new Date(),
    },
  });

  revalidatePath("/billing/thr");
}

/** Opportunistic auto-generate when Finances/THR is opened inside the 15-day window. */
export async function syncThrOnPageLoad(): Promise<{
  ran: boolean;
  year?: number;
  created?: number;
  updated?: number;
}> {
  const session = await requireModule("invoicing");
  const user = toPermissionUser(session);
  if (isClientPortalUser(user) || isVendorPortalUser(user)) {
    return { ran: false };
  }

  const result = await generateThrPaymentsForCompany(session.user.companyId);
  if (!result.inWindow || (result.created === 0 && result.updated === 0)) {
    return { ran: result.inWindow, year: result.year };
  }

  revalidatePath("/billing/thr");
  return {
    ran: true,
    year: result.year,
    created: result.created,
    updated: result.updated,
  };
}
