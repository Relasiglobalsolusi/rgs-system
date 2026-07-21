import {
  formatContactPersonName,
  resolveContactPersonNameParts,
} from "@/lib/contact-person";
import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { parseOptionalNpwpValue } from "@/lib/npwp";
import { normalizeImportPhoneWithCountryCode } from "@/lib/phone-normalize";
import { capitalizeName, capitalizeProper } from "@/lib/text-case";
import { parseImportDateWithDefault } from "@/lib/bulk-import/parse-import-date";
import { parsePaymentTermsImportValue } from "@/lib/bulk-import/payment-terms-import";
import { isNotApplicableImportValue } from "@/lib/bulk-import/template-i18n";
import { todayDateInput } from "@/lib/project-contract";
import { parseDateInput } from "@/lib/invoice-period";
import type { SpreadsheetRow } from "@/lib/bulk-import/xlsx";

export type ParsedClientImportRow = {
  name: string;
  clientType: "COMPANY" | "INDIVIDUAL";
  email: string | null;
  phone: string | null;
  address: string | null;
  npwp: string | null;
  paymentTermsDays: number;
  clientSince: Date;
  contactPersonFirstName: string;
  contactPersonLastName: string | null;
  contactPersonPosition: string | null;
  contactPersonEmail: string | null;
  contactPersonPhone: string | null;
};

function parseClientTypeImportValue(
  raw: string | undefined
): "COMPANY" | "INDIVIDUAL" {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (
    !normalized ||
    normalized === "company" ||
    normalized === "perusahaan" ||
    normalized === "corporate"
  ) {
    return "COMPANY";
  }
  if (
    normalized === "individual" ||
    normalized === "perorangan" ||
    normalized === "person"
  ) {
    return "INDIVIDUAL";
  }
  throw new Error(
    'Client Type must be "Company" or "Individual" (or Perusahaan / Perorangan).'
  );
}

/** Empty string when the cell is blank or an N/A token. */
function importCellValue(raw: string | undefined): string {
  const value = raw?.trim() ?? "";
  if (!value || isNotApplicableImportValue(value)) {
    return "";
  }
  return value;
}

export function parseClientImportRow(
  values: SpreadsheetRow,
  locale: AppLocale = DEFAULT_LOCALE
): ParsedClientImportRow {
  const clientType = parseClientTypeImportValue(values.clientType);
  const nameRaw = capitalizeProper(importCellValue(values.name));
  let contactPersonFirstName = capitalizeName(
    importCellValue(values.contactPersonFirstName)
  );
  let contactPersonLastName = importCellValue(values.contactPersonLastName)
    ? capitalizeName(importCellValue(values.contactPersonLastName))
    : null;
  const contactPersonPositionRaw = importCellValue(values.contactPersonPosition)
    ? capitalizeProper(importCellValue(values.contactPersonPosition))
    : null;
  const contactPersonEmailRaw =
    importCellValue(values.contactPersonEmail) || null;
  const email = importCellValue(values.email) || null;
  const address = importCellValue(values.address)
    ? capitalizeProper(importCellValue(values.address))
    : null;

  const phone =
    normalizeImportPhoneWithCountryCode(
      importCellValue(values.countryCode) || undefined,
      importCellValue(values.phone) || undefined,
      clientType === "INDIVIDUAL" ? "Phone" : "Company phone"
    ) || null;
  const contactPersonPhoneRaw =
    normalizeImportPhoneWithCountryCode(
      importCellValue(values.contactPersonCountryCode) || undefined,
      importCellValue(values.contactPersonPhone) || undefined,
      "Contact person phone"
    ) || null;

  let name = nameRaw;
  let contactPersonPosition: string | null = contactPersonPositionRaw;
  let contactPersonEmail: string | null = contactPersonEmailRaw;
  let contactPersonPhone: string | null = contactPersonPhoneRaw;

  if (clientType === "INDIVIDUAL") {
    if (!contactPersonFirstName && name) {
      const parts = resolveContactPersonNameParts(name, null);
      contactPersonFirstName = parts.firstName;
      contactPersonLastName = parts.lastName;
    }
    if (!name && contactPersonFirstName) {
      name =
        formatContactPersonName(
          contactPersonFirstName,
          contactPersonLastName
        ) || contactPersonFirstName;
    }
    if (!name) {
      throw new Error("Client Name or First Name is required.");
    }
    if (!contactPersonFirstName) {
      throw new Error("First Name is required for Individual clients.");
    }
    // Individual has no separate contact person — mirror self.
    // Company Email / Phone / Contact Person columns are N/A for Individual;
    // if provided (legacy sheets), still accept email/phone for the person.
    contactPersonPosition = null;
    contactPersonEmail = contactPersonEmailRaw || email;
    contactPersonPhone = contactPersonPhoneRaw || phone;
  } else {
    if (!name) {
      throw new Error("Client Name is required.");
    }
    if (!contactPersonFirstName) {
      throw new Error("Contact Person First Name is required.");
    }
  }

  const npwp = parseOptionalNpwpValue(
    importCellValue(values.npwp),
    locale,
    clientType === "INDIVIDUAL" ? "client" : "company"
  );
  const paymentTermsDays = parsePaymentTermsImportValue(
    values.paymentTermsDays
  );
  const clientSince = parseImportDateWithDefault(
    values.clientSince ?? "",
    "Client Since",
    parseDateInput(todayDateInput())
  );

  return {
    name,
    clientType,
    email,
    phone,
    address,
    npwp,
    paymentTermsDays,
    clientSince,
    contactPersonFirstName,
    contactPersonLastName,
    contactPersonPosition,
    contactPersonEmail,
    contactPersonPhone,
  };
}
