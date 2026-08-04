import type { Employee, InternalHomeSite } from "@prisma/client";

import {
  isInHouseCleaningStaffPosition,
  isWarehouseStaffPosition,
  isWarehouseSupervisorPosition,
} from "@/lib/positions";
import { isHeadOfficeWorkforceDepartment } from "@/lib/placement";
import { appMinutesOfDay, parseTimeToMinutes } from "@/lib/operating-hours";
import {
  ATTENDANCE_HEAD_OFFICE_NAME,
  ATTENDANCE_WAREHOUSE_NAME,
} from "@/lib/attendance-internal-sites";

/**
 * Desk office hours (Asia/Jakarta).
 * Late / left-early flags are computed for Attendance review today and are the
 * intended basis for a future monthly payroll PDF (deductions) — not wired yet.
 */
export const OFFICE_HOURS_START_HHMM = "09:00";
export const OFFICE_HOURS_END_HHMM = "17:00";
/** Check-in after 09:15 is late (15 minutes grace). */
export const OFFICE_LATE_GRACE_MINUTES = 15;

/** Punctuality snapshot for Attendance now / payroll PDF later. */
export type OfficeCicoPunctuality = {
  lateCheckIn: boolean;
  earlyCheckOut: boolean;
};

export function getOfficeCicoPunctuality(opts: {
  checkIn: Date | null | undefined;
  checkOut: Date | null | undefined;
}): OfficeCicoPunctuality {
  return {
    lateCheckIn: opts.checkIn != null ? isOfficeClockLate(opts.checkIn) : false,
    earlyCheckOut:
      opts.checkOut != null ? isOfficeClockEarlyLeave(opts.checkOut) : false,
  };
}

export function internalHomeSiteToProjectName(
  homeSite: InternalHomeSite | null | undefined
): string | null {
  if (homeSite === "HEAD_OFFICE_OPERATIONS") return ATTENDANCE_HEAD_OFFICE_NAME;
  if (homeSite === "WAREHOUSE") return ATTENDANCE_WAREHOUSE_NAME;
  return null;
}

type PositionLike = { name?: string | null; slug?: string | null } | null;

/**
 * Derive office home site from department + position (no UI override).
 * - In-House Cleaning Staff → NONE (assign to Internal project; field CICO)
 * - Warehouse Supervisor / Staff → WAREHOUSE
 * - Other Corporate / Warehouse desk → HEAD_OFFICE_OPERATIONS / WAREHOUSE by dept
 */
export function defaultInternalHomeSite(options: {
  categorySlug?: string | null;
  categoryPrefix?: string | null;
  jobPosition?: PositionLike;
}): InternalHomeSite {
  if (isInHouseCleaningStaffPosition(options.jobPosition ?? {})) {
    return "NONE";
  }
  if (
    isWarehouseSupervisorPosition(options.jobPosition ?? {}) ||
    isWarehouseStaffPosition(options.jobPosition ?? {})
  ) {
    return "WAREHOUSE";
  }
  const slug = (options.categorySlug ?? "").trim().toLowerCase();
  const prefix = (options.categoryPrefix ?? "").trim().toUpperCase();
  if (slug === "warehouse" || prefix === "WRH") {
    return "WAREHOUSE";
  }
  if (isHeadOfficeWorkforceDepartment(options)) {
    return "HEAD_OFFICE_OPERATIONS";
  }
  return "NONE";
}

type OfficeEmployee = Pick<
  Employee,
  | "archivedFromDirectory"
  | "status"
  | "placement"
  | "employeeType"
  | "internalHomeSite"
> & {
  jobPosition?: PositionLike;
};

/** May use office CICO UI (required desk staff, or optional Director/OM with home site). */
export function canUseOfficeCico(employee: OfficeEmployee | null | undefined): boolean {
  if (!employee) return false;
  if (employee.archivedFromDirectory) return false;
  if (employee.employeeType !== "HEAD_OFFICE") return false;
  if (employee.placement === "ON_PROJECT") return false;
  if (employee.internalHomeSite === "NONE") return false;
  return true;
}

export function isOfficeClockLate(checkIn: Date): boolean {
  const start = parseTimeToMinutes(OFFICE_HOURS_START_HHMM);
  if (start == null) return false;
  const lateAfter = start + OFFICE_LATE_GRACE_MINUTES;
  return appMinutesOfDay(checkIn) > lateAfter;
}

export function isOfficeClockEarlyLeave(checkOut: Date): boolean {
  const end = parseTimeToMinutes(OFFICE_HOURS_END_HHMM);
  if (end == null) return false;
  return appMinutesOfDay(checkOut) < end;
}
