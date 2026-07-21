"use server";

import { revalidatePath } from "next/cache";

import { VENDOR_IMPORT_COLUMNS } from "@/lib/bulk-import/vendor-template";
import { parseVendorImportRow } from "@/lib/bulk-import/parse-vendor-row";
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
import { getNextVendorShortCode } from "@/lib/vendor-short-code";
import { prisma } from "@/lib/prisma";
import { canManageVendors } from "@/lib/project-access";
import { nextCompanyScopedSortOrder } from "@/lib/persist-reorder";
import { provisionVendorUser } from "@/lib/provision-linked-user";
import { SORT_ORDER_STEP } from "@/lib/reorder";
import { requireModule, toPermissionUser } from "@/lib/session";
import { formatImportDateDisplay } from "@/lib/bulk-import/parse-import-date";
import { formatPaymentTermsImportDisplay } from "@/lib/bulk-import/payment-terms-import";
import { getServerLocale } from "@/lib/i18n/locale";

async function assertCanManageVendors() {
  const session = await requireModule("vendors");
  if (!canManageVendors(toPermissionUser(session))) {
    throw new Error("You do not have permission to manage vendors.");
  }
}

function previewFieldsFromValues(values: Record<string, string>) {
  return {
    "Vendor Name": values.name?.trim() || "—",
    "Company Email": values.email?.trim() || "—",
    "Country Code": values.countryCode?.trim() || "—",
    "Company Phone": values.phone?.trim() || "—",
    "Company Address": values.address?.trim() || "—",
    "Company Tax ID": values.npwp?.trim() || "—",
    "Payment terms": values.paymentTermsDays?.trim() || "—",
    "Vendor Since": values.vendorSince?.trim() || "—",
    "Contact person":
      [values.contactPersonFirstName, values.contactPersonLastName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(" ") || "—",
    Position: values.contactPersonPosition?.trim() || "—",
    "Contact Person Email": values.contactPersonEmail?.trim() || "—",
    "Contact Person Country Code":
      values.contactPersonCountryCode?.trim() || "—",
    "Contact Person Phone": values.contactPersonPhone?.trim() || "—",
    "Portal Login Access": values.createPortalLogin?.trim() || "—",
  };
}

async function loadVendorImportContext(file: File) {
  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Company not found.");
  }

  const buffer = await readSpreadsheetFile(file);
  const { rows } = parseSpreadsheetRows(buffer, VENDOR_IMPORT_COLUMNS);

  if (rows.length === 0) {
    throw new Error("No data rows found. Add vendors below the header row.");
  }

  const existingVendors = await prisma.vendor.findMany({
    where: { companyId: company.id },
    select: { name: true },
  });

  const seenNames = new Set(
    existingVendors.map((vendor) => vendor.name.trim().toLowerCase())
  );

  return { company, rows, seenNames };
}

export async function previewBulkImportVendors(
  formData: FormData
): Promise<BulkImportPreview> {
  await assertCanManageVendors();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose an Excel file to upload.");
  }

  const { rows, seenNames } = await loadVendorImportContext(file);
  const locale = await getServerLocale();
  const previewNames = new Set(seenNames);
  const previewRows: BulkImportPreviewRow[] = [];

  for (const { rowNumber, values } of rows) {
    const fields = previewFieldsFromValues(values);

    try {
      const parsed = parseVendorImportRow(values, locale);
      const nameKey = parsed.name.toLowerCase();

      if (previewNames.has(nameKey)) {
        previewRows.push({
          rowNumber,
          status: "duplicate",
          message: `Vendor "${parsed.name}" already exists or is duplicated in this file.`,
          fields,
        });
        continue;
      }

      previewNames.add(nameKey);
      previewRows.push({
        rowNumber,
        status: "ready",
        fields: {
          ...fields,
          "Vendor Name": parsed.name,
          "Contact person":
            [parsed.contactPersonFirstName, parsed.contactPersonLastName]
              .filter(Boolean)
              .join(" ") || "—",
          "Company Phone": parsed.phone ?? "—",
          "Contact Person Phone": parsed.contactPersonPhone ?? "—",
          "Payment terms": formatPaymentTermsImportDisplay(
            parsed.paymentTermsDays
          ),
          "Vendor Since": formatImportDateDisplay(parsed.vendorSince) || "—",
          "Portal Login Access": parsed.createPortalLogin ? "Yes" : "No",
        },
      });
    } catch (error) {
      previewRows.push({
        rowNumber,
        status: "invalid",
        message:
          error instanceof Error ? error.message : "Invalid vendor row.",
        fields,
      });
    }
  }

  return createBulkImportPreview(previewRows);
}

/** Excel import is create-only: duplicate vendor names are skipped. */
export async function confirmBulkImportVendors(
  formData: FormData
): Promise<BulkImportResult> {
  await assertCanManageVendors();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose an Excel file to upload.");
  }

  const { company, rows, seenNames } = await loadVendorImportContext(file);
  const locale = await getServerLocale();
  const result = createBulkImportResult();
  let nextSortOrder = await nextCompanyScopedSortOrder("vendor", company.id);

  for (const { rowNumber, values } of rows) {
    try {
      const parsed = parseVendorImportRow(values, locale);
      const nameKey = parsed.name.toLowerCase();

      if (seenNames.has(nameKey)) {
        recordImportSkipped(
          result,
          rowNumber,
          `Vendor "${parsed.name}" already exists.`
        );
        continue;
      }

      const sortOrder = nextSortOrder;
      nextSortOrder += SORT_ORDER_STEP;

      await prisma.$transaction(async (tx) => {
        const shortCode = await getNextVendorShortCode(company.id, tx);
        const vendor = await tx.vendor.create({
          data: {
            name: parsed.name,
            shortCode,
            email: parsed.email,
            phone: parsed.phone,
            address: parsed.address,
            npwp: parsed.npwp,
            paymentTermsDays: parsed.paymentTermsDays,
            contactPersonFirstName: parsed.contactPersonFirstName,
            contactPersonLastName: parsed.contactPersonLastName,
            contactPersonPosition: parsed.contactPersonPosition,
            contactPersonEmail: parsed.contactPersonEmail,
            contactPersonPhone: parsed.contactPersonPhone,
            vendorSince: parsed.vendorSince,
            companyId: company.id,
            active: true,
            sortOrder,
          },
        });

        if (parsed.createPortalLogin) {
          await provisionVendorUser(tx, {
            companyId: company.id,
            vendorId: vendor.id,
            vendorName: parsed.name,
            contactPersonFirstName: parsed.contactPersonFirstName,
            contactPersonLastName: parsed.contactPersonLastName,
          });
        }
      });

      seenNames.add(nameKey);
      recordImportCreated(result);
    } catch (error) {
      recordImportFailed(
        result,
        rowNumber,
        error instanceof Error ? error.message : "Failed to create vendor."
      );
    }
  }

  if (result.createdCount > 0) {
    revalidatePath("/vendors");
    revalidatePath("/users");
  }

  return result;
}
