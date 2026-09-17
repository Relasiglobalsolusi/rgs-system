import type { TaxRateAppliesTo } from "@prisma/client";

import { toUtcDateOnly } from "@/lib/invoice-period";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import {
  TAX_RATE_CODE,
  pphTaxCodeFromChargedKind,
  slugTaxRateCode,
  taxRateMissingError,
  type TaxRatePickerRow,
  type TaxRateTypeView,
} from "@/lib/tax-rate-codes";

export {
  TAX_RATE_CODE,
  TAX_RATE_MISSING,
  chargedKindUsesPpn,
  formatTaxRatePercent,
  isCustomTaxRateType,
  isTaxRateMissing,
  pphTaxCodeFromChargedKind,
  slugTaxRateCode,
  taxRateMissingError,
  type TaxRateAppliesToValue,
  type TaxRateCodeValue,
  type TaxRatePickerRow,
  type TaxRateTypeView,
  type TaxRateVersionView,
} from "@/lib/tax-rate-codes";

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

type SystemTaxSeed = {
  code: string;
  name: string;
  appliesTo: TaxRateAppliesTo;
  commercialKind: string | null;
  ratePercent: number | null;
  effectiveFrom: Date;
  note: string;
};

/** Indonesian statutory / usual rates. Edit later from Tax Rates. */
const SYSTEM_TAX_SEEDS: SystemTaxSeed[] = [
  {
    code: TAX_RATE_CODE.PPN,
    name: "PPN",
    appliesTo: "CLIENT_CHARGE",
    commercialKind: "PPN",
    ratePercent: 11,
    effectiveFrom: utcDate(2022, 4, 1),
    note: "Effective 11% on services (statutory 12% × 11/12 DPP from 1 Jan 2025).",
  },
  {
    code: TAX_RATE_CODE.PPH_BADAN,
    name: "PPh Badan",
    appliesTo: "CORPORATE",
    commercialKind: null,
    ratePercent: 22,
    effectiveFrom: utcDate(2022, 1, 1),
    note: "Statutory corporate income tax from UU HPP 2021.",
  },
  {
    code: TAX_RATE_CODE.PPH_23,
    name: "PPh 23",
    appliesTo: "CLIENT_CHARGE",
    commercialKind: "PPH_23",
    ratePercent: 2,
    effectiveFrom: utcDate(2009, 1, 1),
    note: "Usual withholding on services, excluding VAT.",
  },
  {
    code: TAX_RATE_CODE.PPH_4_2,
    name: "PPh 4(2)",
    appliesTo: "CLIENT_CHARGE",
    commercialKind: "PPH_4_2",
    ratePercent: 10,
    effectiveFrom: utcDate(2008, 1, 1),
    note: "Usual final tax on land and building rental. Change if this job uses another article rate.",
  },
  {
    code: TAX_RATE_CODE.PPH_22,
    name: "PPh 22",
    appliesTo: "CLIENT_CHARGE",
    commercialKind: "PPH_22",
    ratePercent: 2.5,
    effectiveFrom: utcDate(2008, 1, 1),
    note: "Import withholding with API. 7.5% without API — add a version if needed.",
  },
  {
    code: TAX_RATE_CODE.PPH_26,
    name: "PPh 26",
    appliesTo: "CLIENT_CHARGE",
    commercialKind: "PPH_26",
    ratePercent: 20,
    effectiveFrom: utcDate(2008, 1, 1),
    note: "Withholding on payments to non-residents.",
  },
  {
    code: TAX_RATE_CODE.PPH_21,
    name: "PPh 21",
    appliesTo: "CLIENT_CHARGE",
    commercialKind: "PPH_21",
    ratePercent: null,
    effectiveFrom: utcDate(2008, 1, 1),
    note: "Progressive employee tax. Add a flat percent here if a job charges PPh 21.",
  },
];

export type TaxRateSlice = {
  ratePercent: number;
  from: Date;
  toExclusive: Date;
};

function toDateKey(date: Date): string {
  return toUtcDateOnly(date).toISOString().slice(0, 10);
}

export async function ensureCompanyTaxRates(companyId: string): Promise<void> {
  const existing = await prisma.taxRateType.findMany({
    where: { companyId },
    select: { code: true, versions: { select: { id: true }, take: 1 } },
  });
  const byCode = new Map(existing.map((row) => [row.code, row]));

  for (const seed of SYSTEM_TAX_SEEDS) {
    let type = byCode.get(seed.code);
    if (!type) {
      const created = await prisma.taxRateType.create({
        data: {
          companyId,
          code: seed.code,
          name: seed.name,
          appliesTo: seed.appliesTo,
          commercialKind: seed.commercialKind,
          isSystem: true,
        },
        select: { code: true, versions: { select: { id: true }, take: 1 } },
      });
      type = created;
      byCode.set(seed.code, created);
    }
    if (seed.ratePercent != null && type.versions.length === 0) {
      await prisma.taxRateVersion.create({
        data: {
          typeId: (
            await prisma.taxRateType.findFirstOrThrow({
              where: { companyId, code: seed.code },
              select: { id: true },
            })
          ).id,
          ratePercent: seed.ratePercent,
          effectiveFrom: seed.effectiveFrom,
          note: seed.note,
        },
      });
    }
  }
}

function pickRateAsOf(
  versions: { ratePercent: { toString(): string } | number; effectiveFrom: Date }[],
  asOf: Date
): number | null {
  const day = toUtcDateOnly(asOf).getTime();
  let current: number | null = null;
  for (const version of versions) {
    if (toUtcDateOnly(version.effectiveFrom).getTime() <= day) {
      current = decimalToNumber(version.ratePercent) ?? null;
    }
  }
  return current;
}

export async function taxRatePercentAsOf(
  companyId: string,
  code: string,
  asOf: Date
): Promise<number | null> {
  await ensureCompanyTaxRates(companyId);
  const type = await prisma.taxRateType.findFirst({
    where: { companyId, code, archivedAt: null },
    select: {
      versions: {
        select: { ratePercent: true, effectiveFrom: true },
        orderBy: { effectiveFrom: "asc" },
      },
    },
  });
  if (!type) return null;
  return pickRateAsOf(type.versions, asOf);
}

export async function requireTaxRatePercent(
  companyId: string,
  code: string,
  asOf: Date
): Promise<number> {
  const percent = await taxRatePercentAsOf(companyId, code, asOf);
  if (percent == null) {
    throw taxRateMissingError();
  }
  return percent;
}

export async function requirePpnRatePercent(
  companyId: string,
  asOf: Date
): Promise<number> {
  return requireTaxRatePercent(companyId, TAX_RATE_CODE.PPN, asOf);
}

export async function lookupChargedPphRate(input: {
  companyId: string;
  chargedTaxKind: string | null | undefined;
  taxRateCode?: string | null;
  asOf: Date;
}): Promise<number | null> {
  const kind = String(input.chargedTaxKind ?? "").trim().toUpperCase();
  const code = pphTaxCodeFromChargedKind(input.chargedTaxKind, input.taxRateCode);
  if (kind === "OTHER" && !code) {
    throw taxRateMissingError();
  }
  if (!code) return null;
  return requireTaxRatePercent(input.companyId, code, input.asOf);
}

export async function listTaxRateSlices(
  companyId: string,
  code: string,
  from: Date | undefined,
  toExclusive: Date | undefined
): Promise<TaxRateSlice[]> {
  await ensureCompanyTaxRates(companyId);
  const type = await prisma.taxRateType.findFirst({
    where: { companyId, code, archivedAt: null },
    select: {
      versions: {
        select: { ratePercent: true, effectiveFrom: true },
        orderBy: { effectiveFrom: "asc" },
      },
    },
  });
  if (!type || type.versions.length === 0) return [];

  const start = from ? toUtcDateOnly(from) : type.versions[0].effectiveFrom;
  const end = toExclusive
    ? toUtcDateOnly(toExclusive)
    : utcDate(9999, 12, 31);
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (endMs <= startMs) return [];

  const slices: TaxRateSlice[] = [];
  let cursor = startMs;
  let rate =
    pickRateAsOf(type.versions, new Date(startMs)) ??
    (decimalToNumber(type.versions[0].ratePercent) ?? 0);

  for (const version of type.versions) {
    const at = toUtcDateOnly(version.effectiveFrom).getTime();
    if (at <= startMs || at >= endMs) {
      if (at <= startMs) {
        rate = decimalToNumber(version.ratePercent) ?? rate;
      }
      continue;
    }
    if (at > cursor) {
      slices.push({
        ratePercent: rate,
        from: new Date(cursor),
        toExclusive: new Date(at),
      });
      cursor = at;
    }
    rate = decimalToNumber(version.ratePercent) ?? rate;
  }
  if (cursor < endMs) {
    slices.push({
      ratePercent: rate,
      from: new Date(cursor),
      toExclusive: new Date(endMs),
    });
  }
  return slices;
}

export async function listCompanyTaxRateTypes(
  companyId: string
): Promise<TaxRateTypeView[]> {
  await ensureCompanyTaxRates(companyId);
  const today = toUtcDateOnly(new Date());
  const rows = await prisma.taxRateType.findMany({
    where: { companyId, archivedAt: null },
    include: {
      versions: { orderBy: { effectiveFrom: "desc" } },
    },
    orderBy: [{ appliesTo: "asc" }, { isSystem: "desc" }, { name: "asc" }],
  });
  return rows.map((row) => {
    const chronological = [...row.versions].sort(
      (left, right) =>
        left.effectiveFrom.getTime() - right.effectiveFrom.getTime()
    );
    const currentPercent = pickRateAsOf(chronological, today);
    const current = [...chronological]
      .reverse()
      .find(
        (version) =>
          toUtcDateOnly(version.effectiveFrom).getTime() <= today.getTime()
      );
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      appliesTo: row.appliesTo,
      commercialKind: row.commercialKind,
      isSystem: row.isSystem,
      currentPercent,
      currentFrom: current ? toDateKey(current.effectiveFrom) : null,
      versions: row.versions.map((version) => ({
        id: version.id,
        ratePercent: decimalToNumber(version.ratePercent) ?? 0,
        effectiveFrom: toDateKey(version.effectiveFrom),
        note: version.note,
        createdAt: version.createdAt.toISOString(),
      })),
    };
  });
}

export async function listTaxRatesForPicker(
  companyId: string,
  asOf: Date = new Date()
): Promise<TaxRatePickerRow[]> {
  const types = await listCompanyTaxRateTypes(companyId);
  const rows: TaxRatePickerRow[] = [];
  for (const type of types) {
    const percent = await taxRatePercentAsOf(companyId, type.code, asOf);
    if (percent == null) continue;
    const current = type.versions
      .slice()
      .reverse()
      .find(
        (version) =>
          toUtcDateOnly(new Date(version.effectiveFrom)).getTime() <=
          toUtcDateOnly(asOf).getTime()
      );
    rows.push({
      code: type.code,
      name: type.name,
      appliesTo: type.appliesTo,
      commercialKind: type.commercialKind,
      isSystem: type.isSystem,
      ratePercent: percent,
      effectiveFrom: current?.effectiveFrom ?? type.currentFrom ?? toDateKey(asOf),
    });
  }
  return rows;
}

export async function createTaxRateType(input: {
  companyId: string;
  name: string;
  appliesTo: TaxRateAppliesTo;
  ratePercent: number;
  effectiveFrom: Date;
  note?: string | null;
  createdById?: string | null;
}): Promise<TaxRateTypeView> {
  await ensureCompanyTaxRates(input.companyId);
  const name = input.name.trim();
  if (!name) throw new Error("Enter the tax type name.");
  let code = slugTaxRateCode(name);
  const taken = await prisma.taxRateType.findMany({
    where: { companyId: input.companyId },
    select: { code: true },
  });
  const used = new Set(taken.map((row) => row.code));
  if (used.has(code)) {
    let index = 2;
    while (used.has(`${code}_${index}`)) index += 1;
    code = `${code}_${index}`;
  }
  await prisma.taxRateType.create({
    data: {
      companyId: input.companyId,
      code,
      name,
      appliesTo: input.appliesTo,
      commercialKind: input.appliesTo === "CLIENT_CHARGE" ? "OTHER" : null,
      isSystem: false,
      versions: {
        create: {
          ratePercent: input.ratePercent,
          effectiveFrom: toUtcDateOnly(input.effectiveFrom),
          note: input.note?.trim() || null,
          createdById: input.createdById ?? null,
        },
      },
    },
  });
  const types = await listCompanyTaxRateTypes(input.companyId);
  const created = types.find((row) => row.code === code);
  if (!created) throw new Error("Could not save the tax type.");
  return created;
}

export async function addTaxRateVersion(input: {
  companyId: string;
  typeId: string;
  ratePercent: number;
  effectiveFrom: Date;
  note?: string | null;
  createdById?: string | null;
}): Promise<void> {
  const type = await prisma.taxRateType.findFirst({
    where: { id: input.typeId, companyId: input.companyId, archivedAt: null },
    select: { id: true },
  });
  if (!type) throw new Error("Tax type not found.");
  const day = toUtcDateOnly(input.effectiveFrom);
  const existing = await prisma.taxRateVersion.findFirst({
    where: { typeId: type.id, effectiveFrom: day },
    select: { id: true },
  });
  if (existing) {
    await prisma.taxRateVersion.update({
      where: { id: existing.id },
      data: {
        ratePercent: input.ratePercent,
        note: input.note?.trim() || null,
        createdById: input.createdById ?? null,
      },
    });
    return;
  }
  await prisma.taxRateVersion.create({
    data: {
      typeId: type.id,
      ratePercent: input.ratePercent,
      effectiveFrom: day,
      note: input.note?.trim() || null,
      createdById: input.createdById ?? null,
    },
  });
}

export function parseTaxRatePercentInput(raw: string): number {
  const trimmed = raw.trim().replace("%", "").replace(",", ".");
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Enter a tax rate between 0 and 100.");
  }
  return Math.round(value * 10000) / 10000;
}
