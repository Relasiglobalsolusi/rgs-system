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

export const VEHICLE_LEASE_TENOR_MONTHS = [12, 24, 36, 48, 60] as const;
