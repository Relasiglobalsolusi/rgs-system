"use server";

import { revalidatePath } from "next/cache";
import type { EmploymentType, InternalHomeSite, Placement } from "@prisma/client";

import {
  allocateEmployeeNumbers,
  getNextEmployeeNumber,
  reassignEmployeeNumber,
} from "@/lib/employee-number";
import {
  releaseEmployeeFromProjects,
  syncProjectAssignments,
} from "@/lib/employee-projects";
import {
  nextCompanyScopedSortOrder,
  persistCompanyScopedReorder,
} from "@/lib/persist-reorder";
import { prisma } from "@/lib/prisma";
import { canManageEmployees, canResignEmployees } from "@/lib/project-access";
import { parseCreatePortalLoginFlag } from "@/lib/create-portal-login-flag";
import {
  employeeTypeFromPlacement,
  initialPlacementForDepartment,
  placementOnSoftRestore,
} from "@/lib/placement";
import { requireSession, toPermissionUser } from "@/lib/session";
import { deleteLocalUpload, saveUpload } from "@/lib/upload";
import { normalizeAndValidatePhone } from "@/lib/phone";
import { capitalizeName } from "@/lib/text-case";
import {
  isAreaManagerPosition,
  isOperationsManagerPosition,
} from "@/lib/positions";
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
import {
  lineFormDataFromPrefix,
  MAX_BULK_CREATE_LINES,
  parseBulkLineCount,
} from "@/lib/bulk-create";
import { parseEmployeeFinanceFromForm } from "@/lib/employee-bpjs";
import { SORT_ORDER_STEP } from "@/lib/reorder";
import { syncEmployeeLeaveEmploymentStatus } from "@/lib/leave-employment-status";
import {
  assertCanAssignEmployeePosition,
  assertCanManageEmployeeRecord,
} from "@/lib/employee-create-hierarchy";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";

async function employeeLocaleError(key: string) {
  const locale = await getServerLocale();
  return new Error(translate(locale, `pages.employees.errors.${key}`));
}

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

async function resolveAreaManagedProjectIds(
  formData: FormData,
  companyId: string,
  isAm: boolean
): Promise<string[]> {
  const ids = [
    ...new Set(
      formData
        .getAll("areaManagedProjectIds")
        .map((value) => String(value).trim())
        .filter(Boolean)
    ),
  ];
  if (!isAm) return [];
  if (ids.length === 0) {
    throw new Error("Select at least one project for Area Manager.");
  }

  const projects = await prisma.project.findMany({
    where: {
      id: { in: ids },
      companyId,
      subCategory: { not: "INTERNAL" },
    },
    select: { id: true },
  });
  if (projects.length !== ids.length) {
    throw new Error(
      "One or more selected projects are invalid for Area Manager coverage."
    );
  }
  return ids;
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

/** Preview one employee number per line, sequential within the same department. */
export async function previewEmployeeNumbersForLines(categoryIds: string[]) {
  await assertCanManageEmployees();

  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Company not found.");
  }

  const ids = categoryIds
    .slice(0, MAX_BULK_CREATE_LINES)
    .map((value) => String(value ?? "").trim());
  const counts = new Map<string, number>();
  for (const id of ids) {
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const allocated = new Map<string, string[]>();
  for (const [categoryId, count] of counts) {
    const resolved = await parseCategoryId(categoryId, company.id, {
      required: true,
    });
    allocated.set(
      categoryId,
      await allocateEmployeeNumbers(company.id, resolved!, count)
    );
  }

  const used = new Map<string, number>();
  return ids.map((id) => {
    if (!id) return "";
    const offset = used.get(id) ?? 0;
    used.set(id, offset + 1);
    return allocated.get(id)?.[offset] ?? "";
  });
}

export async function createEmployee(formData: FormData) {
  const session = await assertCanManageEmployees();

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
  await assertCanAssignEmployeePosition(session, {
    slug: positionSlug,
    name: positionName,
  });
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
          jobPosition: { slug: positionSlug, name: positionName },
        })
      : parseCreatePortalLoginFlag(portalRaw);
  const isOm = isOperationsManagerPosition({
    slug: positionSlug,
    name: positionName,
  });
  const isAm = isAreaManagerPosition({
    slug: positionSlug,
    name: positionName,
  });
  const omApprovalAreas = isOm ? parseOmApprovalAreas(formData) : [];
  if (isOm && omApprovalAreas.length === 0) {
    throw new Error("Select at least one Approval Area for Operations Manager.");
  }
  const areaManagedProjectIds = await resolveAreaManagedProjectIds(
    formData,
    company.id,
    isAm
  );
  const displayPosition = isOm
    ? formatOperationsManagerLabel(omApprovalAreas)
    : positionName;
  const { defaultInternalHomeSite } = await import("@/lib/office-cico");
  const internalHomeSite =
    employeeType !== "HEAD_OFFICE"
      ? "NONE"
      : defaultInternalHomeSite({
          categorySlug: category.slug,
          categoryPrefix: category.prefix,
          jobPosition: { slug: positionSlug, name: positionName },
        });

  if (!firstName) throw new Error("First name is required.");
  if (!lastName) throw new Error("Last name is required.");

  const finance = parseEmployeeFinanceFromForm(formData);
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
        internalHomeSite,
        portalAccessRequested,
        categoryId,
        positionId,
        position: displayPosition,
        omApprovalAreas,
        ...(isAm
          ? {
              areaManagedProjects: {
                create: areaManagedProjectIds.map((projectId) => ({
                  projectId,
                })),
              },
            }
          : {}),
        idDocumentUrl: idDocumentUrl ?? null,
        hiredAt,
        companyId: company.id,
        status: "ACTIVE",
        sortOrder,
        basePay: finance.basePay,
        bpjsKesehatanEnabled: finance.bpjsKesehatanEnabled,
        bpjsKetenagakerjaanEnabled: finance.bpjsKetenagakerjaanEnabled,
        jhtEnabled: finance.jhtEnabled,
        jpEnabled: finance.jpEnabled,
        jkkEnabled: finance.jkkEnabled,
        jkmEnabled: finance.jkmEnabled,
        jkkPercent: finance.jkkPercent,
        securityDepositRequired: finance.securityDepositRequired,
        cicoExempt: finance.cicoExempt,
        bankName: finance.bankName,
        bankAccountNumber: finance.bankAccountNumber,
        bankAccountName: finance.bankAccountName,
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
      jobPosition: { slug: positionSlug, name: positionName },
    });
  });

  revalidatePath("/employees");
  revalidatePath("/users");
}

export async function createEmployeesInBulk(formData: FormData) {
  const session = await assertCanManageEmployees();
  const locale = await getServerLocale();
  const uploaded: string[] = [];

  try {
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new Error("Company not found.");
    }

    const lineCount = parseBulkLineCount(formData);
    const people: Array<{
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
      categoryId: string;
      positionId: string | null;
      positionName: string | null;
      positionSlug: string | null;
      employmentType: EmploymentType;
      placement: ReturnType<typeof initialPlacementForDepartment>;
      employeeType: ReturnType<typeof employeeTypeFromPlacement>;
      hiredAt: Date | null;
      portalAccessRequested: boolean;
      omApprovalAreas: ReturnType<typeof parseOmApprovalAreas>;
      areaManagedProjectIds: string[];
      displayPosition: string | null;
      internalHomeSite: InternalHomeSite;
      finance: ReturnType<typeof parseEmployeeFinanceFromForm>;
      idDocumentUrl: string | null;
    }> = [];

    for (let index = 0; index < lineCount; index += 1) {
      const row = lineFormDataFromPrefix(formData, index);
      const firstName = capitalizeName(String(row.get("firstName") || "").trim());
      const lastName = capitalizeName(String(row.get("lastName") || "").trim());
      const categoryRaw = String(row.get("categoryId") ?? "").trim();
      const empty = !firstName && !lastName && !categoryRaw;
      if (empty) continue;

      try {
        if (!firstName) throw new Error("First name is required.");
        if (!lastName) throw new Error("Last name is required.");

        const categoryId = await parseCategoryId(row.get("categoryId"), company.id, {
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
          row.get("positionId"),
          company.id,
          categoryId,
          { required: true }
        );
        await assertCanAssignEmployeePosition(session, {
          slug: positionSlug,
          name: positionName,
        });
        const employmentType = parseEmploymentType(row.get("employmentType"));
        const placement = initialPlacementForDepartment({
          categorySlug: category.slug,
          categoryPrefix: category.prefix,
        });
        const employeeType = employeeTypeFromPlacement(placement);
        const hiredAt = parseHiredAt(row.get("hiredAt"));
        const portalRaw = row.get("createPortalLogin");
        const portalAccessRequested =
          portalRaw == null || String(portalRaw).trim() === ""
            ? defaultPortalAccessRequested({
                placement,
                categorySlug: category.slug,
                jobPosition: { slug: positionSlug, name: positionName },
              })
            : parseCreatePortalLoginFlag(portalRaw);
        const isOm = isOperationsManagerPosition({
          slug: positionSlug,
          name: positionName,
        });
        const isAm = isAreaManagerPosition({
          slug: positionSlug,
          name: positionName,
        });
        const omApprovalAreas = isOm ? parseOmApprovalAreas(row) : [];
        if (isOm && omApprovalAreas.length === 0) {
          throw new Error(
            "Select at least one Approval Area for Operations Manager."
          );
        }
        const areaManagedProjectIds = await resolveAreaManagedProjectIds(
          row,
          company.id,
          isAm
        );
        const displayPosition = isOm
          ? formatOperationsManagerLabel(omApprovalAreas)
          : positionName;
        const { defaultInternalHomeSite } = await import("@/lib/office-cico");
        const internalHomeSite =
          employeeType !== "HEAD_OFFICE"
            ? "NONE"
            : defaultInternalHomeSite({
                categorySlug: category.slug,
                categoryPrefix: category.prefix,
                jobPosition: { slug: positionSlug, name: positionName },
              });
        const finance = parseEmployeeFinanceFromForm(row);
        const idDocumentUrl = (await saveIdDocument(row)) ?? null;
        if (idDocumentUrl) uploaded.push(idDocumentUrl);

        people.push({
          firstName,
          lastName,
          email: parseContactEmail(row.get("email")),
          phone:
            normalizeAndValidatePhone(String(row.get("phone") || ""), "Phone") ||
            null,
          categoryId: categoryId!,
          positionId,
          positionName,
          positionSlug,
          employmentType,
          placement,
          employeeType,
          hiredAt,
          portalAccessRequested,
          omApprovalAreas,
          areaManagedProjectIds,
          displayPosition,
          internalHomeSite,
          finance,
          idDocumentUrl,
        });
      } catch (error) {
        throw new Error(
          translate(locale, "bulkCreate.lineError", {
            n: String(index + 1),
            message:
              error instanceof Error ? error.message : "Invalid employee line.",
          })
        );
      }
    }

    if (people.length === 0) {
      throw new Error(translate(locale, "bulkCreate.emptyLines"));
    }

    let sortOrder = await nextCompanyScopedSortOrder("employee", company.id);

    await prisma.$transaction(async (tx) => {
      for (const person of people) {
        const employeeNo = await getNextEmployeeNumber(
          company.id,
          person.categoryId,
          tx
        );
        const existing = await tx.employee.findUnique({
          where: { employeeNo },
        });
        if (existing) {
          throw new Error("Employee number already exists. Please try again.");
        }

        const employee = await tx.employee.create({
          data: {
            employeeNo,
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
            phone: person.phone,
            employeeType: person.employeeType,
            employmentType: person.employmentType,
            placement: person.placement,
            internalHomeSite: person.internalHomeSite,
            portalAccessRequested: person.portalAccessRequested,
            categoryId: person.categoryId,
            positionId: person.positionId,
            position: person.displayPosition,
            omApprovalAreas: person.omApprovalAreas,
            ...(person.areaManagedProjectIds.length > 0
              ? {
                  areaManagedProjects: {
                    create: person.areaManagedProjectIds.map((projectId) => ({
                      projectId,
                    })),
                  },
                }
              : {}),
            idDocumentUrl: person.idDocumentUrl,
            hiredAt: person.hiredAt,
            companyId: company.id,
            status: "ACTIVE",
            sortOrder,
            basePay: person.finance.basePay,
            bpjsKesehatanEnabled: person.finance.bpjsKesehatanEnabled,
            bpjsKetenagakerjaanEnabled: person.finance.bpjsKetenagakerjaanEnabled,
            jhtEnabled: person.finance.jhtEnabled,
            jpEnabled: person.finance.jpEnabled,
            jkkEnabled: person.finance.jkkEnabled,
            jkmEnabled: person.finance.jkmEnabled,
            jkkPercent: person.finance.jkkPercent,
            securityDepositRequired: person.finance.securityDepositRequired,
            cicoExempt: person.finance.cicoExempt,
            bankName: person.finance.bankName,
            bankAccountNumber: person.finance.bankAccountNumber,
            bankAccountName: person.finance.bankAccountName,
          },
        });

        await syncEmployeePortalLogin(tx, {
          companyId: company.id,
          employeeId: employee.id,
          firstName: person.firstName,
          lastName: person.lastName,
          employeeNo,
          employmentType: person.employmentType,
          placement: person.placement,
          portalAccessRequested: person.portalAccessRequested,
          status: "ACTIVE",
          userId: null,
          employeeType: person.employeeType,
          jobPosition: {
            slug: person.positionSlug,
            name: person.positionName,
          },
        });

        sortOrder += SORT_ORDER_STEP;
      }
    });

    revalidatePath("/employees");
    revalidatePath("/users");
  } catch (error) {
    await Promise.all(uploaded.map((path) => deleteLocalUpload(path)));
    throw error;
  }
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
  const session = await assertCanManageEmployees();

  const firstName = capitalizeName(String(formData.get("firstName") || "").trim());
  const lastName = capitalizeName(String(formData.get("lastName") || "").trim());
  const email = parseContactEmail(formData.get("email"));
  const phone = normalizeAndValidatePhone(
    String(formData.get("phone") || ""),
    "Phone"
  );

  if (!firstName) throw new Error("First name is required.");
  if (!lastName) throw new Error("Last name is required.");

  const finance = parseEmployeeFinanceFromForm(formData);

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
      status: true,
      categoryId: true,
      userId: true,
      jobPosition: { select: { slug: true, name: true } },
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

  await assertCanManageEmployeeRecord(session, employee.jobPosition);

  if (!isRosterActiveEmployeeStatus(employee.status)) {
    throw new Error("Restore the employee before editing status or details.");
  }

  // Employment status is leave-driven — sync before save; edit form cannot set ON_LEAVE.
  await syncEmployeeLeaveEmploymentStatus(prisma, id);
  const synced = await prisma.employee.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!synced) {
    throw new Error("Employee not found.");
  }
  const status = synced.status;

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
  await assertCanAssignEmployeePosition(session, {
    slug: positionSlug,
    name: positionName,
  });
  const employmentType = parseEmploymentType(formData.get("employmentType"));
  // Placement is system-driven — Assign/Release change ON_PROJECT.
  // Department moves between Corporate/Warehouse ↔ Operations reset the desk/field default.
  const categoryChanged = categoryId !== employee.categoryId;
  let placement = employee.placement;
  if (categoryChanged && placement !== "ON_PROJECT" && placement !== "ON_LEAVE") {
    placement = initialPlacementForDepartment({
      categorySlug: category.slug,
      categoryPrefix: category.prefix,
    });
  }
  const employeeType = employeeTypeFromPlacement(placement);
  const hiredAt = parseHiredAt(formData.get("hiredAt"));

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
  const isAm = isAreaManagerPosition({
    slug: positionSlug,
    name: positionName,
  });
  const omApprovalAreas = isOm ? parseOmApprovalAreas(formData) : [];
  if (isOm && omApprovalAreas.length === 0) {
    throw new Error("Select at least one Approval Area for Operations Manager.");
  }
  const areaManagedProjectIds = await resolveAreaManagedProjectIds(
    formData,
    employee.companyId,
    isAm
  );
  const displayPosition = isOm
    ? formatOperationsManagerLabel(omApprovalAreas)
    : positionName;
  const { defaultInternalHomeSite } = await import("@/lib/office-cico");
  const internalHomeSite =
    employeeType !== "HEAD_OFFICE"
      ? "NONE"
      : defaultInternalHomeSite({
          categorySlug: category.slug,
          categoryPrefix: category.prefix,
          jobPosition: { slug: positionSlug, name: positionName },
        });

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
        internalHomeSite,
        status,
        portalAccessRequested,
        categoryId,
        positionId,
        position: displayPosition,
        omApprovalAreas,
        areaManagedProjects: {
          deleteMany: {},
          ...(isAm
            ? {
                create: areaManagedProjectIds.map((projectId) => ({
                  projectId,
                })),
              }
            : {}),
        },
        hiredAt,
        basePay: finance.basePay,
        bpjsKesehatanEnabled: finance.bpjsKesehatanEnabled,
        bpjsKetenagakerjaanEnabled: finance.bpjsKetenagakerjaanEnabled,
        jhtEnabled: finance.jhtEnabled,
        jpEnabled: finance.jpEnabled,
        jkkEnabled: finance.jkkEnabled,
        jkmEnabled: finance.jkmEnabled,
        jkkPercent: finance.jkkPercent,
        securityDepositRequired: finance.securityDepositRequired,
        cicoExempt: finance.cicoExempt,
        bankName: finance.bankName,
        bankAccountNumber: finance.bankAccountNumber,
        bankAccountName: finance.bankAccountName,
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
      status,
      userId: updated.userId,
      employeeType,
      jobPosition: { slug: positionSlug, name: positionName },
    });
  });

  revalidatePath("/employees");
  revalidatePath("/users");
}

/**
 * Assign to Head Office → placement HEAD_OFFICE; clear project links.
 * Do not force FT or PT portal Yes (PT portal only forced On Project).
 */
export async function assignEmployeeToHeadOffice(id: string) {
  await assertCanManageEmployees();

  await syncEmployeeLeaveEmploymentStatus(prisma, id);

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

  if (!employee) {
    throw new Error("Employee not found.");
  }
  if (employee.status !== "ACTIVE") {
    throw new Error(
      "Only Active employees can be assigned. On Leave staff cannot be assigned."
    );
  }

  const employeeType = employeeTypeFromPlacement("HEAD_OFFICE");

  await prisma.$transaction(async (tx) => {
    await syncProjectAssignments(tx, id, []);
    await tx.employee.update({
      where: { id },
      data: {
        placement: "HEAD_OFFICE",
        employeeType,
        // Keep existing portal Yes/No — do not force for HO (esp. PT).
      },
    });

    await syncEmployeePortalLogin(tx, {
      companyId: employee.companyId,
      employeeId: id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeNo: employee.employeeNo,
      employmentType: employee.employmentType,
      placement: "HEAD_OFFICE",
      portalAccessRequested: employee.portalAccessRequested,
      status: employee.status,
      userId: employee.userId,
      employeeType,
    });
  });

  revalidatePath("/employees");
  revalidatePath("/users");
  revalidatePath("/projects");
  revalidatePath("/shifts");
  revalidatePath("/cico");
  revalidatePath("/attendance");
}

/**
 * Release from assignment (project or Head Office) → AVAILABLE (Unassigned pool).
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
    },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  const releasePlacement: Placement = "AVAILABLE";
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
  revalidatePath("/shifts");
  revalidatePath("/cico");
  revalidatePath("/attendance");
}

async function deactivateEmployeeRecord(id: string, currentUserId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      userId: true,
      status: true,
      _count: { select: { projectAssignments: true } },
    },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  if (!isRosterActiveEmployeeStatus(employee.status)) {
    throw new Error("Only active employees can be removed from the directory.");
  }

  if (employee._count.projectAssignments > 0) {
    throw await employeeLocaleError("deleteBlockedAssigned");
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

    // Like Clients/Vendors: soft restore keeps portal login revoked until
    // Users → Revoked Access → Restore Access (do not auto-sync FT login on).
    await ensureEmployeeLoginStaysInactive(tx, updated.userId);
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

  if (
    employee.status !== "INACTIVE" &&
    employee.status !== "TERMINATED" &&
    employee.status !== "RESIGNED"
  ) {
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
            jobPosition: { select: { slug: true, name: true } },
          },
        });

        if (!employee) {
          throw new Error("Employee not found.");
        }

        if (!isRosterActiveEmployeeStatus(employee.status)) {
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
            `${label}: Part Time login is only available while On Project.`
          );
        }

        if (employee.userId) {
          const linkedUser = await tx.user.findUnique({
            where: { id: employee.userId },
            select: { active: true },
          });
          if (linkedUser && !linkedUser.active) {
            const label = `${employee.firstName} ${employee.lastName}`.trim();
            const locale = await getServerLocale();
            throw new Error(
              translate(locale, "pages.employees.portalLoginRevoked", {
                name: label,
              })
            );
          }
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
          jobPosition: employee.jobPosition,
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

export async function resignEmployee(formData: FormData) {
  const session = await requireSession();
  const user = toPermissionUser(session);
  if (!canResignEmployees(user)) {
    throw await employeeLocaleError("resignHoOnly");
  }

  const locale = await getServerLocale();
  const id = String(formData.get("employeeId") ?? "").trim();
  const lastWorkingDayRaw = String(formData.get("lastWorkingDay") ?? "").trim();
  const procedure = String(formData.get("procedure") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!id) {
    throw new Error(translate(locale, "pages.employees.errors.resignFailed"));
  }
  if (!lastWorkingDayRaw) {
    throw new Error(translate(locale, "pages.employees.errors.lastWorkingDayRequired"));
  }
  if (procedure !== "according" && procedure !== "notAccording") {
    throw new Error(translate(locale, "pages.employees.errors.procedureRequired"));
  }

  const { parseDateInput } = await import("@/lib/invoice-period");
  const { payrollPeriodFromJakartaDate } = await import(
    "@/lib/internal-payroll-period"
  );
  const { toDecimal } = await import("@/lib/inventory");
  const { applyResignIfLastDayReached } = await import("@/lib/employee-resign");
  const { decimalToNumber } = await import("@/lib/project-billing");

  let lastWorkingDay: Date;
  try {
    lastWorkingDay = parseDateInput(lastWorkingDayRaw);
  } catch {
    throw new Error(translate(locale, "pages.employees.errors.lastWorkingDayRequired"));
  }

  const accordingToProcedure = procedure === "according";
  const forfeitRemainingWages =
    !accordingToProcedure &&
    String(formData.get("forfeitRemainingWages") ?? "") === "1";

  const employee = await prisma.employee.findFirst({
    where: { id, companyId: session.user.companyId },
    select: {
      id: true,
      status: true,
      companyId: true,
      userId: true,
      depositHeldAmount: true,
      depositStatus: true,
      resignAccordingToProcedure: true,
      depositSourceProjectId: true,
    },
  });
  if (!employee) {
    throw new Error(translate(locale, "pages.employees.errors.resignFailed"));
  }
  if (employee.status === "RESIGNED" || employee.resignAccordingToProcedure != null) {
    throw new Error(translate(locale, "pages.employees.errors.alreadyResigned"));
  }
  if (!isRosterActiveEmployeeStatus(employee.status)) {
    throw new Error(translate(locale, "pages.employees.errors.resignFailed"));
  }

  const held = decimalToNumber(employee.depositHeldAmount) ?? 0;
  const ym = payrollPeriodFromJakartaDate(lastWorkingDay);

  await prisma.$transaction(async (tx) => {
    const lastCommercial = await tx.projectAssignment.findFirst({
      where: {
        employeeId: employee.id,
        project: { subCategory: { not: "INTERNAL" } },
      },
      orderBy: { assignedAt: "desc" },
      select: { projectId: true },
    });
    const depositSourceProjectId =
      lastCommercial?.projectId ?? employee.depositSourceProjectId ?? null;

    await tx.employee.update({
      where: { id: employee.id },
      data: {
        lastWorkingDay,
        resignAccordingToProcedure: accordingToProcedure,
        resignForfeitRemainingWages: forfeitRemainingWages,
        resignNote: note || null,
        depositSourceProjectId,
        depositStatus: accordingToProcedure
          ? held > 0
            ? "RETURNED"
            : employee.depositStatus
          : held > 0
            ? "KEPT_BY_COMPANY"
            : employee.depositStatus,
      },
    });

    if (accordingToProcedure && held > 0 && employee.depositStatus === "HELD") {
      await tx.payrollDeduction.create({
        data: {
          companyId: employee.companyId,
          employeeId: employee.id,
          year: ym.year,
          month: ym.month,
          type: "RETURN_OF_SECURITY_DEPOSIT",
          amount: toDecimal(held),
          reason: "Return of security deposit",
          createdById: session.user.id,
          projectId: depositSourceProjectId,
        },
      });
    }

    await applyResignIfLastDayReached(tx, employee.id);
  });

  if (forfeitRemainingWages) {
    const { loadInternalPayrollMonth } = await import(
      "@/lib/internal-payroll-month"
    );
    await loadInternalPayrollMonth({
      companyId: employee.companyId,
      year: ym.year,
      month: ym.month,
      live: true,
    });
  }

  revalidatePath("/employees");
  revalidatePath("/users");
  revalidatePath("/billing/payroll");
  revalidatePath("/billing/financial-report");
}
