import type { Prisma } from "@prisma/client";

import { toDecimal } from "@/lib/inventory";
import { parseContractPrice, decimalToNumber } from "@/lib/project-billing";
import {
  summarizeVehicleLeaseProgress,
  type VehicleLeaseInput,
} from "@/lib/vehicle-lease";

type DbClient = Prisma.TransactionClient;

const LEASE_ASSET_SELECT = {
  id: true,
  assetCode: true,
  vehicleYear: true,
  isVehicleLease: true,
  leaseOtrAmount: true,
  leaseDownPayment: true,
  leaseTenorMonths: true,
  leaseInterestPercentYear: true,
  leaseAdminFee: true,
  leaseInsuranceAmount: true,
  leaseFiduciaryFee: true,
  leaseProvisionFee: true,
  leaseOtherFee: true,
  leaseMonthlyInstallment: true,
} as const;

export type VehicleLeaseAssetRow = Prisma.EquipmentAssetGetPayload<{
  select: typeof LEASE_ASSET_SELECT;
}>;

export function leaseInputFromAsset(asset: {
  leaseOtrAmount?: Parameters<typeof decimalToNumber>[0];
  leaseDownPayment?: Parameters<typeof decimalToNumber>[0];
  leaseTenorMonths?: number | null;
  leaseInterestPercentYear?: Parameters<typeof decimalToNumber>[0];
  leaseAdminFee?: Parameters<typeof decimalToNumber>[0];
  leaseInsuranceAmount?: Parameters<typeof decimalToNumber>[0];
  leaseFiduciaryFee?: Parameters<typeof decimalToNumber>[0];
  leaseProvisionFee?: Parameters<typeof decimalToNumber>[0];
  leaseOtherFee?: Parameters<typeof decimalToNumber>[0];
  leaseMonthlyInstallment?: Parameters<typeof decimalToNumber>[0];
}): VehicleLeaseInput & { monthlyInstallment?: number | null } {
  return {
    otrAmount: decimalToNumber(asset.leaseOtrAmount) ?? 0,
    downPayment: decimalToNumber(asset.leaseDownPayment) ?? 0,
    tenorMonths: asset.leaseTenorMonths ?? 0,
    interestPercentYear: decimalToNumber(asset.leaseInterestPercentYear) ?? 0,
    adminFee: decimalToNumber(asset.leaseAdminFee) ?? 0,
    insuranceAmount: decimalToNumber(asset.leaseInsuranceAmount) ?? 0,
    fiduciaryFee: decimalToNumber(asset.leaseFiduciaryFee) ?? 0,
    provisionFee: decimalToNumber(asset.leaseProvisionFee) ?? 0,
    otherFee: decimalToNumber(asset.leaseOtherFee) ?? 0,
    monthlyInstallment: decimalToNumber(asset.leaseMonthlyInstallment),
  };
}

function parseNonNegAmount(formData: FormData, name: string): number {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return 0;
  const amount = parseContractPrice(raw);
  if (amount == null || amount < 0) {
    throw new Error("Enter a valid amount.");
  }
  return amount;
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

async function createSettlementInvoice(
  db: DbClient,
  options: {
    companyId: string;
    userId: string;
    asset: VehicleLeaseAssetRow;
    amount: number;
    description: string;
    invoiceRef: string;
    paidAt: Date;
    bankAccountId: string;
    filePath: string;
    vehicleExpenseKind: "LEASE_PAYMENT" | "OTHER";
  }
) {
  if (options.amount <= 0) return;
  await db.purchaseInvoice.create({
    data: {
      companyId: options.companyId,
      supplierName: "Vehicle Lease Settlement",
      invoiceRef: options.invoiceRef,
      invoiceDate: options.paidAt,
      amount: toDecimal(options.amount),
      filePath: options.filePath,
      hasInvoice: false,
      notes: options.description,
      purchaseCategory: "VEHICLE",
      purpose: "INTERNAL",
      paymentTermsDays: 0,
      paidAt: options.paidAt,
      paidById: options.userId,
      bankAccountId: options.bankAccountId,
      vehicleExpenseKind: options.vehicleExpenseKind,
      vehicleAssetId: options.asset.id,
      vehicleOtherCostDescription:
        options.vehicleExpenseKind === "OTHER" ? options.description : null,
      vehiclePlate: options.asset.assetCode,
      vehicleYear: options.asset.vehicleYear,
      isVehicleLease: true,
      createdById: options.userId,
    },
  });
}

/**
 * When selling a leased plate that is not paid off, book the bank payoff and
 * early-termination amounts as vehicle expenses from the sale bank.
 */
export async function bookLeasedVehicleSaleSettlements(
  db: DbClient,
  options: {
    companyId: string;
    userId: string;
    assetIds: string[];
    formData: FormData;
    soldAt: Date;
    settlementPaidAt: Date | null;
    settlementBankAccountId: string | null;
    settlementFilePath: string | null;
    payoffRequiredMessage: (plate: string) => string;
    settlementRequiredMessage: string;
  }
): Promise<string[]> {
  const assetIds = [...new Set(options.assetIds.filter(Boolean))];
  if (assetIds.length === 0) return [];

  const assets = await db.equipmentAsset.findMany({
    where: { id: { in: assetIds }, companyId: options.companyId },
    select: LEASE_ASSET_SELECT,
  });
  const leased = assets.filter((asset) => asset.isVehicleLease);
  if (leased.length === 0) return [];

  const plates = leased.map((asset) => asset.assetCode);
  const expenses = await db.purchaseInvoice.findMany({
    where: {
      companyId: options.companyId,
      reversedAt: null,
      OR: [
        { vehicleAssetId: { in: leased.map((asset) => asset.id) } },
        { vehiclePlate: { in: plates } },
      ],
    },
    select: {
      vehicleAssetId: true,
      vehiclePlate: true,
      vehicleExpenseKind: true,
      amount: true,
    },
  });

  const bookedAssetIds: string[] = [];
  const day = utcDateKey(options.settlementPaidAt ?? options.soldAt);

  for (const asset of leased) {
    const progress = summarizeVehicleLeaseProgress(
      leaseInputFromAsset(asset),
      expenses
        .filter(
          (row) =>
            row.vehicleAssetId === asset.id || row.vehiclePlate === asset.assetCode
        )
        .map((row) => ({
          kind: row.vehicleExpenseKind,
          amount: decimalToNumber(row.amount) ?? 0,
        }))
    );
    if (!progress || progress.paidOff) continue;

    const payoff = parseNonNegAmount(
      options.formData,
      `leasePayoff:${asset.id}`
    );
    const earlyTermination = parseNonNegAmount(
      options.formData,
      `earlyTermination:${asset.id}`
    );
    if (payoff <= 0) {
      throw new Error(options.payoffRequiredMessage(asset.assetCode));
    }
    if (
      !options.settlementPaidAt ||
      !options.settlementBankAccountId ||
      !options.settlementFilePath
    ) {
      throw new Error(options.settlementRequiredMessage);
    }

    await createSettlementInvoice(db, {
      companyId: options.companyId,
      userId: options.userId,
      asset,
      amount: payoff,
      description: "Lease Payoff",
      invoiceRef: `LEASE-PAYOFF-${asset.assetCode}-${day}`,
      paidAt: options.settlementPaidAt,
      bankAccountId: options.settlementBankAccountId,
      filePath: options.settlementFilePath,
      vehicleExpenseKind: "LEASE_PAYMENT",
    });
    await createSettlementInvoice(db, {
      companyId: options.companyId,
      userId: options.userId,
      asset,
      amount: earlyTermination,
      description: "Early Termination",
      invoiceRef: `LEASE-ET-${asset.assetCode}-${day}`,
      paidAt: options.settlementPaidAt,
      bankAccountId: options.settlementBankAccountId,
      filePath: options.settlementFilePath,
      vehicleExpenseKind: "OTHER",
    });
    bookedAssetIds.push(asset.id);
  }

  return bookedAssetIds;
}
