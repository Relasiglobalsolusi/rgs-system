"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { findOpenCicoAttendance } from "@/lib/cico-attendance";
import { translate } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import {
  INVENTORY_ISSUE_PROJECT_STATUSES,
  toDecimal,
} from "@/lib/inventory";
import type { AppLocale } from "@/lib/i18n/locale";
import { prisma } from "@/lib/prisma";
import { requireModule, toPermissionUser } from "@/lib/session";
import { assertCanApproveProjectServiceArea } from "@/lib/om-approval";
import { capitalizeProper } from "@/lib/text-case";

function toActionError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error;
  return new Error(fallback);
}

async function requireCompany(locale: AppLocale) {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    throw new Error(translate(locale, "pages.inventory.companyNotFound"));
  }
  return company;
}

async function requireLinkedEmployee(userId: string, companyId: string) {
  const employee = await prisma.employee.findFirst({
    where: { userId, companyId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!employee) {
    throw new Error("Employee profile required.");
  }
  return employee;
}

/** Staff: create a material request for the project they are currently checked into. */
export async function createMaterialRequest(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requireModule("materialRequests");
    const company = await requireCompany(locale);
    const employee = await requireLinkedEmployee(session.user.id, company.id);

    const open = await findOpenCicoAttendance(employee.id);
    const projectId = open?.record?.projectId?.trim() || "";
    if (!projectId) {
      throw new Error(
        translate(locale, "pages.materialRequests.mustBeCheckedIn")
      );
    }

    const notes =
      capitalizeProper(String(formData.get("notes") ?? "").trim()) || null;
    const itemIds = formData
      .getAll("itemId")
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);
    const quantities = formData
      .getAll("quantity")
      .map((v) => String(v ?? "").trim());

    if (itemIds.length === 0) {
      throw new Error(translate(locale, "pages.materialRequests.linesRequired"));
    }

    const lines: { itemId: string; quantity: Prisma.Decimal }[] = [];
    for (let i = 0; i < itemIds.length; i++) {
      const qty = Number(String(quantities[i] ?? "").replace(/,/g, ""));
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
        throw new Error(
          translate(locale, "pages.materialRequests.quantityInvalid")
        );
      }
      lines.push({ itemId: itemIds[i]!, quantity: toDecimal(qty) });
    }

    const items = await prisma.inventoryItem.findMany({
      where: {
        companyId: company.id,
        id: { in: lines.map((l) => l.itemId) },
        active: true,
        deletedAt: null,
        tracksStock: true,
      },
      select: { id: true },
    });
    if (items.length !== lines.length) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        companyId: company.id,
        status: { in: [...INVENTORY_ISSUE_PROJECT_STATUSES] },
      },
      select: { id: true },
    });
    if (!project) {
      throw new Error(translate(locale, "pages.materialRequests.projectInvalid"));
    }

    await prisma.materialRequest.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        requestedById: employee.id,
        notes,
        status: "REQUESTED",
        lines: {
          create: lines.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
          })),
        },
      },
    });

    revalidatePath("/material-requests");
    revalidatePath("/approvals");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.materialRequests.createFailed")
    );
  }
}

export async function cancelMaterialRequest(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requireModule("materialRequests");
    const company = await requireCompany(locale);
    const employee = await requireLinkedEmployee(session.user.id, company.id);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) throw new Error("Request id required.");

    const updated = await prisma.materialRequest.updateMany({
      where: {
        id,
        companyId: company.id,
        requestedById: employee.id,
        status: "REQUESTED",
      },
      data: { status: "CANCELLED" },
    });
    if (updated.count === 0) {
      throw new Error(translate(locale, "pages.materialRequests.cancelFailed"));
    }
    revalidatePath("/material-requests");
    revalidatePath("/approvals");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.materialRequests.cancelFailed")
    );
  }
}

/** OM+: approve → create transfer order; reject → close request. */
export async function reviewMaterialRequest(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requireModule("approvals");
    const company = await requireCompany(locale);
    const id = String(formData.get("id") ?? "").trim();
    const decision = String(formData.get("decision") ?? "")
      .trim()
      .toUpperCase();
    const reviewNote =
      capitalizeProper(String(formData.get("reviewNote") ?? "").trim()) || null;

    if (!id) throw new Error("Request id required.");
    if (decision !== "APPROVE" && decision !== "REJECT") {
      throw new Error("Invalid decision.");
    }

    await prisma.$transaction(async (tx) => {
      const request = await tx.materialRequest.findFirst({
        where: { id, companyId: company.id, status: "REQUESTED" },
        include: {
          lines: true,
          project: { select: { id: true, serviceArea: true } },
        },
      });
      if (!request) {
        throw new Error(translate(locale, "pages.materialRequests.notFound"));
      }

      await assertCanApproveProjectServiceArea({
        userId: session.user.id,
        username: session.user.username,
        permissionUser: toPermissionUser(session),
        projectServiceArea: request.project.serviceArea,
        projectId: request.project.id,
      });

      if (decision === "REJECT") {
        await tx.materialRequest.update({
          where: { id: request.id },
          data: {
            status: "REJECTED",
            reviewedById: session.user.id,
            reviewedAt: new Date(),
            reviewNote,
          },
        });
        return;
      }

      await tx.materialRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          reviewedById: session.user.id,
          reviewedAt: new Date(),
          reviewNote,
        },
      });

      await tx.transferOrder.create({
        data: {
          companyId: company.id,
          projectId: request.projectId,
          materialRequestId: request.id,
          status: "PENDING_SEND",
          lines: {
            create: request.lines.map((line) => ({
              itemId: line.itemId,
              quantity: line.quantity,
            })),
          },
        },
      });
    });

    revalidatePath("/approvals");
    revalidatePath("/material-requests");
    revalidatePath("/transfer-orders");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.materialRequests.reviewFailed")
    );
  }
}
