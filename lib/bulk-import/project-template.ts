import { IMPORT_DATE_EXCEL_FORMAT } from "@/lib/bulk-import/parse-import-date";
import { IMPORT_NPWP_EXCEL_FORMAT } from "@/lib/npwp";
import { BASE_PROJECT_IMPORT_COLUMNS } from "@/lib/bulk-import/project-import-columns";
import {
  applyLocalizedHeaders,
  dataSheetName,
  PROJECT_HEADER_LABELS,
  projectBillingModeLabels,
  projectMilestoneBillingModeLabels,
  projectDurationColumnNote,
  projectDurationDaysLabels,
  projectDurationMonthsLabels,
  projectMilestonePaymentPickHeader,
  projectNotApplicableLabel,
  projectNoneTaxIdLabel,
  projectPlanningStageFieldNote,
  projectStartingStageLabels,
  projectTemplateHeaderNote,
  projectTemplateTitle,
  withDateColumnHeaderNotes,
} from "@/lib/bulk-import/template-i18n";
import {
  buildProfessionalImportTemplate,
  type ColumnDef,
  type TemplateDataValidationContext,
  worksheetWithDataValidations,
} from "@/lib/bulk-import/xlsx";
import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { MAX_MILESTONE_PAYMENTS } from "@/lib/project-billing";
import { CONTRACT_DURATION_PRESETS } from "@/lib/project-contract";
import { PROJECT_SUB_CATEGORY_LABELS } from "@/lib/project-subcategory";

const PROJECT_DURATION_IMPORT_VALUES = CONTRACT_DURATION_PRESETS.map(String);

/** Excel dropdown values for Milestone payments (1–10). */
const PROJECT_PAYMENT_COUNT_IMPORT_VALUES = Array.from(
  { length: MAX_MILESTONE_PAYMENTS },
  (_, index) => String(index + 1)
);

const REGULAR_CLEANING_LABEL = PROJECT_SUB_CATEGORY_LABELS.REGULAR_CLEANING;

export type ProjectImportClientOption = {
  name: string;
  npwp: string | null;
};

export type ProjectImportEmployeeOption = {
  employeeNo: string;
  firstName: string;
  lastName: string;
  categoryName: string | null;
};

export type ProjectImportCategoryOption = {
  name: string;
  prefix: string;
  slug?: string;
};

export type ProjectImportTemplateOptions = {
  clients: ProjectImportClientOption[];
  categories: ProjectImportCategoryOption[];
  employees: ProjectImportEmployeeOption[];
  locale?: AppLocale;
};

function excelDurationNumericExpr(col: string, row: number): string {
  const ref = `${col}${row}`;
  return `IF(ISNUMBER(${ref}),${ref},VALUE(LEFT(${ref},FIND(" ",${ref}&" ")-1)))`;
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

function employeeFullName(employee: ProjectImportEmployeeOption): string {
  return `${employee.firstName} ${employee.lastName}`.trim().replace(/\s+/g, " ");
}

/**
 * Dropdown label: always `Full Name - Employee No` (e.g. `Andi Prasetyo - EMP-001`).
 */
export function formatStaffImportLabel(
  employee: ProjectImportEmployeeOption
): string {
  const fullName = employeeFullName(employee);
  if (!fullName) return employee.employeeNo;
  return `${fullName} - ${employee.employeeNo}`;
}

function columnsWithDropdowns(
  clientNames: string[],
  locale: AppLocale,
  extras?: {
    departmentNames?: string[];
    staffLabels?: string[];
    taxIdSamples?: string[];
  }
): ColumnDef[] {
  const stages = projectStartingStageLabels(locale);
  const billing = projectBillingModeLabels(locale);
  const naLabel = projectNotApplicableLabel(locale);
  const paymentSamples = [
    naLabel,
    ...PROJECT_PAYMENT_COUNT_IMPORT_VALUES,
  ];

  return withDateColumnHeaderNotes(
    applyLocalizedHeaders(
      BASE_PROJECT_IMPORT_COLUMNS,
      locale,
      PROJECT_HEADER_LABELS
    ).map((column) => {
      if (column.key === "client") {
        return {
          ...column,
          dropdownValues: clientNames.length > 0 ? [...clientNames] : undefined,
        };
      }
      if (column.key === "startingStage") {
        return { ...column, dropdownValues: [...stages] };
      }
      if (column.key === "billingMode") {
        return { ...column, contentSamples: [...billing] };
      }
      if (column.key === "milestonePayments") {
        return {
          ...column,
          header: projectMilestonePaymentPickHeader(locale),
          contentSamples: paymentSamples,
        };
      }
      if (column.key === "companyTaxId" && extras?.taxIdSamples?.length) {
        return { ...column, contentSamples: extras.taxIdSamples };
      }
      if (column.key === "estimatedStartDate") {
        return {
          ...column,
          headerSubline: projectPlanningStageFieldNote(locale),
        };
      }
      if (column.key === "estimatedEndDate") {
        return {
          ...column,
          headerSubline: projectPlanningStageFieldNote(locale),
        };
      }
      if (column.key === "durationMonths") {
        const durationDaysLabels = projectDurationDaysLabels(locale);
        return {
          ...column,
          headerNote: projectDurationColumnNote(locale),
          contentSamples: [
            ...projectDurationMonthsLabels(locale),
            durationDaysLabels[2] ?? "3 days",
            durationDaysLabels[durationDaysLabels.length - 1] ?? "365 days",
          ],
        };
      }
      if (column.key === "department" && extras?.departmentNames?.length) {
        return {
          ...column,
          contentSamples: [naLabel, ...extras.departmentNames],
        };
      }
      if (column.key === "staffAssigned" && extras?.staffLabels?.length) {
        return {
          ...column,
          contentSamples: [naLabel, ...extras.staffLabels],
        };
      }
      return column;
    }),
    locale
  );
}

function staffByDepartment(
  employees: ProjectImportEmployeeOption[],
  departmentNames: string[]
): Map<string, string[]> {
  const deptLookup = new Map(
    departmentNames.map((name) => [name.trim().toLowerCase(), name] as const)
  );
  const map = new Map<string, string[]>();
  for (const name of departmentNames) {
    map.set(name, []);
  }

  for (const employee of employees) {
    const raw = employee.categoryName?.trim() ?? "";
    if (!raw) continue;
    const dept = deptLookup.get(raw.toLowerCase());
    if (!dept) continue;
    const list = map.get(dept) ?? [];
    list.push(formatStaffImportLabel(employee));
    map.set(dept, list);
  }

  for (const [dept, labels] of map) {
    labels.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    map.set(dept, labels);
  }

  return map;
}

function applyProjectImportExtras(
  options: ProjectImportTemplateOptions,
  context: TemplateDataValidationContext
): void {
  const { workbook, dataSheet, listsSheet, firstDataRow, lastDataRow, columnLetter } =
    context;
  const locale = options.locale ?? DEFAULT_LOCALE;
  const noneLabel = projectNoneTaxIdLabel(locale);
  const naLabel = projectNotApplicableLabel(locale);
  const stages = projectStartingStageLabels(locale);
  const planningLabel = stages[0];
  const billingAll = projectBillingModeLabels(locale);
  const billingMilestone = projectMilestoneBillingModeLabels(locale);
  const monthlyLabel = billingAll[0];
  const onCompletionLabel = billingAll[1];
  const milestoneLabel = billingAll[2];
  const durationMonthsLabels = projectDurationMonthsLabels(locale);
  const durationDaysLabels = projectDurationDaysLabels(locale);

  // In Progress department list: live categories supplied by the caller.
  const departmentNames = options.categories
    .map((category) => category.name.trim())
    .filter((name) => name.length > 0);
  const deptStaff = staffByDepartment(options.employees, departmentNames);
  const departmentsForDropdown = [...departmentNames];

  let nextListCol = context.nextListsColumn;

  // Client → Tax ID lookup (hidden): name | npwp-or-None
  const clientLookupCol = nextListCol;
  const taxValueCol = nextListCol + 1;
  nextListCol += 2;

  const sortedClients = [...options.clients].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  sortedClients.forEach((client, index) => {
    const row = index + 1;
    listsSheet.getCell(row, clientLookupCol).value = client.name;
    listsSheet.getCell(row, taxValueCol).value =
      client.npwp?.trim() || noneLabel;
  });
  const clientCount = Math.max(sortedClients.length, 1);
  const clientLookupLetter = columnIndexToLetter(clientLookupCol);
  const taxValueLetter = columnIndexToLetter(taxValueCol);
  const taxLookupRange = `Lists!$${clientLookupLetter}$1:$${taxValueLetter}$${clientCount}`;

  // N/A singleton + Monthly-only + Milestone-eligible billing + payment counts
  const naCol = nextListCol;
  const monthlyCol = nextListCol + 1;
  const milestoneBillingCol = nextListCol + 2;
  const paymentCountCol = nextListCol + 3;
  const deptListCol = nextListCol + 4;
  nextListCol += 5;

  listsSheet.getCell(1, naCol).value = naLabel;
  listsSheet.getCell(1, monthlyCol).value = monthlyLabel;
  billingMilestone.forEach((label, index) => {
    listsSheet.getCell(index + 1, milestoneBillingCol).value = label;
  });
  PROJECT_PAYMENT_COUNT_IMPORT_VALUES.forEach((value, index) => {
    listsSheet.getCell(index + 1, paymentCountCol).value = value;
  });
  departmentsForDropdown.forEach((name, index) => {
    listsSheet.getCell(index + 1, deptListCol).value = name;
  });

  const naLetter = columnIndexToLetter(naCol);
  const monthlyLetter = columnIndexToLetter(monthlyCol);
  const milestoneBillingLetter = columnIndexToLetter(milestoneBillingCol);
  const paymentCountLetter = columnIndexToLetter(paymentCountCol);
  const deptListLetter = columnIndexToLetter(deptListCol);
  const naRange = `Lists!$${naLetter}$1:$${naLetter}$1`;
  const naRangeRef = `Lists!$${naLetter}$1`;
  const monthlyRange = `Lists!$${monthlyLetter}$1:$${monthlyLetter}$1`;
  const milestoneBillingRange = `Lists!$${milestoneBillingLetter}$1:$${milestoneBillingLetter}$${Math.max(billingMilestone.length, 1)}`;
  const paymentCountRange = `Lists!$${paymentCountLetter}$1:$${paymentCountLetter}$${PROJECT_PAYMENT_COUNT_IMPORT_VALUES.length}`;
  const deptListRange =
    departmentsForDropdown.length > 0
      ? `Lists!$${deptListLetter}$1:$${deptListLetter}$${departmentsForDropdown.length}`
      : naRange;

  // Per-department staff columns + dept → range-address map for INDIRECT
  const deptMapCol = nextListCol;
  const deptMapRefCol = nextListCol + 1;
  nextListCol += 2;

  const staffDeptEntries: Array<{ dept: string; rangeRef: string; count: number }> =
    [];
  let staffCol = nextListCol;
  let deptIndex = 0;
  for (const dept of departmentsForDropdown) {
    const labels = deptStaff.get(dept) ?? [];
    if (labels.length === 0) continue;
    deptIndex += 1;
    labels.forEach((label, rowIdx) => {
      listsSheet.getCell(rowIdx + 1, staffCol).value = label;
    });
    const staffLetter = columnIndexToLetter(staffCol);
    // Store a concrete A1 range (not a defined name) — INDIRECT handles this reliably.
    const rangeRef = `Lists!$${staffLetter}$1:$${staffLetter}$${labels.length}`;
    listsSheet.getCell(deptIndex, deptMapCol).value = dept;
    listsSheet.getCell(deptIndex, deptMapRefCol).value = rangeRef;
    staffDeptEntries.push({ dept, rangeRef, count: labels.length });
    staffCol += 1;
  }
  nextListCol = staffCol;

  const deptMapLetter = columnIndexToLetter(deptMapCol);
  const deptMapRefLetter = columnIndexToLetter(deptMapRefCol);
  const deptMapRange =
    staffDeptEntries.length > 0
      ? `Lists!$${deptMapLetter}$1:$${deptMapRefLetter}$${staffDeptEntries.length}`
      : null;

  // Empty staff fallback (blank-only list)
  const blankStaffCol = nextListCol;
  listsSheet.getCell(1, blankStaffCol).value = "";
  const blankStaffLetter = columnIndexToLetter(blankStaffCol);
  const blankStaffRangeRef = `Lists!$${blankStaffLetter}$1`;

  // Contract duration (months) + General/Facade duration (days 1–365)
  const durationMonthsListCol = nextListCol + 1;
  const durationDaysListCol = nextListCol + 2;
  nextListCol += 3;

  PROJECT_DURATION_IMPORT_VALUES.forEach((value, index) => {
    listsSheet.getCell(index + 1, durationMonthsListCol).value =
      durationMonthsLabels[index] ?? value;
  });
  durationDaysLabels.forEach((label, index) => {
    listsSheet.getCell(index + 1, durationDaysListCol).value = label;
  });

  const durationMonthsListLetter = columnIndexToLetter(durationMonthsListCol);
  const durationDaysListLetter = columnIndexToLetter(durationDaysListCol);
  const durationMonthsListRange = `Lists!$${durationMonthsListLetter}$1:$${durationMonthsListLetter}$${durationMonthsLabels.length}`;
  const durationDaysListRange = `Lists!$${durationDaysListLetter}$1:$${durationDaysListLetter}$${durationDaysLabels.length}`;
  workbook.definedNames.add(durationDaysListRange, "ProjectDurationDays");
  const durationDaysListFormula = "ProjectDurationDays";

  const clientCol = columnLetter("client");
  const stageCol = columnLetter("startingStage");
  const subCatCol = columnLetter("subCategory");
  const billingCol = columnLetter("billingMode");
  const milestonePaymentsCol = columnLetter("milestonePayments");
  const taxIdCol = columnLetter("companyTaxId");
  const startCol = columnLetter("estimatedStartDate");
  const durationCol = columnLetter("durationMonths");
  const endCol = columnLetter("estimatedEndDate");
  const deptCol = columnLetter("department");
  const staffColLetter = columnLetter("staffAssigned");

  // Hidden helper: resolves the Lists range address for this row's staff dropdown.
  // Nested IF/IFERROR/INDIRECT inside data-validation list sources is unreliable in Excel
  // (especially with allowBlank / Ignore blank), so DV only does =INDIRECT($helper).
  const helperColIndex = context.columns.length + 1;
  const helperLetter = columnIndexToLetter(helperColIndex);
  dataSheet.getColumn(helperColIndex).hidden = true;
  dataSheet.getColumn(helperColIndex).width = 8;

  const formulaLastRow = Math.min(lastDataRow, firstDataRow + 497);
  const planningCheck = (row: number) =>
    `${stageCol}${row}=${excelStringLiteral(planningLabel)}`;
  const regularCheck = (row: number) =>
    `${subCatCol}${row}=${excelStringLiteral(REGULAR_CLEANING_LABEL)}`;
  const onCompletionCheck = (row: number) =>
    `${billingCol}${row}=${excelStringLiteral(onCompletionLabel)}`;
  const monthlyCheck = (row: number) =>
    `${billingCol}${row}=${excelStringLiteral(monthlyLabel)}`;

  for (let row = firstDataRow; row <= formulaLastRow; row += 1) {
    const taxCell = dataSheet.getCell(`${taxIdCol}${row}`);
    taxCell.numFmt = IMPORT_NPWP_EXCEL_FORMAT;
    taxCell.value = {
      formula: `IF(${clientCol}${row}="","",IFERROR(VLOOKUP(${clientCol}${row},${taxLookupRange},2,FALSE),${excelStringLiteral(noneLabel)}))`,
    };

    const billingCell = dataSheet.getCell(`${billingCol}${row}`);
    billingCell.value = {
      formula: `IF(${regularCheck(row)},${excelStringLiteral(monthlyLabel)},"")`,
    };

    const milestonePaymentsCell = dataSheet.getCell(`${milestonePaymentsCol}${row}`);
    milestonePaymentsCell.value = {
      formula: `IF(OR(${regularCheck(row)},${onCompletionCheck(row)},${monthlyCheck(row)}),${excelStringLiteral(naLabel)},"")`,
    };

    const deptCell = dataSheet.getCell(`${deptCol}${row}`);
    deptCell.value = {
      formula: `IF(${planningCheck(row)},${excelStringLiteral(naLabel)},"")`,
    };

    const staffCell = dataSheet.getCell(`${staffColLetter}${row}`);
    staffCell.value = {
      formula: `IF(${planningCheck(row)},${excelStringLiteral(naLabel)},"")`,
    };

    const helperCell = dataSheet.getCell(row, helperColIndex);
    if (deptMapRange) {
      helperCell.value = {
        formula: `IF(${planningCheck(row)},${excelStringLiteral(naRangeRef)},IF(${deptCol}${row}="",${excelStringLiteral(blankStaffRangeRef)},IFERROR(VLOOKUP(${deptCol}${row},${deptMapRange},2,FALSE),${excelStringLiteral(blankStaffRangeRef)})))`,
      };
    } else {
      helperCell.value = {
        formula: `IF(${planningCheck(row)},${excelStringLiteral(naRangeRef)},${excelStringLiteral(blankStaffRangeRef)})`,
      };
    }

    const endCell = dataSheet.getCell(`${endCol}${row}`);
    const durationNum = excelDurationNumericExpr(durationCol, row);
    endCell.value = {
      formula: `IF(OR(${startCol}${row}="",${durationCol}${row}=""),"",IF(ISNUMBER(${startCol}${row}),IF(${regularCheck(row)},EDATE(${startCol}${row},${durationNum}),${startCol}${row}+${durationNum}),""))`,
    };
    endCell.numFmt = IMPORT_DATE_EXCEL_FORMAT;
  }

  // Relative-row checks for data validation (top-left of validated range)
  const stageCellRel = `$${stageCol}${firstDataRow}`;
  const subCatCellRel = `$${subCatCol}${firstDataRow}`;
  const billingCellRel = `$${billingCol}${firstDataRow}`;
  const isPlanningRel = `${stageCellRel}=${excelStringLiteral(planningLabel)}`;
  const isRegularRel = `${subCatCellRel}=${excelStringLiteral(REGULAR_CLEANING_LABEL)}`;
  const isMilestoneRel = `${billingCellRel}=${excelStringLiteral(milestoneLabel)}`;

  worksheetWithDataValidations(dataSheet).dataValidations.add(
    `${durationCol}${firstDataRow}:${durationCol}${lastDataRow}`,
    {
      type: "list",
      allowBlank: true,
      formulae: [
        `=IF(${isRegularRel},${durationMonthsListRange},${durationDaysListFormula})`,
      ],
      showErrorMessage: true,
      errorTitle: "Invalid duration",
      error:
        locale === "id"
          ? `Regular Cleaning: durasi dalam bulan (${durationMonthsLabels.join(", ")}). General/Facade: ${durationDaysLabels[0]}–${durationDaysLabels[durationDaysLabels.length - 1]}.`
          : `Regular Cleaning: duration in months (${durationMonthsLabels.join(", ")}). General/Facade: ${durationDaysLabels[0]}–${durationDaysLabels[durationDaysLabels.length - 1]}.`,
    }
  );

  worksheetWithDataValidations(dataSheet).dataValidations.add(
    `${billingCol}${firstDataRow}:${billingCol}${lastDataRow}`,
    {
      type: "list",
      allowBlank: true,
      formulae: [
        `=IF(${isRegularRel},${monthlyRange},${milestoneBillingRange})`,
      ],
      showErrorMessage: true,
      errorTitle: "Invalid billing mode",
      error:
        "Regular Cleaning is Monthly only. General/Facade: choose On completion or Milestone.",
    }
  );

  worksheetWithDataValidations(dataSheet).dataValidations.add(
    `${milestonePaymentsCol}${firstDataRow}:${milestonePaymentsCol}${lastDataRow}`,
    {
      type: "list",
      allowBlank: true,
      formulae: [
        `=IF(${isMilestoneRel},${paymentCountRange},${naRange})`,
      ],
      showErrorMessage: true,
      errorTitle: "Invalid milestone payments",
      error:
        "Milestone billing: choose 1–10. Monthly, On completion, and Regular Cleaning use Not applicable.",
    }
  );

  worksheetWithDataValidations(dataSheet).dataValidations.add(
    `${deptCol}${firstDataRow}:${deptCol}${lastDataRow}`,
    {
      type: "list",
      allowBlank: true,
      formulae: [`=IF(${isPlanningRel},${naRange},${deptListRange})`],
      showErrorMessage: true,
      errorTitle: "Invalid department",
      error:
        "Planning rows use Not applicable. In Progress rows choose a real department (not Unassign).",
    }
  );

  worksheetWithDataValidations(dataSheet).dataValidations.add(
    `${staffColLetter}${firstDataRow}:${staffColLetter}${lastDataRow}`,
    {
      type: "list",
      allowBlank: true,
      // Absolute helper column, relative row — Excel adjusts per validated cell.
      formulae: [`=INDIRECT($${helperLetter}${firstDataRow})`],
      showErrorMessage: true,
      errorTitle: "Invalid staff",
      error:
        "Planning rows use Not applicable. In Progress: pick Full Name - Employee No from the selected department (comma-separate for multiple), or leave blank to assign staff later.",
    }
  );
}

export async function buildProjectImportTemplate(
  options: ProjectImportTemplateOptions
): Promise<Buffer> {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const noneLabel = projectNoneTaxIdLabel(locale);
  const clientNames = [...options.clients]
    .map((client) => client.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const departmentNames = options.categories
    .map((category) => category.name.trim())
    .filter((name) => name.length > 0);
  const staffLabels = options.employees.map((employee) =>
    formatStaffImportLabel(employee)
  );
  const taxIdSamples = [
    noneLabel,
    ...options.clients.map((client) => client.npwp?.trim() || noneLabel),
  ];
  const columns = columnsWithDropdowns(clientNames, locale, {
    departmentNames,
    staffLabels,
    taxIdSamples,
  });

  return buildProfessionalImportTemplate({
    columns,
    title: projectTemplateTitle(locale),
    sheetName: dataSheetName(),
    includeInstructionsSheet: false,
    headerNote: projectTemplateHeaderNote(locale),
    applyExtraDataValidations: (context) =>
      applyProjectImportExtras(options, context),
  });
}
