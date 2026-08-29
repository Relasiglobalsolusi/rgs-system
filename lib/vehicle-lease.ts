/**
 * Indonesian finance-lease (pembiayaan) schedule for a company vehicle.
 * Typical 2026 market: DP 20–30%, tenor 12–60 months, effective 11–16% / year,
 * plus admin, insurance, fiduciary, and provision fees paid up front.
 */

export type VehicleLeaseInput = {
  otrAmount: number;
  downPayment: number;
  tenorMonths: number;
  interestPercentYear: number;
  adminFee: number;
  insuranceAmount: number;
  fiduciaryFee: number;
  provisionFee: number;
  otherFee: number;
};

export type VehicleLeaseSchedule = {
  principal: number;
  upfrontAmount: number;
  monthlyInstallment: number;
  totalInstallments: number;
  totalCost: number;
};

function moneyOrZero(value: number | null | undefined): number {
  return Number.isFinite(value) && (value ?? 0) >= 0 ? Number(value) : 0;
}

export function calculateVehicleLease(
  input: VehicleLeaseInput
): VehicleLeaseSchedule | null {
  const otrAmount = moneyOrZero(input.otrAmount);
  const downPayment = moneyOrZero(input.downPayment);
  const tenorMonths = Math.round(moneyOrZero(input.tenorMonths));
  const interestPercentYear = moneyOrZero(input.interestPercentYear);
  const adminFee = moneyOrZero(input.adminFee);
  const insuranceAmount = moneyOrZero(input.insuranceAmount);
  const fiduciaryFee = moneyOrZero(input.fiduciaryFee);
  const provisionFee = moneyOrZero(input.provisionFee);
  const otherFee = moneyOrZero(input.otherFee);

  if (otrAmount <= 0 || tenorMonths < 1) return null;

  const principal = Math.max(0, Math.round((otrAmount - downPayment) * 100) / 100);
  const monthlyRate = interestPercentYear / 100 / 12;
  let monthlyInstallment: number;
  if (principal <= 0) {
    monthlyInstallment = 0;
  } else if (monthlyRate <= 0) {
    monthlyInstallment = Math.round((principal / tenorMonths) * 100) / 100;
  } else {
    const factor = Math.pow(1 + monthlyRate, tenorMonths);
    monthlyInstallment =
      Math.round(((principal * monthlyRate * factor) / (factor - 1)) * 100) /
      100;
  }

  const upfrontAmount =
    Math.round(
      (downPayment + adminFee + insuranceAmount + fiduciaryFee + provisionFee + otherFee) *
        100
    ) / 100;
  const totalInstallments =
    Math.round(monthlyInstallment * tenorMonths * 100) / 100;
  const totalCost = Math.round((upfrontAmount + totalInstallments) * 100) / 100;

  return {
    principal,
    upfrontAmount,
    monthlyInstallment,
    totalInstallments,
    totalCost,
  };
}

export type VehicleLeasePaidRow = {
  kind: string | null | undefined;
  amount: number;
};

export type VehicleLeaseProgress = {
  otrAmount: number;
  downPayment: number;
  principal: number;
  tenorMonths: number;
  interestPercentYear: number;
  monthlyInstallment: number;
  adminFee: number;
  insuranceAmount: number;
  fiduciaryFee: number;
  provisionFee: number;
  otherFee: number;
  upfrontFees: number;
  upfrontAmount: number;
  totalInstallments: number;
  scheduledTotalCost: number;
  installmentsPaidCount: number;
  installmentsRemaining: number;
  installmentPaidAmount: number;
  leaseCashPaid: number;
  remainingToPay: number;
  paidOff: boolean;
  otherSpend: number;
  totalSpent: number;
};

/** Remaining lease vs cash already paid on this vehicle. */
export function summarizeVehicleLeaseProgress(
  input: VehicleLeaseInput & { monthlyInstallment?: number | null },
  payments: VehicleLeasePaidRow[]
): VehicleLeaseProgress | null {
  const schedule = calculateVehicleLease(input);
  if (!schedule) return null;

  const monthlyInstallment =
    input.monthlyInstallment != null && Number.isFinite(input.monthlyInstallment)
      ? moneyOrZero(input.monthlyInstallment)
      : schedule.monthlyInstallment;

  let installmentPaidAmount = 0;
  let installmentsPaidCount = 0;
  let purchasePaid = 0;
  let otherSpend = 0;
  for (const row of payments) {
    const amount = moneyOrZero(row.amount);
    const kind = String(row.kind ?? "").trim().toUpperCase();
    if (kind === "LEASE_PAYMENT") {
      installmentPaidAmount += amount;
      installmentsPaidCount += 1;
    } else if (kind === "PURCHASE") {
      purchasePaid += amount;
    } else {
      otherSpend += amount;
    }
  }

  const leaseCashPaid = Math.round((purchasePaid + installmentPaidAmount) * 100) / 100;
  const remainingToPay = Math.max(
    0,
    Math.round((schedule.totalCost - leaseCashPaid) * 100) / 100
  );
  const tenorMonths = Math.round(moneyOrZero(input.tenorMonths));
  const remainingMonths = Math.max(0, tenorMonths - installmentsPaidCount);

  return {
    otrAmount: moneyOrZero(input.otrAmount),
    downPayment: moneyOrZero(input.downPayment),
    principal: schedule.principal,
    tenorMonths,
    interestPercentYear: moneyOrZero(input.interestPercentYear),
    monthlyInstallment,
    adminFee: moneyOrZero(input.adminFee),
    insuranceAmount: moneyOrZero(input.insuranceAmount),
    fiduciaryFee: moneyOrZero(input.fiduciaryFee),
    provisionFee: moneyOrZero(input.provisionFee),
    otherFee: moneyOrZero(input.otherFee),
    upfrontFees:
      Math.round(
        (moneyOrZero(input.adminFee) +
          moneyOrZero(input.insuranceAmount) +
          moneyOrZero(input.fiduciaryFee) +
          moneyOrZero(input.provisionFee) +
          moneyOrZero(input.otherFee)) *
          100
      ) / 100,
    upfrontAmount: schedule.upfrontAmount,
    totalInstallments: schedule.totalInstallments,
    scheduledTotalCost: schedule.totalCost,
    installmentsPaidCount,
    installmentsRemaining: remainingMonths,
    installmentPaidAmount: Math.round(installmentPaidAmount * 100) / 100,
    leaseCashPaid,
    remainingToPay,
    paidOff: remainingToPay <= 0,
    otherSpend: Math.round(otherSpend * 100) / 100,
    totalSpent: Math.round((leaseCashPaid + otherSpend) * 100) / 100,
  };
}

/** Remaining lease after each cost-log row (purchase + installments only). */
export function remainingAfterLeaseRows(
  scheduledTotalCost: number,
  rows: VehicleLeasePaidRow[]
): number[] {
  let left = Math.max(0, Math.round(moneyOrZero(scheduledTotalCost) * 100) / 100);
  return rows.map((row) => {
    const kind = String(row.kind ?? "").trim().toUpperCase();
    if (kind === "PURCHASE" || kind === "LEASE_PAYMENT") {
      left = Math.max(
        0,
        Math.round((left - moneyOrZero(row.amount)) * 100) / 100
      );
    }
    return left;
  });
}

export const VEHICLE_LEASE_TENOR_MONTHS = [12, 24, 36, 48, 60] as const;

export type VehicleLeaseFormValues = {
  isVehicleLease: boolean;
  otrAmount: number | null;
  downPayment: number | null;
  tenorMonths: number | null;
  interestPercentYear: number | null;
  adminFee: number | null;
  insuranceAmount: number | null;
  fiduciaryFee: number | null;
  provisionFee: number | null;
  otherFee: number | null;
  monthlyInstallment: number | null;
};

function parseOptionalMoneyField(
  formData: FormData,
  key: string
): number | null {
  const raw = String(formData.get(key) ?? "").replace(/,/g, "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

const EMPTY_LEASE: VehicleLeaseFormValues = {
  isVehicleLease: false,
  otrAmount: null,
  downPayment: null,
  tenorMonths: null,
  interestPercentYear: null,
  adminFee: null,
  insuranceAmount: null,
  fiduciaryFee: null,
  provisionFee: null,
  otherFee: null,
  monthlyInstallment: null,
};

export function parseVehicleLeaseFromForm(
  formData: FormData
): VehicleLeaseFormValues {
  const isVehicleLease = formData.get("isVehicleLease") === "true";
  if (!isVehicleLease) return EMPTY_LEASE;

  const otrAmount = parseOptionalMoneyField(formData, "leaseOtrAmount");
  const downPayment = parseOptionalMoneyField(formData, "leaseDownPayment") ?? 0;
  const tenorMonths = Number(String(formData.get("leaseTenorMonths") ?? "").trim());
  const interestPercentYear =
    parseOptionalMoneyField(formData, "leaseInterestPercentYear") ?? 0;
  const adminFee = parseOptionalMoneyField(formData, "leaseAdminFee") ?? 0;
  const insuranceAmount =
    parseOptionalMoneyField(formData, "leaseInsuranceAmount") ?? 0;
  const fiduciaryFee = parseOptionalMoneyField(formData, "leaseFiduciaryFee") ?? 0;
  const provisionFee = parseOptionalMoneyField(formData, "leaseProvisionFee") ?? 0;
  const otherFee = parseOptionalMoneyField(formData, "leaseOtherFee") ?? 0;
  if (otrAmount == null || otrAmount <= 0) {
    throw new Error("Enter the vehicle On The Road price.");
  }
  if (!Number.isFinite(tenorMonths) || tenorMonths < 1) {
    throw new Error("Enter the lease tenor in months.");
  }
  const schedule = calculateVehicleLease({
    otrAmount,
    downPayment,
    tenorMonths,
    interestPercentYear,
    adminFee,
    insuranceAmount,
    fiduciaryFee,
    provisionFee,
    otherFee,
  });
  return {
    isVehicleLease: true,
    otrAmount,
    downPayment,
    tenorMonths,
    interestPercentYear,
    adminFee,
    insuranceAmount,
    fiduciaryFee,
    provisionFee,
    otherFee,
    monthlyInstallment: schedule?.monthlyInstallment ?? null,
  };
}
