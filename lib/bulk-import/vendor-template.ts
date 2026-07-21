import { IMPORT_DATE_EXCEL_FORMAT } from "@/lib/bulk-import/parse-import-date";
import { paymentTermsDropdown } from "@/lib/bulk-import/payment-terms-import";
import {
  applyLocalizedHeaders,
  countryCodeColumnHeaderNote,
  VENDOR_HEADER_LABELS,
  vendorTemplateHeaderNote,
  vendorTemplateTitle,
  dataSheetName,
  withDateColumnHeaderNotes,
  yesNoDropdown,
  yesNoPlaceholder,
} from "@/lib/bulk-import/template-i18n";
import {
  buildProfessionalImportTemplate,
  type ColumnDef,
} from "@/lib/bulk-import/xlsx";
import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { IMPORT_NPWP_EXCEL_FORMAT } from "@/lib/npwp";
import {
  importCountryCodeDropdownValues,
  localizedPhoneFormatPlaceholder,
  PHONE_FORMAT_PLACEHOLDER,
} from "@/lib/phone-normalize";

/**
 * Vendor import columns (no Example column).
 * Order matches the ERP bulk-import UX.
 */
const BASE_VENDOR_IMPORT_COLUMNS: ColumnDef[] = [
  {
    key: "name",
    header: VENDOR_HEADER_LABELS.name!.en,
    required: true,
    width: 18,
    centerContent: true,
  },
  {
    key: "email",
    header: VENDOR_HEADER_LABELS.email!.en,
    width: 22,
    centerContent: true,
  },
  {
    key: "countryCode",
    header: VENDOR_HEADER_LABELS.countryCode!.en,
    centerContent: true,
    dropdownValues: importCountryCodeDropdownValues(),
    width: 14,
  },
  {
    key: "phone",
    header: VENDOR_HEADER_LABELS.phone!.en,
    centerContent: true,
    placeholder: PHONE_FORMAT_PLACEHOLDER,
    width: 26,
  },
  {
    key: "address",
    header: VENDOR_HEADER_LABELS.address!.en,
    width: 28,
    centerContent: true,
  },
  {
    key: "npwp",
    header: VENDOR_HEADER_LABELS.npwp!.en,
    width: 16,
    centerContent: true,
    numberFormat: IMPORT_NPWP_EXCEL_FORMAT,
  },
  {
    key: "paymentTermsDays",
    header: VENDOR_HEADER_LABELS.paymentTermsDays!.en,
    centerContent: true,
    width: 14,
    dropdownValues: paymentTermsDropdown("en"),
  },
  {
    key: "vendorSince",
    header: VENDOR_HEADER_LABELS.vendorSince!.en,
    centerContent: true,
    width: 12,
    numberFormat: IMPORT_DATE_EXCEL_FORMAT,
  },
  {
    key: "contactPersonFirstName",
    header: VENDOR_HEADER_LABELS.contactPersonFirstName!.en,
    required: true,
    width: 14,
    centerContent: true,
  },
  {
    key: "contactPersonLastName",
    header: VENDOR_HEADER_LABELS.contactPersonLastName!.en,
    width: 14,
    centerContent: true,
  },
  {
    key: "contactPersonPosition",
    header: VENDOR_HEADER_LABELS.contactPersonPosition!.en,
    width: 14,
    centerContent: true,
  },
  {
    key: "contactPersonEmail",
    header: VENDOR_HEADER_LABELS.contactPersonEmail!.en,
    width: 22,
    centerContent: true,
  },
  {
    key: "contactPersonCountryCode",
    header: VENDOR_HEADER_LABELS.contactPersonCountryCode!.en,
    centerContent: true,
    dropdownValues: importCountryCodeDropdownValues(),
    width: 14,
  },
  {
    key: "contactPersonPhone",
    header: VENDOR_HEADER_LABELS.contactPersonPhone!.en,
    centerContent: true,
    placeholder: PHONE_FORMAT_PLACEHOLDER,
    width: 26,
  },
  {
    key: "createPortalLogin",
    header: VENDOR_HEADER_LABELS.createPortalLogin!.en,
    centerContent: true,
    width: 12,
    dropdownValues: ["Yes", "No"],
    placeholder: yesNoPlaceholder("en"),
  },
];

/** Parser columns — English headers + bilingual aliases. */
export const VENDOR_IMPORT_COLUMNS: ColumnDef[] = applyLocalizedHeaders(
  BASE_VENDOR_IMPORT_COLUMNS,
  DEFAULT_LOCALE,
  VENDOR_HEADER_LABELS
);

export function getVendorImportColumns(locale: AppLocale): ColumnDef[] {
  const [yes, no] = yesNoDropdown(locale);
  const paymentTerms = paymentTermsDropdown(locale);
  const countryCodes = importCountryCodeDropdownValues();
  const countryCodeNote = countryCodeColumnHeaderNote(locale);
  return withDateColumnHeaderNotes(
    applyLocalizedHeaders(
      BASE_VENDOR_IMPORT_COLUMNS,
      locale,
      VENDOR_HEADER_LABELS
    ).map((column) => {
      if (column.key === "paymentTermsDays") {
        return { ...column, dropdownValues: paymentTerms };
      }
      if (
        column.key === "countryCode" ||
        column.key === "contactPersonCountryCode"
      ) {
        return {
          ...column,
          dropdownValues: countryCodes,
          headerNote: countryCodeNote,
        };
      }
      if (column.key === "phone" || column.key === "contactPersonPhone") {
        return {
          ...column,
          placeholder: localizedPhoneFormatPlaceholder(locale),
        };
      }
      if (column.key === "createPortalLogin") {
        return {
          ...column,
          dropdownValues: [yes, no],
          placeholder: yesNoPlaceholder(locale),
        };
      }
      return column;
    }),
    locale
  );
}

export async function buildVendorImportTemplate(
  locale: AppLocale = DEFAULT_LOCALE
): Promise<Buffer> {
  return buildProfessionalImportTemplate({
    columns: getVendorImportColumns(locale),
    title: vendorTemplateTitle(locale),
    sheetName: dataSheetName(),
    includeInstructionsSheet: false,
    headerNote: vendorTemplateHeaderNote(locale),
  });
}
