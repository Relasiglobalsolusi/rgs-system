"use server";

import { revalidatePath } from "next/cache";

import { parseFormDateInput } from "@/lib/bulk-import/parse-import-date";
import {
  confirmFactoryRepairedInTx,
  receiveFactoryReplacementInTx,
  recordFactoryRefundInTx,
  sendEquipmentToFactoryInTx,
  type FactoryReturnIntentValue,
  type FactoryReturnSourceValue,
} from "@/lib/equipment-factory-return";
import { canReturnEquipmentToFactory } from "@/lib/inventory-access";
import type { AppLocale } from "@/lib/i18n/locale";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import { toActionError } from "@/lib/prisma-errors";
import { canManageInventory } from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";
import { capitalizeProper } from "@/lib/text-case";

async function assertCanReturnToFactory(locale: AppLocale) {
  const session = await requireModule("inventory");
  const user = toPermissionUser(session);
  if (!canManageInventory(user)) {
    throw new Error(translate(locale, "pages.inventory.permissionDenied"));
  }
  const allowed = await canReturnEquipmentToFactory(session.user.id, {
    ...user,
    username: session.user.username,
  });
  if (!allowed) {
    throw new Error(
      translate(locale, "pages.inventory.factoryReturn.permissionDenied")
    );
  }
  return session;
}

function revalidateFactoryReturn(itemId: string, projectIds: string[] = []) {
  revalidatePath("/inventory");
  revalidatePath(`/inventory/equipment/${itemId}`);
  for (const projectId of projectIds) {
    revalidatePath(`/projects/${projectId}`);
  }
}

function parseIntent(raw: FormDataEntryValue | null): FactoryReturnIntentValue {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "REFUND" || value === "REPAIR" || value === "REPLACE") {
    return value;
  }
  throw new Error("INTENT_REQUIRED");
}

function parseSource(raw: FormDataEntryValue | null): FactoryReturnSourceValue {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "new" || value === "issued") return value;
  throw new Error("SOURCE_REQUIRED");
}

function parsePositiveAmount(raw: FormDataEntryValue | null): number {
  const value = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("REFUND_AMOUNT_REQUIRED");
  }
  return value;
}

export async function sendEquipmentToFactory(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanReturnToFactory(locale);
    const company = await prisma.company.findFirst({
      select: { id: true },
    });
    if (!company) {
      throw new Error(translate(locale, "pages.inventory.companyNotFound"));
    }

    const itemId = String(formData.get("itemId") ?? "").trim();
    const reason = capitalizeProper(String(formData.get("reason") ?? "").trim());
    const vendorId = String(formData.get("vendorId") ?? "").trim() || null;
    const source = parseSource(formData.get("source"));
    const intent = parseIntent(formData.get("intent"));
    const assetIds = formData
      .getAll("assetIds")
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);
    const quantity = Math.round(
      Number(String(formData.get("quantity") ?? "").replace(/,/g, "").trim())
    );
    const sentAt =
      parseFormDateInput(formData.get("sentAt"), {
        fieldLabel: translate(locale, "pages.inventory.factoryReturn.sentAt"),
      }) ?? new Date();

    if (!itemId) {
      throw new Error(translate(locale, "pages.inventory.itemRequired"));
    }
    if (!reason) {
      throw new Error(
        translate(locale, "pages.inventory.factoryReturn.reasonRequired")
      );
    }

    let refundAmount: number | null = null;
    if (intent === "REFUND") {
      refundAmount = parsePositiveAmount(formData.get("refundAmount"));
    }

    if (vendorId) {
      const vendor = await prisma.vendor.findFirst({
        where: { id: vendorId, companyId: company.id },
        select: { id: true },
      });
      if (!vendor) {
        throw new Error(translate(locale, "pages.inventory.vendorNotFound"));
      }
    }

    const result = await prisma.$transaction((tx) =>
      sendEquipmentToFactoryInTx(tx, {
        companyId: company.id,
        itemId,
        source,
        intent,
        quantity: source === "new" ? quantity : assetIds.length,
        assetIds,
        reason,
        vendorId,
        refundAmount,
        sentAt,
        createdById: session.user.id,
      })
    );

    revalidateFactoryReturn(result.itemId, result.projectIds);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message =
      code === "INSUFFICIENT_UNCODED"
        ? translate(locale, "pages.inventory.factoryReturn.insufficientNew")
        : code === "ASSETS_REQUIRED"
          ? translate(locale, "pages.inventory.factoryReturn.assetsRequired")
          : code === "INSUFFICIENT_STOCK"
            ? translate(locale, "pages.inventory.factoryReturn.insufficientStock")
            : code === "ITEM_NOT_EQUIPMENT"
              ? translate(locale, "pages.inventory.itemNotFound")
              : code === "INTENT_REQUIRED"
                ? translate(locale, "pages.inventory.factoryReturn.intentRequired")
                : code === "SOURCE_REQUIRED"
                  ? translate(locale, "pages.inventory.factoryReturn.sourceRequired")
                  : code === "REFUND_AMOUNT_REQUIRED"
                    ? translate(
                        locale,
                        "pages.inventory.factoryReturn.refundAmountRequired"
                      )
                    : undefined;
    throw toActionError(
      message ? new Error(message) : error,
      translate(locale, "pages.inventory.factoryReturn.sendFailed")
    );
  }
}

export async function recordFactoryRefund(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanReturnToFactory(locale);
    const company = await prisma.company.findFirst({ select: { id: true } });
    if (!company) {
      throw new Error(translate(locale, "pages.inventory.companyNotFound"));
    }
    const returnId = String(formData.get("returnId") ?? "").trim();
    if (!returnId) {
      throw new Error(
        translate(locale, "pages.inventory.factoryReturn.notFound")
      );
    }
    const refundAmount = parsePositiveAmount(formData.get("refundAmount"));
    const result = await prisma.$transaction((tx) =>
      recordFactoryRefundInTx(tx, {
        companyId: company.id,
        returnId,
        refundAmount,
        closedById: session.user.id,
        refundedAt: new Date(),
      })
    );
    revalidateFactoryReturn(result.itemId);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    throw toActionError(
      code === "FACTORY_RETURN_NOT_WAITING"
        ? new Error(
            translate(locale, "pages.inventory.factoryReturn.notWaiting")
          )
        : code === "REFUND_AMOUNT_REQUIRED"
          ? new Error(
              translate(
                locale,
                "pages.inventory.factoryReturn.refundAmountRequired"
              )
            )
          : error,
      translate(locale, "pages.inventory.factoryReturn.refundFailed")
    );
  }
}

export async function confirmFactoryRepaired(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanReturnToFactory(locale);
    const company = await prisma.company.findFirst({ select: { id: true } });
    if (!company) {
      throw new Error(translate(locale, "pages.inventory.companyNotFound"));
    }
    const returnId = String(formData.get("returnId") ?? "").trim();
    if (!returnId) {
      throw new Error(
        translate(locale, "pages.inventory.factoryReturn.notFound")
      );
    }
    const result = await prisma.$transaction((tx) =>
      confirmFactoryRepairedInTx(tx, {
        companyId: company.id,
        returnId,
        closedById: session.user.id,
        receivedAt: new Date(),
      })
    );
    revalidateFactoryReturn(result.itemId);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    throw toActionError(
      code === "FACTORY_RETURN_NOT_WAITING"
        ? new Error(
            translate(locale, "pages.inventory.factoryReturn.notWaiting")
          )
        : error,
      translate(locale, "pages.inventory.factoryReturn.repairFailed")
    );
  }
}

export async function receiveFactoryReplacement(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanReturnToFactory(locale);
    const company = await prisma.company.findFirst({ select: { id: true } });
    if (!company) {
      throw new Error(translate(locale, "pages.inventory.companyNotFound"));
    }
    const returnId = String(formData.get("returnId") ?? "").trim();
    if (!returnId) {
      throw new Error(
        translate(locale, "pages.inventory.factoryReturn.notFound")
      );
    }
    const result = await prisma.$transaction((tx) =>
      receiveFactoryReplacementInTx(tx, {
        companyId: company.id,
        returnId,
        closedById: session.user.id,
        receivedAt: new Date(),
      })
    );
    revalidateFactoryReturn(result.itemId);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    throw toActionError(
      code === "FACTORY_RETURN_NOT_WAITING"
        ? new Error(
            translate(locale, "pages.inventory.factoryReturn.notWaiting")
          )
        : error,
      translate(locale, "pages.inventory.factoryReturn.replaceFailed")
    );
  }
}
