"use server";

import { revalidatePath } from "next/cache";

import { VENDOR_IMPORT_COLUMNS } from "@/lib/bulk-import/vendor-template";
import {
  parseVendorImportRow,
  type ParsedVendorImportRow,
} from "@/lib/bulk-import/parse-vendor-row";
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
import { translate } from "@/lib/i18n/translate";
import { saveUpload } from "@/lib/upload";

async function assertCanManageVendors() {
  const session = await requireModule("vendors");
  if (!canManageVendors(toPermissionUser(session))) {
    const locale = await getServerLocale();
    throw new Error(translate(locale, "pages.vendors.permissionDenied"));
  }
}

function taxIdDocumentFieldKey(rowNumber: number): string {
  return `taxIdDocument_${rowNumber}`;
}

function previewFieldsFromValues(values: Record<string, string>) {
  return {
    "Vendor Name": values.name?.trim() || "—",
    "Company Email": values.email?.trim() || "—",
    "Country Code": values.countryCode?.trim() || "—",
    "Company Phone": values.phone?.trim() || "—",
    "Company Address": values.address?.trim() || "—",
    NPWP: values.npwp?.trim() || "—",
    "Payment Terms": values.paymentTermsDays?.trim() || "—",
    "Vendor Since": values.vendorSince?.trim() || "—",
    "Contact Person":
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

function previewFieldsFromParsed(parsed: ParsedVendorImportRow) {
  return {
    "Vendor Name": parsed.name,
    "Company Email": parsed.email ?? "—",
    "Company Phone": parsed.phone ?? "—",
    "Company Address": parsed.address ?? "—",
    NPWP: parsed.npwp,
    "Payment Terms": formatPaymentTermsImportDisplay(parsed.paymentTermsDays),
    "Vendor Since": formatImportDateDisplay(parsed.vendorSince) || "—",
    "Contact Person":
      [parsed.contactPersonFirstName, parsed.contactPersonLastName]
        .filter(Boolean)
        .join(" ") || "—",
    Position: parsed.contactPersonPosition ?? "—",
    "Contact Person Email": parsed.contactPersonEmail ?? "—",
    "Contact Person Phone": parsed.contactPersonPhone ?? "—",
    "Portal Login Access": parsed.createPortalLogin ? "Yes" : "No",
  };
}

async function loadVendorImportContext(file: File) {
  const locale = await getServerLocale();
  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error(translate(locale, "pages.vendors.companyNotFound"));
  }

  const buffer = await readSpreadsheetFile(file);
  const { rows } = parseSpreadsheetRows(buffer, VENDOR_IMPORT_COLUMNS);

  if (rows.length === 0) {
    throw new Error(translate(locale, "pages.vendors.import.noDataRows"));
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

async function saveImportTaxIdDocument(
  formData: FormData,
  rowNumber: number,
  locale: Awaited<ReturnType<typeof getServerLocale>>
): Promise<string> {
  const file = formData.get(taxIdDocumentFieldKey(rowNumber));
  if (!(file instanceof File) || file.size === 0) {
    throw new Error(
      translate(locale, "bulkImport.taxIdDocumentRequiredCompany")
    );
  }

  // Same storage path as createVendor form upload (uploads/vendors).
  return saveUpload(file, "uploads/vendors", {
    fileBaseName: "NPWP",
  });
}

export async function previewBulkImportVendors(
  formData: FormData
): Promise<BulkImportPreview> {
  await assertCanManageVendors();

  const locale = await getServerLocale();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error(translate(locale, "bulkImport.chooseExcel"));
  }

  const { rows, seenNames } = await loadVendorImportContext(file);
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
          message: translate(locale, "pages.vendors.import.duplicateInFile", {
            name: parsed.name,
          }),
          fields: previewFieldsFromParsed(parsed),
        });
        continue;
      }

      previewNames.add(nameKey);
      previewRows.push({
        rowNumber,
        status: "ready",
        fields: previewFieldsFromParsed(parsed),
      });
    } catch (error) {
      previewRows.push({
        rowNumber,
        status: "invalid",
        message:
          error instanceof Error
            ? error.message
            : translate(locale, "pages.vendors.import.invalidRow"),
        fields,
      });
    }
  }

  return createBulkImportPreview(previewRows);
}

/**
 * Excel import is create-only: duplicate vendor names are skipped and existing
 * vendors are never updated. Contact-person renames never reset vendor Login IDs
 * (Login ID stays contact-based; revoke/restore lives in Users).
 *
 * Each ready row must include an NPWP number (Excel) and a tax ID document
 * file uploaded in the confirmation step (`taxIdDocument_{rowNumber}`).
 */
export async function confirmBulkImportVendors(
  formData: FormData
): Promise<BulkImportResult> {
  await assertCanManageVendors();

  const locale = await getServerLocale();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error(translate(locale, "bulkImport.chooseExcel"));
  }

  const { company, rows, seenNames } = await loadVendorImportContext(file);
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
          translate(locale, "pages.vendors.import.alreadyExists", {
            name: parsed.name,
          })
        );
        continue;
      }

      const sortOrder = nextSortOrder;
      nextSortOrder += SORT_ORDER_STEP;

      // Require file before DB write (same rule as form create).
      const taxIdDocumentUrl = await saveImportTaxIdDocument(
        formData,
        rowNumber,
        locale
      );

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
            taxIdDocumentUrl,
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
        error instanceof Error
          ? error.message
          : translate(locale, "pages.vendors.createFailed")
      );
    }
  }

  if (result.createdCount > 0) {
    revalidatePath("/vendors");
    revalidatePath("/users");
  }

  return result;
}
