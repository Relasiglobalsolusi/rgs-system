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

export function parseClientImportRow(
  values: SpreadsheetRow,
  locale: AppLocale = DEFAULT_LOCALE
): ParsedClientImportRow {
  const clientType = parseClientTypeImportValue(values.clientType);
  const nameRaw = capitalizeProper(values.name?.trim() ?? "");
  let contactPersonFirstName = capitalizeName(
    values.contactPersonFirstName?.trim() ?? ""
  );
  let contactPersonLastName = values.contactPersonLastName?.trim()
    ? capitalizeName(values.contactPersonLastName.trim())
    : null;
  const contactPersonPositionRaw = values.contactPersonPosition?.trim()
    ? capitalizeProper(values.contactPersonPosition.trim())
    : null;
  const contactPersonEmailRaw = values.contactPersonEmail?.trim() || null;
  const email = values.email?.trim() || null;
  const address = values.address?.trim()
    ? capitalizeProper(values.address.trim())
    : null;

  const phone =
    normalizeImportPhoneWithCountryCode(
      values.countryCode,
      values.phone,
      clientType === "INDIVIDUAL" ? "Phone" : "Company phone"
    ) || null;
  const contactPersonPhoneRaw =
    normalizeImportPhoneWithCountryCode(
      values.contactPersonCountryCode,
      values.contactPersonPhone,
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
    values.npwp,
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
