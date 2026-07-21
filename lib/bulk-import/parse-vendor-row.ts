import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { parseCreatePortalLoginFlag } from "@/lib/create-portal-login-flag";
import { parseOptionalNpwpValue } from "@/lib/npwp";
import { normalizeImportPhoneWithCountryCode } from "@/lib/phone-normalize";
import { capitalizeName, capitalizeProper } from "@/lib/text-case";
import { parseImportDateWithDefault } from "@/lib/bulk-import/parse-import-date";
import { parsePaymentTermsImportValue } from "@/lib/bulk-import/payment-terms-import";
import { todayDateInput } from "@/lib/project-contract";
import { parseDateInput } from "@/lib/invoice-period";
import type { SpreadsheetRow } from "@/lib/bulk-import/xlsx";

export type ParsedVendorImportRow = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  npwp: string | null;
  paymentTermsDays: number;
  vendorSince: Date;
  contactPersonFirstName: string;
  contactPersonLastName: string | null;
  contactPersonPosition: string | null;
  contactPersonEmail: string | null;
  contactPersonPhone: string | null;
  createPortalLogin: boolean;
};

export function parseVendorImportRow(
  values: SpreadsheetRow,
  locale: AppLocale = DEFAULT_LOCALE
): ParsedVendorImportRow {
  const name = capitalizeProper(values.name?.trim() ?? "");
  const contactPersonFirstName = capitalizeName(
    values.contactPersonFirstName?.trim() ?? ""
  );
  const contactPersonLastName = values.contactPersonLastName?.trim()
    ? capitalizeName(values.contactPersonLastName.trim())
    : null;
  const contactPersonPosition = values.contactPersonPosition?.trim()
    ? capitalizeProper(values.contactPersonPosition.trim())
    : null;
  const contactPersonEmail = values.contactPersonEmail?.trim() || null;
  const email = values.email?.trim() || null;
  const address = values.address?.trim()
    ? capitalizeProper(values.address.trim())
    : null;

  if (!name) {
    throw new Error("Vendor Name is required.");
  }
  if (!contactPersonFirstName) {
    throw new Error("Contact Person First Name is required.");
  }

  const npwp = parseOptionalNpwpValue(values.npwp, locale);

  const phone =
    normalizeImportPhoneWithCountryCode(
      values.countryCode,
      values.phone,
      "Company phone"
    ) || null;
  const contactPersonPhone =
    normalizeImportPhoneWithCountryCode(
      values.contactPersonCountryCode,
      values.contactPersonPhone,
      "Contact person phone"
    ) || null;
  const paymentTermsDays = parsePaymentTermsImportValue(
    values.paymentTermsDays
  );
  const vendorSince = parseImportDateWithDefault(
    values.vendorSince ?? "",
    "Vendor Since",
    parseDateInput(todayDateInput())
  );
  const createPortalLogin = parseCreatePortalLoginFlag(
    values.createPortalLogin
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
    createPortalLogin,
  };
}
