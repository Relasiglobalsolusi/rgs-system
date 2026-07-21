import type { BillingMode, ProjectSubCategory } from "@prisma/client";

import { parseImportDate } from "@/lib/bulk-import/parse-import-date";
import type { SpreadsheetRow } from "@/lib/bulk-import/xlsx";
import { parseDateInput } from "@/lib/invoice-period";
import { todayDateInput } from "@/lib/project-contract";
import {
  assertBillingModeForSubCategory,
  BILLING_MODE_LABELS,
  defaultBillingMode,
  isBillingMode,
  MAX_MILESTONE_PAYMENTS,
} from "@/lib/project-billing";
import {
  addDaysToDateInput,
  addMonthsToDateInput,
  CONTRACT_DURATION_PRESETS,
  isContractSubCategory,
  MAX_PROJECT_DURATION_DAYS,
  MIN_PROJECT_DURATION_DAYS,
} from "@/lib/project-contract";
import {
  isProjectSubCategory,
  PROJECT_SUB_CATEGORY_LABELS,
} from "@/lib/project-subcategory";
import { capitalizeProper } from "@/lib/text-case";
import { isNotApplicableImportValue } from "@/lib/bulk-import/template-i18n";

export type ParsedProjectImportRow = {
  name: string;
  clientName: string;
  startingStage: "PLANNED" | "IN_PROGRESS";
  subCategory: ProjectSubCategory;
  estimatedStartDate: Date;
  durationMonths: number | null;
  /** General / Facade job duration in days (1–365). */
  durationDays: number | null;
  estimatedEndDate: Date | null;
  /** Raw coordinates / Maps paste — resolved to lat/lng + address on import. */
  coordinatesRaw: string;
  billingMode: BillingMode;
  /** Set when Billing Mode is Milestone; otherwise null. */
  numberOfPayments: number | null;
  department: string | null;
  staffTokens: string[];
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isNotApplicableToken(raw: string): boolean {
  return isNotApplicableImportValue(raw);
}

function parseStartingStage(raw: string): "PLANNED" | "IN_PROGRESS" {
  const value = normalizeKey(raw);
  if (!value) {
    throw new Error("Starting Stage is required.");
  }
  if (
    value === "planning" ||
    value === "planned" ||
    value === "project planning" ||
    value === "perencanaan"
  ) {
    return "PLANNED";
  }
  if (
    value === "in progress" ||
    value === "in-progress" ||
    value === "inprogress" ||
    value === "active" ||
    value === "berjalan" ||
    value === "sedang berjalan"
  ) {
    return "IN_PROGRESS";
  }
  throw new Error(
    'Starting Stage must be "Planning"/"Perencanaan" or "In Progress"/"Berjalan".'
  );
}

function parseSubCategory(raw: string): ProjectSubCategory {
  const value = normalizeKey(raw);
  if (!value) {
    throw new Error("Subcategory is required.");
  }

  const byLabel = (
    Object.entries(PROJECT_SUB_CATEGORY_LABELS) as Array<
      [ProjectSubCategory, string]
    >
  ).find(([, label]) => normalizeKey(label) === value);
  if (byLabel) return byLabel[0];

  const compact = value.replace(/\s+/g, "_");
  if (isProjectSubCategory(compact.toUpperCase())) {
    return compact.toUpperCase() as ProjectSubCategory;
  }

  if (value === "regular" || value === "regular cleaning") {
    return "REGULAR_CLEANING";
  }
  if (value === "general" || value === "general cleaning") {
    return "GENERAL_CLEANING";
  }
  if (value === "facade" || value === "facade cleaning") {
    return "FACADE_CLEANING";
  }

  throw new Error(
    "Subcategory must be Regular Cleaning, General Cleaning, or Facade Cleaning."
  );
}

function parseBillingMode(
  raw: string,
  subCategory: ProjectSubCategory
): BillingMode {
  if (isContractSubCategory(subCategory)) {
    return "MONTHLY";
  }

  const value = normalizeKey(raw);
  if (!value) {
    return defaultBillingMode(subCategory);
  }

  const byLabel = (
    Object.entries(BILLING_MODE_LABELS) as Array<[BillingMode, string]>
  ).find(([, label]) => normalizeKey(label) === value);
  if (byLabel) {
    assertBillingModeForSubCategory(subCategory, byLabel[0]);
    return byLabel[0];
  }

  const compact = value.replace(/\s+/g, "_").toUpperCase();
  if (isBillingMode(compact)) {
    assertBillingModeForSubCategory(subCategory, compact);
    return compact;
  }

  if (
    value === "on completion" ||
    value === "completion" ||
    value === "saat selesai"
  ) {
    assertBillingModeForSubCategory(subCategory, "ON_COMPLETION");
    return "ON_COMPLETION";
  }

  if (value === "monthly" || value === "bulanan") {
    assertBillingModeForSubCategory(subCategory, "MONTHLY");
    return "MONTHLY";
  }

  if (value === "milestone" || value === "tahap" || value === "bertahap") {
    assertBillingModeForSubCategory(subCategory, "MILESTONE");
    return "MILESTONE";
  }

  throw new Error(
    "Billing Mode must be On completion/Saat selesai or Milestone/Bertahap for General/Facade (Regular Cleaning is always Monthly)."
  );
}

const CONTRACT_START_DATE_LABEL = "Contract Start Date";
const CONTRACT_END_DATE_LABEL = "Contract End Date";
const DURATION_LABEL = "Duration";

const DURATION_MONTH_UNIT_SUFFIXES = new Set(["", "month", "months", "bulan"]);
const DURATION_DAY_UNIT_SUFFIXES = new Set(["", "day", "days", "hari"]);

const REGULAR_DURATION_ERROR =
  `${DURATION_LABEL} is invalid for Regular Cleaning. Use 6, 12, 24, or 36 months (e.g. 12, 12 months, 12 bulan). / ${DURATION_LABEL} tidak valid untuk Regular Cleaning. Gunakan 6, 12, 24, atau 36 bulan (mis. 12, 12 months, 12 bulan).`;

const GENERAL_FACADE_DURATION_ERROR =
  `${DURATION_LABEL} is invalid for General/Facade Cleaning. Use a whole number of days from ${MIN_PROJECT_DURATION_DAYS} to ${MAX_PROJECT_DURATION_DAYS} (e.g. 3, 3 days, 3 hari). / ${DURATION_LABEL} tidak valid untuk General/Facade Cleaning. Gunakan bilangan bulat hari ${MIN_PROJECT_DURATION_DAYS}–${MAX_PROJECT_DURATION_DAYS} (mis. 3, 3 days, 3 hari).`;

function parseDurationUnitValue(
  raw: string,
  allowedSuffixes: Set<string>,
  validate: (value: number) => void,
  errorMessage: string
): number {
  const value = raw.trim();
  if (!value) {
    throw new Error(errorMessage);
  }

  const match = value.match(/^(\d+)(?:\s+(.+))?$/i);
  if (!match) {
    throw new Error(errorMessage);
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
    throw new Error(errorMessage);
  }

  const suffix = (match[2] ?? "").trim().toLowerCase();
  if (suffix && !allowedSuffixes.has(suffix)) {
    throw new Error(errorMessage);
  }

  validate(parsed);
  return parsed;
}

function parseDurationMonths(raw: string): number {
  return parseDurationUnitValue(
    raw,
    DURATION_MONTH_UNIT_SUFFIXES,
    (months) => {
      if (!(CONTRACT_DURATION_PRESETS as readonly number[]).includes(months)) {
        throw new Error(REGULAR_DURATION_ERROR);
      }
    },
    REGULAR_DURATION_ERROR
  );
}

function parseDurationDays(raw: string): number {
  return parseDurationUnitValue(
    raw,
    DURATION_DAY_UNIT_SUFFIXES,
    (days) => {
      if (days < MIN_PROJECT_DURATION_DAYS || days > MAX_PROJECT_DURATION_DAYS) {
        throw new Error(GENERAL_FACADE_DURATION_ERROR);
      }
    },
    GENERAL_FACADE_DURATION_ERROR
  );
}

function parseMilestonePayments(
  raw: string,
  billingMode: BillingMode
): number | null {
  const value = raw.trim();

  // On completion / Monthly (and any non-milestone): ignore leftovers such as a
  // prior Milestone 1–10 pick still sitting in the cell from an older template.
  if (billingMode !== "MILESTONE") {
    return null;
  }

  if (!value || isNotApplicableToken(value)) {
    throw new Error(
      `Milestone payments is required for Milestone billing (choose 1–${MAX_MILESTONE_PAYMENTS}).`
    );
  }

  const count = Number(value);
  if (
    !Number.isFinite(count) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_MILESTONE_PAYMENTS
  ) {
    throw new Error(
      `Milestone payments must be a whole number from 1 to ${MAX_MILESTONE_PAYMENTS}.`
    );
  }

  return count;
}

function dateToInput(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Asia/Jakarta calendar day for upload (UTC date-only). */
export function projectImportUploadDate(
  referenceDate?: Date
): Date {
  return referenceDate ?? parseDateInput(todayDateInput());
}

/**
 * Stage-aware contract date rejection rules (preview + confirm).
 * Upload day = Asia/Jakarta calendar day unless `referenceDate` is passed.
 * Same-day start (Planning) and same-day end (In Progress) are allowed.
 */
export function assertProjectImportContractDates(opts: {
  startingStage: "PLANNED" | "IN_PROGRESS";
  startDate: Date;
  /** Computed end (start + duration). Required for In Progress (I4). */
  endDate: Date | null;
  uploadDate?: Date;
}): void {
  const uploadDate = opts.uploadDate ?? projectImportUploadDate();
  const { startingStage, startDate, endDate } = opts;

  if (startingStage === "PLANNED") {
    // P1: start strictly before upload day
    if (startDate.getTime() < uploadDate.getTime()) {
      throw new Error(
        "Contract start is before the upload day. Set Contract Start Date to today or a future date. / Tanggal mulai kontrak sebelum hari unggah. Ubah Contract Start Date ke hari ini atau tanggal mendatang."
      );
    }
    return;
  }

  // I1: start strictly after upload day
  if (startDate.getTime() > uploadDate.getTime()) {
    throw new Error(
      "Contract start is after the upload day. For In Progress rows, set Contract Start Date to today or an earlier date. / Tanggal mulai kontrak setelah hari unggah. Untuk baris Berjalan, ubah Contract Start Date ke hari ini atau tanggal sebelumnya."
    );
  }

  // I4: computed end strictly before upload day
  if (!endDate) {
    throw new Error(
      `Could not calculate ${CONTRACT_END_DATE_LABEL} from start and duration. Enter a valid Duration. / Tidak dapat menghitung ${CONTRACT_END_DATE_LABEL} dari mulai dan durasi. Isi Duration yang valid.`
    );
  }
  if (endDate.getTime() < uploadDate.getTime()) {
    throw new Error(
      "Computed contract end (start + duration) is before the upload day. Extend Duration or move Contract Start Date later so the end is today or in the future. / Akhir kontrak terhitung (mulai + durasi) sebelum hari unggah. Perpanjang Duration atau geser Contract Start Date agar akhir jatuh hari ini atau setelahnya."
    );
  }
}

function parseEndFromStartAndDuration(
  start: Date,
  durationMonths: number
): Date {
  const endInput = addMonthsToDateInput(dateToInput(start), durationMonths);
  if (!endInput) {
    throw new Error(
      `Could not calculate ${CONTRACT_END_DATE_LABEL} from start and duration. Enter a valid Duration. / Tidak dapat menghitung ${CONTRACT_END_DATE_LABEL} dari mulai dan durasi. Isi Duration yang valid.`
    );
  }
  const [year, month, day] = endInput.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function parseEndFromStartAndDurationDays(start: Date, durationDays: number): Date {
  const endInput = addDaysToDateInput(dateToInput(start), durationDays);
  if (!endInput) {
    throw new Error(
      `Could not calculate ${CONTRACT_END_DATE_LABEL} from start and duration. Enter a valid Duration. / Tidak dapat menghitung ${CONTRACT_END_DATE_LABEL} dari mulai dan durasi. Isi Duration yang valid.`
    );
  }
  const [year, month, day] = endInput.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function parseStaffAssignedTokens(raw: string): string[] {
  if (isNotApplicableToken(raw)) return [];
  return raw
    .split(/[,;|]/)
    .map((token) => token.trim())
    .filter((token) => token && !isNotApplicableToken(token));
}

export type ParseProjectImportRowOptions = {
  /** Upload / import reference day (Asia/Jakarta calendar). Defaults to today. */
  referenceDate?: Date;
};

export function parseProjectImportRow(
  values: SpreadsheetRow,
  options?: ParseProjectImportRowOptions
): ParsedProjectImportRow {
  const name = capitalizeProper(values.name?.trim() ?? "");
  const clientName = values.client?.trim() ?? "";
  const coordinatesRaw = values.coordinates?.trim() ?? "";
  const rawDepartment = values.department?.trim() ?? "";

  if (!name) throw new Error("Project Name is required.");
  if (!clientName) throw new Error("Client is required.");
  if (!coordinatesRaw) {
    throw new Error(
      "Gmaps Coordinates are required (paste lat, lng or a Google Maps / share link)."
    );
  }

  const startingStage = parseStartingStage(values.startingStage ?? "");
  const subCategory = parseSubCategory(values.subCategory ?? "");
  const billingMode = parseBillingMode(values.billingMode ?? "", subCategory);
  const milestonePaymentsRaw =
    values.milestonePayments?.trim() ||
    values.numberOfPayments?.trim() ||
    "";
  const numberOfPayments = parseMilestonePayments(
    milestonePaymentsRaw,
    billingMode
  );

  // P2 / I2 / A1: missing or unparseable start
  const estimatedStartDate = parseImportDate(
    values.estimatedStartDate ?? "",
    CONTRACT_START_DATE_LABEL
  );
  if (!estimatedStartDate) {
    throw new Error(
      `${CONTRACT_START_DATE_LABEL} is missing. Enter a valid date (e.g. DD/MM/YYYY). / ${CONTRACT_START_DATE_LABEL} belum diisi. Masukkan tanggal valid (mis. DD/MM/YYYY).`
    );
  }

  // A1: reject unparseable sheet end; A2: always prefer computed end below.
  parseImportDate(values.estimatedEndDate ?? "", CONTRACT_END_DATE_LABEL);

  let durationMonths: number | null = null;
  let durationDays: number | null = null;
  let estimatedEndDate: Date;

  const isContract = isContractSubCategory(subCategory);
  const isPlanning = startingStage === "PLANNED";
  const rawDuration = values.durationMonths ?? "";

  if (isContract) {
    // P3 / I3: Regular — 6/12/24/36 months
    durationMonths = parseDurationMonths(rawDuration);
    estimatedEndDate = parseEndFromStartAndDuration(
      estimatedStartDate,
      durationMonths
    );
  } else {
    // P3 / I3: General/Facade — 1–365 days
    durationDays = parseDurationDays(rawDuration);
    estimatedEndDate = parseEndFromStartAndDurationDays(
      estimatedStartDate,
      durationDays
    );
  }

  assertProjectImportContractDates({
    startingStage,
    startDate: estimatedStartDate,
    endDate: estimatedEndDate,
    uploadDate: projectImportUploadDate(options?.referenceDate),
  });

  const department =
    isPlanning || isNotApplicableToken(rawDepartment) ? null : rawDepartment;
  const staffTokens = isPlanning
    ? []
    : parseStaffAssignedTokens(values.staffAssigned ?? "");

  if (!isPlanning) {
    if (!department) {
      throw new Error(
        "Department is required for In Progress projects. Choose a department from the dropdown."
      );
    }
    // Staff Assigned may be empty for In Progress (assign later) — preview warns, does not block.
  }

  return {
    name,
    clientName,
    startingStage,
    subCategory,
    estimatedStartDate,
    durationMonths,
    durationDays,
    estimatedEndDate,
    coordinatesRaw,
    billingMode,
    numberOfPayments,
    department,
    staffTokens,
  };
}
