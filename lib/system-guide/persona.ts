import {
  isAreaManagerPosition,
  isCleaningStaffPosition,
  isDirectorPosition,
  isFieldCleaningStaffPosition,
  isInHouseCleaningStaffPosition,
  isOperationsManagerPosition,
  isParkingStaffPosition,
  isSecurityStaffPosition,
  isTechnicianPosition,
  isWarehouseStaffPosition,
  isWarehouseSupervisorPosition,
  positionSlugFromName,
} from "@/lib/positions";

/**
 * Who the handbook is written for. Same module, different steps.
 * Director is the Head Office baseline used by Admin, Owner, and custom
 * corporate titles that do not match a more specific role.
 */
export type SystemGuidePersona =
  | "client"
  | "cleaningStaff"
  | "securityStaff"
  | "technician"
  | "opsManager"
  | "finance"
  | "warehouse"
  | "director";

function positionRef(positionName: string) {
  return {
    name: positionName,
    slug: positionSlugFromName(positionName),
  };
}

function normalizeLabel(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isOwnerOrAdminName(name: string): boolean {
  return (
    name === "owner" ||
    name === "pemilik" ||
    name === "ceo" ||
    name === "chief executive officer" ||
    name === "admin" ||
    name === "administrator"
  );
}

function isFinanceName(name: string): boolean {
  return (
    name === "accountant" ||
    name === "akuntan" ||
    name === "finance admin" ||
    name === "admin keuangan" ||
    name.includes("finance") ||
    name.includes("keuangan") ||
    name.includes("accountant") ||
    name.includes("akuntan")
  );
}

function isGondolaOrCleaningName(name: string): boolean {
  return (
    name.includes("gondola") ||
    name.includes("cleaning") ||
    name.includes("kebersihan") ||
    name === "gc staff" ||
    name === "staf gc" ||
    name === "general cleaning staff"
  );
}

function isOperationsDepartment(departmentLabel: string): boolean {
  const dept = normalizeLabel(departmentLabel);
  return (
    dept === "operations" ||
    dept === "operasi" ||
    dept.includes("operation") ||
    dept.includes("operasi")
  );
}

function isWarehouseDepartment(departmentLabel: string): boolean {
  const dept = normalizeLabel(departmentLabel);
  return (
    dept === "warehouse" ||
    dept === "gudang" ||
    dept.includes("warehouse") ||
    dept.includes("gudang")
  );
}

function isCorporateDepartment(departmentLabel: string): boolean {
  const dept = normalizeLabel(departmentLabel);
  return (
    dept === "corporate" ||
    dept === "korporat" ||
    dept.includes("corporate") ||
    dept.includes("korporat")
  );
}

export function resolveSystemGuidePersona(input: {
  audience?: "position" | "client";
  positionName: string;
  departmentLabel?: string;
}): SystemGuidePersona {
  if (input.audience === "client") return "client";

  const position = positionRef(input.positionName);
  const name = normalizeLabel(input.positionName);
  const departmentLabel = input.departmentLabel ?? "";

  if (isDirectorPosition(position) || isOwnerOrAdminName(name)) {
    return "director";
  }
  if (isFinanceName(name)) return "finance";
  if (
    isOperationsManagerPosition(position) ||
    isAreaManagerPosition(position)
  ) {
    return "opsManager";
  }
  if (
    isWarehouseSupervisorPosition(position) ||
    isWarehouseStaffPosition(position)
  ) {
    return "warehouse";
  }
  if (isTechnicianPosition(position)) return "technician";
  if (isSecurityStaffPosition(position) || isParkingStaffPosition(position)) {
    return "securityStaff";
  }
  if (
    isCleaningStaffPosition(position) ||
    isFieldCleaningStaffPosition(position) ||
    isInHouseCleaningStaffPosition(position) ||
    isGondolaOrCleaningName(name)
  ) {
    return "cleaningStaff";
  }
  if (isWarehouseDepartment(departmentLabel)) return "warehouse";
  if (isOperationsDepartment(departmentLabel)) {
    if (name.includes("manager") || name.includes("manajer")) {
      return "opsManager";
    }
    return "cleaningStaff";
  }
  if (isCorporateDepartment(departmentLabel) && isFinanceName(name)) {
    return "finance";
  }
  return "director";
}

export function personaUsesLeaveApproverCopy(
  persona: SystemGuidePersona
): boolean {
  return (
    persona === "director" ||
    persona === "opsManager" ||
    persona === "finance" ||
    persona === "warehouse"
  );
}

/** Field crew: never inherit Head Office how-to steps. */
export function isFieldSystemGuidePersona(
  persona: SystemGuidePersona
): boolean {
  return (
    persona === "cleaningStaff" ||
    persona === "securityStaff" ||
    persona === "technician"
  );
}

/**
 * Head Office readers may use the director baseline when a module has
 * no dedicated persona chapter. Client, field, and warehouse never do.
 */
export function personaFallsBackToHeadOfficeCopy(
  persona: SystemGuidePersona
): boolean {
  return (
    persona === "director" ||
    persona === "opsManager" ||
    persona === "finance"
  );
}
