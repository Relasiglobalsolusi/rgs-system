"use server";

import { revalidatePath } from "next/cache";
import type { EmploymentType, Placement } from "@prisma/client";

import {
  getNextEmployeeNumber,
  reassignEmployeeNumber,
} from "@/lib/employee-number";
import {
  assignEmployeeToProjects,
  parseProjectIds,
  releaseEmployeeFromProjects,
  syncProjectAssignments,
} from "@/lib/employee-projects";
import { parseProjectShiftsFromForm } from "@/lib/operating-hours";
import {
  nextCompanyScopedSortOrder,
  persistCompanyScopedReorder,
} from "@/lib/persist-reorder";
import { prisma } from "@/lib/prisma";
import { canManageEmployees } from "@/lib/project-access";
import { parseCreatePortalLoginFlag } from "@/lib/create-portal-login-flag";
import {
  employeeTypeFromPlacement,
  initialPlacementForDepartment,
  placementOnSoftRestore,
} from "@/lib/placement";
import { requireSession, toPermissionUser } from "@/lib/session";
import { saveUpload } from "@/lib/upload";
import { normalizeAndValidatePhone } from "@/lib/phone";
import { capitalizeName } from "@/lib/text-case";
import { isOperationsManagerPosition } from "@/lib/positions";
import {
  formatOperationsManagerLabel,
  parseOmApprovalAreas,
} from "@/lib/service-area";
import {
  createBulkActionResult,
  recordBulkFailure,
  recordBulkSuccess,
  type BulkActionResult,
} from "@/lib/bulk-action-result";
import {
  completeEmployeeDirectoryArchive,
  isIncompleteEmployeeDirectoryArchive,
} from "@/lib/archive-employee-directory";
import {
  ensureEmployeeLoginStaysInactive,
  softDeactivateEmployeeLogin,
} from "@/lib/linked-login-lifecycle";
import { isRosterActiveEmployeeStatus } from "@/lib/user-directory-status";
import {
  defaultPortalAccessRequested,
  syncEmployeePortalLogin,
} from "@/lib/workforce-login";

async function assertCanManageEmployees() {
  const session = await requireSession();
  const user = toPermissionUser(session);
  if (!canManageEmployees(user)) {
    throw new Error("You do not have permission to manage employees.");
  }
  return session;
}

async function parseCategoryId(
  value: FormDataEntryValue | null,
  companyId: string,
  options?: { required?: boolean }
): Promise<string | null> {
  const categoryId = String(value ?? "").trim();
  if (!categoryId) {
    if (options?.required) {
      throw new Error("Employee department is required.");
    }
    return null;
  }

  const category = await prisma.employeeCategory.findFirst({
    where: {
      id: categoryId,
      companyId,
      active: true,
    },
  });

  if (!category) {
    throw new Error("Selected department was not found.");
  }

  return category.id;
}

async function parsePositionId(
  value: FormDataEntryValue | null,
  companyId: string,
  categoryId: string | null,
  options?: { required?: boolean }
): Promise<{
  positionId: string | null;
  positionName: string | null;
  positionSlug: string | null;
}> {
  const positionId = String(value ?? "").trim();
  if (!positionId) {
    if (options?.required) {
      throw new Error("Position is required.");
    }
    return { positionId: null, positionName: null, positionSlug: null };
  }

  if (!categoryId) {
    throw new Error("Select a department before choosing a position.");
  }

  const position = await prisma.position.findFirst({
    where: {
      id: positionId,
      companyId,
      categoryId,
      active: true,
    },
    select: { id: true, name: true, slug: true },
  });

  if (!position) {
    throw new Error("Selected position was not found for this department.");
  }

  return {
    positionId: position.id,
    positionName: position.name,
    positionSlug: position.slug,
  };
}

function parseEmploymentType(
  value: FormDataEntryValue | null
): EmploymentType {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (raw === "PART_TIME" || raw === "PT") return "PART_TIME";
  if (!raw || raw === "FULL_TIME" || raw === "FT") return "FULL_TIME";
  throw new Error("Employment type must be Full time or Part time.");
}

function parseHiredAt(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid start date.");
  }

  return date;
}

function parseContactEmail(value: FormDataEntryValue | null): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return email || null;
}

async function saveIdDocument(
  formData: FormData
): Promise<string | null | undefined> {
  const file = formData.get("idDocument");

  if (!(file instanceof File) || file.size === 0) {
    return undefined;
  }

  return saveUpload(file, "uploads/employees");
}

export async function previewEmployeeNumber(categoryId: string) {
  await assertCanManageEmployees();

  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Company not found.");
  }

  const resolvedCategoryId = await parseCategoryId(categoryId, company.id, {
    required: true,
  });

  return getNextEmployeeNumber(company.id, resolvedCategoryId!);
}

export async function createEmployee(formData: FormData) {
  await assertCanManageEmployees();

  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Company not found.");
  }

  const firstName = capitalizeName(String(formData.get("firstName") || "").trim());
  const lastName = capitalizeName(String(formData.get("lastName") || "").trim());
  const email = parseContactEmail(formData.get("email"));
  const phone = normalizeAndValidatePhone(
    String(formData.get("phone") || ""),
    "Phone"
  );
  const categoryId = await parseCategoryId(formData.get("categoryId"), company.id, {
    required: true,
  });
  const category = await prisma.employeeCategory.findFirst({
    where: { id: categoryId!, companyId: company.id },
    select: { id: true, slug: true, prefix: true },
  });
  if (!category) {
    throw new Error("Selected department was not found.");
  }

  const { positionId, positionName, positionSlug } = await parsePositionId(
    formData.get("positionId"),
    company.id,
    categoryId,
    { required: true }
  );
  const employmentType = parseEmploymentType(formData.get("employmentType"));
  const placement = initialPlacementForDepartment({
    categorySlug: category.slug,
    categoryPrefix: category.prefix,
  });
  const employeeType = employeeTypeFromPlacement(placement);
  const hiredAt = parseHiredAt(formData.get("hiredAt"));
  const portalRaw = formData.get("createPortalLogin");
  const portalAccessRequested =
    portalRaw == null || String(portalRaw).trim() === ""
      ? defaultPortalAccessRequested({
          placement,
          categorySlug: category.slug,
        })
      : parseCreatePortalLoginFlag(portalRaw);
  const isOm = isOperationsManagerPosition({
    slug: positionSlug,
    name: positionName,
  });
  const omApprovalAreas = isOm ? parseOmApprovalAreas(formData) : [];
  if (isOm && omApprovalAreas.length === 0) {
    throw new Error("Select at least one Approval Area for Operations Manager.");
  }
  const displayPosition = isOm
    ? formatOperationsManagerLabel(omApprovalAreas)
    : positionName;

  if (!firstName) throw new Error("First name is required.");
  if (!lastName) throw new Error("Last name is required.");

  const idDocumentUrl = await saveIdDocument(formData);
  const sortOrder = await nextCompanyScopedSortOrder("employee", company.id);

  await prisma.$transaction(async (tx) => {
    const employeeNo = await getNextEmployeeNumber(company.id, categoryId!, tx);

    const existing = await tx.employee.findUnique({
      where: { employeeNo },
    });
    if (existing) {
      throw new Error("Employee number already exists. Please try again.");
    }

    const employee = await tx.employee.create({
      data: {
        employeeNo,
        firstName,
        lastName,
        email,
        phone: phone || null,
        employeeType,
        employmentType,
        placement,
        portalAccessRequested,
        categoryId,
        positionId,
        position: displayPosition,
        omApprovalAreas,
        idDocumentUrl: idDocumentUrl ?? null,
        hiredAt,
        companyId: company.id,
        status: "ACTIVE",
        sortOrder,
      },
    });

    await syncEmployeePortalLogin(tx, {
      companyId: company.id,
      employeeId: employee.id,
      firstName,
      lastName,
      employeeNo,
      employmentType,
      placement,
      portalAccessRequested,
      status: "ACTIVE",
      userId: null,
      employeeType,
    });
  });

  revalidatePath("/employees");
  revalidatePath("/users");
}

export async function reorderEmployees(ids: string[]) {
  await assertCanManageEmployees();

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    throw new Error("Company not found.");
  }

  await persistCompanyScopedReorder("employee", {
    companyId: company.id,
    ids,
    mismatchError: "One or more employees are invalid for reorder.",
  });

  revalidatePath("/employees");
}

export async function updateEmployee(id: string, formData: FormData) {
  await assertCanManageEmployees();

  const firstName = capitalizeName(String(formData.get("firstName") || "").trim());
  const lastName = capitalizeName(String(formData.get("lastName") || "").trim());
  const email = parseContactEmail(formData.get("email"));
  const phone = normalizeAndValidatePhone(
    String(formData.get("phone") || ""),
    "Phone"
  );

  if (!firstName) throw new Error("First name is required.");
  if (!lastName) throw new Error("Last name is required.");

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      companyId: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
      employeeType: true,
      employmentType: true,
      placement: true,
      portalAccessRequested: true,
      categoryId: true,
      userId: true,
      category: {
        select: {
          id: true,
          prefix: true,
          slug: true,
        },
      },
    },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  const categoryId = await parseCategoryId(
    formData.get("categoryId"),
    employee.companyId,
    { required: true }
  );
  const category = await prisma.employeeCategory.findFirst({
    where: { id: categoryId!, companyId: employee.companyId },
    select: { id: true, slug: true, prefix: true },
  });
  if (!category) {
    throw new Error("Selected department was not found.");
  }

  const { positionId, positionName, positionSlug } = await parsePositionId(
    formData.get("positionId"),
    employee.companyId,
    categoryId,
    { required: true }
  );
  const employmentType = parseEmploymentType(formData.get("employmentType"));
  // Placement is system-driven — keep current; Assign/Release change it.
  const placement = employee.placement;
  const employeeType = employeeTypeFromPlacement(placement);
  const hiredAt = parseHiredAt(formData.get("hiredAt"));
  const categoryChanged = categoryId !== employee.categoryId;

  // Portal Yes/No may be omitted on edit (keep existing)
  const portalRaw = formData.get("createPortalLogin");
  const portalAccessRequested =
    portalRaw == null || String(portalRaw).trim() === ""
      ? employee.portalAccessRequested
      : parseCreatePortalLoginFlag(portalRaw);
  const isOm = isOperationsManagerPosition({
    slug: positionSlug,
    name: positionName,
  });
  const omApprovalAreas = isOm ? parseOmApprovalAreas(formData) : [];
  if (isOm && omApprovalAreas.length === 0) {
    throw new Error("Select at least one Approval Area for Operations Manager.");
  }
  const displayPosition = isOm
    ? formatOperationsManagerLabel(omApprovalAreas)
    : positionName;

  const idDocumentUrl = await saveIdDocument(formData);

  await prisma.$transaction(async (tx) => {
    const employeeNo =
      categoryChanged && categoryId
        ? await reassignEmployeeNumber(id, categoryId, tx)
        : employee.employeeNo;

    const updated = await tx.employee.update({
      where: { id },
      data: {
        firstName,
        lastName,
        email,
        phone: phone || null,
        employeeType,
        employmentType,
        placement,
        portalAccessRequested,
        categoryId,
        positionId,
        position: displayPosition,
        omApprovalAreas,
        hiredAt,
        ...(idDocumentUrl !== undefined ? { idDocumentUrl } : {}),
        employeeNo,
      },
      select: { userId: true },
    });

    await syncEmployeePortalLogin(tx, {
      companyId: employee.companyId,
      employeeId: id,
      firstName,
      lastName,
      employeeNo,
      employmentType,
      placement,
      portalAccessRequested,
      status: "ACTIVE",
      userId: updated.userId,
      employeeType,
    });
  });

  revalidatePath("/employees");
  revalidatePath("/users");
}

/**
 * Assign selected projects → placement ON_PROJECT; sync PT/FT portal access.
 */
export async function assignEmployeeToProject(
  id: string,
  formData: FormData
) {
  await assertCanManageEmployees();

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      companyId: true,
      status: true,
      firstName: true,
      lastName: true,
      employeeNo: true,
      employmentType: true,
      portalAccessRequested: true,
      userId: true,
      placement: true,
      employeeType: true,
    },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }
  if (employee.status !== "ACTIVE") {
    throw new Error("Only active employees can be assigned to a project.");
  }

  const projectIds = await parseProjectIds(
    prisma,
    formData.get("projectIds"),
    employee.companyId
  );
  if (projectIds.length === 0) {
    throw new Error("Select at least one project.");
  }
  const projectShifts = parseProjectShiftsFromForm(formData, projectIds);

  await prisma.$transaction(async (tx) => {
    await assignEmployeeToProjects(tx, id, projectIds, projectShifts);
    const portalAccessRequested =
      employee.portalAccessRequested ||
      employee.employmentType === "PART_TIME" ||
      true;

    await tx.employee.update({
      where: { id },
      data: {
        portalAccessRequested,
        employeeType: "PROJECT_SITE",
      },
    });

    await syncEmployeePortalLogin(tx, {
      companyId: employee.companyId,
      employeeId: id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeNo: employee.employeeNo,
      employmentType: employee.employmentType,
      placement: "ON_PROJECT",
      portalAccessRequested,
      status: employee.status,
      userId: employee.userId,
      employeeType: "PROJECT_SITE",
    });
  });

  revalidatePath("/employees");
  revalidatePath("/users");
  revalidatePath("/projects");
}

/**
 * Release from all projects → AVAILABLE (or HEAD_OFFICE for corporate soft path).
 */
export async function releaseEmployeeFromProject(id: string) {
  await assertCanManageEmployees();

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      companyId: true,
      status: true,
      firstName: true,
      lastName: true,
      employeeNo: true,
      employmentType: true,
      portalAccessRequested: true,
      userId: true,
      category: { select: { slug: true, prefix: true } },
    },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  const nextPlacement: Placement = placementOnSoftRestore({
    categorySlug: employee.category?.slug,
    categoryPrefix: employee.category?.prefix,
  });
  // Ops crew → AVAILABLE; Corporate → HEAD_OFFICE
  const releasePlacement: Placement =
    nextPlacement === "HEAD_OFFICE" ? "HEAD_OFFICE" : "AVAILABLE";
  const employeeType = employeeTypeFromPlacement(releasePlacement);

  await prisma.$transaction(async (tx) => {
    await releaseEmployeeFromProjects(tx, id, releasePlacement);
    await tx.employee.update({
      where: { id },
      data: { employeeType },
    });
    await syncEmployeePortalLogin(tx, {
      companyId: employee.companyId,
      employeeId: id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeNo: employee.employeeNo,
      employmentType: employee.employmentType,
      placement: releasePlacement,
      portalAccessRequested: employee.portalAccessRequested,
      status: employee.status,
      userId: employee.userId,
      employeeType,
    });
  });

  revalidatePath("/employees");
  revalidatePath("/users");
  revalidatePath("/projects");
}

/** Set placement to FIELD (no required project). */
export async function setEmployeeFieldPlacement(id: string) {
  await assertCanManageEmployees();

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      companyId: true,
      status: true,
      firstName: true,
      lastName: true,
      employeeNo: true,
      employmentType: true,
      portalAccessRequested: true,
      userId: true,
    },
  });

  if (!employee || employee.status !== "ACTIVE") {
    throw new Error("Only active employees can be set to Field placement.");
  }

  await prisma.$transaction(async (tx) => {
    await syncProjectAssignments(tx, id, []);
    await tx.employee.update({
      where: { id },
      data: {
        placement: "FIELD",
        employeeType: "PROJECT_SITE",
      },
    });
    await syncEmployeePortalLogin(tx, {
      companyId: employee.companyId,
      employeeId: id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeNo: employee.employeeNo,
      employmentType: employee.employmentType,
      placement: "FIELD",
      portalAccessRequested: employee.portalAccessRequested,
      status: employee.status,
      userId: employee.userId,
      employeeType: "PROJECT_SITE",
    });
  });

  revalidatePath("/employees");
  revalidatePath("/users");
}

async function deactivateEmployeeRecord(id: string, currentUserId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  if (employee.status !== "ACTIVE" && employee.status !== "ON_LEAVE") {
    throw new Error("Only active employees can be removed from the directory.");
  }

  if (employee.userId && employee.userId === currentUserId) {
    throw new Error(
      "You cannot delete your own employee record while signed in."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id },
      data: { status: "INACTIVE" },
    });

    await softDeactivateEmployeeLogin(tx, employee.userId);
  });
}

export async function deactivateEmployee(id: string) {
  const session = await assertCanManageEmployees();
  await deactivateEmployeeRecord(id, session.user.id);
  revalidatePath("/employees");
  revalidatePath("/users");
}

async function reactivateEmployeeRecord(id: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      status: true,
      archivedFromDirectory: true,
      category: { select: { slug: true, prefix: true } },
      employmentType: true,
      portalAccessRequested: true,
      firstName: true,
      lastName: true,
      employeeNo: true,
      companyId: true,
      userId: true,
    },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  if (employee.archivedFromDirectory) {
    throw new Error(
      "This employee was permanently removed and cannot be restored."
    );
  }

  if (isRosterActiveEmployeeStatus(employee.status)) {
    throw new Error("Employee is already active.");
  }

  const placement = placementOnSoftRestore({
    categorySlug: employee.category?.slug,
    categoryPrefix: employee.category?.prefix,
  });
  const employeeType = employeeTypeFromPlacement(placement);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id },
      data: {
        status: "ACTIVE",
        placement,
        employeeType,
      },
      select: { userId: true },
    });

    // Soft restore keeps login revoked until sync / Users restore for FT with portal flag.
    await ensureEmployeeLoginStaysInactive(tx, updated.userId);

    // FT with portal requested → restore login; PT stays revoked until ON_PROJECT
    if (
      employee.employmentType === "FULL_TIME" &&
      employee.portalAccessRequested
    ) {
      await syncEmployeePortalLogin(tx, {
        companyId: employee.companyId,
        employeeId: id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeNo: employee.employeeNo,
        employmentType: employee.employmentType,
        placement,
        portalAccessRequested: employee.portalAccessRequested,
        status: "ACTIVE",
        userId: updated.userId,
        employeeType,
      });
    }
  });
}

export async function reactivateEmployee(id: string) {
  await assertCanManageEmployees();
  await reactivateEmployeeRecord(id);
  revalidatePath("/employees");
  revalidatePath("/users");
}

export async function bulkReactivateEmployees(
  ids: string[]
): Promise<BulkActionResult> {
  await assertCanManageEmployees();

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      await reactivateEmployeeRecord(id);
      recordBulkSuccess(result);
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error ? error.message : "Failed to restore employee."
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/employees");
    revalidatePath("/users");
  }

  return result;
}

export async function deleteEmployee(id: string) {
  await deactivateEmployee(id);
}

async function archiveEmployeeFromDirectoryRecord(id: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      archivedFromDirectory: true,
      userId: true,
      employeeNo: true,
    },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  if (employee.archivedFromDirectory) {
    if (!isIncompleteEmployeeDirectoryArchive(employee)) {
      throw new Error("Employee is already removed from the directory.");
    }

    await prisma.$transaction(async (tx) => {
      await completeEmployeeDirectoryArchive(tx, employee);
    });
    return;
  }

  if (employee.status !== "INACTIVE" && employee.status !== "TERMINATED") {
    throw new Error(
      "Only deleted employees can be permanently removed from the directory."
    );
  }

  // Permanent delete: remove login; keep project history (row archived, not hard-deleted).
  await prisma.$transaction(async (tx) => {
    await completeEmployeeDirectoryArchive(tx, employee);
  });
}

export async function archiveEmployeeFromDirectory(id: string) {
  await assertCanManageEmployees();
  await archiveEmployeeFromDirectoryRecord(id);
  revalidatePath("/employees");
  revalidatePath("/users");
}

export async function bulkDeactivateEmployees(
  ids: string[]
): Promise<BulkActionResult> {
  const session = await assertCanManageEmployees();

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      await deactivateEmployeeRecord(id, session.user.id);
      recordBulkSuccess(result);
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error ? error.message : "Failed to remove employee."
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/employees");
    revalidatePath("/users");
  }

  return result;
}

export async function bulkArchiveEmployeesFromDirectory(
  ids: string[]
): Promise<BulkActionResult> {
  await assertCanManageEmployees();

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      await archiveEmployeeFromDirectoryRecord(id);
      recordBulkSuccess(result);
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error
          ? error.message
          : "Failed to remove employee from directory."
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/employees");
    revalidatePath("/users");
  }

  return result;
}

/**
 * Provision ERP logins for employees with no linked User.
 */
export async function generateEmployeePortalLogins(
  ids: string[]
): Promise<BulkActionResult> {
  await assertCanManageEmployees();

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return result;
  }

  for (const id of uniqueIds) {
    try {
      const provisioned = await prisma.$transaction(async (tx) => {
        const employee = await tx.employee.findUnique({
          where: { id },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNo: true,
            employeeType: true,
            employmentType: true,
            placement: true,
            companyId: true,
            status: true,
            userId: true,
            portalAccessRequested: true,
          },
        });

        if (!employee) {
          throw new Error("Employee not found.");
        }

        if (employee.status !== "ACTIVE") {
          const label = `${employee.firstName} ${employee.lastName}`.trim();
          throw new Error(
            `${label}: portal login cannot be generated for deleted or inactive employees. Restore the employee first.`
          );
        }

        if (
          employee.employmentType === "PART_TIME" &&
          employee.placement !== "ON_PROJECT"
        ) {
          const label = `${employee.firstName} ${employee.lastName}`.trim();
          throw new Error(
            `${label}: part-time login is only available while On project.`
          );
        }

        await tx.employee.update({
          where: { id },
          data: { portalAccessRequested: true },
        });

        const sync = await syncEmployeePortalLogin(tx, {
          companyId: employee.companyId,
          employeeId: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          employeeNo: employee.employeeNo,
          employmentType: employee.employmentType,
          placement: employee.placement,
          portalAccessRequested: true,
          status: employee.status,
          userId: employee.userId,
          employeeType: employee.employeeType,
        });

        return sync.active;
      });

      if (provisioned) {
        recordBulkSuccess(result);
      }
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error
          ? error.message
          : "Failed to generate portal login."
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/employees");
    revalidatePath("/users");
  }

  return result;
}
