import { IMPORT_DATE_EXCEL_FORMAT } from "@/lib/bulk-import/parse-import-date";
import {
  applyLocalizedHeaders,
  countryCodeColumnHeaderNote,
  dataSheetName,
  EMPLOYEE_HEADER_LABELS,
  employeeNotApplicableLabel,
  employeeTemplateHeaderNote,
  employeeTemplateTitle,
  withDateColumnHeaderNotes,
} from "@/lib/bulk-import/template-i18n";
import {
  buildProfessionalImportTemplate,
  type ColumnDef,
  type TemplateDataValidationContext,
  worksheetWithDataValidations,
} from "@/lib/bulk-import/xlsx";
import {
  CREATE_PORTAL_LOGIN_PLACEHOLDER,
  CREATE_PORTAL_LOGIN_PLACEHOLDER_ID,
} from "@/lib/create-portal-login-flag";
import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import {
  importCountryCodeDropdownValues,
  localizedPhoneFormatPlaceholder,
  PHONE_FORMAT_PLACEHOLDER,
} from "@/lib/phone-normalize";

const BASE_EMPLOYEE_IMPORT_COLUMNS: ColumnDef[] = [
  { key: "department", header: EMPLOYEE_HEADER_LABELS.department!.en, required: true, width: 18, centerContent: true },
  { key: "position", header: EMPLOYEE_HEADER_LABELS.position!.en, required: true, width: 22, centerContent: true },
  { key: "employmentType", header: EMPLOYEE_HEADER_LABELS.employmentType!.en, required: true, width: 17, centerContent: true },
  { key: "firstName", header: EMPLOYEE_HEADER_LABELS.firstName!.en, required: true, width: 14, centerContent: true },
  { key: "lastName", header: EMPLOYEE_HEADER_LABELS.lastName!.en, required: true, width: 14, centerContent: true },
  { key: "hiredAt", header: EMPLOYEE_HEADER_LABELS.hiredAt!.en, width: 12, centerContent: true, numberFormat: IMPORT_DATE_EXCEL_FORMAT },
  { key: "email", header: EMPLOYEE_HEADER_LABELS.email!.en, width: 24, centerContent: true },
  { key: "countryCode", header: EMPLOYEE_HEADER_LABELS.countryCode!.en, width: 14, centerContent: true, dropdownValues: importCountryCodeDropdownValues() },
  { key: "phone", header: EMPLOYEE_HEADER_LABELS.phone!.en, width: 26, centerContent: true, placeholder: PHONE_FORMAT_PLACEHOLDER },
  { key: "projectNames", header: EMPLOYEE_HEADER_LABELS.projectNames!.en, width: 22, centerContent: true },
  { key: "createPortalLogin", header: EMPLOYEE_HEADER_LABELS.createPortalLogin!.en, width: 18, centerContent: true },
];

/** Parser columns include Placement only as a legacy Assignment Scope alias. */
export const EMPLOYEE_IMPORT_COLUMNS: ColumnDef[] = applyLocalizedHeaders(
  [
    ...BASE_EMPLOYEE_IMPORT_COLUMNS,
    {
      key: "placement",
      header: EMPLOYEE_HEADER_LABELS.placement!.en,
      width: 1,
    },
  ],
  DEFAULT_LOCALE,
  EMPLOYEE_HEADER_LABELS
);

export type EmployeeImportCategoryOption = {
  id: string;
  name: string;
  prefix: string;
  slug?: string;
};

export type EmployeeImportPositionOption = {
  name: string;
  categoryId: string;
};

export type EmployeeImportTemplateOptions = {
  categories: EmployeeImportCategoryOption[];
  positions: EmployeeImportPositionOption[];
  projectNames: string[];
  locale?: AppLocale;
  /** When set, template prefills / scopes Employment Type (Part Time Roster bulk). */
  defaultEmploymentType?: "FULL_TIME" | "PART_TIME";
};

function departmentNamesForTemplate(
  categories: EmployeeImportCategoryOption[]
): string[] {
  return categories.map((category) => category.name);
}

function localizedEmploymentTypes(locale: AppLocale): string[] {
  return locale === "id"
    ? ["Penuh Waktu", "Paruh Waktu"]
    : ["Full Time", "Part Time"];
}

function localizedEmploymentTypeLabel(
  type: "FULL_TIME" | "PART_TIME",
  locale: AppLocale
): string {
  if (locale === "id") {
    return type === "FULL_TIME" ? "Penuh Waktu" : "Paruh Waktu";
  }
  return type === "FULL_TIME" ? "Full Time" : "Part Time";
}

function localizedPortalAccessValues(locale: AppLocale): string[] {
  return locale === "id" ? ["Ya", "Tidak"] : ["Yes", "No"];
}

function columnsWithDropdowns(options: EmployeeImportTemplateOptions): ColumnDef[] {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const departmentNames = departmentNamesForTemplate(options.categories);
  const positionNames = [...new Set(options.positions.map((position) => position.name))];

  return withDateColumnHeaderNotes(
    applyLocalizedHeaders(
      BASE_EMPLOYEE_IMPORT_COLUMNS,
      locale,
      EMPLOYEE_HEADER_LABELS
    ).map((column) => {
      if (column.key === "department") {
        return { ...column, dropdownValues: departmentNames };
      }
      if (column.key === "position") {
        return { ...column, contentSamples: positionNames };
      }
      if (column.key === "employmentType") {
        const forced = options.defaultEmploymentType;
        if (forced) {
          const label = localizedEmploymentTypeLabel(forced, locale);
          return {
            ...column,
            dropdownValues: [label],
            placeholder: label,
          };
        }
        return { ...column, dropdownValues: localizedEmploymentTypes(locale) };
      }
      if (column.key === "createPortalLogin") {
        return {
          ...column,
          dropdownValues: localizedPortalAccessValues(locale),
          placeholder:
            locale === "id"
              ? CREATE_PORTAL_LOGIN_PLACEHOLDER_ID
              : CREATE_PORTAL_LOGIN_PLACEHOLDER,
        };
      }
      if (column.key === "projectNames") {
        return {
          ...column,
          contentSamples: [
            employeeNotApplicableLabel(locale),
            ...options.projectNames,
          ],
        };
      }
      if (column.key === "countryCode") {
        return {
          ...column,
          dropdownValues: importCountryCodeDropdownValues(),
          headerNote: countryCodeColumnHeaderNote(locale),
        };
      }
      if (column.key === "phone") {
        return { ...column, placeholder: localizedPhoneFormatPlaceholder(locale) };
      }
      return column;
    }),
    locale
  );
}

function applyEmployeeImportDataValidations(
  options: EmployeeImportTemplateOptions,
  context: TemplateDataValidationContext
): void {
  const { dataSheet, listsSheet, firstDataRow, lastDataRow, columnLetter } =
    context;
  const departmentColLetter = columnLetter("department");
  const positionColLetter = columnLetter("position");
  const projectColLetter = columnLetter("projectNames");
  const positionListStartCol = context.nextListsColumn;
  const projectListCol = positionListStartCol + options.categories.length;
  const blankListCol = projectListCol + 1;
  const locale = options.locale ?? DEFAULT_LOCALE;

  const positionRanges = options.categories.map((category, categoryIndex) => {
    const listCol = positionListStartCol + categoryIndex;
    const names = options.positions
      .filter((position) => position.categoryId === category.id)
      .map((position) => position.name);
    names.forEach((name, rowIdx) => {
      listsSheet.getCell(rowIdx + 1, listCol).value = name;
    });
    if (names.length === 0) {
      listsSheet.getCell(1, listCol).value = "";
    }
    const listLetter = columnIndexToLetter(listCol);
    return {
      category,
      range: `Lists!$${listLetter}$1:$${listLetter}$${Math.max(names.length, 1)}`,
    };
  });

  options.projectNames.forEach((name, rowIdx) => {
    listsSheet.getCell(rowIdx + 1, projectListCol).value = name;
  });
  listsSheet.getCell(1, blankListCol).value = "";

  const projectListLetter = columnIndexToLetter(projectListCol);
  const blankListLetter = columnIndexToLetter(blankListCol);
  const projectsRange = options.projectNames.length
    ? `Lists!$${projectListLetter}$1:$${projectListLetter}$${options.projectNames.length}`
    : `Lists!$${blankListLetter}$1:$${blankListLetter}$1`;
  const departmentCell = `$${departmentColLetter}${firstDataRow}`;
  const positionFormula = positionRanges.reduceRight(
    (fallback, item) =>
      `IF(${departmentCell}=${excelStringLiteral(item.category.name)},${item.range},${fallback})`,
    `Lists!$${blankListLetter}$1:$${blankListLetter}$1`
  );

  worksheetWithDataValidations(dataSheet).dataValidations.add(
    `${positionColLetter}${firstDataRow}:${positionColLetter}${lastDataRow}`,
    {
      type: "list",
      allowBlank: true,
      formulae: [`=${positionFormula}`],
      showErrorMessage: true,
      errorTitle: "Invalid position",
      error:
        locale === "id"
          ? "Pilih jabatan aktif untuk departemen yang dipilih."
          : "Choose an active position for the selected department.",
    }
  );

  worksheetWithDataValidations(dataSheet).dataValidations.add(
    `${projectColLetter}${firstDataRow}:${projectColLetter}${lastDataRow}`,
    {
      type: "list",
      allowBlank: true,
      formulae: [`=${projectsRange}`],
      showErrorMessage: true,
      errorTitle: "Invalid project",
      error:
        locale === "id"
          ? "Pilih proyek aktif dari dropdown."
          : "Choose an active project from the dropdown.",
    }
  );
}

function columnIndexToLetter(index: number): string {
  let letter = "";
  let value = index;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    value = Math.floor((value - 1) / 26);
  }
  return letter;
}

function excelStringLiteral(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function buildEmployeeImportTemplate(
  options: EmployeeImportTemplateOptions
): Promise<Buffer> {
  const locale = options.locale ?? DEFAULT_LOCALE;
  return buildProfessionalImportTemplate({
    columns: columnsWithDropdowns(options),
    title: employeeTemplateTitle(locale),
    sheetName: dataSheetName(),
    includeInstructionsSheet: false,
    headerNote: employeeTemplateHeaderNote(locale),
    applyExtraDataValidations: (context) =>
      applyEmployeeImportDataValidations(options, context),
  });
}

export function departmentNamesFromCategories(
  categories: EmployeeImportCategoryOption[]
): string[] {
  return departmentNamesForTemplate(categories);
}
