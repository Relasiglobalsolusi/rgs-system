import { Prisma, type PrismaClient } from "@prisma/client";

import type { AppLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { isVehicleItemType } from "@/lib/inventory-sku";
import {
  formatPrepaidCardNumber,
  normalizePrepaidCardNumber,
  PREPAID_CARD_LIVE_STATUSES,
  prepaidReplacementFeeLabel,
} from "@/lib/prepaid-card";
import { decimalToNumber } from "@/lib/project-billing";
import { formatVehicleIdentityLabel } from "@/lib/vehicle-plate";

type Db = PrismaClient | Prisma.TransactionClient;

export async function assertPrepaidCardNumberAvailable(
  db: Db,
  companyId: string,
  cardNumber: string,
  exceptId?: string
) {
  const normalized = normalizePrepaidCardNumber(cardNumber);
  if (!normalized) throw new Error("Card number is required.");
  const existing = await db.prepaidCard.findFirst({
    where: {
      companyId,
      cardNumber: normalized,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error("That Card number is already reserved.");
  }
  return normalized;
}

export async function requireOwnedVehicleAsset(
  db: Db,
  companyId: string,
  vehicleAssetId: string
) {
  const asset = await db.equipmentAsset.findFirst({
    where: {
      id: vehicleAssetId,
      companyId,
      soldOffMovementId: null,
      writeOffMovementId: null,
    },
    select: {
      id: true,
      itemId: true,
      item: { select: { itemType: true, active: true, deletedAt: true } },
    },
  });
  if (
    !asset ||
    !asset.item.active ||
    asset.item.deletedAt ||
    !isVehicleItemType(asset.item.itemType)
  ) {
    throw new Error("Choose a vehicle from Inventory.");
  }
  return asset;
}

export async function requireActiveEmployee(
  db: Db,
  companyId: string,
  employeeId: string
) {
  const employee = await db.employee.findFirst({
    where: {
      id: employeeId,
      companyId,
      archivedFromDirectory: false,
      status: { in: ["ACTIVE", "ON_LEAVE"] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });
  if (!employee) throw new Error("Choose the person in charge.");
  return employee;
}

export async function assertVehicleHasNoLiveCard(
  db: Db,
  companyId: string,
  vehicleKey: { vehicleAssetId?: string | null; vehicleItemId?: string | null },
  exceptCardId?: string
) {
  const vehicleAssetId = vehicleKey.vehicleAssetId?.trim() || null;
  const vehicleItemId = vehicleKey.vehicleItemId?.trim() || null;
  if (!vehicleAssetId && !vehicleItemId) return;
  const taken = await db.prepaidCard.findFirst({
    where: {
      companyId,
      kind: "VEHICLE",
      status: { in: PREPAID_CARD_LIVE_STATUSES },
      ...(exceptCardId ? { id: { not: exceptCardId } } : {}),
      ...(vehicleAssetId
        ? { vehicleAssetId }
        : { vehicleItemId, vehicleAssetId: null }),
    },
    select: { id: true, cardNumber: true },
  });
  if (taken) {
    throw new Error(
      `That vehicle already has a live Card (${formatPrepaidCardNumber(taken.cardNumber)}). Return it to the list first.`
    );
  }
}

export async function currentPrepaidAssignment(
  db: Db,
  prepaidCardId: string
) {
  return db.prepaidCardAssignment.findFirst({
    where: { prepaidCardId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
}

export async function endOpenPrepaidAssignment(
  db: Db,
  prepaidCardId: string,
  endedAt = new Date()
) {
  await db.prepaidCardAssignment.updateMany({
    where: { prepaidCardId, endedAt: null },
    data: { endedAt },
  });
}

export async function startPrepaidAssignment(
  db: Db,
  options: {
    prepaidCardId: string;
    vehicleItemId?: string | null;
    vehicleAssetId?: string | null;
    custodianEmployeeId?: string | null;
    startedAt?: Date;
  }
) {
  await endOpenPrepaidAssignment(db, options.prepaidCardId, options.startedAt);
  return db.prepaidCardAssignment.create({
    data: {
      prepaidCardId: options.prepaidCardId,
      vehicleItemId: options.vehicleItemId ?? null,
      vehicleAssetId: options.vehicleAssetId ?? null,
      custodianEmployeeId: options.custodianEmployeeId ?? null,
      startedAt: options.startedAt ?? new Date(),
    },
  });
}

export async function returnPrepaidCardToStandby(
  db: Db,
  cardId: string,
  endedAt = new Date()
) {
  await endOpenPrepaidAssignment(db, cardId, endedAt);
  await db.prepaidCard.update({
    where: { id: cardId },
    data: {
      status: "STANDBY",
      vehicleItemId: null,
      vehicleAssetId: null,
      custodianEmployeeId: null,
    },
  });
}

export async function returnVehicleCardsToPool(
  db: Db,
  options: {
    companyId: string;
    vehicleItemId?: string;
    vehicleAssetIds?: string[];
  }
) {
  const assetIds = (options.vehicleAssetIds ?? []).filter(Boolean);
  const cards = await db.prepaidCard.findMany({
    where: {
      companyId: options.companyId,
      kind: "VEHICLE",
      status: { in: PREPAID_CARD_LIVE_STATUSES },
      OR: [
        ...(assetIds.length > 0 ? [{ vehicleAssetId: { in: assetIds } }] : []),
        ...(assetIds.length === 0 && options.vehicleItemId
          ? [{ vehicleItemId: options.vehicleItemId, vehicleAssetId: null }]
          : []),
      ],
    },
    select: { id: true },
  });
  for (const card of cards) {
    await returnPrepaidCardToStandby(db, card.id);
  }
}

export async function returnOpenCardsForEmployee(
  db: Db,
  options: { companyId: string; employeeId: string }
) {
  const cards = await db.prepaidCard.findMany({
    where: {
      companyId: options.companyId,
      kind: "OPEN",
      custodianEmployeeId: options.employeeId,
      status: { in: PREPAID_CARD_LIVE_STATUSES },
    },
    select: { id: true },
  });
  for (const card of cards) {
    await returnPrepaidCardToStandby(db, card.id);
  }
}

export async function writePrepaidCardEntry(
  db: Db,
  options: {
    cardId: string;
    kind: Prisma.PrepaidCardEntryCreateInput["kind"];
    amount: number;
    balanceDelta: number;
    entryDate: Date;
    description: string;
    createdById?: string | null;
    spendKind?: Prisma.PrepaidCardEntryCreateInput["spendKind"];
    proofPath?: string | null;
    assignmentId?: string | null;
    purchaseInvoiceId?: string | null;
    lossId?: string | null;
    relatedCardId?: string | null;
    bankAccountId?: string | null;
  }
) {
  await db.$queryRaw`
    SELECT id FROM "PrepaidCard" WHERE id = ${options.cardId} FOR UPDATE
  `;
  const card = await db.prepaidCard.findUnique({
    where: { id: options.cardId },
    select: { id: true, currentBalance: true },
  });
  if (!card) throw new Error("Card not found.");
  const previous = decimalToNumber(card.currentBalance) ?? 0;
  const resulting = Math.round((previous + options.balanceDelta) * 100) / 100;
  if (resulting < -0.001) {
    throw new Error("This amount is more than the Card balance.");
  }
  const nextBalance = Math.max(0, resulting);
  await db.prepaidCard.update({
    where: { id: card.id },
    data: { currentBalance: new Prisma.Decimal(nextBalance) },
  });
  return db.prepaidCardEntry.create({
    data: {
      prepaidCardId: card.id,
      kind: options.kind,
      spendKind: options.spendKind ?? null,
      amount: options.amount,
      previousBalance: previous,
      resultingBalance: nextBalance,
      proofPath: options.proofPath ?? null,
      entryDate: options.entryDate,
      description: options.description,
      createdById: options.createdById ?? null,
      assignmentId: options.assignmentId ?? null,
      purchaseInvoiceId: options.purchaseInvoiceId ?? null,
      lossId: options.lossId ?? null,
      relatedCardId: options.relatedCardId ?? null,
      bankAccountId: options.bankAccountId ?? null,
    },
  });
}

export async function transferPrepaidCardLeftover(
  db: Db,
  options: {
    fromCardId: string;
    toCardId: string;
    amount: number;
    entryDate: Date;
    createdById?: string | null;
    fromNumber: string;
    toNumber: string;
    locale?: AppLocale;
  }
) {
  if (options.amount <= 0) return;
  await writePrepaidCardEntry(db, {
    cardId: options.fromCardId,
    kind: "TRANSFER_OUT",
    amount: options.amount,
    balanceDelta: -options.amount,
    entryDate: options.entryDate,
    description: translate(
      options.locale ?? "en",
      "pages.pettyCash.transferToCardLabel",
      { number: formatPrepaidCardNumber(options.toNumber) }
    ),
    createdById: options.createdById,
    relatedCardId: options.toCardId,
  });
  const toAssignment = await currentPrepaidAssignment(db, options.toCardId);
  await writePrepaidCardEntry(db, {
    cardId: options.toCardId,
    kind: "TRANSFER_IN",
    amount: options.amount,
    balanceDelta: options.amount,
    entryDate: options.entryDate,
    description: translate(
      options.locale ?? "en",
      "pages.pettyCash.transferFromCardLabel",
      { number: formatPrepaidCardNumber(options.fromNumber) }
    ),
    createdById: options.createdById,
    relatedCardId: options.fromCardId,
    assignmentId: toAssignment?.id ?? null,
  });
}

export async function recordReplacementFeeOnCard(
  db: Db,
  options: {
    cardId: string;
    cardNumber: string;
    fee: number;
    fromLeftover: boolean;
    entryDate: Date;
    createdById?: string | null;
    bankAccountId?: string | null;
    purchaseInvoiceId?: string | null;
    locale?: AppLocale;
  }
) {
  const assignment = await currentPrepaidAssignment(db, options.cardId);
  return writePrepaidCardEntry(db, {
    cardId: options.cardId,
    kind: "REPLACEMENT_FEE",
    amount: options.fee,
    balanceDelta: options.fromLeftover ? -options.fee : 0,
    entryDate: options.entryDate,
    description: prepaidReplacementFeeLabel(options.cardNumber, options.locale),
    createdById: options.createdById,
    assignmentId: assignment?.id ?? null,
    bankAccountId: options.bankAccountId ?? null,
    purchaseInvoiceId: options.purchaseInvoiceId ?? null,
  });
}

export function vehicleAssignmentLabel(vehicle: {
  name: string;
  sku?: string | null;
  equipmentAssets?: { assetCode: string | null; vehicleYear?: number | null }[];
  plate?: string | null;
  year?: number | string | null;
}) {
  const plate =
    vehicle.plate ??
    (vehicle.equipmentAssets ?? [])
      .map((asset) => asset.assetCode)
      .filter(Boolean)
      .join(" / ");
  const year =
    vehicle.year ??
    (vehicle.equipmentAssets ?? []).find((asset) => asset.vehicleYear != null)
      ?.vehicleYear ??
    null;
  return formatVehicleIdentityLabel({
    plate,
    name: vehicle.name,
    sku: vehicle.sku,
    year,
  });
}

export const PREPAID_REVERSED_PREFIX = "[Reversed] ";

export function isPrepaidEntryReversed(description: string | null | undefined) {
  return String(description ?? "").startsWith(PREPAID_REVERSED_PREFIX);
}

export async function reversePrepaidCardSpendEntry(
  db: Db,
  options: {
    companyId: string;
    entryId: string;
    createdById: string;
  }
) {
  const entry = await db.prepaidCardEntry.findFirst({
    where: {
      id: options.entryId,
      prepaidCard: { companyId: options.companyId },
    },
    include: { prepaidCard: { select: { id: true, currentBalance: true } } },
  });
  if (!entry || entry.kind !== "SPEND") {
    throw new Error("Only a posted spend can be reversed.");
  }
  if (isPrepaidEntryReversed(entry.description)) {
    throw new Error("This spend is already reversed.");
  }
  const amount = decimalToNumber(entry.amount) ?? 0;
  await db.prepaidCardEntry.update({
    where: { id: entry.id },
    data: {
      description: `${PREPAID_REVERSED_PREFIX}${entry.description}`,
    },
  });
  await writePrepaidCardEntry(db, {
    cardId: entry.prepaidCardId,
    kind: "TOP_UP",
    amount,
    balanceDelta: amount,
    entryDate: entry.entryDate,
    description: `Reversal of spend on ${entry.entryDate.toISOString().slice(0, 10)}`,
    createdById: options.createdById,
    assignmentId: entry.assignmentId,
  });
  const { voidOdometerReadingForSource } = await import(
    "@/lib/vehicle-odometer"
  );
  await voidOdometerReadingForSource(db, { prepaidCardEntryId: entry.id });
}
