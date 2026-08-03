import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { parseRequiredClientNpwpValue } from "@/lib/npwp";
import { normalizeImportPhoneWithCountryCode } from "@/lib/phone-normalize";
import { capitalizeName, capitalizeProper } from "@/lib/text-case";
import { parseImportDateWithDefault } from "@/lib/bulk-import/parse-import-date";
import { parsePaymentTermsImportValue } from "@/lib/bulk-import/payment-terms-import";
import { isNotApplicableImportValue } from "@/lib/bulk-import/template-i18n";
import { todayDateInput } from "@/lib/project-contract";
import { parseDateInput } from "@/lib/invoice-period";
import type { SpreadsheetRow } from "@/lib/bulk-import/xlsx";

export type ParsedVendorImportRow = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  npwp: string;
  paymentTermsDays: number;
  vendorSince: Date;
  contactPersonFirstName: string;
  contactPersonLastName: string | null;
  contactPersonPosition: string | null;
  contactPersonEmail: string | null;
  contactPersonPhone: string | null;
};

/** Empty string when the cell is blank or an N/A token. */
function importCellValue(raw: string | undefined): string {
  const value = raw?.trim() ?? "";
  if (!value || isNotApplicableImportValue(value)) {
    return "";
  }
  return value;
}

export function parseVendorImportRow(
  values: SpreadsheetRow,
  locale: AppLocale = DEFAULT_LOCALE
): ParsedVendorImportRow {
  const name = capitalizeProper(importCellValue(values.name));
  const contactPersonFirstName = capitalizeName(
    importCellValue(values.contactPersonFirstName)
  );
  const contactPersonLastName = importCellValue(values.contactPersonLastName)
    ? capitalizeName(importCellValue(values.contactPersonLastName))
    : null;
  const contactPersonPosition = importCellValue(values.contactPersonPosition)
    ? capitalizeProper(importCellValue(values.contactPersonPosition))
    : null;
  const contactPersonEmail =
    importCellValue(values.contactPersonEmail) || null;
  const email = importCellValue(values.email) || null;
  const address = importCellValue(values.address)
    ? capitalizeProper(importCellValue(values.address))
    : null;

  if (!name) {
    throw new Error(translate(locale, "pages.vendors.import.nameRequired"));
  }
  if (!contactPersonFirstName) {
    throw new Error(
      translate(locale, "pages.vendors.import.contactFirstRequired")
    );
  }

  const phoneLabel = translate(locale, "pages.vendors.form.companyPhone");
  const contactPhoneLabel = translate(
    locale,
    "pages.vendors.form.contactPhone"
  );
  const phoneInvalid = translate(locale, "validation.fieldInvalid", {
    field: phoneLabel,
  });
  const contactPhoneInvalid = translate(locale, "validation.fieldInvalid", {
    field: contactPhoneLabel,
  });

  const npwp = parseRequiredClientNpwpValue(
    importCellValue(values.npwp),
    locale,
    "company"
  );

  const phone =
    normalizeImportPhoneWithCountryCode(
      importCellValue(values.countryCode) || undefined,
      importCellValue(values.phone) || undefined,
      phoneLabel,
      phoneInvalid
    ) || null;
  const contactPersonPhone =
    normalizeImportPhoneWithCountryCode(
      importCellValue(values.contactPersonCountryCode) || undefined,
      importCellValue(values.contactPersonPhone) || undefined,
      contactPhoneLabel,
      contactPhoneInvalid
    ) || null;
  const paymentTermsDays = parsePaymentTermsImportValue(
    values.paymentTermsDays
  );
  const vendorSince = parseImportDateWithDefault(
    values.vendorSince ?? "",
    translate(locale, "pages.vendors.form.vendorSince"),
    parseDateInput(todayDateInput())
  );
  return {
    name,
    email,
    phone,
    address,
    npwp,
    paymentTermsDays,
    vendorSince,
    contactPersonFirstName,
    contactPersonLastName,
    contactPersonPosition,
    contactPersonEmail,
    contactPersonPhone,
  };
}
