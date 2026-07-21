/**
 * Full preview path (minus auth) for the user's project import file.
 * Run: npx tsx scripts/debug-user-project-preview-full.ts
 */
import { readFileSync } from "fs";
import path from "path";

import { formatImportDateDisplay } from "../lib/bulk-import/parse-import-date";
import { parseProjectImportRow } from "../lib/bulk-import/parse-project-row";
import { PROJECT_IMPORT_COLUMNS } from "../lib/bulk-import/project-import-columns";
import {
  createBulkImportPreview,
  type BulkImportPreviewRow,
} from "../lib/bulk-import/types";
import { parseSpreadsheetRows } from "../lib/bulk-import/xlsx";
import {
  isGoogleMapsUrl,
  normalizeGoogleMapsUrl,
} from "../lib/google-maps-url";
import { resolveMapsUrl } from "../lib/maps-resolve";
import { reverseGeocodeNominatim } from "../lib/nominatim";
import { taxInvoiceDefaultsFromClient } from "../lib/npwp";
import { parseCoordinates } from "../lib/parse-coordinates";
import { getProjectSubCategoryLabel } from "../lib/project-subcategory";
import { prisma } from "../lib/prisma";
import { capitalizeProper } from "../lib/text-case";

const filePath = path.join(process.cwd(), "tmp-user-project-import.xlsx");

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function coordPlaceholder(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

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

async function resolveImportLocation(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Gmaps Coordinates are required.");
  }

  let latitude: number | null = null;
  let longitude: number | null = null;

  const parsed = parseCoordinates(trimmed);
  if (parsed) {
    latitude = parsed.lat;
    longitude = parsed.lng;
  } else if (isGoogleMapsUrl(trimmed)) {
    const url = normalizeGoogleMapsUrl(trimmed);
    if (!url) throw new Error("Could not read that Maps link.");
    const resolved = await resolveMapsUrl(url);
    latitude = resolved.latitude;
    longitude = resolved.longitude;
  } else {
    throw new Error("Invalid coordinates.");
  }

  if (latitude == null || longitude == null) {
    throw new Error("Could not determine coordinates.");
  }

  const address = await reverseGeocodeNominatim(latitude, longitude);
  const location = capitalizeProper(
    address?.trim() || coordPlaceholder(latitude, longitude)
  );
  return { latitude, longitude, location };
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

function resolveEmployeeFromStaffToken(
  token: string,
  employeesByNo: Map<string, ImportEmployee>,
  employeesByName: Map<string, ImportEmployee[]>
): ImportEmployee {
  const trimmed = token.trim();
  const key = normalizeKey(trimmed);

  const byNo = employeesByNo.get(key);
  if (byNo) return byNo;

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
      throw new Error(`Staff name "${namePart}" matches more than one employee.`);
    }
  }

  const byName = employeesByName.get(key) ?? [];
  if (byName.length === 0) {
    throw new Error(`Staff "${token}" was not found.`);
  }
  if (byName.length > 1) {
    throw new Error(`Staff name "${token}" matches more than one employee.`);
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
          `Staff "${token}" is not in department "${department}".`
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

async function main() {
  const t0 = Date.now();
  const company = await prisma.company.findFirst();
  if (!company) throw new Error("Company not found.");
  console.log("Company:", company.id, `(${Date.now() - t0}ms)`);

  const buf = readFileSync(filePath);
  const ab = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  ) as ArrayBuffer;
  const { rows } = parseSpreadsheetRows(ab, PROJECT_IMPORT_COLUMNS);
  console.log("Rows:", rows.length);

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
  console.log("Clients:", clients.length, "Employees:", employees.length);

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

  const previewRows: BulkImportPreviewRow[] = [];

  for (const { rowNumber, values } of rows) {
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

      previewRows.push({
        rowNumber,
        status: "ready",
        fields: {
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
                : "—",
        },
      });
      console.log(`Row ${rowNumber}: READY`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid project row.";
      previewRows.push({
        rowNumber,
        status: "invalid",
        message,
        fields: { "Project Name": values.name ?? "—" },
      });
      console.log(`Row ${rowNumber}: INVALID — ${message}`);
    }
  }

  const preview = createBulkImportPreview(previewRows);
  console.log(
    `\nPreview ready=${preview.readyCount} invalid=${preview.invalidCount} total=${preview.rows.length}`
  );
  console.log(`Elapsed: ${Date.now() - t0}ms`);
  console.log(
    "Serializable?",
    JSON.stringify(preview).length,
    "chars"
  );
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
