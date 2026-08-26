"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { isVehicleItemType } from "@/lib/inventory-sku";
import { isOwnerAccount } from "@/lib/permissions";
import { parseContractPrice } from "@/lib/project-billing";
import { prisma } from "@/lib/prisma";
import { requirePettyCashAccess } from "@/lib/session";
import { saveUpload } from "@/lib/upload";
import { todayDateInput } from "@/lib/project-contract";
import { parseDateInput } from "@/lib/invoice-period";

async function requireOwnerPrepaidCardManage() {
  const session = await requirePettyCashAccess();
  if (!isOwnerAccount({ username: session.user.username })) {
    const locale = await getServerLocale();
    throw new Error(translate(locale, "pages.pettyCash.cardManageDenied"));
  }
  return session;
}

export async function createPrepaidCard(formData: FormData) {
  const session = await requireOwnerPrepaidCardManage();
  const cardNumber = String(formData.get("cardNumber") ?? "").trim();
  const vehicleItemId = String(formData.get("vehicleItemId") ?? "").trim();
  if (!cardNumber) throw new Error("Card number is required.");
  if (!vehicleItemId) throw new Error("Choose the vehicle this card is for.");

  const vehicle = await prisma.inventoryItem.findFirst({
    where: {
      id: vehicleItemId,
      companyId: session.user.companyId,
      active: true,
      deletedAt: null,
    },
    select: { id: true, itemType: true },
  });
  if (!vehicle || !isVehicleItemType(vehicle.itemType)) {
    throw new Error("Choose a vehicle from Inventory.");
  }
  const owned = await prisma.inventoryItem.findFirst({
    where: {
      id: vehicleItemId,
      companyId: session.user.companyId,
      OR: [
        { currentStock: { gt: 0 } },
        { equipmentAssets: { some: { companyId: session.user.companyId } } },
      ],
    },
    select: { id: true },
  });
  if (!owned) {
    throw new Error("Choose a vehicle that is already in Inventory.");
  }

  await prisma.prepaidCard.create({
    data: {
      companyId: session.user.companyId,
      cardNumber,
      vehicleItemId,
      currentBalance: 0,
    },
  });
  revalidatePath("/billing/petty-cash");
}

export async function recordPrepaidCardSpend(formData: FormData) {
  const session = await requirePettyCashAccess();
  const prepaidCardId = String(formData.get("prepaidCardId") ?? "").trim();
  const spendKindRaw = String(formData.get("spendKind") ?? "").trim();
  const spendKind =
    spendKindRaw === "FUEL" || spendKindRaw === "TOLL" || spendKindRaw === "PARKING"
      ? spendKindRaw
      : null;
  const amount = parseContractPrice(String(formData.get("amount") ?? ""));
  if (!prepaidCardId) throw new Error("Choose a prepaid card.");
  if (!spendKind) throw new Error("Choose fuel, toll, or parking.");
  if (amount == null || amount <= 0) throw new Error("Enter the amount paid.");

  const proof = formData.get("proof");
  if (!(proof instanceof File) || proof.size === 0) {
    throw new Error("Upload the bill or receipt.");
  }
  const proofPath = await saveUpload(proof, "prepaid-card-proofs", {
    fileBaseName: "prepaid_spend",
  });
  const entryDate = parseDateInput(
    String(formData.get("entryDate") ?? todayDateInput())
  );

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error("Prepaid card not found.");
    const previous = Number(card.currentBalance);
    if (amount > previous) {
      throw new Error("This spend is more than the card balance.");
    }
    const resulting = previous - amount;
    await tx.prepaidCard.update({
      where: { id: card.id },
      data: { currentBalance: new Prisma.Decimal(resulting) },
    });
    await tx.prepaidCardEntry.create({
      data: {
        prepaidCardId: card.id,
        kind: "SPEND",
        spendKind,
        amount,
        previousBalance: previous,
        resultingBalance: resulting,
        proofPath,
        entryDate,
        description: spendKind,
        createdById: session.user.id,
      },
    });
  });
  revalidatePath("/billing/petty-cash");
  revalidatePath("/billing/financial-report");
}

export async function updatePrepaidCard(cardId: string, formData: FormData) {
  const session = await requireOwnerPrepaidCardManage();
  const cardNumber = String(formData.get("cardNumber") ?? "").trim();
  const vehicleItemId = String(formData.get("vehicleItemId") ?? "").trim();
  if (!cardId) throw new Error("Prepaid card not found.");
  if (!cardNumber) throw new Error("Card number is required.");
  if (!vehicleItemId) throw new Error("Choose the vehicle this card is for.");

  const existing = await prisma.prepaidCard.findFirst({
    where: { id: cardId, companyId: session.user.companyId },
    select: { id: true, vehicleItemId: true },
  });
  if (!existing) throw new Error("Prepaid card not found.");

  const vehicle = await prisma.inventoryItem.findFirst({
    where: {
      id: vehicleItemId,
      companyId: session.user.companyId,
      active: true,
      deletedAt: null,
    },
    select: { id: true, itemType: true },
  });
  if (!vehicle || !isVehicleItemType(vehicle.itemType)) {
    throw new Error("Choose a vehicle from Inventory.");
  }
  if (vehicleItemId !== existing.vehicleItemId) {
    const taken = await prisma.prepaidCard.findFirst({
      where: {
        companyId: session.user.companyId,
        vehicleItemId,
        id: { not: cardId },
      },
      select: { id: true },
    });
    if (taken) {
      throw new Error("That vehicle already has a prepaid card.");
    }
  }

  await prisma.prepaidCard.update({
    where: { id: cardId },
    data: { cardNumber, vehicleItemId },
  });
  revalidatePath("/billing/petty-cash");
}

export async function deletePrepaidCard(cardId: string) {
  const session = await requireOwnerPrepaidCardManage();
  const existing = await prisma.prepaidCard.findFirst({
    where: { id: cardId, companyId: session.user.companyId },
    select: { id: true },
  });
  if (!existing) throw new Error("Prepaid card not found.");
  await prisma.prepaidCard.delete({ where: { id: cardId } });
  revalidatePath("/billing/petty-cash");
}
