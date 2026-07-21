"use server";

import { revalidatePath } from "next/cache";

import { formatImportDateDisplay } from "@/lib/bulk-import/parse-import-date";
import { EMPLOYEE_IMPORT_COLUMNS } from "@/lib/bulk-import/employee-template";
import { EMPLOYEE_TEMPLATE_ASSIGNABLE_PROJECT_STATUSES } from "@/lib/bulk-import/live-template-lists";
import { parseEmployeeImportRow } from "@/lib/bulk-import/parse-employee-row";
import {
  createBulkImportPreview,
  createBulkImportResult,
  recordImportCreated,
  recordImportFailed,
  recordImportSkipped,
  type BulkImportPreview,
  type BulkImportPreviewRow,
  type BulkImportResult,
} from "@/lib/bulk-import/types";
import {
  parseSpreadsheetRows,
  readSpreadsheetFile,
} from "@/lib/bulk-import/xlsx";
import { getNextEmployeeNumber } from "@/lib/employee-number";
import { syncProjectAssignments } from "@/lib/employee-projects";
import {
  employeeTypeFromPlacement,
  initialPlacementForDepartment,
} from "@/lib/placement";
import { nextCompanyScopedSortOrder } from "@/lib/persist-reorder";
import { prisma } from "@/lib/prisma";
import { canManageEmployees } from "@/lib/project-access";
import { SORT_ORDER_STEP } from "@/lib/reorder";
import { requireSession, toPermissionUser } from "@/lib/session";
import {
  defaultPortalAccessRequested,
  syncEmployeePortalLogin,
} from "@/lib/workforce-login";

const ASSIGNABLE_STATUSES = EMPLOYEE_TEMPLATE_ASSIGNABLE_PROJECT_STATUSES;

async function assertCanManageEmployees() {
  const session = await requireSession();
  if (!canManageEmployees(toPermissionUser(session))) {
    throw new Error("You do not have permission to manage employees.");
  }
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function previewFieldsFromValues(values: Record<string, string>) {
  return {
    Name:
      [values.firstName, values.lastName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(" ") || "—",
    Department: values.department?.trim() || "—",
    "Employment type": values.employmentType?.trim() || "—",
    Position: values.position?.trim() || "—",
    Email: values.email?.trim() || "—",
    "Country Code": values.countryCode?.trim() || "—",
    Phone: values.phone?.trim() || "—",
    "Start date": values.hiredAt?.trim() || "—",
    Projects: values.projectNames?.trim() || "—",
    "Portal login": values.createPortalLogin?.trim() || "Default",
  };
}

async function loadEmployeeImportContext(file: File) {
  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Company not found.");
  }

  const buffer = await readSpreadsheetFile(file);
  const { rows } = parseSpreadsheetRows(buffer, EMPLOYEE_IMPORT_COLUMNS);

  if (rows.length === 0) {
    throw new Error("No data rows found. Add employees below the header row.");
  }

  const [categories, positions, projects] = await Promise.all([
    prisma.employeeCategory.findMany({
      where: {
        companyId: company.id,
        active: true,
        NOT: {
          OR: [
            { slug: "unassign" },
            { slug: "unassigned" },
            { prefix: { equals: "UNA", mode: "insensitive" } },
          ],
        },
      },
      select: { id: true, name: true, prefix: true, slug: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.position.findMany({
      where: { companyId: company.id, active: true },
      select: { id: true, name: true, categoryId: true },
    }),
    prisma.project.findMany({
      where: {
        companyId: company.id,
        status: { in: ASSIGNABLE_STATUSES },
      },
      select: { id: true, name: true },
    }),
  ]);

  const categoryByName = new Map(
    categories.map((category) => [normalizeKey(category.name), category])
  );
  const categoryByPrefix = new Map(
    categories.map((category) => [
      normalizeKey(category.prefix),
      category,
    ])
  );
  const projectByName = new Map(
    projects.map((project) => [normalizeKey(project.name), project])
  );

  return {
    company,
    rows,
    categories,
    positions,
    categoryByName,
    categoryByPrefix,
    projectByName,
  };
}

function resolveImportCategory(
  parsed: Awaited<ReturnType<typeof parseEmployeeImportRow>>,
  categoryByName: Map<
    string,
    { id: string; name: string; prefix: string; slug: string }
  >,
  categoryByPrefix: Map<
    string,
    { id: string; name: string; prefix: string; slug: string }
  >
) {
  const category =
    categoryByPrefix.get(normalizeKey(parsed.department)) ??
    categoryByName.get(normalizeKey(parsed.department));

  if (!category) {
    throw new Error(
      `Department "${parsed.department}" was not found. Choose an active department from the dropdown.`
    );
  }

  return category;
}

function parseForcedEmploymentType(
  formData: FormData
): "FULL_TIME" | "PART_TIME" | undefined {
  const raw = String(formData.get("forceEmploymentType") ?? "")
    .trim()
    .toUpperCase();
  if (raw === "PART_TIME" || raw === "FULL_TIME") return raw;
  return undefined;
}

export async function previewBulkImportEmployees(
  formData: FormData
): Promise<BulkImportPreview> {
  await assertCanManageEmployees();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose an Excel file to upload.");
  }

  const forceEmploymentType = parseForcedEmploymentType(formData);

  const {
    rows,
    positions,
    categoryByName,
    categoryByPrefix,
    projectByName,
  } = await loadEmployeeImportContext(file);

  const previewRows: BulkImportPreviewRow[] = [];

  for (const { rowNumber, values } of rows) {
    const fields = previewFieldsFromValues(values);

    try {
      const parsed = parseEmployeeImportRow(values, undefined, {
        forceEmploymentType,
      });
      const category = resolveImportCategory(
        parsed,
        categoryByName,
        categoryByPrefix
      );
      const position = positions.find(
        (item) =>
          item.categoryId === category.id &&
          normalizeKey(item.name) === normalizeKey(parsed.position)
      );
      if (!position) {
        throw new Error(
          `Position "${parsed.position}" was not found in Department "${category.name}".`
        );
      }

      for (const projectName of parsed.projectNames) {
        const project = projectByName.get(normalizeKey(projectName));
        if (!project) {
          throw new Error(
            `Project "${projectName}" was not found or is not assignable.`
          );
        }
      }

      const defaultPlacement = initialPlacementForDepartment({
        categorySlug: category.slug,
        categoryPrefix: category.prefix,
      });
      const placement = parsed.projectNames.length
        ? "ON_PROJECT"
        : defaultPlacement === "HEAD_OFFICE"
          ? "HEAD_OFFICE"
          : parsed.legacyPlacement === "FIELD"
            ? "FIELD"
            : "AVAILABLE";
      const portalAccessRequested =
        parsed.portalAccessRequested ??
        defaultPortalAccessRequested({
          placement,
          categorySlug: category.slug,
        });

      previewRows.push({
        rowNumber,
        status: "ready",
        fields: {
          ...fields,
          Name: `${parsed.firstName} ${parsed.lastName}`.trim(),
          Department: category.name,
          "Employment type":
            parsed.employmentType === "PART_TIME" ? "Part Time" : "Full Time",
          Placement: placement.replace(/_/g, " "),
          Position: position.name,
          Phone: parsed.phone ?? "—",
          "Start date": parsed.hiredAt
            ? formatImportDateDisplay(parsed.hiredAt)
            : fields["Start date"],
          "Portal login": portalAccessRequested ? "Yes" : "No",
        },
      });
    } catch (error) {
      previewRows.push({
        rowNumber,
        status: "invalid",
        message:
          error instanceof Error ? error.message : "Invalid employee row.",
        fields,
      });
    }
  }

  return createBulkImportPreview(previewRows);
}

export async function confirmBulkImportEmployees(
  formData: FormData
): Promise<BulkImportResult> {
  await assertCanManageEmployees();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose an Excel file to upload.");
  }

  const forceEmploymentType = parseForcedEmploymentType(formData);

  const {
    company,
    rows,
    positions,
    categoryByName,
    categoryByPrefix,
    projectByName,
  } = await loadEmployeeImportContext(file);

  const result = createBulkImportResult();
  const seenEmployeeNos = new Set(
    (
      await prisma.employee.findMany({
        where: { companyId: company.id, archivedFromDirectory: false },
        select: { employeeNo: true },
      })
    ).map((employee) => normalizeKey(employee.employeeNo))
  );
  let nextSortOrder = await nextCompanyScopedSortOrder("employee", company.id);

  for (const { rowNumber, values } of rows) {
    try {
      const parsed = parseEmployeeImportRow(values, undefined, {
        forceEmploymentType,
      });
      const category = resolveImportCategory(
        parsed,
        categoryByName,
        categoryByPrefix
      );
      const position = positions.find(
        (item) =>
          item.categoryId === category.id &&
          normalizeKey(item.name) === normalizeKey(parsed.position)
      );
      if (!position) {
        throw new Error(
          `Position "${parsed.position}" was not found in Department "${category.name}".`
        );
      }

      let projectIds: string[] = [];
      for (const projectName of parsed.projectNames) {
        const project = projectByName.get(normalizeKey(projectName));
        if (!project) {
          throw new Error(
            `Project "${projectName}" was not found or is not assignable.`
          );
        }
        projectIds.push(project.id);
      }
      projectIds = [...new Set(projectIds)];
      const defaultPlacement = initialPlacementForDepartment({
        categorySlug: category.slug,
        categoryPrefix: category.prefix,
      });
      const placement = projectIds.length
        ? "ON_PROJECT"
        : defaultPlacement === "HEAD_OFFICE"
          ? "HEAD_OFFICE"
          : parsed.legacyPlacement === "FIELD"
            ? "FIELD"
            : "AVAILABLE";
      const portalAccessRequested =
        parsed.portalAccessRequested ??
        defaultPortalAccessRequested({
          placement,
          categorySlug: category.slug,
        });

      const sortOrder = nextSortOrder;
      nextSortOrder += SORT_ORDER_STEP;

      const createdEmployeeNo = await prisma.$transaction(async (tx) => {
        const employeeNo = await getNextEmployeeNumber(company.id, category.id, tx);

        if (seenEmployeeNos.has(normalizeKey(employeeNo))) {
          throw new Error(`Employee number "${employeeNo}" already exists.`);
        }

        const employeeType = employeeTypeFromPlacement(placement);

        const employee = await tx.employee.create({
          data: {
            employeeNo,
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            email: parsed.email,
            phone: parsed.phone,
            employeeType,
            employmentType: parsed.employmentType,
            placement,
            portalAccessRequested,
            categoryId: category.id,
            hiredAt: parsed.hiredAt,
            positionId: position.id,
            position: position.name,
            companyId: company.id,
            status: "ACTIVE",
            sortOrder,
          },
        });

        if (placement === "ON_PROJECT") {
          await syncProjectAssignments(tx, employee.id, projectIds);
        }
        await syncEmployeePortalLogin(tx, {
          companyId: company.id,
          employeeId: employee.id,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          employeeNo,
          employmentType: parsed.employmentType,
          placement,
          portalAccessRequested,
          status: "ACTIVE",
          employeeType,
        });

        return employeeNo;
      });

      seenEmployeeNos.add(normalizeKey(createdEmployeeNo));
      recordImportCreated(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create employee.";
      const isDuplicateNo =
        /employee number/i.test(message) && /already exists/i.test(message);

      if (isDuplicateNo) {
        recordImportSkipped(result, rowNumber, message);
        continue;
      }

      recordImportFailed(result, rowNumber, message);
    }
  }

  if (result.createdCount > 0) {
    revalidatePath("/employees");
    revalidatePath("/users");
  }

  return result;
}

/** @deprecated Use previewBulkImportEmployees + confirmBulkImportEmployees. */
export async function bulkImportEmployees(
  formData: FormData
): Promise<BulkImportResult> {
  return confirmBulkImportEmployees(formData);
}
