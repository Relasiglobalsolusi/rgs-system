import type { Prisma, PrismaClient } from "@prisma/client";

import { isVehicleItemType } from "@/lib/inventory-sku";
import { isOwnerAccount } from "@/lib/permissions";
import {
  isDirectorPosition,
  isOperationsManagerPosition,
} from "@/lib/positions";
import { formatVehicleIdentityLabel } from "@/lib/vehicle-plate";

type Db = PrismaClient | Prisma.TransactionClient;

export const DEFAULT_KM_PER_LITRE_MIN = 12;
export const DEFAULT_KM_PER_LITRE_MAX = 15;
export const SHORT_FILL_USED_RATIO = 0.4;
export const SHORT_REFILL_RATIO = 0.8;
export const TANK_FILL_TOLERANCE = 0.1;

export type VehicleOdometerFlagReason =
  | "SHORT_INTERVAL"
  | "OVER_USE"
  | "OVER_FILL";

export type VehicleOdometerOption = {
  id: string;
  plate: string;
  name: string;
  sku: string;
  year: number | null;
  label: string;
  lastOdometerKm: number | null;
  kmPerLitreMin: number;
  kmPerLitreMax: number;
  lastFillLitres: number | null;
  fuelLeftMin: number | null;
  fuelLeftMax: number | null;
  tankLitres: number | null;
  hasInitial: boolean;
};

export type FuelFillPreview = {
  vehicleAssetId: string;
  plate: string;
  label: string;
  previousKm: number | null;
  readingKm: number;
  kmTraveled: number | null;
  litresFilled: number;
  lastFillLitres: number | null;
  tankLitres: number | null;
  tankLimitLitres: number | null;
  isFirstFuelFill: boolean;
  kmPerLitreMin: number;
  kmPerLitreMax: number;
  expectedKmMin: number | null;
  expectedKmMax: number | null;
  fuelUsedMin: number | null;
  fuelUsedMax: number | null;
  fuelLeftBeforeMin: number | null;
  fuelLeftBeforeMax: number | null;
  fuelLeftAfterMin: number;
  fuelLeftAfterMax: number;
  flagged: boolean;
  flagReason: VehicleOdometerFlagReason | null;
};

export const vehicleOdometerAssetSelect = {
  id: true,
  assetCode: true,
  vehicleYear: true,
  currentOdometerKm: true,
  initialOdometerKm: true,
  kmPerLitreMin: true,
  kmPerLitreMax: true,
  lastFillLitres: true,
  estimatedFuelLeftLitresMin: true,
  estimatedFuelLeftLitresMax: true,
  item: {
    select: {
      name: true,
      sku: true,
      itemType: true,
      kmPerLitreMin: true,
      kmPerLitreMax: true,
      fuelTankLitres: true,
    },
  },
} as const;

function asFinite(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function roundLitres(value: number): number {
  return Math.round(value * 10) / 10;
}

export function parseOdometerKm(value: unknown): number | null {
  const raw = String(value ?? "").replace(/[^\d]/g, "");
  if (!raw) return null;
  const reading = Number(raw);
  if (!Number.isInteger(reading) || reading < 0 || reading > 9_999_999) {
    return null;
  }
  return reading;
}

export function parseFuelTankLitres(value: unknown): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 10 || n > 300) return null;
  return roundLitres(n);
}

export function requireFuelTankLitres(value: unknown): number {
  const tank = parseFuelTankLitres(value);
  if (tank == null) {
    throw new Error(fuelTankRequiredMessage());
  }
  return tank;
}

export function tankFillLimitLitres(tankLitres: number): number {
  return roundLitres(tankLitres * (1 + TANK_FILL_TOLERANCE));
}

export function exceedsTankCapacity(
  litres: number,
  tankLitres: number | null | undefined
): boolean {
  if (tankLitres == null || tankLitres <= 0) return false;
  return litres > tankFillLimitLitres(tankLitres);
}

export function parseLitres(value: unknown): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 500) return null;
  return roundLitres(n);
}

export function parseKmPerLitre(value: unknown): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 3 || n > 50) return null;
  return Math.round(n * 10) / 10;
}

export function parseKmPerLitreRange(minRaw: unknown, maxRaw: unknown): {
  min: number;
  max: number;
} | null {
  const min = parseKmPerLitre(minRaw);
  const max = parseKmPerLitre(maxRaw);
  if (min == null || max == null || max < min) return null;
  return { min, max };
}

export function formatOdometerKm(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString("id-ID")} km`;
}

export function formatLitres(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} L`;
}

export function formatLitresRange(
  min: number | null | undefined,
  max: number | null | undefined
): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null && min === max) return formatLitres(min);
  if (min != null && max != null) {
    return `${formatLitres(min)}–${formatLitres(max)}`;
  }
  return formatLitres(min ?? max);
}

export function formatKmPerLitreRange(
  min: number | null | undefined,
  max: number | null | undefined
): string {
  const range = kmPerLitreOf({
    kmPerLitreMin: min ?? null,
    kmPerLitreMax: max ?? null,
  });
  return `${range.min.toLocaleString("id-ID")}–${range.max.toLocaleString("id-ID")} km/L`;
}

export function lastOdometerKm(asset: {
  currentOdometerKm?: number | null;
  initialOdometerKm?: number | null;
}): number | null {
  return asset.currentOdometerKm ?? asset.initialOdometerKm ?? null;
}

export function kmPerLitreOf(asset: {
  kmPerLitreMin?: number | null;
  kmPerLitreMax?: number | null;
}): { min: number; max: number } {
  const min =
    asset.kmPerLitreMin && asset.kmPerLitreMin > 0
      ? asset.kmPerLitreMin
      : DEFAULT_KM_PER_LITRE_MIN;
  const max =
    asset.kmPerLitreMax && asset.kmPerLitreMax > 0
      ? asset.kmPerLitreMax
      : DEFAULT_KM_PER_LITRE_MAX;
  return min <= max ? { min, max } : { min: max, max: min };
}

export function remainingKmOf(
  litresMin: number,
  litresMax: number,
  economy: { min: number; max: number }
): { min: number; max: number } {
  return {
    min: Math.round(Math.max(0, litresMin) * economy.min),
    max: Math.round(Math.max(0, litresMax) * economy.max),
  };
}

export function requireKmPerLitreRange(
  minRaw: unknown,
  maxRaw: unknown
): { min: number; max: number } {
  const range = parseKmPerLitreRange(minRaw, maxRaw);
  if (!range) {
    throw new Error(kmPerLitreRequiredMessage());
  }
  return range;
}

export function evaluateFuelFill(input: {
  previousKm: number | null;
  readingKm: number;
  litresFilled: number;
  lastFillLitres?: number | null;
  fuelLeftMin?: number | null;
  fuelLeftMax?: number | null;
  tankLitres?: number | null;
  kmPerLitreMin?: number | null;
  kmPerLitreMax?: number | null;
}): Omit<FuelFillPreview, "vehicleAssetId" | "plate" | "label"> {
  if (input.previousKm != null && input.readingKm < input.previousKm) {
    throw new Error("ODOMETER_WENT_BACK");
  }
  const economy = kmPerLitreOf({
    kmPerLitreMin: input.kmPerLitreMin,
    kmPerLitreMax: input.kmPerLitreMax,
  });
  const kmTraveled =
    input.previousKm != null ? input.readingKm - input.previousKm : null;
  const tankKnown =
    input.fuelLeftMin != null ||
    input.fuelLeftMax != null ||
    input.lastFillLitres != null;
  const isFirstFuelFill = !tankKnown;
  const lastFillLitres = input.lastFillLitres ?? null;
  const litresFilled = roundLitres(input.litresFilled);
  const tankLitres = input.tankLitres ?? null;
  const tankLimitLitres =
    tankLitres != null ? tankFillLimitLitres(tankLitres) : null;

  if (isFirstFuelFill) {
    const remaining = remainingKmOf(litresFilled, litresFilled, economy);
    const flagReason = exceedsTankCapacity(litresFilled, tankLitres)
      ? "OVER_FILL"
      : null;
    return {
      previousKm: input.previousKm,
      readingKm: input.readingKm,
      kmTraveled,
      litresFilled,
      lastFillLitres: null,
      tankLitres,
      tankLimitLitres,
      isFirstFuelFill: true,
      kmPerLitreMin: economy.min,
      kmPerLitreMax: economy.max,
      expectedKmMin: remaining.min,
      expectedKmMax: remaining.max,
      fuelUsedMin: null,
      fuelUsedMax: null,
      fuelLeftBeforeMin: null,
      fuelLeftBeforeMax: null,
      fuelLeftAfterMin: litresFilled,
      fuelLeftAfterMax: litresFilled,
      flagged: flagReason != null,
      flagReason,
    };
  }

  const leftoverMin = input.fuelLeftMin ?? lastFillLitres;
  const leftoverMax = input.fuelLeftMax ?? lastFillLitres;
  let fuelUsedMin: number | null = null;
  let fuelUsedMax: number | null = null;
  let fuelLeftBeforeMin = leftoverMin != null ? roundLitres(leftoverMin) : null;
  let fuelLeftBeforeMax = leftoverMax != null ? roundLitres(leftoverMax) : null;
  let flagReason: VehicleOdometerFlagReason | null = null;

  if (kmTraveled != null && kmTraveled > 0) {
    fuelUsedMin = roundLitres(kmTraveled / economy.max);
    fuelUsedMax = roundLitres(kmTraveled / economy.min);
    if (leftoverMin != null) {
      fuelLeftBeforeMin = roundLitres(Math.max(0, leftoverMin - fuelUsedMax));
    }
    if (leftoverMax != null) {
      fuelLeftBeforeMax = roundLitres(Math.max(0, leftoverMax - fuelUsedMin));
    }
    const maxPossibleKm = leftoverMax != null ? leftoverMax * economy.max : null;
    if (maxPossibleKm != null && kmTraveled > maxPossibleKm + 1) {
      flagReason = "OVER_USE";
    }
  }

  const fuelLeftAfterMin = roundLitres(
    (fuelLeftBeforeMin ?? 0) + litresFilled
  );
  const fuelLeftAfterMax = roundLitres(
    (fuelLeftBeforeMax ?? 0) + litresFilled
  );

  if (
    exceedsTankCapacity(litresFilled, tankLitres) ||
    exceedsTankCapacity(fuelLeftAfterMin, tankLitres)
  ) {
    flagReason = "OVER_FILL";
  } else if (
    flagReason == null &&
    tankLitres != null &&
    fuelLeftBeforeMin != null &&
    fuelLeftBeforeMin / tankLitres > SHORT_FILL_USED_RATIO &&
    litresFilled >= tankLitres * SHORT_REFILL_RATIO
  ) {
    flagReason = "SHORT_INTERVAL";
  }

  const remaining = remainingKmOf(
    fuelLeftAfterMin,
    fuelLeftAfterMax,
    economy
  );

  return {
    previousKm: input.previousKm,
    readingKm: input.readingKm,
    kmTraveled,
    litresFilled,
    lastFillLitres,
    tankLitres,
    tankLimitLitres,
    isFirstFuelFill: false,
    kmPerLitreMin: economy.min,
    kmPerLitreMax: economy.max,
    expectedKmMin: remaining.min,
    expectedKmMax: remaining.max,
    fuelUsedMin,
    fuelUsedMax,
    fuelLeftBeforeMin,
    fuelLeftBeforeMax,
    fuelLeftAfterMin,
    fuelLeftAfterMax,
    flagged: flagReason != null,
    flagReason,
  };
}

export function previewFuelFill(input: {
  vehicle: VehicleOdometerOption;
  readingKm: number;
  litresFilled: number;
}): FuelFillPreview {
  const preview = evaluateFuelFill({
    previousKm: input.vehicle.lastOdometerKm,
    readingKm: input.readingKm,
    litresFilled: input.litresFilled,
    lastFillLitres: input.vehicle.lastFillLitres,
    fuelLeftMin: input.vehicle.fuelLeftMin,
    fuelLeftMax: input.vehicle.fuelLeftMax,
    tankLitres: input.vehicle.tankLitres,
    kmPerLitreMin: input.vehicle.kmPerLitreMin,
    kmPerLitreMax: input.vehicle.kmPerLitreMax,
  });
  return {
    vehicleAssetId: input.vehicle.id,
    plate: input.vehicle.plate,
    label: input.vehicle.label,
    ...preview,
  };
}

export function toVehicleOdometerOption(asset: {
  id: string;
  assetCode: string;
  vehicleYear: number | null;
  currentOdometerKm?: number | null;
  initialOdometerKm?: number | null;
  kmPerLitreMin?: unknown;
  kmPerLitreMax?: unknown;
  lastFillLitres?: unknown;
  estimatedFuelLeftLitresMin?: unknown;
  estimatedFuelLeftLitresMax?: unknown;
  item: {
    name: string;
    sku: string;
    kmPerLitreMin?: unknown;
    kmPerLitreMax?: unknown;
    fuelTankLitres?: unknown;
  };
}): VehicleOdometerOption {
  const economy = kmPerLitreOf({
    kmPerLitreMin:
      asFinite(asset.item.kmPerLitreMin) ?? asFinite(asset.kmPerLitreMin),
    kmPerLitreMax:
      asFinite(asset.item.kmPerLitreMax) ?? asFinite(asset.kmPerLitreMax),
  });
  return {
    id: asset.id,
    plate: asset.assetCode,
    name: asset.item.name,
    sku: asset.item.sku,
    year: asset.vehicleYear,
    label: formatVehicleIdentityLabel({
      plate: asset.assetCode,
      name: asset.item.name,
      sku: asset.item.sku,
      year: asset.vehicleYear,
    }),
    lastOdometerKm: lastOdometerKm(asset),
    kmPerLitreMin: economy.min,
    kmPerLitreMax: economy.max,
    lastFillLitres: asFinite(asset.lastFillLitres),
    fuelLeftMin: asFinite(asset.estimatedFuelLeftLitresMin),
    fuelLeftMax: asFinite(asset.estimatedFuelLeftLitresMax),
    tankLitres: asFinite(asset.item.fuelTankLitres),
    hasInitial:
      asset.initialOdometerKm != null || asset.currentOdometerKm != null,
  };
}

export async function requireVehicleAssetForOdometer(
  db: Db,
  companyId: string,
  vehicleAssetId: string
) {
  const asset = await db.equipmentAsset.findFirst({
    where: {
      id: vehicleAssetId,
      companyId,
      status: { not: "RETIRED" },
    },
    select: vehicleOdometerAssetSelect,
  });
  if (!asset || !isVehicleItemType(asset.item.itemType)) {
    throw new Error("Choose which vehicle this fuel is for.");
  }
  return asset;
}

export async function resolveVehicleAssetForPrepaidFuel(
  db: Db,
  options: {
    companyId: string;
    vehicleItemId: string | null;
    vehicleAssetId?: string | null;
  }
) {
  if (!options.vehicleItemId) {
    throw new Error("This Card is not assigned to a vehicle.");
  }
  const assets = await db.equipmentAsset.findMany({
    where: {
      companyId: options.companyId,
      itemId: options.vehicleItemId,
      status: { not: "RETIRED" },
    },
    select: vehicleOdometerAssetSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const live = assets.filter((asset) => isVehicleItemType(asset.item.itemType));
  if (options.vehicleAssetId) {
    const match = live.find((asset) => asset.id === options.vehicleAssetId);
    if (!match) {
      throw new Error("Choose which plate this fuel is for.");
    }
    return match;
  }
  if (live.length === 1) return live[0];
  if (live.length === 0) {
    throw new Error("This Card has no vehicle plate in Inventory.");
  }
  throw new Error("Choose which plate this fuel is for.");
}

export async function recordVehicleOdometerReading(
  db: Db,
  options: {
    companyId: string;
    vehicleAssetId: string;
    readingKm: number;
    litresFilled?: number | null;
    source: "MANUAL" | "PETTY_CASH" | "PREPAID" | "PURCHASE_INVOICE";
    kind?: "INITIAL" | "REFUEL";
    recordedAt: Date;
    createdById?: string | null;
    prepaidCardEntryId?: string | null;
    pettyCashEntryId?: string | null;
    purchaseInvoiceId?: string | null;
  }
) {
  const asset = await requireVehicleAssetForOdometer(
    db,
    options.companyId,
    options.vehicleAssetId
  );
  const previousKm = lastOdometerKm(asset);
  const kind =
    options.kind ?? (previousKm == null ? "INITIAL" : "REFUEL");
  const litresFilled = options.litresFilled ?? null;

  if (litresFilled == null) {
    if (previousKm != null && options.readingKm < previousKm) {
      throw new Error("ODOMETER_WENT_BACK");
    }
    await db.equipmentAsset.update({
      where: { id: asset.id },
      data: {
        currentOdometerKm: options.readingKm,
        initialOdometerKm: asset.initialOdometerKm ?? options.readingKm,
      },
    });
    return db.vehicleOdometerReading.create({
      data: {
        companyId: options.companyId,
        vehicleAssetId: asset.id,
        readingKm: options.readingKm,
        previousReadingKm: previousKm,
        kmTraveled:
          previousKm != null ? options.readingKm - previousKm : null,
        kind,
        source: options.source,
        createdById: options.createdById ?? null,
        recordedAt: options.recordedAt,
        prepaidCardEntryId: options.prepaidCardEntryId ?? null,
        pettyCashEntryId: options.pettyCashEntryId ?? null,
        purchaseInvoiceId: options.purchaseInvoiceId ?? null,
      },
    });
  }

  const preview = evaluateFuelFill({
    previousKm,
    readingKm: options.readingKm,
    litresFilled,
    lastFillLitres: asFinite(asset.lastFillLitres),
    fuelLeftMin: asFinite(asset.estimatedFuelLeftLitresMin),
    fuelLeftMax: asFinite(asset.estimatedFuelLeftLitresMax),
    tankLitres: asFinite(asset.item.fuelTankLitres),
    kmPerLitreMin:
      asFinite(asset.item.kmPerLitreMin) ?? asFinite(asset.kmPerLitreMin),
    kmPerLitreMax:
      asFinite(asset.item.kmPerLitreMax) ?? asFinite(asset.kmPerLitreMax),
  });
  if (preview.flagReason === "OVER_FILL") {
    throw new Error(
      tankOverCapacityMessage(preview.tankLitres, preview.tankLimitLitres)
    );
  }
  await db.equipmentAsset.update({
    where: { id: asset.id },
    data: {
      currentOdometerKm: preview.readingKm,
      initialOdometerKm: asset.initialOdometerKm ?? preview.readingKm,
      lastFillLitres: preview.litresFilled,
      estimatedFuelLeftLitresMin: preview.fuelLeftAfterMin,
      estimatedFuelLeftLitresMax: preview.fuelLeftAfterMax,
    },
  });
  return db.vehicleOdometerReading.create({
    data: {
      companyId: options.companyId,
      vehicleAssetId: asset.id,
      readingKm: preview.readingKm,
      previousReadingKm: preview.previousKm,
      kmTraveled: preview.kmTraveled,
      litresFilled: preview.litresFilled,
      fuelUsedLitresMin: preview.fuelUsedMin,
      fuelUsedLitresMax: preview.fuelUsedMax,
      fuelLeftBeforeMin: preview.fuelLeftBeforeMin,
      fuelLeftBeforeMax: preview.fuelLeftBeforeMax,
      fuelLeftAfterMin: preview.fuelLeftAfterMin,
      fuelLeftAfterMax: preview.fuelLeftAfterMax,
      expectedKmMin: preview.expectedKmMin,
      expectedKmMax: preview.expectedKmMax,
      kind,
      source: options.source,
      flagged: preview.flagged,
      flagReason: preview.flagReason,
      prepaidCardEntryId: options.prepaidCardEntryId ?? null,
      pettyCashEntryId: options.pettyCashEntryId ?? null,
      purchaseInvoiceId: options.purchaseInvoiceId ?? null,
      createdById: options.createdById ?? null,
      recordedAt: options.recordedAt,
    },
  });
}

export async function voidOdometerReadingForSource(
  db: Db,
  options: {
    purchaseInvoiceId?: string | null;
    prepaidCardEntryId?: string | null;
    pettyCashEntryId?: string | null;
  }
) {
  const where: Prisma.VehicleOdometerReadingWhereInput[] = [];
  if (options.purchaseInvoiceId) {
    where.push({ purchaseInvoiceId: options.purchaseInvoiceId });
  }
  if (options.prepaidCardEntryId) {
    where.push({ prepaidCardEntryId: options.prepaidCardEntryId });
  }
  if (options.pettyCashEntryId) {
    where.push({ pettyCashEntryId: options.pettyCashEntryId });
  }
  if (where.length === 0) return;
  const reading = await db.vehicleOdometerReading.findFirst({
    where: { OR: where },
    select: {
      id: true,
      vehicleAssetId: true,
      previousReadingKm: true,
      recordedAt: true,
    },
  });
  if (!reading) return;
  const later = await db.vehicleOdometerReading.findFirst({
    where: {
      vehicleAssetId: reading.vehicleAssetId,
      id: { not: reading.id },
      recordedAt: { gt: reading.recordedAt },
    },
    select: { id: true },
  });
  const previous = await db.vehicleOdometerReading.findFirst({
    where: {
      vehicleAssetId: reading.vehicleAssetId,
      id: { not: reading.id },
      recordedAt: { lt: reading.recordedAt },
    },
    orderBy: { recordedAt: "desc" },
    select: {
      litresFilled: true,
      fuelLeftAfterMin: true,
      fuelLeftAfterMax: true,
    },
  });
  await db.vehicleOdometerReading.delete({ where: { id: reading.id } });
  if (!later) {
    const stillHasFuel = previous?.litresFilled != null;
    await db.equipmentAsset.update({
      where: { id: reading.vehicleAssetId },
      data: {
        currentOdometerKm: reading.previousReadingKm,
        lastFillLitres: previous?.litresFilled ?? null,
        estimatedFuelLeftLitresMin: previous?.fuelLeftAfterMin ?? null,
        estimatedFuelLeftLitresMax: previous?.fuelLeftAfterMax ?? null,
        ...(stillHasFuel ? {} : { fullTankLitres: null }),
      },
    });
  }
}

export async function loadFlaggedFuelFills(db: Db, companyId: string) {
  return db.vehicleOdometerReading.findMany({
    where: {
      companyId,
      flagged: true,
      acknowledgedAt: null,
    },
    select: {
      id: true,
      readingKm: true,
      previousReadingKm: true,
      kmTraveled: true,
      flagReason: true,
      litresFilled: true,
      fuelUsedLitresMin: true,
      fuelUsedLitresMax: true,
      fuelLeftBeforeMin: true,
      fuelLeftBeforeMax: true,
      recordedAt: true,
      vehicleAsset: {
        select: {
          id: true,
          assetCode: true,
          kmPerLitreMin: true,
          kmPerLitreMax: true,
          item: { select: { name: true } },
        },
      },
    },
    orderBy: { recordedAt: "desc" },
    take: 20,
  });
}

export function canSeeFuelRangeAlerts(input: {
  username?: string | null;
  jobPosition?: { slug?: string | null; name?: string | null } | null;
}): boolean {
  if (isOwnerAccount({ username: input.username })) return true;
  const position = input.jobPosition;
  if (!position) return false;
  return (
    isOperationsManagerPosition(position) || isDirectorPosition(position)
  );
}

export function odometerWentBackMessage(): string {
  return "The odometer cannot be lower than the last reading on this vehicle.";
}

export function odometerRequiredMessage(): string {
  return "Enter the current odometer in kilometers.";
}

export function litresRequiredMessage(): string {
  return "Enter how many litres were filled.";
}

export function kmPerLitreRequiredMessage(): string {
  return "Enter the average range per litre, low and high (for example 10 and 15).";
}

export function fuelTankRequiredMessage(): string {
  return "Enter the estimated fuel tank size in litres (for example 40).";
}

export function tankOverCapacityMessage(
  tankLitres?: number | null,
  limitLitres?: number | null
): string {
  if (tankLitres != null && limitLitres != null) {
    return `This fill is more than the ${tankLitres.toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} L tank plus 10% (max ${limitLitres.toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} L).`;
  }
  return "This fill is more than the fuel tank plus 10%.";
}
