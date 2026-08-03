"use server";

import { revalidatePath } from "next/cache";

import { findOpenCicoAttendance } from "@/lib/cico-attendance";
import {
  InsufficientEquipmentAssetsError,
  assertEquipmentInventoryInvariants,
  assignAvailableEquipmentAssetsToProject,
  isEquipmentItemType,
} from "@/lib/equipment-asset";
import { translate } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import {
  formatInventoryQty,
  inventoryQtyFromDecimal,
  movementTotalCost,
  normalizeInventoryQty,
  toDecimal,
} from "@/lib/inventory";
import { lockInventoryItemRow } from "@/lib/inventory-access";
import type { AppLocale } from "@/lib/i18n/locale";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { requireModule } from "@/lib/session";

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

/** Warehouse: mark transfer sent and issue stock to the project. */
export async function markTransferOrderSent(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requireModule("transferOrders");
    const company = await requireCompany(locale);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) throw new Error("Transfer order id required.");

    await prisma.$transaction(async (tx) => {
      const order = await tx.transferOrder.findFirst({
        where: { id, companyId: company.id, status: "PENDING_SEND" },
        include: {
          lines: { include: { item: { select: { id: true, itemType: true, unit: true } } } },
          project: { select: { id: true, status: true } },
        },
      });
      if (!order) {
        throw new Error(translate(locale, "pages.transferOrders.notFound"));
      }
      if (
        !["IN_PROGRESS", "WAITING_FOR_APPROVAL", "ON_HOLD"].includes(
          order.project.status
        )
      ) {
        throw new Error(translate(locale, "pages.materialRequests.projectInvalid"));
      }

      const movedAt = new Date();
      for (const line of order.lines) {
        const quantity = inventoryQtyFromDecimal(line.quantity);
        const locked = await lockInventoryItemRow(tx, line.itemId);
        if (!locked || !locked.active) {
          throw new Error(translate(locale, "pages.inventory.itemNotFound"));
        }
        const currentStock = inventoryQtyFromDecimal(locked.currentStock);
        if (currentStock <= 0 || quantity > currentStock) {
          throw new Error(
            translate(locale, "pages.inventory.insufficientStock", {
              available: formatInventoryQty(currentStock),
              unit: locked.unit,
            })
          );
        }

        const isEquipment = isEquipmentItemType(line.item.itemType);
        const unitCost = isEquipment
          ? 0
          : decimalToNumber(locked.avgUnitCost) ??
            decimalToNumber(locked.lastUnitCost) ??
            0;
        const totalCost = isEquipment ? 0 : movementTotalCost(quantity, unitCost);

        const movement = await tx.inventoryMovement.create({
          data: {
            companyId: company.id,
            itemId: line.itemId,
            projectId: order.projectId,
            type: "ISSUE_TO_PROJECT",
            quantity: toDecimal(-quantity),
            unitCost: toDecimal(unitCost),
            totalCost: toDecimal(totalCost),
            movedAt,
            notes: `Transfer order ${order.id}`,
            createdById: session.user.id,
          },
        });

        const stockUpdate = await tx.inventoryItem.updateMany({
          where: {
            id: line.itemId,
            currentStock: { gte: toDecimal(quantity) },
          },
          data: {
            currentStock: toDecimal(normalizeInventoryQty(currentStock - quantity)),
          },
        });
        if (stockUpdate.count === 0) {
          throw new Error(
            translate(locale, "pages.inventory.insufficientStock", {
              available: formatInventoryQty(currentStock),
              unit: locked.unit,
            })
          );
        }

        if (isEquipment) {
          try {
            await assignAvailableEquipmentAssetsToProject(
              tx,
              company.id,
              line.itemId,
              order.projectId,
              quantity,
              { issueMovementId: movement.id, assignedAt: movedAt }
            );
            await assertEquipmentInventoryInvariants(tx, company.id, {
              itemIds: [line.itemId],
              projectId: order.projectId,
              movementIds: [movement.id],
            });
          } catch (error) {
            if (error instanceof InsufficientEquipmentAssetsError) {
              throw new Error(
                translate(
                  locale,
                  "pages.inventory.insufficientEquipmentAssetsForIssue",
                  {
                    available: String(error.available),
                    requested: String(error.requested),
                  }
                )
              );
            }
            throw error;
          }
        }
      }

      await tx.transferOrder.update({
        where: { id: order.id },
        data: {
          status: "SENT",
          sentAt: movedAt,
          sentById: session.user.id,
        },
      });
    });

    revalidatePath("/transfer-orders");
    revalidatePath("/inventory");
    revalidatePath("/material-requests");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.transferOrders.sendFailed")
    );
  }
}

/** Site staff: confirm goods received (must be CICO'd into the project). */
export async function markTransferOrderReceived(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requireModule("materialRequests");
    const company = await requireCompany(locale);
    const employee = await requireLinkedEmployee(session.user.id, company.id);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) throw new Error("Transfer order id required.");

    const order = await prisma.transferOrder.findFirst({
      where: { id, companyId: company.id, status: "SENT" },
      select: {
        id: true,
        projectId: true,
        materialRequest: { select: { requestedById: true } },
      },
    });
    if (!order) {
      throw new Error(translate(locale, "pages.transferOrders.notFound"));
    }

    // Allowed to confirm receipt: the original requester, or any materialRequests
    // user currently checked in (CICO) to the destination project.
    const isRequester = order.materialRequest.requestedById === employee.id;
    if (!isRequester) {
      const open = await findOpenCicoAttendance(employee.id);
      const checkedInProjectId = open?.record?.projectId ?? null;
      if (checkedInProjectId !== order.projectId) {
        throw new Error(
          translate(locale, "pages.transferOrders.mustBeCheckedInToReceive")
        );
      }
    }

    await prisma.transferOrder.update({
      where: { id: order.id },
      data: {
        status: "RECEIVED",
        receivedAt: new Date(),
        receivedById: employee.id,
      },
    });

    revalidatePath("/transfer-orders");
    revalidatePath("/material-requests");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.transferOrders.receiveFailed")
    );
  }
}
