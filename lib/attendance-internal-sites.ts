/**
 * Attendance Report — internal sites (Head Office, Warehouse) vs client projects.
 * Matched by canonical English names (case-insensitive) and/or HEAD_OFFICE area.
 */

export const ATTENDANCE_INTERNAL_CLIENT_NAME = "RGS Internal";

/** Form sentinel — not a Client row. Internal projects stay `clientId: null`. */
export const RGS_INTERNAL_CLIENT_FORM_VALUE = "__rgs_internal__";

export function isRgsInternalClientFormValue(
  clientId: string | null | undefined
): boolean {
  return clientId === RGS_INTERNAL_CLIENT_FORM_VALUE;
}

/** URL segment for Internal projects with null clientId: /attendance/internal/:projectId */
export const ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID = "internal";

export const ATTENDANCE_HEAD_OFFICE_NAME = "Head Office";
export const ATTENDANCE_WAREHOUSE_NAME = "Warehouse";

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isAttendanceHeadOfficeName(name: string): boolean {
  const n = norm(name);
  return n === "head office" || n === "kantor pusat";
}

export function isAttendanceWarehouseName(name: string): boolean {
  const n = norm(name);
  return n === "warehouse" || n === "gudang";
}

export function isAttendanceInternalSiteName(name: string): boolean {
  return isAttendanceHeadOfficeName(name) || isAttendanceWarehouseName(name);
}

/** Sort key: Head Office (0), Warehouse (1), then others (2). */
export function attendanceInternalSortRank(name: string): number {
  if (isAttendanceHeadOfficeName(name)) return 0;
  if (isAttendanceWarehouseName(name)) return 1;
  return 2;
}

export function isAttendanceInternalProject<
  T extends { name: string; serviceArea?: string | null; subCategory?: string | null },
>(project: T): boolean {
  return (
    project.subCategory === "INTERNAL" ||
    isAttendanceInternalSiteName(project.name) ||
    project.serviceArea === "HEAD_OFFICE"
  );
}
