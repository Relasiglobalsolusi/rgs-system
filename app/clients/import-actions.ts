"use server";

import { revalidatePath } from "next/cache";

import { CLIENT_IMPORT_COLUMNS } from "@/lib/bulk-import/client-template";
import {
  parseClientImportRow,
  type ParsedClientImportRow,
} from "@/lib/bulk-import/parse-client-row";
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
import { getNextClientShortCode } from "@/lib/client-short-code";
import { assertClientNameAvailable } from "@/lib/client-name";
import { normalizeClientName } from "@/lib/client-login-id";
import { prisma } from "@/lib/prisma";
import { canManageClients } from "@/lib/project-access";
import { provisionClientUser } from "@/lib/provision-linked-user";
import { nextCompanyScopedSortOrder } from "@/lib/persist-reorder";
import { SORT_ORDER_STEP } from "@/lib/reorder";
import { requireModule, toPermissionUser } from "@/lib/session";
import { formatImportDateDisplay } from "@/lib/bulk-import/parse-import-date";
import { formatPaymentTermsImportDisplay } from "@/lib/bulk-import/payment-terms-import";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { saveUpload } from "@/lib/upload";

async function assertCanManageClients() {
  const session = await requireModule("clients");
  if (!canManageClients(toPermissionUser(session))) {
    const locale = await getServerLocale();
    throw new Error(translate(locale, "pages.clients.permissionDenied"));
  }
}

function isIndividualImportType(raw: string | undefined): boolean {
  const normalized = (raw ?? "").trim().toLowerCase();
  return (
    normalized === "individual" ||
    normalized === "perorangan" ||
    normalized === "person"
  );
}

function taxIdDocumentFieldKey(rowNumber: number): string {
  return `taxIdDocument_${rowNumber}`;
}

function previewFieldsFromValues(
  values: Record<string, string>
): Record<string, string> {
  const individual = isIndividualImportType(values.clientType);
  const personName =
    [values.contactPersonFirstName, values.contactPersonLastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ") ||
    values.name?.trim() ||
    "—";

  if (individual) {
    return {
      "Client Type": values.clientType?.trim() || "—",
      "Client Name": values.name?.trim() || personName,
      Email: values.email?.trim() || "—",
      "Country Code": values.countryCode?.trim() || "—",
      Phone: values.phone?.trim() || "—",
      Address: values.address?.trim() || "—",
      "NPWP / NIK": values.npwp?.trim() || "—",
      "Payment Terms": values.paymentTermsDays?.trim() || "—",
      "Client Since": values.clientSince?.trim() || "—",
      Contact: personName,
    };
  }

  return {
    "Client Type": values.clientType?.trim() || "—",
    "Client Name": values.name?.trim() || "—",
    "Company Email": values.email?.trim() || "—",
    "Country Code": values.countryCode?.trim() || "—",
    "Company Phone": values.phone?.trim() || "—",
    Address: values.address?.trim() || "—",
    "NPWP / NIK": values.npwp?.trim() || "—",
    "Payment Terms": values.paymentTermsDays?.trim() || "—",
    "Client Since": values.clientSince?.trim() || "—",
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
  };
}

function previewFieldsFromParsed(
  parsed: ParsedClientImportRow
): Record<string, string> {
  const contactLabel =
    [parsed.contactPersonFirstName, parsed.contactPersonLastName]
      .filter(Boolean)
      .join(" ") || parsed.name;
  const paymentTerms = formatPaymentTermsImportDisplay(parsed.paymentTermsDays);
  const clientSince = formatImportDateDisplay(parsed.clientSince) || "—";

  if (parsed.clientType === "INDIVIDUAL") {
    return {
      "Client Type": "Individual",
      "Client Name": parsed.name,
      Email: parsed.email ?? "—",
      Phone: parsed.phone ?? "—",
      Address: parsed.address ?? "—",
      "NPWP / NIK": parsed.npwp ?? "—",
      "Payment Terms": paymentTerms,
      "Client Since": clientSince,
      Contact: contactLabel,
    };
  }

  return {
    "Client Type": "Company",
    "Client Name": parsed.name,
    "Company Email": parsed.email ?? "—",
    "Company Phone": parsed.phone ?? "—",
    Address: parsed.address ?? "—",
    "NPWP / NIK": parsed.npwp ?? "—",
    "Payment Terms": paymentTerms,
    "Client Since": clientSince,
    "Contact Person": contactLabel,
    Position: parsed.contactPersonPosition ?? "—",
    "Contact Person Email": parsed.contactPersonEmail ?? "—",
    "Contact Person Phone": parsed.contactPersonPhone ?? "—",
  };
}

async function loadClientImportContext(file: File) {
  const locale = await getServerLocale();
  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error(translate(locale, "pages.clients.companyNotFound"));
  }

  const buffer = await readSpreadsheetFile(file);
  const { rows } = parseSpreadsheetRows(buffer, CLIENT_IMPORT_COLUMNS);

  if (rows.length === 0) {
    throw new Error(translate(locale, "pages.clients.import.noDataRows"));
  }

  const existingClients = await prisma.client.findMany({
    where: { companyId: company.id },
    select: { name: true, nameNormalized: true },
  });

  const seenNames = new Set(
    existingClients.map(
      (client) => client.nameNormalized || normalizeClientName(client.name)
    )
  );

  return { company, rows, seenNames };
}

async function saveImportTaxIdDocument(
  formData: FormData,
  rowNumber: number,
  clientType: "COMPANY" | "INDIVIDUAL",
  locale: Awaited<ReturnType<typeof getServerLocale>>
): Promise<string> {
  const file = formData.get(taxIdDocumentFieldKey(rowNumber));
  if (!(file instanceof File) || file.size === 0) {
    throw new Error(
      translate(
        locale,
        clientType === "INDIVIDUAL"
          ? "bulkImport.taxIdDocumentRequiredIndividual"
          : "bulkImport.taxIdDocumentRequiredCompany"
      )
    );
  }

  // Same storage path as createClient form upload (uploads/clients).
  return saveUpload(file, "uploads/clients", {
    fileBaseName: clientType === "INDIVIDUAL" ? "NPWP-NIK" : "NPWP",
  });
}

export async function previewBulkImportClients(
  formData: FormData
): Promise<BulkImportPreview> {
  await assertCanManageClients();

  const locale = await getServerLocale();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error(translate(locale, "bulkImport.chooseExcel"));
  }

  const { rows, seenNames } = await loadClientImportContext(file);
  const previewNames = new Set(seenNames);
  const previewRows: BulkImportPreviewRow[] = [];

  for (const { rowNumber, values } of rows) {
    const fields = previewFieldsFromValues(values);

    try {
      const parsed = parseClientImportRow(values, locale);
      const nameKey = normalizeClientName(parsed.name);

      if (previewNames.has(nameKey)) {
        previewRows.push({
          rowNumber,
          status: "duplicate",
          message: translate(locale, "pages.clients.import.duplicateInFile", {
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
            : translate(locale, "pages.clients.import.invalidRow"),
        fields,
      });
    }
  }

  return createBulkImportPreview(previewRows);
}

/**
 * Excel import is create-only: duplicate client names are skipped and existing
 * clients are never updated. Contact-person renames never reset client Login IDs
 * (Login ID stays company-based; revoke/restore lives in Users).
 *
 * Each ready row must include an NPWP/NIK number (Excel) and a tax ID document
 * file uploaded in the confirmation step (`taxIdDocument_{rowNumber}`).
 */
export async function confirmBulkImportClients(
  formData: FormData
): Promise<BulkImportResult> {
  await assertCanManageClients();

  const locale = await getServerLocale();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error(translate(locale, "bulkImport.chooseExcel"));
  }

  const { company, rows, seenNames } = await loadClientImportContext(file);
  const result = createBulkImportResult();
  let nextSortOrder = await nextCompanyScopedSortOrder("client", company.id);

  for (const { rowNumber, values } of rows) {
    try {
      const parsed = parseClientImportRow(values, locale);
      const nameKey = normalizeClientName(parsed.name);

      if (seenNames.has(nameKey)) {
        recordImportSkipped(
          result,
          rowNumber,
          translate(locale, "pages.clients.import.alreadyExists", {
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
        parsed.clientType,
        locale
      );

      await prisma.$transaction(async (tx) => {
        const nameNormalized = await assertClientNameAvailable(
          { companyId: company.id, name: parsed.name, locale },
          tx
        );
        const shortCode = await getNextClientShortCode(company.id, tx);
        const client = await tx.client.create({
          data: {
            name: parsed.name,
            nameNormalized,
            clientType: parsed.clientType,
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
            clientSince: parsed.clientSince,
            multiProjectAccess: false,
            companyId: company.id,
            active: true,
            sortOrder,
          },
        });

        // Always create portal Login ID (same as createClient); revoke later in Users.
        await provisionClientUser(tx, {
          companyId: company.id,
          clientId: client.id,
          clientName: parsed.name,
          contactPersonFirstName: parsed.contactPersonFirstName,
          contactPersonLastName: parsed.contactPersonLastName,
        });
      });

      seenNames.add(nameKey);
      recordImportCreated(result);
    } catch (error) {
      recordImportFailed(
        result,
        rowNumber,
        error instanceof Error
          ? error.message
          : translate(locale, "pages.clients.createFailed")
      );
    }
  }

  if (result.createdCount > 0) {
    revalidatePath("/clients");
    revalidatePath("/users");
  }

  return result;
}
