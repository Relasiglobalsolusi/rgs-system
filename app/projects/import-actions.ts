"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { formatImportDateDisplay } from "@/lib/bulk-import/parse-import-date";
import { parseProjectImportRow } from "@/lib/bulk-import/parse-project-row";
import { PROJECT_IMPORT_COLUMNS } from "@/lib/bulk-import/project-import-columns";
import {
  createBulkImportPreview,
  createBulkImportResult,
  recordImportCreated,
  recordImportFailed,
  type BulkImportPreview,
  type BulkImportPreviewRow,
  type BulkImportResult,
} from "@/lib/bulk-import/types";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import {
  parseSpreadsheetRows,
  readSpreadsheetFile,
} from "@/lib/bulk-import/xlsx";
import {
  isGoogleMapsUrl,
  normalizeGoogleMapsUrl,
} from "@/lib/google-maps-url";
import {
  clampInvoicingDay,
  toUtcDateOnly,
} from "@/lib/invoice-period";
import { resolveMapsUrl } from "@/lib/maps-resolve";
import { reverseGeocodeNominatim } from "@/lib/nominatim";
import { taxInvoiceDefaultsFromClient } from "@/lib/npwp";
import { parseCoordinates } from "@/lib/parse-coordinates";
import { nextCompanyScopedSortOrder } from "@/lib/persist-reorder";
import { prisma } from "@/lib/prisma";
import { canManageProjects } from "@/lib/project-access";
import {
  buildMilestoneSchedule,
  formatMilestoneScheduleLabel,
  MAX_MILESTONE_PAYMENTS,
  MIN_MILESTONE_PAYMENTS,
  splitEvenlyPercents,
} from "@/lib/project-billing";
import { isContractSubCategory } from "@/lib/project-contract";
import { getProjectSubCategoryLabel } from "@/lib/project-subcategory";
import { PROJECT_LIST_VIEW_PATHS } from "@/lib/project-status";
import { SORT_ORDER_STEP } from "@/lib/reorder";
import { requireModule, toPermissionUser } from "@/lib/session";
import { capitalizeProper } from "@/lib/text-case";

type ImportClient = {
  id: string;
  name: string;
  npwp: string | null;
};

type ImportEmployee = {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  categoryName: string | null;
  categoryPrefix: string | null;
};

type ResolvedLocation = {
  latitude: number;
  longitude: number;
  location: string;
};

async function assertCanManageProjects() {
  const session = await requireModule("projects");
  if (session.user.clientId) {
    throw new Error("Client portal users cannot import projects.");
  }
  if (!canManageProjects(toPermissionUser(session))) {
    throw new Error("You do not have permission to manage projects.");
  }
  return session;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function coordPlaceholder(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function previewFieldsFromValues(values: Record<string, string>) {
  return {
    "Project Name": values.name?.trim() || "—",
    Client: values.client?.trim() || "—",
    Stage: values.startingStage?.trim() || "—",
    Subcategory: values.subCategory?.trim() || "—",
    Billing: values.billingMode?.trim() || "—",
    Payments:
      values.milestonePayments?.trim() ||
      values.numberOfPayments?.trim() ||
      "—",
    "Company Tax ID": values.companyTaxId?.trim() || "—",
    Start: values.estimatedStartDate?.trim() || "—",
    Duration: values.durationMonths?.trim() || "—",
    End: values.estimatedEndDate?.trim() || "—",
    Coordinates: values.coordinates?.trim() || "—",
    Location: "—",
    Department: values.department?.trim() || "—",
    Staff: values.staffAssigned?.trim() || "—",
  };
}

/** Even split for import; allows 1 payment → [100] (template dropdown is 1–10). */
function splitEvenlyPercentsForImport(paymentCount: number): number[] {
  const n = Math.min(
    MAX_MILESTONE_PAYMENTS,
    Math.max(1, Math.round(paymentCount))
  );
  if (n < MIN_MILESTONE_PAYMENTS) {
    return [100];
  }
  return splitEvenlyPercents(n);
}

function resolveClient(
  clientName: string,
  clientsByName: Map<string, ImportClient>
): ImportClient {
  const client = clientsByName.get(normalizeKey(clientName));
  if (!client) {
    throw new Error(
      `Client "${clientName}" was not found. Choose an active client from the dropdown.`
    );
  }
  return client;
}

async function resolveImportLocation(raw: string): Promise<ResolvedLocation> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(
      "Gmaps Coordinates are required (paste lat, lng or a Google Maps / share link)."
    );
  }

  let latitude: number | null = null;
  let longitude: number | null = null;

  const parsed = parseCoordinates(trimmed);
  if (parsed) {
    latitude = parsed.lat;
    longitude = parsed.lng;
  } else if (isGoogleMapsUrl(trimmed)) {
    const url = normalizeGoogleMapsUrl(trimmed);
    if (!url) {
      throw new Error(
        "Could not read that Maps link. Paste decimal coordinates (e.g. -6.1754, 106.8272) instead."
      );
    }
    try {
      const resolved = await resolveMapsUrl(url);
      latitude = resolved.latitude;
      longitude = resolved.longitude;
    } catch {
      throw new Error(
        "Could not resolve that Maps / share link. Paste decimal coordinates (e.g. -6.1754, 106.8272) instead."
      );
    }
  } else {
    throw new Error(
      "Gmaps Coordinates must be latitude and longitude (e.g. -6.1754, 106.8272) or a Google Maps / share link."
    );
  }

  if (latitude == null || longitude == null) {
    throw new Error("Could not determine coordinates from the pasted value.");
  }

  const address = await reverseGeocodeNominatim(latitude, longitude);
  const location = capitalizeProper(
    address?.trim() || coordPlaceholder(latitude, longitude)
  );

  return { latitude, longitude, location };
}

function resolveEmployeeFromStaffToken(
  token: string,
  employeesByNo: Map<string, ImportEmployee>,
  employeesByName: Map<string, ImportEmployee[]>
): ImportEmployee {
  const trimmed = token.trim();
  const key = normalizeKey(trimmed);

  const byNo = employeesByNo.get(key);
  if (byNo) return byNo;

  // Template label: "Full Name - EMP-001" — prefer the employee no after " - ".
  const dashIdx = trimmed.lastIndexOf(" - ");
  if (dashIdx !== -1) {
    const namePart = trimmed.slice(0, dashIdx).trim();
    const noPart = trimmed.slice(dashIdx + 3).trim();
    const fromDash = employeesByNo.get(normalizeKey(noPart));
    if (fromDash) return fromDash;

    const nameKey = normalizeKey(namePart);
    const byName = employeesByName.get(nameKey) ?? [];
    if (byName.length === 1) return byName[0]!;
    if (byName.length > 1) {
      throw new Error(
        `Staff name "${namePart}" matches more than one employee. Use the Name - Employee No form from the dropdown.`
      );
    }
  }

  // Legacy template label: "First Last (EMP-001)".
  const withNo = trimmed.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (withNo) {
    const noKey = normalizeKey(withNo[2] ?? "");
    const fromParen = employeesByNo.get(noKey);
    if (fromParen) return fromParen;

    const nameKey = normalizeKey(withNo[1] ?? "");
    const byName = employeesByName.get(nameKey) ?? [];
    if (byName.length === 1) return byName[0]!;
    if (byName.length > 1) {
      throw new Error(
        `Staff name "${withNo[1]!.trim()}" matches more than one employee. Use the Name - Employee No form from the dropdown.`
      );
    }
  }

  const byName = employeesByName.get(key) ?? [];
  if (byName.length === 0) {
    throw new Error(
      `Staff "${token}" was not found. Pick a name from the department dropdown (or Name - Employee No / Employee No alone).`
    );
  }
  if (byName.length > 1) {
    throw new Error(
      `Staff name "${token}" matches more than one employee. Use the Name - Employee No form from the dropdown.`
    );
  }
  return byName[0]!;
}

function resolveStaffIds(
  tokens: string[],
  department: string | null,
  employeesByNo: Map<string, ImportEmployee>,
  employeesByName: Map<string, ImportEmployee[]>
): string[] {
  if (tokens.length === 0) return [];

  const departmentKey = department ? normalizeKey(department) : null;
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const employee = resolveEmployeeFromStaffToken(
      token,
      employeesByNo,
      employeesByName
    );

    if (departmentKey) {
      const nameKey = normalizeKey(employee.categoryName ?? "");
      const prefixKey = normalizeKey(employee.categoryPrefix ?? "");
      if (
        departmentKey !== nameKey &&
        departmentKey !== prefixKey
      ) {
        throw new Error(
          `Staff "${token}" is not in department "${department}". Clear Department or pick staff from that department.`
        );
      }
    }

    if (!seen.has(employee.id)) {
      seen.add(employee.id);
      ids.push(employee.id);
    }
  }

  return ids;
}

async function createMilestoneSchedulePeriods(
  tx: Prisma.TransactionClient,
  opts: {
    projectId: string;
    startDate: Date | null;
    installmentPercents: number[];
  }
) {
  // Import allows a single 100% milestone (template 1–10); shared validator is 2–10.
  const schedule =
    opts.installmentPercents.length === 1
      ? [
          {
            index: 0,
            installmentPercent: 100,
            cumulativePercent: 100,
            label: formatMilestoneScheduleLabel(100),
            amount: null as number | null,
          },
        ]
      : buildMilestoneSchedule(opts.installmentPercents, null);
  const base = opts.startDate
    ? toUtcDateOnly(opts.startDate)
    : toUtcDateOnly(new Date());

  for (const row of schedule) {
    const periodStart = new Date(
      Date.UTC(
        base.getUTCFullYear(),
        base.getUTCMonth(),
        base.getUTCDate() + row.index
      )
    );
    await tx.projectInvoicePeriod.create({
      data: {
        projectId: opts.projectId,
        periodStart,
        periodEnd: periodStart,
        label: row.label,
        status: "ONGOING",
        amount: row.amount,
        milestonePercent: row.cumulativePercent,
      },
    });
  }
}

async function loadProjectImportContext(file: File) {
  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Company not found.");
  }

  const buffer = await readSpreadsheetFile(file);
  const { rows } = parseSpreadsheetRows(buffer, PROJECT_IMPORT_COLUMNS);

  if (rows.length === 0) {
    throw new Error("No data rows found. Add projects below the header row.");
  }

  const [clients, employees] = await Promise.all([
    prisma.client.findMany({
      where: { companyId: company.id, active: true },
      select: { id: true, name: true, npwp: true },
    }),
    prisma.employee.findMany({
      where: { companyId: company.id, status: "ACTIVE" },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        category: { select: { name: true, prefix: true } },
      },
    }),
  ]);

  const clientsByName = new Map(
    clients.map((client) => [normalizeKey(client.name), client])
  );

  const employeesByNo = new Map(
    employees.map((employee) => [
      normalizeKey(employee.employeeNo),
      {
        id: employee.id,
        employeeNo: employee.employeeNo,
        firstName: employee.firstName,
        lastName: employee.lastName,
        categoryName: employee.category?.name ?? null,
        categoryPrefix: employee.category?.prefix ?? null,
      } satisfies ImportEmployee,
    ])
  );

  const employeesByName = new Map<string, ImportEmployee[]>();
  for (const employee of employees) {
    const mapped: ImportEmployee = {
      id: employee.id,
      employeeNo: employee.employeeNo,
      firstName: employee.firstName,
      lastName: employee.lastName,
      categoryName: employee.category?.name ?? null,
      categoryPrefix: employee.category?.prefix ?? null,
    };
    const fullName = normalizeKey(
      `${employee.firstName} ${employee.lastName}`
    );
    const list = employeesByName.get(fullName) ?? [];
    list.push(mapped);
    employeesByName.set(fullName, list);
  }

  return {
    company,
    rows,
    clientsByName,
    employeesByNo,
    employeesByName,
  };
}

export async function previewBulkImportProjects(
  formData: FormData
): Promise<BulkImportPreview> {
  await assertCanManageProjects();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose an Excel file to upload.");
  }

  const { rows, clientsByName, employeesByNo, employeesByName } =
    await loadProjectImportContext(file);
  const locale = await getServerLocale();

  const previewRows: BulkImportPreviewRow[] = [];

  for (const { rowNumber, values } of rows) {
    const fields = previewFieldsFromValues(values);

    try {
      const parsed = parseProjectImportRow(values);
      const client = resolveClient(parsed.clientName, clientsByName);
      const taxDefaults = taxInvoiceDefaultsFromClient(client);
      const resolved = await resolveImportLocation(parsed.coordinatesRaw);
      const staffIds =
        parsed.startingStage === "PLANNED"
          ? []
          : resolveStaffIds(
              parsed.staffTokens,
              parsed.department,
              employeesByNo,
              employeesByName
            );
      const emptyStaffInProgress =
        parsed.startingStage === "IN_PROGRESS" && staffIds.length === 0;

      previewRows.push({
        rowNumber,
        status: emptyStaffInProgress ? "warning" : "ready",
        message: emptyStaffInProgress
          ? translate(
              locale,
              "bulkImport.inProgressEmptyStaffWarning"
            )
          : undefined,
        fields: {
          ...fields,
          "Project Name": parsed.name,
          Client: client.name,
          Stage:
            parsed.startingStage === "IN_PROGRESS" ? "In Progress" : "Planning",
          Subcategory: getProjectSubCategoryLabel(parsed.subCategory),
          Billing: parsed.billingMode,
          Payments:
            parsed.billingMode === "MILESTONE"
              ? String(parsed.numberOfPayments ?? "—")
              : "Not applicable",
          "Company Tax ID": taxDefaults.npwp || "None",
          Start: formatImportDateDisplay(parsed.estimatedStartDate),
          Duration:
            parsed.durationMonths != null
              ? `${parsed.durationMonths} mo`
              : parsed.durationDays != null
                ? `${parsed.durationDays} d`
                : "—",
          End: parsed.estimatedEndDate
            ? formatImportDateDisplay(parsed.estimatedEndDate)
            : "—",
          Coordinates: `${resolved.latitude}, ${resolved.longitude}`,
          Location: resolved.location,
          Department:
            parsed.startingStage === "PLANNED"
              ? "Not applicable"
              : parsed.department ?? "—",
          Staff:
            parsed.startingStage === "PLANNED"
              ? "Not applicable"
              : staffIds.length > 0
                ? `${staffIds.length} assigned`
                : parsed.staffTokens.length > 0
                  ? parsed.staffTokens.join(", ")
                  : "—",
        },
      });
    } catch (error) {
      previewRows.push({
        rowNumber,
        status: "invalid",
        message:
          error instanceof Error ? error.message : "Invalid project row.",
        fields,
      });
    }
  }

  return createBulkImportPreview(previewRows);
}

export async function confirmBulkImportProjects(
  formData: FormData
): Promise<BulkImportResult> {
  await assertCanManageProjects();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose an Excel file to upload.");
  }

  const {
    company,
    rows,
    clientsByName,
    employeesByNo,
    employeesByName,
  } = await loadProjectImportContext(file);

  const result = createBulkImportResult();
  let nextSortOrder = await nextCompanyScopedSortOrder("project", company.id);

  for (const { rowNumber, values } of rows) {
    try {
      const parsed = parseProjectImportRow(values);
      const client = resolveClient(parsed.clientName, clientsByName);
      const { requiresTaxInvoice } = taxInvoiceDefaultsFromClient(client);
      const resolved = await resolveImportLocation(parsed.coordinatesRaw);
      const employeeIds =
        parsed.startingStage === "PLANNED"
          ? []
          : resolveStaffIds(
              parsed.staffTokens,
              parsed.department,
              employeesByNo,
              employeesByName
            );

      const isPlanning = parsed.startingStage === "PLANNED";
      const isContract = isContractSubCategory(parsed.subCategory);

      let estimatedStartDate: Date | null = null;
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (isPlanning) {
        estimatedStartDate = parsed.estimatedStartDate;
        startDate = null;
        // Persist duration-derived end for Regular and General/Facade (matches UI).
        endDate = parsed.estimatedEndDate;
      } else {
        startDate = parsed.estimatedStartDate;
        endDate = parsed.estimatedEndDate;
        estimatedStartDate = parsed.estimatedStartDate;
        if (isContract && !endDate) {
          throw new Error("Contract end date is required.");
        }
        if (!isContract && !endDate) {
          throw new Error("Expected completion date is required.");
        }
      }

      const estimatedDurationDays =
        !isContract && parsed.durationDays != null
          ? parsed.durationDays
          : null;

      const invoicingDay = isContract ? clampInvoicingDay(1) : 1;
      const sortOrder = nextSortOrder;
      nextSortOrder += SORT_ORDER_STEP;

      const project = await prisma.$transaction(async (tx) => {
        const created = await tx.project.create({
          data: {
            name: parsed.name,
            location: resolved.location,
            latitude: resolved.latitude,
            longitude: resolved.longitude,
            locationRadiusMeters: 50,
            estimatedStartDate,
            estimatedDurationDays,
            startDate,
            endDate,
            status: parsed.startingStage,
            progress: 0,
            invoicingDay,
            billingMode: parsed.billingMode,
            contractPrice: null,
            subCategory: parsed.subCategory,
            requiresTaxInvoice,
            companyId: company.id,
            clientId: client.id,
            sortOrder,
          },
        });

        if (parsed.billingMode === "MILESTONE") {
          const paymentCount = parsed.numberOfPayments;
          if (paymentCount == null) {
            throw new Error(
              `Milestone payments is required for Milestone billing (1–${MAX_MILESTONE_PAYMENTS}).`
            );
          }
          await createMilestoneSchedulePeriods(tx, {
            projectId: created.id,
            startDate: startDate ?? estimatedStartDate,
            installmentPercents: splitEvenlyPercentsForImport(paymentCount),
          });
        }

        return created;
      });

      if (employeeIds.length > 0) {
        await prisma.projectAssignment.createMany({
          data: employeeIds.map((employeeId) => ({
            projectId: project.id,
            employeeId,
          })),
          skipDuplicates: true,
        });
      }

      recordImportCreated(result);
    } catch (error) {
      recordImportFailed(
        result,
        rowNumber,
        error instanceof Error ? error.message : "Failed to create project."
      );
    }
  }

  revalidatePath(PROJECT_LIST_VIEW_PATHS.all);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.planning);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.inProgress);
  revalidatePath("/dashboard");
  revalidatePath("/clients");
  revalidatePath("/billing");

  return result;
}

/** @deprecated Prefer preview + confirm. */
export async function bulkImportProjects(formData: FormData) {
  return confirmBulkImportProjects(formData);
}
