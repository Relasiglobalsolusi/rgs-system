import type { Employee, EmployeeType, Placement } from "@prisma/client";

import {
  canAccess,
  isHoAdminAccount,
  type AccountTypeUser,
  type PermissionUser,
} from "@/lib/permissions";
import { isHeadOfficePlacement } from "@/lib/placement";
import { isEmployeeActiveForOperations } from "@/lib/leave-employment-status";

type CicoEmployee = Pick<
  Employee,
  | "archivedFromDirectory"
  | "status"
  | "placement"
  | "employeeType"
>;

/**
 * Active on-project field cleaning staff who may perform real CICO check-in/out.
 * Excludes head-office / corporate employees even when placement is ON_PROJECT.
 */
export function isCicoFieldEligible(
  employee: CicoEmployee | null | undefined
): boolean {
  if (!employee) return false;
  if (employee.archivedFromDirectory) return false;
  if (!isEmployeeActiveForOperations(employee.status)) return false;
  if (employee.placement !== "ON_PROJECT") return false;
  if (employee.employeeType === "HEAD_OFFICE") return false;
  if (isHeadOfficePlacement(employee.placement)) return false;
  return true;
}

type CicoPreviewUser = PermissionUser &
  AccountTypeUser & {
    clientId?: string | null;
    employeeType?: EmployeeType | null;
  };

/**
 * HO admin (`isHoAdminAccount`) may use real CICO against a selected In Progress
 * project as if assigned — attendance is recorded on their linked employee profile.
 */
export function canUseCicoAdminFieldPreview(user: CicoPreviewUser): boolean {
  if (user.clientId) return false;
  return isHoAdminAccount(user);
}

/**
 * Head-office admin or desk managers who may view the CICO UI in preview mode
 * (today's site activity + disabled check-in layout) without performing CICO.
 */
export function canViewCicoAdminPreview(
  user: CicoPreviewUser,
  employee: CicoEmployee | null | undefined
): boolean {
  if (user.clientId) return false;
  if (isCicoFieldEligible(employee)) return false;
  if (isHoAdminAccount(user)) return true;

  const employeeType =
    user.employeeType ?? employee?.employeeType ?? null;
  if (employeeType === "PROJECT_SITE") return false;

  return (
    canAccess(user, "attendance") ||
    canAccess(user, "projects") ||
    canAccess(user, "cico")
  );
}
