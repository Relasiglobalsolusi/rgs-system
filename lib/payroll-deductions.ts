import type { PayrollDeductionType, SecurityDepositStatus } from "@prisma/client";

export const HEAD_OFFICE_PAYROLL_PROJECT = "__head_office__";

export const MANUAL_DEDUCTION_TYPES = [
  "SECURITY_DEPOSIT",
  "LOST_STOCK",
  "PENALTY",
  "OTHER",
  "CLIENT_COMPENSATION",
] as const satisfies readonly PayrollDeductionType[];

export const PROJECT_PAY_RECOVERY_TYPES = [
  "LOST_STOCK",
  "CLIENT_COMPENSATION",
  "PENALTY",
  "FORFEITED_WAGES",
] as const satisfies readonly PayrollDeductionType[];

export type ManualDeductionType = (typeof MANUAL_DEDUCTION_TYPES)[number];

export function isManualDeductionType(
  type: string
): type is ManualDeductionType {
  return (MANUAL_DEDUCTION_TYPES as readonly string[]).includes(type);
}

export function isPayrollPayableType(type: PayrollDeductionType | string) {
  return type === "RETURN_OF_SECURITY_DEPOSIT";
}

export function payrollLineCashOutDelta(
  type: PayrollDeductionType | string,
  amount: number
): number {
  const value = Number.isFinite(amount) ? amount : 0;
  return isPayrollPayableType(type) ? value : -value;
}

export function payrollNetFromParts(options: {
  wage: number;
  bpjsKesehatan?: number;
  bpjsTk?: number;
  manualDeductions?: number;
  payables?: number;
}): number {
  return (
    options.wage -
    (options.bpjsKesehatan ?? 0) -
    (options.bpjsTk ?? 0) -
    (options.manualDeductions ?? 0) +
    (options.payables ?? 0)
  );
}

/** Recover this month's employee BPJS share plus any amount still held from earlier months. */
export function applyBpjsShareHold(options: {
  wage: number;
  thisMonthEmployeeShare: number;
  priorHeld?: number;
  forfeitWages?: boolean;
}): {
  deductedShare: number;
  heldAfter: number;
  remainingWage: number;
  priorHeld: number;
} {
  const priorHeld = Math.max(0, Math.round(options.priorHeld ?? 0));
  if (options.forfeitWages) {
    return {
      deductedShare: 0,
      heldAfter: 0,
      remainingWage: Math.max(0, Math.round(options.wage)),
      priorHeld,
    };
  }
  const shareDue = Math.max(
    0,
    Math.round(options.thisMonthEmployeeShare) + priorHeld
  );
  const wage = Math.max(0, Math.round(options.wage));
  if (wage < shareDue) {
    return {
      deductedShare: wage,
      heldAfter: shareDue - wage,
      remainingWage: 0,
      priorHeld,
    };
  }
  return {
    deductedShare: shareDue,
    heldAfter: 0,
    remainingWage: wage - shareDue,
    priorHeld,
  };
}

export function nextDepositHeldAmount(
  currentHeld: number,
  delta: number
): number {
  return Math.max(0, Math.round((currentHeld + delta) * 100) / 100);
}

export function nextDepositStatusAfterHold(
  nextHeld: number
): SecurityDepositStatus {
  return nextHeld > 0 ? "HELD" : "NONE";
}

/** True when a second Security deposit deduction must be blocked. */
export function hasHeldSecurityDeposit(options: {
  depositStatus: SecurityDepositStatus | string | null | undefined;
  depositHeldAmount?: number | null;
  securityDepositLines?: number;
  returnOfDepositLines?: number;
}): boolean {
  if (options.depositStatus === "HELD") return true;
  if ((options.depositHeldAmount ?? 0) > 0) return true;
  const holds = options.securityDepositLines ?? 0;
  const returns = options.returnOfDepositLines ?? 0;
  return holds > returns;
}
