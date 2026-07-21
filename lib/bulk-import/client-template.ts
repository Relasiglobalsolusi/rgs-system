import {
  IMPORT_DATE_EXCEL_FORMAT,
} from "@/lib/bulk-import/parse-import-date";
import { paymentTermsDropdown } from "@/lib/bulk-import/payment-terms-import";
import {
  applyLocalizedHeaders,
  CLIENT_HEADER_LABELS,
  clientTemplateHeaderNote,
  clientTemplateTitle,
  clientTypeDropdown,
  countryCodeColumnHeaderNote,
  dataSheetName,
  withDateColumnHeaderNotes,
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
 * Client import columns (no Example / skip-flag column).
 * Order: … → Country Code → Company Phone → … → Contact Country Code → Contact Phone → …
 */
const BASE_CLIENT_IMPORT_COLUMNS: ColumnDef[] = [
  {
    key: "clientType",
    header: CLIENT_HEADER_LABELS.clientType!.en,
    required: true,
    width: 14,
    centerContent: true,
    dropdownValues: clientTypeDropdown("en"),
  },
  {
    key: "name",
    header: CLIENT_HEADER_LABELS.name!.en,
    required: true,
    width: 18,
    centerContent: true,
  },
  {
    key: "email",
    header: CLIENT_HEADER_LABELS.email!.en,
    width: 22,
    centerContent: true,
  },
  {
    key: "countryCode",
    header: CLIENT_HEADER_LABELS.countryCode!.en,
    centerContent: true,
    dropdownValues: importCountryCodeDropdownValues(),
    width: 14,
  },
  {
    key: "phone",
    header: CLIENT_HEADER_LABELS.phone!.en,
    centerContent: true,
    placeholder: PHONE_FORMAT_PLACEHOLDER,
    width: 26,
  },
  {
    key: "address",
    header: CLIENT_HEADER_LABELS.address!.en,
    width: 28,
    centerContent: true,
  },
  {
    key: "npwp",
    header: CLIENT_HEADER_LABELS.npwp!.en,
    width: 16,
    centerContent: true,
    numberFormat: IMPORT_NPWP_EXCEL_FORMAT,
  },
  {
    key: "paymentTermsDays",
    header: CLIENT_HEADER_LABELS.paymentTermsDays!.en,
    centerContent: true,
    width: 14,
    dropdownValues: paymentTermsDropdown("en"),
  },
  {
    key: "clientSince",
    header: CLIENT_HEADER_LABELS.clientSince!.en,
    centerContent: true,
    width: 12,
    numberFormat: IMPORT_DATE_EXCEL_FORMAT,
  },
  {
    key: "contactPersonFirstName",
    header: CLIENT_HEADER_LABELS.contactPersonFirstName!.en,
    // Required for Company only — Individual uses Client Name / First Name path.
    required: false,
    width: 14,
    centerContent: true,
  },
  {
    key: "contactPersonLastName",
    header: CLIENT_HEADER_LABELS.contactPersonLastName!.en,
    width: 14,
    centerContent: true,
  },
  {
    key: "contactPersonPosition",
    header: CLIENT_HEADER_LABELS.contactPersonPosition!.en,
    width: 14,
    centerContent: true,
  },
  {
    key: "contactPersonEmail",
    header: CLIENT_HEADER_LABELS.contactPersonEmail!.en,
    width: 22,
    centerContent: true,
  },
  {
    key: "contactPersonCountryCode",
    header: CLIENT_HEADER_LABELS.contactPersonCountryCode!.en,
    centerContent: true,
    dropdownValues: importCountryCodeDropdownValues(),
    width: 14,
  },
  {
    key: "contactPersonPhone",
    header: CLIENT_HEADER_LABELS.contactPersonPhone!.en,
    centerContent: true,
    placeholder: PHONE_FORMAT_PLACEHOLDER,
    width: 26,
  },
];

/** Parser columns — English headers + bilingual aliases. */
export const CLIENT_IMPORT_COLUMNS: ColumnDef[] = applyLocalizedHeaders(
  BASE_CLIENT_IMPORT_COLUMNS,
  DEFAULT_LOCALE,
  CLIENT_HEADER_LABELS
);

export function getClientImportColumns(locale: AppLocale): ColumnDef[] {
  const clientTypes = clientTypeDropdown(locale);
  const paymentTerms = paymentTermsDropdown(locale);
  const countryCodes = importCountryCodeDropdownValues();
  const countryCodeNote = countryCodeColumnHeaderNote(locale);
  return withDateColumnHeaderNotes(
    applyLocalizedHeaders(
      BASE_CLIENT_IMPORT_COLUMNS,
      locale,
      CLIENT_HEADER_LABELS
    ).map((column) => {
      if (column.key === "clientType") {
        return { ...column, dropdownValues: clientTypes };
      }
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
      return column;
    }),
    locale
  );
}

export async function buildClientImportTemplate(
  locale: AppLocale = DEFAULT_LOCALE
): Promise<Buffer> {
  return buildProfessionalImportTemplate({
    columns: getClientImportColumns(locale),
    title: clientTemplateTitle(locale),
    sheetName: dataSheetName(),
    includeInstructionsSheet: false,
    headerNote: clientTemplateHeaderNote(locale),
  });
}
