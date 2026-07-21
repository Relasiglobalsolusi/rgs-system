/**
 * Project bulk-import column definitions used by the Review import parser.
 * Kept separate from the Excel template builder so template-only syntax/runtime
 * issues cannot break the server-action preview/confirm path.
 */
import { IMPORT_DATE_EXCEL_FORMAT } from "@/lib/bulk-import/parse-import-date";
import {
  applyLocalizedHeaders,
  PROJECT_HEADER_LABELS,
  projectMilestonePaymentPickHeader,
} from "@/lib/bulk-import/template-i18n";
import type { ColumnDef } from "@/lib/bulk-import/xlsx";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { BILLING_MODE_LABELS } from "@/lib/project-billing";
import { PROJECT_SUB_CATEGORY_LABELS } from "@/lib/project-subcategory";
import { IMPORT_NPWP_EXCEL_FORMAT } from "@/lib/npwp";

export const PROJECT_STARTING_STAGE_LABELS = [
  "Planning",
  "In Progress",
] as const;

export const PROJECT_SUBCATEGORY_IMPORT_LABELS = [
  PROJECT_SUB_CATEGORY_LABELS.REGULAR_CLEANING,
  PROJECT_SUB_CATEGORY_LABELS.GENERAL_CLEANING,
  PROJECT_SUB_CATEGORY_LABELS.FACADE_CLEANING,
] as const;

export const PROJECT_BILLING_MODE_IMPORT_LABELS = [
  BILLING_MODE_LABELS.MONTHLY,
  BILLING_MODE_LABELS.ON_COMPLETION,
  BILLING_MODE_LABELS.MILESTONE,
] as const;

/**
 * Import/parser columns (A → M):
 * Name, Client, Starting Stage, Subcategory, Billing Mode,
 * Milestone payments (1–10), Company Tax ID, Contract Start Date, Duration,
 * Contract End Date, Gmaps Coordinates, Department, Staff Assigned.
 */
export const BASE_PROJECT_IMPORT_COLUMNS: ColumnDef[] = [
  {
    key: "name",
    header: PROJECT_HEADER_LABELS.name!.en,
    required: true,
    /** Soft floor for typed project names when no samples. */
    width: 18,
    centerContent: true,
  },
  {
    key: "client",
    header: PROJECT_HEADER_LABELS.client!.en,
    required: true,
    width: 18,
    centerContent: true,
  },
  {
    key: "startingStage",
    header: PROJECT_HEADER_LABELS.startingStage!.en,
    required: true,
    width: 14,
    centerContent: true,
    dropdownValues: [...PROJECT_STARTING_STAGE_LABELS],
  },
  {
    key: "subCategory",
    header: PROJECT_HEADER_LABELS.subCategory!.en,
    required: true,
    width: 14,
    centerContent: true,
    dropdownValues: [...PROJECT_SUBCATEGORY_IMPORT_LABELS],
  },
  {
    key: "billingMode",
    header: PROJECT_HEADER_LABELS.billingMode!.en,
    width: 14,
    centerContent: true,
  },
  {
    key: "milestonePayments",
    header: projectMilestonePaymentPickHeader("en"),
    width: 14,
    centerContent: true,
  },
  {
    key: "companyTaxId",
    header: PROJECT_HEADER_LABELS.companyTaxId!.en,
    width: 16,
    centerContent: true,
    numberFormat: IMPORT_NPWP_EXCEL_FORMAT,
  },
  {
    key: "estimatedStartDate",
    header: PROJECT_HEADER_LABELS.estimatedStartDate!.en,
    required: true,
    width: 12,
    centerContent: true,
    numberFormat: IMPORT_DATE_EXCEL_FORMAT,
  },
  {
    key: "durationMonths",
    header: PROJECT_HEADER_LABELS.durationMonths!.en,
    width: 12,
    centerContent: true,
  },
  {
    key: "estimatedEndDate",
    header: PROJECT_HEADER_LABELS.estimatedEndDate!.en,
    width: 12,
    centerContent: true,
    numberFormat: IMPORT_DATE_EXCEL_FORMAT,
  },
  {
    key: "coordinates",
    header: PROJECT_HEADER_LABELS.coordinates!.en,
    required: true,
    width: 20,
    centerContent: true,
  },
  {
    key: "department",
    header: PROJECT_HEADER_LABELS.department!.en,
    width: 14,
    centerContent: true,
  },
  {
    key: "staffAssigned",
    header: PROJECT_HEADER_LABELS.staffAssigned!.en,
    /** Soft floor; Lists staff labels do not inflate width. */
    width: 22,
    centerContent: true,
  },
];

/** Parser columns — English headers + bilingual aliases. */
export const PROJECT_IMPORT_COLUMNS: ColumnDef[] = applyLocalizedHeaders(
  BASE_PROJECT_IMPORT_COLUMNS,
  DEFAULT_LOCALE,
  PROJECT_HEADER_LABELS
);
