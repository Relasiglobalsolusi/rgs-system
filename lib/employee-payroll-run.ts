import type { PayrollRunKind } from "@/lib/internal-payroll-period";
import {
  isDirectorPosition,
  isOperationsManagerPosition,
} from "@/lib/positions";

type PositionLike = { slug?: string | null; name?: string | null } | null;

export function isGcStaffPosition(position: PositionLike): boolean {
  const slug = (position?.slug ?? "").trim().toLowerCase();
  const name = (position?.name ?? "").trim().toLowerCase();
  return slug === "gc-staff" || name === "gc staff";
}

export function requiresHeadOfficePayrollRun(input: {
  employeeType?: string | null;
  jobPosition?: PositionLike;
}): boolean {
  if (input.employeeType === "HEAD_OFFICE") return true;
  const position = input.jobPosition ?? {};
  return (
    isDirectorPosition(position) ||
    isOperationsManagerPosition(position) ||
    isGcStaffPosition(position)
  );
}

/**
 * HO, corporate, directors, GC staff, and the Operational Manager are paid on
 * the 26th–25th run. Regular project staff stay on the 16th–15th.
 */
export function defaultPayrollRunForEmployee(input: {
  employeeType?: string | null;
  jobPosition?: PositionLike;
}): PayrollRunKind {
  return requiresHeadOfficePayrollRun(input)
    ? "HEAD_OFFICE_MONTHLY"
    : "PROJECT_CYCLE";
}

/**
 * Corporate/HO, Directors, the Operational Manager, and GC Staff are fixed to
 * the 26th–25th run. Other roles use the run explicitly selected on Employee.
 */
export function resolvePayrollRunForEmployee(input: {
  employeeType?: string | null;
  jobPosition?: PositionLike;
  requestedRun?: PayrollRunKind | null;
}): PayrollRunKind {
  if (requiresHeadOfficePayrollRun(input)) return "HEAD_OFFICE_MONTHLY";
  return input.requestedRun ?? defaultPayrollRunForEmployee(input);
}

/** Director and Operational Manager start Exempt From CICO. */
export function defaultCicoExemptForPosition(position: PositionLike): boolean {
  const row = position ?? {};
  return isDirectorPosition(row) || isOperationsManagerPosition(row);
}

/** Desk leadership who still clock in are never flagged late or early. */
export function skipsOfficeLateEarlyFlags(position: PositionLike): boolean {
  const row = position ?? {};
  return isDirectorPosition(row) || isOperationsManagerPosition(row);
}

/** Exempt From CICO is HO-type only, except Director / OM who are always eligible. */
export function canBeCicoExempt(input: {
  employeeType?: string | null;
  placement?: string | null;
  jobPosition?: PositionLike;
}): boolean {
  if (defaultCicoExemptForPosition(input.jobPosition ?? null)) return true;
  if (input.placement === "ON_PROJECT") return false;
  return input.employeeType === "HEAD_OFFICE";
}
