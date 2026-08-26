"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  nextCompanyScopedSortOrder,
  persistCompanyScopedReorder,
} from "@/lib/persist-reorder";
import { projectHistoryWhere, UNPAID_INVOICE_STATUSES } from "@/lib/billing";
import {
  allowedSubCategoriesForServiceArea,
  isClientProjectSubCategory,
  isProjectSubCategory,
  isRgsInternalProject,
  isServiceProjectSubCategory,
  projectUsesNamedShifts,
  serviceAreaForSubCategory,
  subCategoryForServiceArea,
} from "@/lib/project-subcategory";
import {
  billingSubCategoryForCatalog,
  parseDemoProjectFlags,
} from "@/lib/project-service-catalog";
import { isCleaningOneTimeType } from "@/lib/project-form-subcategory";
import {
  clampProjectDurationDays,
  daysBetweenDates,
  isContractSubCategory,
  isExtendableContractSubCategory,
  isRedoJobSubCategory,
  MAX_PROJECT_DURATION_DAYS,
  MIN_PROJECT_DURATION_DAYS,
  todayDateInput,
  usesMonthDurationTimeline,
} from "@/lib/project-contract";
import {
  assertBillingModeForSubCategory,
  allowedBillingModesForSubCategory,
  buildMilestoneSchedule,
  defaultBillingMode,
  isBillingMode,
  isMilestoneSubCategory,
  parseContractPrice,
  parseMilestoneInstallmentsFromFormData,
  splitEvenlyPercents,
  usesInvoicePeriods,
  decimalToNumber,
} from "@/lib/project-billing";
import {
  parseOptionalNamedShiftCount,
  parseShiftWindowsFromForm,
  syncProjectShifts,
} from "@/lib/project-shifts";
import {
  clampInvoicingDay,
  firstMonthlyPeriodBounds,
  invoicingDayFromContractStart,
  invoicingDayFromCycleToDay,
  isMonthlyPeriodAwaitingReconcile,
  parseBillingPeriodBasis,
  parseCustomBillingCycleDays,
  PAYMENT_TERMS_DAYS_OPTIONS,
  addUtcDays,
  parseDateInput,
  toUtcDateOnly,
  type PaymentTermsDaysOption,
} from "@/lib/invoice-period";
import { snapDateToCutoffDay } from "@/lib/payroll-management";
import { parseProjectChargedTax } from "@/lib/commercial-tax";
import { parseFormCompanyBankAccountId } from "@/lib/company-bank-accounts";
import { toActionError } from "@/lib/prisma-errors";
import { parseServiceArea } from "@/lib/service-area";
import { requireModule, toPermissionUser } from "@/lib/session";
import { deleteLocalUpload, saveUpload } from "@/lib/upload";
import {
  issueInvoiceForCurrentMonth,
  issueInvoicesForFinishedProject,
  reconcileDueInvoiceForProject,
} from "@/app/projects/invoice-actions";
import {
  assertCanApproveProjectServiceArea,
  assertCanCreateProjectInScope,
  assertCanWriteProject,
} from "@/lib/om-approval";
import {
  canDeleteActiveStageProjects,
  canManageProjects,
  getInProgressCleaningProjectDeleteBlockReason,
  isAdminDeletableProjectStatus,
  isInProgressCleaningProjectDeleteBlocked,
} from "@/lib/project-access";
import {
  isPlanningProjectStatus,
  isProjectOpenForSiteWork,
  PROJECT_LIST_VIEW_PATHS,
  PROJECT_PLANNING_STATUS,
} from "@/lib/project-status";
import type { BillingMode, ProjectStatus } from "@prisma/client";
import {
  assertEmployeesNotOnOtherProject,
  assertProjectCrewEligible,
  crewOptionsForSubCategory,
  markEmployeesOnProject,
  partTimeRosterWhere,
  stampEmployeeDepositSourceProject,
  releaseAllProjectCrew,
  releaseEmployeesFromProject,
} from "@/lib/workforce-crew";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import {
  lineFormDataFromPrefix,
  parseBulkLineCount,
} from "@/lib/bulk-create";
import {
  clampLocationRadiusMeters,
  DEFAULT_LOCATION_RADIUS_METERS,
} from "@/lib/geo";
import { resolveProjectSiteCoordinates } from "@/lib/project-site-location";
import { isRgsInternalClientFormValue } from "@/lib/attendance-internal-sites";
import { HEAD_OFFICE_SITE } from "@/lib/company-identity";
import {
  applyOperationsTeamAssignments,
  parseTeamIdsFromForm,
} from "@/lib/operations-teams";
import {
  mergeBackupEmployeeIds,
  parsePettyCashAmount,
  schedulePartTimePays,
  voidScheduledPartTimePays,
} from "@/lib/petty-cash";
import { parseProjectVisitsFromForm } from "@/lib/project-visits";
import {
  clearProjectVisitAssignmentRow,
  replaceProjectVisitAssignment,
  syncVisitCrewOccupancy,
} from "@/lib/project-visit-crew";
import {
  finalizePendingEarlyEndIfDue,
} from "@/lib/project-early-end";

async function assertSessionCanWriteProject(
  session: { user: { id: string; username?: string } },
  project: { id: string; serviceArea: import("@prisma/client").ServiceArea }
) {
  await assertCanWriteProject({
    userId: session.user.id,
    username: session.user.username,
    projectId: project.id,
    serviceArea: project.serviceArea,
  });
}

const projectDeleteSelect = {
  id: true,
  name: true,
  clientId: true,
  status: true,
  subCategory: true,
  serviceArea: true,
  contractDocumentUrl: true,
  contractExtensions: { select: { proofUrl: true } },
  invoicePeriods: {
    select: {
      invoicePdfPath: true,
      paymentProofPath: true,
      taxInvoiceDocumentPath: true,
      withholdingSlipPath: true,
      reviewReportPdfPath: true,
      clientRevisionProofPath: true,
      hoReviewProofPath: true,
    },
  },
  progressReports: { select: { photos: { select: { url: true } } } },
} as const;

async function nextCrewIdsWithTeams(
  db: Prisma.TransactionClient,
  opts: {
    companyId: string;
    projectId: string;
    subCategory: string;
    areaCatalogId?: string | null;
    serviceArea?: string | null;
    formData: FormData;
    extraEmployeeIds: string[];
  }
) {
  return applyOperationsTeamAssignments(db, {
    companyId: opts.companyId,
    projectId: opts.projectId,
    subCategory: opts.subCategory,
    areaCatalogId: opts.areaCatalogId,
    serviceArea: opts.serviceArea,
    teamIds: parseTeamIdsFromForm(opts.formData),
    extraEmployeeIds: opts.extraEmployeeIds,
  });
}

function staffAssignableOptions(subCategory: string | null | undefined) {
  const options = crewOptionsForSubCategory(subCategory);
  return {
    includeCleaningStaff: options.includeCleaningStaff,
    allowInHouseCleaning: options.includeInHouseCleaning,
    allowSecurityStaff: options.includeSecurityStaff,
    allowParkingStaff: options.includeParkingStaff,
  };
}

async function projectStaffConflictMessages() {
  const locale = await getServerLocale();
  return {
    generic: translate(
      locale,
      "pages.projects.staffPicker.alreadyOnOtherProject"
    ),
    forProject: (projectName: string) =>
      translate(locale, "pages.projects.staffPicker.alreadyOnOtherProjectNamed", {
        projectName,
      }),
  };
}

async function assertProjectStaffAssignable(
  db: Parameters<typeof assertProjectCrewEligible>[0] &
    Parameters<typeof assertEmployeesNotOnOtherProject>[0],
  companyId: string,
  employeeIds: string[],
  options?: {
    excludeProjectId?: string;
    crewErrorMessage?: string;
    /** Internal HO/Warehouse projects may assign In-House Cleaning Staff. */
    allowInHouseCleaning?: boolean;
    /** Security projects may assign Security staff. */
    allowSecurityStaff?: boolean;
    /** Parking projects may assign Parking staff. */
    allowParkingStaff?: boolean;
    includeCleaningStaff?: boolean;
  }
) {
  const conflictMessages = await projectStaffConflictMessages();
  await assertProjectCrewEligible(
    db,
    companyId,
    employeeIds,
    options?.crewErrorMessage,
    {
      allowInHouseCleaning: options?.allowInHouseCleaning,
      allowSecurityStaff: options?.allowSecurityStaff,
      allowParkingStaff: options?.allowParkingStaff,
      includeCleaningStaff: options?.includeCleaningStaff,
    }
  );
  await assertEmployeesNotOnOtherProject(db, companyId, employeeIds, {
    excludeProjectId: options?.excludeProjectId,
    message: conflictMessages.generic,
    messageForProject: conflictMessages.forProject,
  });
}

type ProjectDeleteFiles = {
  contractDocumentUrl: string | null;
  contractExtensions: { proofUrl: string }[];
  invoicePeriods: {
    invoicePdfPath: string | null;
    paymentProofPath: string | null;
    taxInvoiceDocumentPath: string | null;
    withholdingSlipPath: string | null;
    reviewReportPdfPath: string | null;
    clientRevisionProofPath: string | null;
    hoReviewProofPath: string | null;
  }[];
  progressReports: { photos: { url: string }[] }[];
};

function collectProjectUploadPaths(project: ProjectDeleteFiles) {
  const paths: string[] = [];
  if (project.contractDocumentUrl) paths.push(project.contractDocumentUrl);
  for (const extension of project.contractExtensions) {
    if (extension.proofUrl) paths.push(extension.proofUrl);
  }
  for (const period of project.invoicePeriods) {
    if (period.invoicePdfPath) paths.push(period.invoicePdfPath);
    if (period.paymentProofPath) paths.push(period.paymentProofPath);
    if (period.taxInvoiceDocumentPath) paths.push(period.taxInvoiceDocumentPath);
    if (period.withholdingSlipPath) paths.push(period.withholdingSlipPath);
    if (period.reviewReportPdfPath) paths.push(period.reviewReportPdfPath);
    if (period.clientRevisionProofPath) {
      paths.push(period.clientRevisionProofPath);
    }
    if (period.hoReviewProofPath) paths.push(period.hoReviewProofPath);
  }
  for (const report of project.progressReports) {
    for (const photo of report.photos) paths.push(photo.url);
  }
  return paths;
}

function revalidateAfterProjectDelete(opts: {
  projectId?: string;
  clientId?: string | null;
}) {
  revalidatePath(PROJECT_LIST_VIEW_PATHS.all);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.planning);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.inProgress);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.pendingApproval);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.paymentDue);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.completed);
  revalidatePath("/dashboard");
  revalidatePath("/clients");
  revalidatePath("/billing");
  revalidatePath("/employees");
  revalidatePath("/users");
  revalidatePath("/shifts", "layout");
  revalidatePath("/cico");
  revalidatePath("/progress");
  if (opts.projectId) {
    revalidatePath(`/projects/${opts.projectId}`);
  }
  if (opts.clientId) {
    revalidatePath(`/billing/${opts.clientId}`);
    if (opts.projectId) {
      revalidatePath(`/billing/${opts.clientId}/${opts.projectId}`);
    }
  }
}

/**
 * Permanently delete a project and cascaded children, then remove local uploads.
 * Attendance rows are kept but unlinked (no Prisma cascade on Attendance.projectId).
 */
async function permanentlyDeleteProject(project: {
  id: string;
  name: string;
  clientId: string | null;
} & ProjectDeleteFiles) {
  const filePaths = collectProjectUploadPaths(project);

  await prisma.$transaction(async (tx) => {
    // Release crew to AVAILABLE + portal sync before cascade removes assignments.
    await releaseAllProjectCrew(tx, project.id);
    await tx.attendance.updateMany({
      where: { projectId: project.id },
      data: { projectId: null },
    });
    await tx.project.delete({ where: { id: project.id } });
  });

  await Promise.all(filePaths.map((filePath) => deleteLocalUpload(filePath)));

  revalidateAfterProjectDelete({
    projectId: project.id,
    clientId: project.clientId,
  });
  revalidatePath("/employees");
  revalidatePath("/users");
  revalidatePath("/shifts", "layout");
  revalidatePath("/cico");
  revalidatePath("/progress");

  return { id: project.id, name: project.name };
}

async function parseLocationFields(formData: FormData) {
  const location = String(formData.get("location") ?? "").trim();
  const latitudeRaw = String(formData.get("latitude") ?? "").trim();
  const longitudeRaw = String(formData.get("longitude") ?? "").trim();
  const radiusRaw = String(
    formData.get("locationRadiusMeters") ?? String(DEFAULT_LOCATION_RADIUS_METERS)
  ).trim();

  const formLatitude = latitudeRaw ? Number(latitudeRaw) : null;
  const formLongitude = longitudeRaw ? Number(longitudeRaw) : null;
  const locationRadiusMeters = clampLocationRadiusMeters(
    Number(radiusRaw) || DEFAULT_LOCATION_RADIUS_METERS
  );

  if (!location) throw new Error("Location address is required.");

  const resolved = await resolveProjectSiteCoordinates({
    location,
    latitude: formLatitude,
    longitude: formLongitude,
  });

  if (
    !resolved ||
    Number.isNaN(resolved.latitude) ||
    Number.isNaN(resolved.longitude)
  ) {
    throw new Error("Set the site location on the map.");
  }

  return {
    location,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    locationRadiusMeters,
  };
}

function parseOptionalDateInput(raw: string, label: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Prefer calendar YYYY-MM-DD from <input type="date"> as UTC midnight.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}.`);
  }
  return date;
}

/** Parse optional YYYY-MM-DD start/end; reject end before start. */
function parseProjectDateRange(formData: FormData) {
  const startDate = parseOptionalDateInput(
    String(formData.get("startDate") ?? ""),
    "start date"
  );
  const endDate = parseOptionalDateInput(
    String(formData.get("endDate") ?? ""),
    "end date"
  );

  if (startDate && endDate && endDate < startDate) {
    throw new Error("End date cannot be before start date.");
  }

  return { startDate, endDate };
}

function parseEstimatedStartDate(formData: FormData): Date | null {
  return parseOptionalDateInput(
    String(formData.get("estimatedStartDate") ?? ""),
    "estimated start date"
  );
}

/** General/Facade duration (days). Null when omitted / invalid. */
function parseDurationDays(formData: FormData): number | null {
  const raw = String(formData.get("durationDays") ?? "").trim();
  if (!raw) return null;
  const days = Number(raw);
  if (!Number.isFinite(days) || !Number.isInteger(days)) {
    throw new Error(
      `Duration must be a whole number of days from ${MIN_PROJECT_DURATION_DAYS} to ${MAX_PROJECT_DURATION_DAYS}.`
    );
  }
  if (days < MIN_PROJECT_DURATION_DAYS || days > MAX_PROJECT_DURATION_DAYS) {
    throw new Error(
      `Duration must be a whole number of days from ${MIN_PROJECT_DURATION_DAYS} to ${MAX_PROJECT_DURATION_DAYS}.`
    );
  }
  return days;
}

function resolveEstimatedDurationDays(opts: {
  formDurationDays: number | null;
  startDate: Date | null;
  endDate: Date | null;
  existing?: number | null;
  /** When true, keep an existing frozen estimate (In Progress edits / start). */
  preserveExisting?: boolean;
}): number | null {
  if (
    opts.preserveExisting &&
    opts.existing != null &&
    Number.isFinite(opts.existing)
  ) {
    return clampProjectDurationDays(opts.existing);
  }
  if (opts.formDurationDays != null) {
    return opts.formDurationDays;
  }
  const fromDates = daysBetweenDates(opts.startDate, opts.endDate);
  if (fromDates != null) return clampProjectDurationDays(fromDates);
  if (opts.existing != null && Number.isFinite(opts.existing)) {
    return clampProjectDurationDays(opts.existing);
  }
  return null;
}

function parseSubCategory(formData: FormData) {
  const subCategory = String(formData.get("subCategory") ?? "").trim();
  if (!isProjectSubCategory(subCategory)) {
    throw new Error("Subcategory is required.");
  }
  return subCategory;
}

/**
 * Resolve subcategory + service area together.
 * Parking / Payroll stay 1:1. Cleaning One Time only allows General | Facade.
 */
async function resolveSubCategoryAndServiceArea(
  formData: FormData,
  companyId: string
) {
  const areaCatalogId = String(formData.get("areaCatalogId") ?? "").trim();
  const subcategoryCatalogId = String(
    formData.get("subcategoryCatalogId") ?? ""
  ).trim();
  const rawServiceArea = String(formData.get("serviceArea") ?? "")
    .trim()
    .toUpperCase();
  const serviceArea =
    rawServiceArea === "MAINTENANCE"
      ? "OTHER"
      : parseServiceArea(formData.get("serviceArea"));

  if (subcategoryCatalogId) {
    const catalogSub = await prisma.projectSubcategoryCatalog.findFirst({
      where: {
        id: subcategoryCatalogId,
        area: { companyId },
      },
      include: { area: true },
    });
    if (!catalogSub) {
      throw new Error("Subcategory was not found.");
    }
    if (areaCatalogId && catalogSub.areaId !== areaCatalogId) {
      throw new Error("Subcategory does not belong to this service area.");
    }
    if (
      catalogSub.billingKind === "ONE_TIME" &&
      !catalogSub.area.allowsOneTime
    ) {
      throw new Error("This service area cannot have One Time.");
    }
    const subCategory = billingSubCategoryForCatalog({
      systemArea: catalogSub.area.systemArea,
      billingKind: catalogSub.billingKind,
      systemSubCategory: catalogSub.systemSubCategory,
    });
    return {
      subCategory,
      serviceArea: catalogSub.area.systemArea,
      areaCatalogId: catalogSub.areaId,
      subcategoryCatalogId: catalogSub.id,
    };
  }

  const lockedSub = subCategoryForServiceArea(serviceArea);
  if (lockedSub) {
    return {
      subCategory: lockedSub,
      serviceArea,
      areaCatalogId: areaCatalogId || null,
      subcategoryCatalogId: null,
    };
  }

  const subCategory = parseSubCategory(formData);
  if (serviceArea === "CLEANING" && isCleaningOneTimeType(subCategory)) {
    return {
      subCategory,
      serviceArea: "CLEANING" as const,
      areaCatalogId: areaCatalogId || null,
      subcategoryCatalogId: null,
    };
  }
  const allowed = allowedSubCategoriesForServiceArea(serviceArea);
  if (!allowed.includes(subCategory) || !isClientProjectSubCategory(subCategory)) {
    throw new Error("Choose a project type for this service area.");
  }
  return {
    subCategory,
    serviceArea: serviceAreaForSubCategory(subCategory),
    areaCatalogId: areaCatalogId || null,
    subcategoryCatalogId: null,
  };
}

function parseOptionalIntField(
  formData: FormData,
  key: string
): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Enter a valid number for ${key}.`);
  }
  return Math.round(value);
}

function parseOptionalMoneyField(
  formData: FormData,
  key: string
): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const amount = parseContractPrice(raw);
  if (amount == null) {
    throw new Error(`Invalid amount for ${key}.`);
  }
  return amount;
}

function parseRequiredMoneyField(
  formData: FormData,
  key: string,
  label: string
): number {
  const amount = parseOptionalMoneyField(formData, key);
  if (amount == null || amount <= 0) {
    throw new Error(`${label} is required.`);
  }
  return amount;
}

function parsePercentField(
  formData: FormData,
  key: string,
  opts: { required: boolean; label: string }
): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) {
    if (opts.required) throw new Error(`${opts.label} is required.`);
    return null;
  }
  const num = Number(raw.replace(",", "."));
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    throw new Error(`${opts.label} must be between 0 and 100.`);
  }
  return Math.round(num * 100) / 100;
}

function parseProjectPaymentTermsDays(
  formData: FormData,
  fallback: number
): number {
  const raw = String(formData.get("paymentTermsDays") ?? "").trim();
  if (!raw) return fallback;
  const days = Number(raw);
  if (
    !(PAYMENT_TERMS_DAYS_OPTIONS as readonly number[]).includes(days)
  ) {
    throw new Error("Invalid payment terms.");
  }
  return days as PaymentTermsDaysOption;
}

function parseCutoffDay(formData: FormData, name: string): number | null {
  const raw = Number(String(formData.get(name) ?? "").trim());
  if (!Number.isFinite(raw)) return null;
  const day = Math.round(raw);
  if (day < 1 || day > 31) return null;
  return day;
}

type ServiceCommercialFields = {
  contractPrice: number | null;
  setupCost: number | null;
  profitSharePercent: number | null;
  monthlyClientFee: number | null;
  memberParkingUnitFee: number | null;
  memberParkingUnitCount: number | null;
  parkingTaxPercent: number | null;
  serviceFeePercent: number | null;
  paymentTermsDays: number | null;
  payrollCutoffStartDay: number | null;
  payrollCutoffEndDay: number | null;
  payrollTaxPercent: number | null;
};

function parseServiceCommercialFields(
  formData: FormData,
  subCategory: string
): ServiceCommercialFields {
  const empty: ServiceCommercialFields = {
    contractPrice: null,
    setupCost: null,
    profitSharePercent: null,
    monthlyClientFee: null,
    memberParkingUnitFee: null,
    memberParkingUnitCount: null,
    parkingTaxPercent: null,
    serviceFeePercent: null,
    paymentTermsDays: null,
    payrollCutoffStartDay: null,
    payrollCutoffEndDay: null,
    payrollTaxPercent: null,
  };

  if (subCategory === "SECURITY") {
    return {
      ...empty,
      contractPrice: parseRequiredMoneyField(
        formData,
        "contractPrice",
        "Monthly fee"
      ),
    };
  }

  if (subCategory === "PARKING") {
    return {
      ...empty,
      setupCost: parseOptionalMoneyField(formData, "setupCost"),
      profitSharePercent: parsePercentField(formData, "profitSharePercent", {
        required: false,
        label: "Client profit share %",
      }),
      monthlyClientFee: parseOptionalMoneyField(formData, "monthlyClientFee"),
      memberParkingUnitFee: parseOptionalMoneyField(
        formData,
        "memberParkingUnitFee"
      ),
      memberParkingUnitCount: parseOptionalIntField(
        formData,
        "memberParkingUnitCount"
      ),
      parkingTaxPercent: parsePercentField(formData, "parkingTaxPercent", {
        required: false,
        label: "Parking tax %",
      }) ?? 10,
    };
  }

  if (subCategory === "PAYROLL_MANAGEMENT") {
    const cutoffEndDay = parseCutoffDay(formData, "payrollCutoffEndDay");
    if (cutoffEndDay == null) {
      throw new Error("Enter this client’s cutoff day.");
    }
    const cutoffStartDay = cutoffEndDay === 31 ? 1 : cutoffEndDay + 1;
    return {
      ...empty,
      serviceFeePercent: parsePercentField(formData, "serviceFeePercent", {
        required: true,
        label: "Management fee %",
      }),
      payrollCutoffStartDay: cutoffStartDay,
      payrollCutoffEndDay: cutoffEndDay,
      payrollTaxPercent:
        parsePercentField(formData, "payrollTaxPercent", {
          required: false,
          label: "Payroll tax %",
        }) ?? 11,
    };
  }

  return empty;
}

/**
 * Resolve billing mode from form (General/Facade) or subcategory default.
 * Enforces: MILESTONE only for General Cleaning / Facade Cleaning.
 * When form omits billingMode, prefer `fallback` if still allowed for the subcategory.
 */
function resolveBillingMode(
  formData: FormData,
  subCategory: string,
  fallback?: BillingMode | null
): BillingMode {
  const raw = String(formData.get("billingMode") ?? "").trim();
  if (isBillingMode(raw)) {
    assertBillingModeForSubCategory(subCategory, raw);
    return raw;
  }
  if (fallback && isBillingMode(fallback)) {
    const allowed = allowedBillingModesForSubCategory(subCategory);
    if (allowed.includes(fallback)) {
      return fallback;
    }
  }
  const billingMode = defaultBillingMode(subCategory);
  assertBillingModeForSubCategory(subCategory, billingMode);
  return billingMode;
}

function billingDefaults(subCategory: string, billingMode: BillingMode) {
  return {
    billingMode,
    // Placeholder until Move to In Progress sets the day from real startDate.
    invoicingDay: isContractSubCategory(subCategory)
      ? clampInvoicingDay(1)
      : 1,
  };
}

/** Create ONGOING milestone invoice periods for the payment plan (not issued). */
async function createMilestoneSchedulePeriods(
  tx: Prisma.TransactionClient,
  opts: {
    projectId: string;
    startDate: Date | null;
    installmentPercents: number[];
    contractPrice?: number | null;
    bankAccountId?: string | null;
  }
) {
  const schedule = buildMilestoneSchedule(
    opts.installmentPercents,
    opts.contractPrice
  );
  const base = opts.startDate
    ? toUtcDateOnly(opts.startDate)
    : toUtcDateOnly(new Date());

  for (const row of schedule) {
    const periodStart = new Date(
      Date.UTC(
        base.getUTCFullYear(),
        base.getUTCMonth(),
        base.getUTCDate() + row.index
      )
    );
    const periodEnd = periodStart;
    await tx.projectInvoicePeriod.create({
      data: {
        projectId: opts.projectId,
        periodStart,
        periodEnd,
        label: row.label,
        status: "ONGOING",
        amount: row.amount,
        milestonePercent: row.cumulativePercent,
        bankAccountId: opts.bankAccountId ?? null,
      },
    });
  }
}

async function createInternalRgsProject(
  formData: FormData,
  session: { user: { id: string; username?: string; companyId: string | null } }
) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Project name is required.");
  const companyId = session.user.companyId;
  if (!companyId) throw new Error("Company not found.");
  const employeeIds = [
    ...new Set(formData.getAll("employeeIds").map(String).filter(Boolean)),
  ];
  const resolvedArea = await resolveSubCategoryAndServiceArea(
    formData,
    companyId
  );
  const { subCategory, serviceArea, areaCatalogId, subcategoryCatalogId } =
    resolvedArea;
  const createScope = await assertCanCreateProjectInScope({
    userId: session.user.id,
    username: session.user.username,
    serviceArea,
  });
  let location;
  let latitude;
  let longitude;
  let locationRadiusMeters;
  try {
    const parsed = await parseLocationFields(formData);
    location = parsed.location;
    latitude = parsed.latitude;
    longitude = parsed.longitude;
    locationRadiusMeters = parsed.locationRadiusMeters;
  } catch {
    location = HEAD_OFFICE_SITE.address;
    latitude = HEAD_OFFICE_SITE.latitude;
    longitude = HEAD_OFFICE_SITE.longitude;
    locationRadiusMeters = DEFAULT_LOCATION_RADIUS_METERS;
  }
  const shiftCount = parseOptionalNamedShiftCount(
    formData.get("shiftCount"),
    projectUsesNamedShifts(subCategory)
  );
  const shiftWindows =
    shiftCount > 0 ? parseShiftWindowsFromForm(formData, shiftCount) : [];
  const company = await prisma.company.findFirst({ where: { id: companyId } });
  if (!company) throw new Error("Company not found.");
  const sortOrder = await nextCompanyScopedSortOrder("project", company.id);
  const startDate = parseDateInput(todayDateInput());
  const multipleVisit =
    String(formData.get("multipleVisit") ?? "").trim() === "Yes";
  const visits = multipleVisit
    ? parseProjectVisitsFromForm(formData, null)
    : [];
  const billingMode = multipleVisit ? "MULTI_VISIT" : "ON_COMPLETION";
  const lastVisitEnd = visits[visits.length - 1]?.endDate ?? null;

  await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        name,
        location,
        latitude,
        longitude,
        locationRadiusMeters,
        status: "IN_PROGRESS",
        startDate,
        endDate: lastVisitEnd,
        estimatedStartDate: startDate,
        subCategory,
        serviceArea,
        areaCatalogId,
        subcategoryCatalogId,
        clientId: null,
        isDemo: false,
        isComplimentary: false,
        billingMode,
        requiresTaxInvoice: false,
        companyId: company.id,
        sortOrder,
        shiftCount,
      } as unknown as Prisma.ProjectUncheckedCreateInput,
    });
    if (createScope.areaManagerEmployeeId) {
      await tx.areaManagerProject.create({
        data: {
          employeeId: createScope.areaManagerEmployeeId,
          projectId: created.id,
        },
      });
    }
    await syncProjectShifts(tx, created.id, shiftCount, shiftWindows);
    if (visits.length > 0) {
      await tx.projectVisit.createMany({
        data: visits.map((visit) => ({
          projectId: created.id,
          visitIndex: visit.visitIndex,
          startDate: visit.startDate,
          endDate: visit.endDate,
          amount: visit.amount,
        })),
      });
    }
    const nextIds = await nextCrewIdsWithTeams(tx, {
      companyId: company.id,
      projectId: created.id,
      subCategory,
      areaCatalogId,
      serviceArea,
      formData,
      extraEmployeeIds: employeeIds,
    });
    if (nextIds.length > 0) {
      await assertProjectStaffAssignable(tx, company.id, nextIds, {
        excludeProjectId: created.id,
        ...staffAssignableOptions(subCategory),
      });
      await tx.projectAssignment.createMany({
        data: nextIds.map((employeeId) => ({
          projectId: created.id,
          employeeId,
        })),
        skipDuplicates: true,
      });
      await markEmployeesOnProject(tx, nextIds, company.id);
    }
    return created;
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/cico");
  revalidatePath("/progress");
}

export async function createProject(formData: FormData) {
  try {
    const session = await requireModule("projects");
    if (session.user.clientId) {
      throw new Error("Client portal users cannot create projects.");
    }

    const name = String(formData.get("name") ?? "").trim();
    const { startDate: formStartDate, endDate: formEndDate } =
      parseProjectDateRange(formData);
    const estimatedFromForm = parseEstimatedStartDate(formData);
    const formDurationDays = parseDurationDays(formData);
    const clientId = String(formData.get("clientId") ?? "").trim();
    const employeeIds = formData.getAll("employeeIds").map(String);
    if (isRgsInternalClientFormValue(clientId)) {
      await createInternalRgsProject(formData, session);
      return;
    }
    const companyId = session.user.companyId;
    if (!companyId) throw new Error("Company not found.");
    const { isDemo, isComplimentary } = parseDemoProjectFlags(formData);
    const resolvedArea = await resolveSubCategoryAndServiceArea(
      formData,
      companyId
    );
    let { subCategory, serviceArea, areaCatalogId, subcategoryCatalogId } =
      resolvedArea;
    if (isDemo) {
      if (serviceArea === "CLEANING" && !isCleaningOneTimeType(subCategory)) {
        subCategory = "GENERAL_CLEANING";
      }
      if (serviceArea === "LANDSCAPING") {
        subCategory = "ONE_TIME_LANDSCAPING";
      }
      if (serviceArea === "OTHER" && !subcategoryCatalogId) {
        subCategory = "GENERAL_CLEANING";
      }
    }
    const createScope = await assertCanCreateProjectInScope({
      userId: session.user.id,
      username: session.user.username,
      serviceArea,
    });
    const { location, latitude, longitude, locationRadiusMeters } =
      await parseLocationFields(formData);
    const shiftCount = parseOptionalNamedShiftCount(
      formData.get("shiftCount"),
      projectUsesNamedShifts(subCategory)
    );
    const shiftWindows =
      shiftCount > 0 ? parseShiftWindowsFromForm(formData, shiftCount) : [];
    let billingMode = resolveBillingMode(formData, subCategory);
    if (isDemo && billingMode === "MULTI_VISIT") {
      billingMode = "ON_COMPLETION";
    }
    const { invoicingDay: defaultInvoicingDay } = billingDefaults(
      subCategory,
      billingMode
    );
    const isContract = isContractSubCategory(subCategory);
    const isService = isServiceProjectSubCategory(subCategory);
    const isMonthTimeline = usesMonthDurationTimeline(subCategory);
    // Regular + Security: month-cycle basis for invoice periods.
    const usesMonthlyContractPeriods =
      isContract || subCategory === "SECURITY";
    const billingPeriodBasis = usesMonthlyContractPeriods
      ? parseBillingPeriodBasis(formData.get("billingPeriodBasis")) ??
        "CONTRACT_CYCLE"
      : null;
    const { billingCycleStartDay, billingCycleEndDay } =
      parseCustomBillingCycleDays(formData, billingPeriodBasis);
    const invoicingDay = usesMonthlyContractPeriods
      ? billingPeriodBasis === "CALENDAR_MONTH"
        ? 1
        : billingCycleEndDay
          ? invoicingDayFromCycleToDay(billingCycleEndDay)
          : defaultInvoicingDay
      : defaultInvoicingDay;

    const milestoneInstallments =
      billingMode === "MILESTONE"
        ? parseMilestoneInstallmentsFromFormData(formData)
        : null;

    if (!name) throw new Error("Project name is required.");
    if (!clientId) throw new Error("Client is required.");

    // Default Planning (waiting for work order). Explicit "In Progress" starts ops immediately.
    const initialStatusRaw = String(formData.get("initialStatus") ?? "").trim();
    const status: ProjectStatus =
      initialStatusRaw === "IN_PROGRESS"
        ? "IN_PROGRESS"
        : PROJECT_PLANNING_STATUS;
    const isPlanning = status === PROJECT_PLANNING_STATUS;

    let estimatedStartDate: Date | null = null;
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let estimatedDurationDays: number | null = null;

    // Month-timeline services and Regular use contract-style dates.
    // Payroll Management ends on a cutoff day. GC/Facade: day duration required.
    const requiresEndDate =
      (!isContract && !isService && !isMonthTimeline) ||
      subCategory === "SECURITY" ||
      subCategory === "PAYROLL_MANAGEMENT" ||
      isContract;

    if (isPlanning) {
      estimatedStartDate = estimatedFromForm;
      if (!estimatedStartDate) {
        throw new Error(
          isContract || isMonthTimeline || isService
            ? "Contract start date is required."
            : "Estimated project start date is required."
        );
      }
      // Regular + General/Facade + services: keep duration-derived end as a planned horizon;
      // real start stays null until Move to In Progress.
      startDate = null;
      endDate = formEndDate;
      if (requiresEndDate && !endDate) {
        throw new Error(
          isContract ||
            subCategory === "SECURITY" ||
            subCategory === "PAYROLL_MANAGEMENT"
            ? "Contract end date is required."
            : "Estimated project completion date is required."
        );
      }
      if (!isContract && !isService) {
        estimatedDurationDays = resolveEstimatedDurationDays({
          formDurationDays,
          startDate: estimatedStartDate,
          endDate,
        });
        if (estimatedDurationDays == null) {
          throw new Error("Duration (days) is required.");
        }
      }
    } else {
      startDate = formStartDate;
      endDate = formEndDate;
      if (!startDate) {
        throw new Error(
          isContract || isMonthTimeline || isService
            ? "Contract start date is required."
            : "Project start date is required."
        );
      }
      if (requiresEndDate && !endDate) {
        throw new Error(
          isContract ||
            subCategory === "SECURITY" ||
            subCategory === "PAYROLL_MANAGEMENT"
            ? "Contract end date is required."
            : "Estimated project completion date is required."
        );
      }
      estimatedStartDate = estimatedFromForm ?? startDate;
      if (!isContract && !isService) {
        estimatedDurationDays = resolveEstimatedDurationDays({
          formDurationDays,
          startDate,
          endDate,
        });
        if (estimatedDurationDays == null) {
          throw new Error("Duration (days) is required.");
        }
      }
    }

    const company = await prisma.company.findFirst();
    if (!company) throw new Error("Company not found.");

    const sortOrder = await nextCompanyScopedSortOrder("project", company.id);

    // Ignore form tax fields — derive With/Without tax from the client NPWP.
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId: company.id, active: true },
      select: { id: true, npwp: true },
    });
    if (!client) {
      throw new Error(
        "Client not found or is deleted. Choose an active client."
      );
    }
    let contractDocumentUrl: string | null = null;
    if (status === "IN_PROGRESS" && !isDemo) {
      const contractProof = formData.get("contractProof");
      if (!(contractProof instanceof File) || contractProof.size === 0) {
        throw new Error(
          "Signed contract proof is required before starting In Progress."
        );
      }
      contractDocumentUrl = await saveUpload(
        contractProof,
        "contract-proofs",
        { fileBaseName: "contract_new" }
      );
    }

    const {
      chargedTaxKind,
      requiresTaxInvoice,
      pphRatePercent,
      otherTaxName,
    } = isComplimentary
      ? {
          chargedTaxKind: null,
          requiresTaxInvoice: false,
          pphRatePercent: null,
          otherTaxName: null,
        }
      : parseProjectChargedTax(formData);
    const paymentTermsDays =
      isComplimentary || subCategory === "PARKING"
        ? null
        : parseProjectPaymentTermsDays(formData, 14);
    const bankAccountId = isComplimentary
      ? null
      : await parseFormCompanyBankAccountId(
          formData,
          company.id,
          { requiredWhenAccountsExist: true }
        );
    const serviceFields =
      isComplimentary || !isService
        ? null
        : parseServiceCommercialFields(formData, subCategory);
    const contractPrice = isComplimentary
      ? 0
      : isService
        ? serviceFields?.contractPrice ?? null
        : parseRequiredMoneyField(
            formData,
            "contractPrice",
            "Contract price"
          );
    if (subCategory === "PAYROLL_MANAGEMENT" && endDate) {
      const cutoff = serviceFields?.payrollCutoffEndDay;
      if (cutoff != null) {
        endDate = snapDateToCutoffDay(endDate, cutoff);
      }
    }

    await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name,
          location,
          latitude,
          longitude,
          locationRadiusMeters,
          estimatedStartDate,
          estimatedDurationDays,
          startDate,
          endDate,
          status,
          progress: 0,
          invoicingDay,
          billingMode,
          billingPeriodBasis,
          billingCycleStartDay,
          billingCycleEndDay,
          contractPrice,
          setupCost: serviceFields?.setupCost ?? null,
          profitSharePercent: serviceFields?.profitSharePercent ?? null,
          monthlyClientFee: serviceFields?.monthlyClientFee ?? null,
          memberParkingUnitFee: serviceFields?.memberParkingUnitFee ?? null,
          memberParkingUnitCount: serviceFields?.memberParkingUnitCount ?? null,
          parkingTaxPercent: serviceFields?.parkingTaxPercent ?? null,
          serviceFeePercent: serviceFields?.serviceFeePercent ?? null,
          paymentTermsDays,
          bankAccountId,
          payrollCutoffStartDay: serviceFields?.payrollCutoffStartDay ?? null,
          payrollCutoffEndDay: serviceFields?.payrollCutoffEndDay ?? null,
          payrollTaxPercent: serviceFields?.payrollTaxPercent ?? null,
          subCategory,
          serviceArea,
          areaCatalogId,
          subcategoryCatalogId,
          requiresTaxInvoice,
          chargedTaxKind,
          pphRatePercent,
          otherTaxName,
          isGovernmentContract:
            !isComplimentary &&
            String(formData.get("isGovernmentContract") ?? "") === "true",
          isDemo,
          isComplimentary,
          companyId: company.id,
          clientId,
          sortOrder,
          contractDocumentUrl,
          shiftCount,
        } as unknown as Prisma.ProjectUncheckedCreateInput,
      });

      if (createScope.areaManagerEmployeeId) {
        await tx.areaManagerProject.create({
          data: {
            employeeId: createScope.areaManagerEmployeeId,
            projectId: created.id,
          },
        });
      }

      await syncProjectShifts(tx, created.id, shiftCount, shiftWindows);

      if (billingMode === "MILESTONE") {
        await createMilestoneSchedulePeriods(tx, {
          projectId: created.id,
          // Prefer real start; fall back to estimate for schedule anchoring.
          startDate: startDate ?? estimatedStartDate,
          installmentPercents: milestoneInstallments ?? [100],
          contractPrice,
          bankAccountId,
        });
      }

      if (billingMode === "MULTI_VISIT" && !isComplimentary) {
        const visits = parseProjectVisitsFromForm(
          formData,
          serviceFields?.contractPrice ?? null
        );
        await tx.projectVisit.createMany({
          data: visits.map((visit) => ({
            projectId: created.id,
            visitIndex: visit.visitIndex,
            startDate: visit.startDate,
            endDate: visit.endDate,
            amount: visit.amount,
          })),
        });
        const lastVisitEnd = visits[visits.length - 1]?.endDate;
        if (lastVisitEnd && !endDate) {
          await tx.project.update({
            where: { id: created.id },
            data: { endDate: lastVisitEnd },
          });
        }
      }

      // Regular + Security In Progress create: open the first billing period.
      // Parking / Payroll Management stay commercial-terms only (no periods).
      if (
        !isComplimentary &&
        !isPlanning &&
        usesInvoicePeriods(subCategory) &&
        billingMode === "MONTHLY" &&
        startDate
      ) {
        const first = firstMonthlyPeriodBounds(
          billingPeriodBasis,
          toUtcDateOnly(startDate),
          { fromDay: billingCycleStartDay, toDay: billingCycleEndDay }
        );
        await tx.projectInvoicePeriod.upsert({
          where: {
            projectId_periodStart_periodEnd: {
              projectId: created.id,
              periodStart: first.periodStart,
              periodEnd: first.periodEnd,
            },
          },
          update: { label: first.label },
          create: {
            projectId: created.id,
            periodStart: first.periodStart,
            periodEnd: first.periodEnd,
            label: first.label,
            status: "ONGOING",
            bankAccountId,
          },
        });
      }

      // Planning: assign staff only when moving to In Progress (not at create).
      // Multiple visits: crew is assigned per visit on the project page.
      if (!isPlanning && billingMode !== "MULTI_VISIT") {
        const nextIds = await nextCrewIdsWithTeams(tx, {
          companyId: company.id,
          projectId: created.id,
          subCategory,
          areaCatalogId,
          serviceArea,
          formData,
          extraEmployeeIds: employeeIds,
        });
        if (nextIds.length > 0) {
          await assertProjectStaffAssignable(tx, company.id, nextIds, {
            excludeProjectId: created.id,
            ...staffAssignableOptions(subCategory),
          });
          await tx.projectAssignment.createMany({
            data: nextIds.map((employeeId) => ({
              projectId: created.id,
              employeeId,
            })),
            skipDuplicates: true,
          });
          await markEmployeesOnProject(tx, nextIds, company.id);
          await stampEmployeeDepositSourceProject(tx, nextIds, {
            id: created.id,
            subCategory,
          });
        }
      }

      return created;
    });

    revalidatePath("/projects");
    revalidatePath("/dashboard");
    revalidatePath("/clients");
    revalidatePath("/billing");
    revalidatePath("/employees");
    revalidatePath("/users");
    revalidatePath("/shifts", "layout");
  } catch (error) {
    throw toActionError(error, "Failed to create project.");
  }
}

export async function createProjectsInBulk(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requireModule("projects");
    if (session.user.clientId) {
      throw new Error("Client portal users cannot create projects.");
    }

    const lineCount = parseBulkLineCount(formData);
    const rows: FormData[] = [];

    for (let index = 0; index < lineCount; index += 1) {
      const row = lineFormDataFromPrefix(formData, index);
      const name = String(row.get("name") ?? "").trim();
      const clientId = String(row.get("clientId") ?? "").trim();
      try {
        if (!name) throw new Error("Project name is required.");
        if (!clientId) throw new Error("Client is required.");
      } catch (error) {
        throw new Error(
          translate(locale, "bulkCreate.lineError", {
            n: String(index + 1),
            message:
              error instanceof Error ? error.message : "Invalid project line.",
          })
        );
      }
      rows.push(row);
    }

    if (rows.length === 0) {
      throw new Error(translate(locale, "bulkCreate.emptyLines"));
    }

    for (let index = 0; index < rows.length; index += 1) {
      try {
        await createProject(rows[index]);
      } catch (error) {
        throw new Error(
          translate(locale, "bulkCreate.lineError", {
            n: String(index + 1),
            message:
              error instanceof Error
                ? error.message
                : translate(locale, "pages.projects.finish.createFailed"),
          })
        );
      }
    }
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.projects.finish.createFailed")
    );
  }
}

export async function reorderProjects(ids: string[]) {
  try {
    const session = await requireModule("projects");
    if (session.user.clientId) {
      throw new Error("Client portal users cannot reorder projects.");
    }

    const companyId = session.user.companyId;
    if (!companyId) throw new Error("Company not found.");

    await persistCompanyScopedReorder("project", {
      companyId,
      ids,
      mismatchError: "One or more projects are invalid for reorder.",
    });

    revalidatePath("/projects");
    revalidatePath("/billing");
  } catch (error) {
    throw toActionError(error, "Failed to reorder projects.");
  }
}

export async function updateProjectBankAccount(
  projectId: string,
  formData: FormData
) {
  try {
    const session = await requireModule("projects");
    if (session.user.clientId) {
      throw new Error("Client portal users cannot edit projects.");
    }
    const companyId = session.user.companyId;
    if (!companyId) throw new Error("Company not found.");

    const existing = await prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: { id: true, clientId: true, serviceArea: true },
    });
    if (!existing) throw new Error("Project not found.");
    await assertCanWriteProject({
      userId: session.user.id,
      username: session.user.username,
      projectId,
      serviceArea: existing.serviceArea,
    });

    const bankAccountId = await parseFormCompanyBankAccountId(
      formData,
      companyId,
      { requiredWhenAccountsExist: true }
    );

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { bankAccountId },
      });
      await tx.projectInvoicePeriod.updateMany({
        where: {
          projectId,
          invoicePdfPath: null,
          status: { in: ["ONGOING", "COMPILING"] },
        },
        data: { bankAccountId },
      });
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    if (existing.clientId) {
      revalidatePath(`/billing/${existing.clientId}/${projectId}`);
    }
  } catch (error) {
    throw toActionError(error, "Could not save the bank account.");
  }
}

export async function updateProject(id: string, formData: FormData) {
  try {
    const session = await requireModule("projects");
    if (session.user.clientId) {
      throw new Error("Client portal users cannot edit projects.");
    }

    const name = String(formData.get("name") ?? "").trim();
    const { startDate: formStartDate, endDate: formEndDate } =
      parseProjectDateRange(formData);
    const estimatedFromForm = parseEstimatedStartDate(formData);
    const formDurationDays = parseDurationDays(formData);
    const clientId = String(formData.get("clientId") ?? "").trim();
    const employeeIds = formData.getAll("employeeIds").map(String);
    const rawSubCategory = String(formData.get("subCategory") ?? "").trim();
    const { location, latitude, longitude, locationRadiusMeters } =
      await parseLocationFields(formData);
    // Payment schedule is create-only — Edit Project does not rebuild milestone periods.
    const companyId = session.user.companyId;
    if (!companyId) throw new Error("Company not found.");

    const existing = await prisma.project.findFirst({
      where: { id, companyId },
      select: {
        status: true,
        companyId: true,
        billingMode: true,
        estimatedDurationDays: true,
        estimatedStartDate: true,
        startDate: true,
        subCategory: true,
        contractPrice: true,
        setupCost: true,
        profitSharePercent: true,
        monthlyClientFee: true,
        serviceFeePercent: true,
        paymentTermsDays: true,
        payrollCutoffStartDay: true,
        payrollCutoffEndDay: true,
        shiftCount: true,
        serviceArea: true,
      },
    });
    if (!existing) {
      throw new Error("Project not found.");
    }
    await assertCanWriteProject({
      userId: session.user.id,
      username: session.user.username,
      projectId: id,
      serviceArea: existing.serviceArea,
    });

    // Internal HO/Warehouse: location/GPS/staff only — no commercial dates/client.
    if (
      existing.subCategory === "INTERNAL" ||
      rawSubCategory === "INTERNAL"
    ) {
      if (!name) throw new Error("Project name is required.");
      await prisma.project.update({
        where: { id },
        data: {
          name,
          location,
          latitude,
          longitude,
          locationRadiusMeters,
          clientId: null,
          subCategory: "INTERNAL",
          serviceArea: "HEAD_OFFICE",
          status: "IN_PROGRESS",
        },
      });

      if (!isPlanningProjectStatus(existing.status)) {
        const nextIds = await mergeBackupEmployeeIds(
          prisma,
          id,
          [...new Set(employeeIds.filter(Boolean))]
        );
        const previous = await prisma.projectAssignment.findMany({
          where: { projectId: id },
          select: { employeeId: true },
        });
        const previousIds = previous.map((row) => row.employeeId);
        const previousSet = new Set(previousIds);
        const nextSet = new Set(nextIds);
        const addedIds = nextIds.filter((eid) => !previousSet.has(eid));
        const removedIds = previousIds.filter((eid) => !nextSet.has(eid));
        if (addedIds.length > 0 || removedIds.length > 0) {
          await prisma.$transaction(async (tx) => {
            if (removedIds.length > 0) {
              await releaseEmployeesFromProject(tx, id, removedIds);
            }
            if (addedIds.length > 0) {
              await assertProjectStaffAssignable(tx, existing.companyId, addedIds, {
                excludeProjectId: id,
                ...staffAssignableOptions(existing.subCategory),
              });
              await tx.projectAssignment.createMany({
                data: addedIds.map((employeeId) => ({
                  projectId: id,
                  employeeId,
                })),
                skipDuplicates: true,
              });
              await markEmployeesOnProject(tx, addedIds, existing.companyId);
              await stampEmployeeDepositSourceProject(tx, addedIds, {
                id,
                subCategory: existing.subCategory,
              });
            }
          });
        }
      }

      revalidatePath(PROJECT_LIST_VIEW_PATHS.all);
      revalidatePath(PROJECT_LIST_VIEW_PATHS.inProgress);
      revalidatePath(`/projects/${id}`);
      revalidatePath("/dashboard");
      revalidatePath("/employees");
      revalidatePath("/cico");
      revalidatePath("/progress");
      return;
    }

    const { isDemo, isComplimentary } = parseDemoProjectFlags(formData);
    const resolvedUpdate = await resolveSubCategoryAndServiceArea(
      formData,
      companyId
    );
    let { subCategory, serviceArea, areaCatalogId, subcategoryCatalogId } =
      resolvedUpdate;
    if (isDemo) {
      if (serviceArea === "CLEANING" && !isCleaningOneTimeType(subCategory)) {
        subCategory = "GENERAL_CLEANING";
      }
      if (serviceArea === "LANDSCAPING") {
        subCategory = "ONE_TIME_LANDSCAPING";
      }
      if (serviceArea === "OTHER" && !subcategoryCatalogId) {
        subCategory = "GENERAL_CLEANING";
      }
    }
    let billingMode = resolveBillingMode(
      formData,
      subCategory,
      existing.billingMode
    );
    if (isDemo && billingMode === "MULTI_VISIT") {
      billingMode = "ON_COMPLETION";
    }
    const { invoicingDay: defaultInvoicingDay } = billingDefaults(
      subCategory,
      billingMode
    );
    const isPlanning = isPlanningProjectStatus(existing.status);
    const isContract = isContractSubCategory(subCategory);
    const isService = isServiceProjectSubCategory(subCategory);
    const isMonthTimeline = usesMonthDurationTimeline(subCategory);
    const usesMonthlyContractPeriods =
      isContract || subCategory === "SECURITY";
    const billingPeriodBasis = usesMonthlyContractPeriods
      ? parseBillingPeriodBasis(formData.get("billingPeriodBasis")) ??
        "CONTRACT_CYCLE"
      : null;
    const { billingCycleStartDay, billingCycleEndDay } =
      parseCustomBillingCycleDays(formData, billingPeriodBasis);
    const invoicingDay = usesMonthlyContractPeriods
      ? billingPeriodBasis === "CALENDAR_MONTH"
        ? 1
        : billingCycleEndDay
          ? invoicingDayFromCycleToDay(billingCycleEndDay)
          : defaultInvoicingDay
      : defaultInvoicingDay;
    const requiresEndDate =
      (!isContract && !isService && !isMonthTimeline) ||
      subCategory === "SECURITY" ||
      subCategory === "PAYROLL_MANAGEMENT" ||
      isContract;

    let startDate = formStartDate;
    let endDate = formEndDate;
    let estimatedStartDate = existing.estimatedStartDate;
    let estimatedDurationDays: number | null | undefined =
      existing.estimatedDurationDays;

    if (isPlanning) {
      estimatedStartDate = estimatedFromForm ?? existing.estimatedStartDate;
      if (!estimatedStartDate) {
        throw new Error(
          isContract || isMonthTimeline || isService
            ? "Contract start date is required."
            : "Estimated project start date is required."
        );
      }
      // Planning keeps real start null; end is the duration-derived horizon.
      startDate = null;
      if (requiresEndDate && !endDate) {
        throw new Error(
          isContract ||
            subCategory === "SECURITY" ||
            subCategory === "PAYROLL_MANAGEMENT"
            ? "Contract end date is required."
            : "Estimated project completion date is required."
        );
      }
      if (!isContract && !isService) {
        estimatedDurationDays = resolveEstimatedDurationDays({
          formDurationDays,
          startDate: estimatedStartDate,
          endDate,
          existing: existing.estimatedDurationDays,
        });
      } else if (isService) {
        estimatedDurationDays = null;
      }
    } else {
      if (!startDate) {
        throw new Error(
          isContract || isMonthTimeline || isService
            ? "Contract start date is required."
            : "Project start date is required."
        );
      }
      if (requiresEndDate && !endDate) {
        throw new Error(
          isContract ||
            subCategory === "SECURITY" ||
            subCategory === "PAYROLL_MANAGEMENT"
            ? "Contract end date is required."
            : "Estimated project completion date is required."
        );
      }
      if (!isContract && !isService) {
        // Freeze initial estimate once set; only backfill when missing.
        estimatedDurationDays = resolveEstimatedDurationDays({
          formDurationDays,
          startDate,
          endDate,
          existing: existing.estimatedDurationDays,
          preserveExisting: true,
        });
      } else {
        estimatedDurationDays = null;
      }
    }

    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, companyId: existing.companyId, active: true },
        select: { id: true, npwp: true },
      });
      if (!client) {
        throw new Error(
          "Client not found or is deleted. Choose an active client."
        );
      }
    }

    const {
      chargedTaxKind,
      requiresTaxInvoice,
      pphRatePercent,
      otherTaxName,
    } = isComplimentary
      ? {
          chargedTaxKind: null,
          requiresTaxInvoice: false,
          pphRatePercent: null,
          otherTaxName: null,
        }
      : parseProjectChargedTax(formData);

    const paymentTermsDays =
      isComplimentary || subCategory === "PARKING"
        ? null
        : parseProjectPaymentTermsDays(
            formData,
            existing.paymentTermsDays ?? 14
          );
    const bankAccountId = isComplimentary
      ? null
      : await parseFormCompanyBankAccountId(
          formData,
          companyId,
          { requiredWhenAccountsExist: true }
        );
    const serviceFields =
      isComplimentary || !isService
        ? null
        : parseServiceCommercialFields(formData, subCategory);
    const contractPrice = isComplimentary
      ? 0
      : isService
        ? serviceFields?.contractPrice ?? null
        : parseRequiredMoneyField(
            formData,
            "contractPrice",
            "Contract price"
          );
    if (subCategory === "PAYROLL_MANAGEMENT" && endDate) {
      const cutoff = serviceFields?.payrollCutoffEndDay;
      if (cutoff != null) {
        endDate = snapDateToCutoffDay(endDate, cutoff);
      }
    }

    const leavingMilestone =
      existing.billingMode === "MILESTONE" && billingMode !== "MILESTONE";
    const shiftCount = parseOptionalNamedShiftCount(
      formData.get("shiftCount"),
      projectUsesNamedShifts(subCategory),
      existing.shiftCount
    );
    const shiftWindows =
      shiftCount > 0 ? parseShiftWindowsFromForm(formData, shiftCount) : [];

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id },
        data: {
          name,
          location,
          latitude,
          longitude,
          locationRadiusMeters,
          estimatedStartDate,
          estimatedDurationDays:
            isContract || isService ? null : estimatedDurationDays,
          startDate,
          endDate,
          status: existing.status,
          subCategory,
          serviceArea,
          areaCatalogId,
          subcategoryCatalogId,
          invoicingDay,
          billingMode,
          billingPeriodBasis,
          billingCycleStartDay,
          billingCycleEndDay,
          requiresTaxInvoice,
          chargedTaxKind,
          pphRatePercent,
          otherTaxName,
          isGovernmentContract:
            !isComplimentary &&
            String(formData.get("isGovernmentContract") ?? "") === "true",
          isDemo,
          isComplimentary,
          contractPrice,
          ...(isService
            ? {
                setupCost: serviceFields?.setupCost ?? null,
                profitSharePercent: serviceFields?.profitSharePercent ?? null,
                monthlyClientFee: serviceFields?.monthlyClientFee ?? null,
                memberParkingUnitFee:
                  serviceFields?.memberParkingUnitFee ?? null,
                memberParkingUnitCount:
                  serviceFields?.memberParkingUnitCount ?? null,
                parkingTaxPercent: serviceFields?.parkingTaxPercent ?? null,
                serviceFeePercent: serviceFields?.serviceFeePercent ?? null,
                payrollCutoffStartDay:
                  serviceFields?.payrollCutoffStartDay ?? null,
                payrollCutoffEndDay: serviceFields?.payrollCutoffEndDay ?? null,
                payrollTaxPercent: serviceFields?.payrollTaxPercent ?? null,
              }
            : {
                setupCost: null,
                profitSharePercent: null,
                monthlyClientFee: null,
                memberParkingUnitFee: null,
                memberParkingUnitCount: null,
                parkingTaxPercent: null,
                serviceFeePercent: null,
                payrollCutoffStartDay: null,
                payrollCutoffEndDay: null,
                payrollTaxPercent: null,
              }),
          paymentTermsDays,
          bankAccountId,
          clientId: clientId || null,
          shiftCount,
        } as unknown as Prisma.ProjectUncheckedUpdateInput,
      });

      await syncProjectShifts(tx, id, shiftCount, shiftWindows);

      await tx.projectInvoicePeriod.updateMany({
        where: {
          projectId: id,
          invoicePdfPath: null,
          status: { in: ["ONGOING", "COMPILING"] },
        },
        data: { bankAccountId },
      });

      // Drop unissued schedule rows when leaving milestone billing (safe; issued stay).
      if (leavingMilestone) {
        await tx.projectInvoicePeriod.deleteMany({
          where: {
            projectId: id,
            status: { in: ["ONGOING", "COMPILING"] },
            milestonePercent: { not: null },
          },
        });
      }
    });

    // Planning: staff is assigned at Move to In Progress — do not clear/rewrite here.
    if (!isPlanningProjectStatus(existing.status)) {
      const nextIds = await prisma.$transaction(async (tx) =>
        mergeBackupEmployeeIds(
          tx,
          id,
          await nextCrewIdsWithTeams(tx, {
            companyId: existing.companyId,
            projectId: id,
            subCategory,
            areaCatalogId,
            serviceArea,
            formData,
            extraEmployeeIds: employeeIds,
          })
        )
      );
      const previous = await prisma.projectAssignment.findMany({
        where: { projectId: id },
        select: { employeeId: true },
      });
      const previousIds = previous.map((row) => row.employeeId);
      const previousSet = new Set(previousIds);
      const nextSet = new Set(nextIds);
      const addedIds = nextIds.filter((employeeId) => !previousSet.has(employeeId));
      const removedIds = previousIds.filter(
        (employeeId) => !nextSet.has(employeeId)
      );

      if (addedIds.length > 0 || removedIds.length > 0) {
        await prisma.$transaction(async (tx) => {
          // Kept rows are left untouched so shiftStart/shiftEnd stay intact.
          if (removedIds.length > 0) {
            await releaseEmployeesFromProject(tx, id, removedIds);
          }
          if (addedIds.length > 0) {
            await assertProjectStaffAssignable(tx, existing.companyId, addedIds, {
              excludeProjectId: id,
              ...staffAssignableOptions(subCategory),
            });
            await tx.projectAssignment.createMany({
              data: addedIds.map((employeeId) => ({
                projectId: id,
                employeeId,
              })),
              skipDuplicates: true,
            });
            await markEmployeesOnProject(tx, addedIds, existing.companyId);
            await stampEmployeeDepositSourceProject(tx, addedIds, {
              id,
              subCategory,
            });
          }
        });
      }
    }

    revalidatePath(PROJECT_LIST_VIEW_PATHS.all);
    revalidatePath(PROJECT_LIST_VIEW_PATHS.planning);
    revalidatePath(PROJECT_LIST_VIEW_PATHS.inProgress);
    revalidatePath(PROJECT_LIST_VIEW_PATHS.pendingApproval);
    revalidatePath(PROJECT_LIST_VIEW_PATHS.paymentDue);
    revalidatePath(PROJECT_LIST_VIEW_PATHS.completed);
    revalidatePath(`/projects/${id}`);
    revalidatePath("/dashboard");
    revalidatePath("/clients");
    revalidatePath("/billing");
    revalidatePath("/employees");
    revalidatePath("/users");
    revalidatePath("/shifts", "layout");
    revalidatePath("/cico");
    revalidatePath("/progress");
  } catch (error) {
    throw toActionError(error, "Failed to update project.");
  }
}

export async function assignProjectStaff(formData: FormData) {
  try {
    const session = await requireModule("projects");
    if (session.user.clientId) {
      throw new Error("Client portal users cannot assign staff.");
    }
    const permissionUser = toPermissionUser(session);
    if (!canManageProjects(permissionUser)) {
      throw new Error("Permission denied.");
    }
    const companyId = session.user.companyId;
    if (!companyId) throw new Error("Company not found.");

    const id = String(formData.get("projectId") ?? "").trim();
    if (!id) throw new Error("Select a project.");
    const employeeIds = formData.getAll("employeeIds").map(String);

    const existing = await prisma.project.findFirst({
      where: { id, companyId },
      select: {
        status: true,
        companyId: true,
        subCategory: true,
        serviceArea: true,
        areaCatalogId: true,
      },
    });
    if (!existing) throw new Error("Project not found.");
    await assertSessionCanWriteProject(session, {
      id,
      serviceArea: existing.serviceArea,
    });
    if (isPlanningProjectStatus(existing.status)) {
      throw new Error("Assign staff after the project is In Progress.");
    }

    const nextIds = await prisma.$transaction(async (tx) =>
      mergeBackupEmployeeIds(
        tx,
        id,
        await nextCrewIdsWithTeams(tx, {
          companyId: existing.companyId,
          projectId: id,
          subCategory: existing.subCategory,
          areaCatalogId: existing.areaCatalogId,
          serviceArea: existing.serviceArea,
          formData,
          extraEmployeeIds: employeeIds,
        })
      )
    );
    const previous = await prisma.projectAssignment.findMany({
      where: { projectId: id },
      select: { employeeId: true },
    });
    const previousIds = previous.map((row) => row.employeeId);
    const previousSet = new Set(previousIds);
    const nextSet = new Set(nextIds);
    const addedIds = nextIds.filter((employeeId) => !previousSet.has(employeeId));
    const removedIds = previousIds.filter(
      (employeeId) => !nextSet.has(employeeId)
    );

    if (addedIds.length > 0 || removedIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        if (removedIds.length > 0) {
          await releaseEmployeesFromProject(tx, id, removedIds);
        }
        if (addedIds.length > 0) {
          await assertProjectStaffAssignable(tx, existing.companyId, addedIds, {
            excludeProjectId: id,
            ...staffAssignableOptions(existing.subCategory),
          });
          await tx.projectAssignment.createMany({
            data: addedIds.map((employeeId) => ({
              projectId: id,
              employeeId,
            })),
            skipDuplicates: true,
          });
          await markEmployeesOnProject(tx, addedIds, existing.companyId);
          await stampEmployeeDepositSourceProject(tx, addedIds, {
            id,
            subCategory: existing.subCategory,
          });
        }
      });
    }

    revalidatePath(`/projects/${id}`);
    revalidatePath("/projects");
    revalidatePath("/employees");
    revalidatePath("/shifts", "layout");
    revalidatePath("/cico");
    revalidatePath("/progress");
  } catch (error) {
    throw toActionError(error, "Failed to assign staff.");
  }
}

/**
 * Permanently deletes a project (active, Payment Due, or history).
 * Cascades assignments, invoice periods, progress reports/photos; removes PDFs.
 * No recycle bin — irreversible.
 * Planning / In Progress / legacy On Hold: admin accounts only (enforced here).
 */
export async function deleteProject(id: string) {
  const session = await requireModule("projects");
  if (session.user.clientId) {
    throw new Error("Client portal users cannot delete projects.");
  }

  const project = await prisma.project.findFirst({
    where: {
      id,
      companyId: session.user.companyId,
    },
    select: projectDeleteSelect,
  });

  if (!project) {
    throw new Error("Project not found.");
  }
  await assertSessionCanWriteProject(session, project);

  if (
    isInProgressCleaningProjectDeleteBlocked({
      status: project.status,
      subCategory: project.subCategory,
    })
  ) {
    throw new Error(
      getInProgressCleaningProjectDeleteBlockReason({
        status: project.status,
        subCategory: project.subCategory,
      }) ?? "In Progress cleaning projects cannot be deleted."
    );
  }

  if (isAdminDeletableProjectStatus(project.status)) {
    const mayDelete = canDeleteActiveStageProjects({
      ...toPermissionUser(session),
      username: session.user.username,
      employee: session.user.employee,
    });
    if (!mayDelete) {
      throw new Error(
        "Only administrators can delete Planning or In Progress projects."
      );
    }
  }

  return permanentlyDeleteProject(project);
}

/**
 * Permanently deletes Completed Projects entries by id.
 * Only COMPLETED + fully paid projects for the company are removed.
 * Payment Due and active/ongoing projects are left intact.
 */
export async function clearProjectHistory(ids: string[]) {
  const session = await requireModule("projects");
  if (session.user.clientId) {
    throw new Error("Client portal users cannot delete completed projects.");
  }

  const uniqueIds = [...new Set(ids.map(String).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { deletedCount: 0 };
  }

  const projects = await prisma.project.findMany({
    where: {
      id: { in: uniqueIds },
      companyId: session.user.companyId,
      ...projectHistoryWhere(),
    },
    select: projectDeleteSelect,
  });

  if (projects.length === 0) {
    return { deletedCount: 0 };
  }

  const historyIds = projects.map((project) => project.id);
  const filePaths = projects.flatMap((project) =>
    collectProjectUploadPaths(project)
  );

  await prisma.$transaction(async (tx) => {
    await tx.attendance.updateMany({
      where: { projectId: { in: historyIds } },
      data: { projectId: null },
    });
    await tx.project.deleteMany({
      where: {
        id: { in: historyIds },
        companyId: session.user.companyId,
      },
    });
  });

  await Promise.all(filePaths.map((filePath) => deleteLocalUpload(filePath)));

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/clients");
  revalidatePath("/billing");
  for (const project of projects) {
    revalidatePath(`/projects/${project.id}`);
    if (project.clientId) {
      revalidatePath(`/billing/${project.clientId}`);
      revalidatePath(`/billing/${project.clientId}/${project.id}`);
    }
  }

  return {
    deletedCount: projects.length,
    names: projects.map((project) => project.name),
  };
}

export type FinishProjectResult = {
  invoice: {
    compiled: number;
    error: string | null;
    billingPath: string | null;
    periodLabel?: string | null;
  };
};

export type ReconcileProjectResult = {
  reconcile: {
    reconciled: number;
    error: string | null;
    billingPath: string | null;
    periodLabel?: string | null;
  };
};

function revalidateAfterProjectLifecycle(opts: {
  projectId: string;
  clientId: string | null;
}) {
  // Bust All + stage lists so Planning drops IN_PROGRESS immediately.
  revalidatePath(PROJECT_LIST_VIEW_PATHS.all);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.planning);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.inProgress);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.pendingApproval);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.paymentDue);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.completed);
  revalidatePath(`/projects/${opts.projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/billing");
  revalidatePath("/clients");
  revalidatePath("/employees");
  revalidatePath("/users");
  revalidatePath("/shifts", "layout");
  revalidatePath("/cico");
  revalidatePath("/progress");
  if (opts.clientId) {
    revalidatePath(`/billing/${opts.clientId}`);
    revalidatePath(`/billing/${opts.clientId}/${opts.projectId}`);
  }
}

/**
 * Regular Cleaning only: mark the earliest due cycle reconciled so staff can
 * submit the invoice. Does not end the contract or issue the invoice.
 */
export async function reconcileCurrentMonth(
  id: string
): Promise<ReconcileProjectResult> {
  const session = await requireModule("projects");
  if (session.user.clientId) {
    throw new Error("Client portal users cannot reconcile projects.");
  }

  const project = await prisma.project.findFirst({
    where: {
      id,
      companyId: session.user.companyId,
    },
    select: {
      id: true,
      status: true,
      clientId: true,
      subCategory: true,
      billingMode: true,
    },
  });
  if (!project) {
    throw new Error("Project not found.");
  }
  if (!isContractSubCategory(project.subCategory)) {
    throw new Error("Reconcile is only for Regular Cleaning contracts.");
  }
  if (project.status !== "IN_PROGRESS") {
    throw new Error("Only In Progress contracts can be reconciled this way.");
  }

  const billingPath = project.clientId
    ? `/billing/${project.clientId}/${id}`
    : "/billing";

  let reconciled = 0;
  let periodLabel: string | null = null;
  let reconcileError: string | null = null;

  try {
    const result = await reconcileDueInvoiceForProject(id);
    reconciled = result.reconciled;
    periodLabel = result.periodLabel;
  } catch (error) {
    reconcileError =
      error instanceof Error
        ? error.message
        : "Failed to reconcile billing period.";
  }

  revalidateAfterProjectLifecycle({
    projectId: id,
    clientId: project.clientId,
  });

  return {
    reconcile: {
      reconciled,
      error: reconcileError,
      billingPath,
      periodLabel,
    },
  };
}

/**
 * Regular Cleaning only: compile/send the due anniversary-cycle invoice without
 * ending the contract. The project stays active; the period goes to Payment Due.
 * Requires the due cycle to be reconciled first.
 */
export async function invoiceCurrentMonth(
  id: string
): Promise<FinishProjectResult> {
  const session = await requireModule("projects");
  if (session.user.clientId) {
    throw new Error("Client portal users cannot invoice projects.");
  }

  const project = await prisma.project.findFirst({
    where: {
      id,
      companyId: session.user.companyId,
    },
    select: {
      id: true,
      status: true,
      clientId: true,
      subCategory: true,
      billingMode: true,
    },
  });
  if (!project) {
    throw new Error("Project not found.");
  }
  if (!isContractSubCategory(project.subCategory)) {
    throw new Error(
      "Invoice this month is only for Regular Cleaning contracts."
    );
  }
  if (project.status === "COMPLETED") {
    throw new Error("This contract has already ended.");
  }
  if (project.status === "CANCELLED") {
    throw new Error("Cancelled projects cannot be invoiced.");
  }
  if (isPlanningProjectStatus(project.status)) {
    throw new Error(
      "Receive the work order to start this project before invoicing."
    );
  }
  if (project.status !== "IN_PROGRESS") {
    throw new Error("Only In Progress contracts can be invoiced this month.");
  }

  const billingPath = project.clientId
    ? `/billing/${project.clientId}/${id}`
    : "/billing";

  let compiled = 0;
  let periodLabel: string | null = null;
  let invoiceError: string | null = null;

  try {
    const issued = await issueInvoiceForCurrentMonth(id);
    compiled = issued.compiled;
    periodLabel = issued.periodLabel;
  } catch (error) {
    invoiceError =
      error instanceof Error
        ? error.message
        : "Failed to compile and send invoice.";
  }

  revalidateAfterProjectLifecycle({
    projectId: id,
    clientId: project.clientId,
  });

  return {
    invoice: {
      compiled,
      error: invoiceError,
      billingPath,
      periodLabel,
    },
  };
}

/**
 * Planning → In Progress when the client issues a work order.
 * Requires real contract/job dates from the Move to In Progress dialog.
 * Optionally assigns staff from the same dialog (or skips via assignStaffLater).
 * For Regular Cleaning: stores startDate, derives invoicing day, opens cycle 1.
 * Preserves estimatedStartDate.
 */
export async function startProject(
  id: string,
  formData: FormData
): Promise<void> {
  const session = await requireModule("projects");
  if (session.user.clientId) {
    throw new Error("Client portal users cannot start projects.");
  }

  const project = await prisma.project.findFirst({
    where: {
      id,
      companyId: session.user.companyId,
    },
    select: {
      id: true,
      status: true,
      clientId: true,
      subCategory: true,
      endDate: true,
      estimatedStartDate: true,
      estimatedDurationDays: true,
      billingMode: true,
      billingPeriodBasis: true,
      billingCycleStartDay: true,
      billingCycleEndDay: true,
      payrollCutoffEndDay: true,
      serviceArea: true,
      areaCatalogId: true,
    },
  });
  if (!project) {
    throw new Error("Project not found.");
  }
  await assertSessionCanWriteProject(session, project);
  if (!isPlanningProjectStatus(project.status)) {
    throw new Error("Only Planning projects can move to In Progress.");
  }

  const isContract = isContractSubCategory(project.subCategory);
  const isService = isServiceProjectSubCategory(project.subCategory);
  const isMonthTimeline = usesMonthDurationTimeline(project.subCategory);
  const { startDate, endDate: formEndDate } = parseProjectDateRange(formData);
  const formDurationDays = parseDurationDays(formData);
  const isMultiVisit = project.billingMode === "MULTI_VISIT";
  const assignStaffLater =
    isMultiVisit ||
    String(formData.get("assignStaffLater") ?? "").trim() === "true";
  const employeeIds = [
    ...new Set(formData.getAll("employeeIds").map(String).filter(Boolean)),
  ];

  if (!startDate) {
    throw new Error(
      isContract || isMonthTimeline || isService
        ? "Real contract start date is required."
        : "Real project start date is required."
    );
  }

  const contractProof = formData.get("contractProof");
  if (!(contractProof instanceof File) || contractProof.size === 0) {
    throw new Error(
      "Signed contract proof is required before moving to In Progress."
    );
  }
  const contractDocumentUrl = await saveUpload(
    contractProof,
    "contract-proofs",
    { fileBaseName: `contract_${id.slice(0, 8)}` }
  );

  let endDate = formEndDate;
  if (isContract || isService || isMonthTimeline) {
    // Keep planned contract end from Planning when the dialog does not send one.
    endDate = formEndDate ?? project.endDate;
    if (
      (isContract ||
        project.subCategory === "SECURITY" ||
        project.subCategory === "PAYROLL_MANAGEMENT") &&
      !endDate
    ) {
      throw new Error("Contract end date is required.");
    }
    if (
      project.subCategory === "PAYROLL_MANAGEMENT" &&
      endDate &&
      project.payrollCutoffEndDay != null
    ) {
      endDate = snapDateToCutoffDay(endDate, project.payrollCutoffEndDay);
    }
  } else if (!endDate) {
    throw new Error("Estimated project completion date is required.");
  }

  const estimatedDurationDays =
    isContract || isService
      ? null
      : resolveEstimatedDurationDays({
          formDurationDays,
          startDate,
          endDate,
          existing: project.estimatedDurationDays,
          // Keep the planning estimate when present; backfill only if missing.
          preserveExisting: true,
        });

  const companyId = session.user.companyId;
  if (!companyId) throw new Error("Company not found.");
  const startCrewIds = !assignStaffLater
    ? await prisma.$transaction((tx) =>
        nextCrewIdsWithTeams(tx, {
          companyId,
          projectId: id,
          subCategory: project.subCategory,
          areaCatalogId: project.areaCatalogId,
          serviceArea: project.serviceArea,
          formData,
          extraEmployeeIds: employeeIds,
        })
      )
    : [];
  if (!assignStaffLater && startCrewIds.length > 0) {
    await assertProjectStaffAssignable(prisma, companyId, startCrewIds, {
      excludeProjectId: id,
      ...staffAssignableOptions(project.subCategory),
    });
  }

  const contractStart = toUtcDateOnly(startDate);
  const usesMonthlyContractPeriods =
    isContract || project.subCategory === "SECURITY";
  const billingPeriodBasis =
    project.billingPeriodBasis ??
    (usesMonthlyContractPeriods ? "CONTRACT_CYCLE" : null);
  const invoicingDay = usesMonthlyContractPeriods
    ? billingPeriodBasis === "CALENDAR_MONTH"
      ? 1
      : project.billingCycleEndDay
        ? invoicingDayFromCycleToDay(project.billingCycleEndDay)
        : invoicingDayFromContractStart(contractStart)
    : undefined;

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        startDate: contractStart,
        endDate,
        contractDocumentUrl,
        ...(usesMonthlyContractPeriods && !project.billingPeriodBasis
          ? { billingPeriodBasis: "CONTRACT_CYCLE" }
          : {}),
        // Never clear the planning estimate.
        estimatedStartDate: project.estimatedStartDate ?? contractStart,
        ...(isContract || isService ? {} : { estimatedDurationDays }),
        ...(invoicingDay != null ? { invoicingDay } : {}),
      },
    });

    // Regular + Security: open the first billing period immediately.
    // Parking / Payroll Management never create invoice periods.
    if (
      usesInvoicePeriods(project.subCategory) &&
      project.billingMode === "MONTHLY"
    ) {
      const first = firstMonthlyPeriodBounds(
        billingPeriodBasis,
        contractStart,
        {
          fromDay: project.billingCycleStartDay,
          toDay: project.billingCycleEndDay,
        }
      );
      await tx.projectInvoicePeriod.upsert({
        where: {
          projectId_periodStart_periodEnd: {
            projectId: id,
            periodStart: first.periodStart,
            periodEnd: first.periodEnd,
          },
        },
        update: { label: first.label },
        create: {
          projectId: id,
          periodStart: first.periodStart,
          periodEnd: first.periodEnd,
          label: first.label,
          status: "ONGOING",
        },
      });
    }

    // Assign staff when provided; "Assign staff later" leaves existing assignments.
    if (!assignStaffLater && startCrewIds.length > 0) {
      const keptCrewIds = await mergeBackupEmployeeIds(tx, id, startCrewIds);
      const previous = await tx.projectAssignment.findMany({
        where: { projectId: id },
        select: { employeeId: true },
      });
      const previousIds = previous.map((row) => row.employeeId);
      const nextSet = new Set(keptCrewIds);
      const removedIds = previousIds.filter((employeeId) => !nextSet.has(employeeId));
      if (removedIds.length > 0) {
        await releaseEmployeesFromProject(tx, id, removedIds);
      }
      await tx.projectAssignment.createMany({
        data: startCrewIds.map((employeeId) => ({
          projectId: id,
          employeeId,
        })),
        skipDuplicates: true,
      });
      await markEmployeesOnProject(tx, startCrewIds, companyId);
      await stampEmployeeDepositSourceProject(tx, startCrewIds, {
        id,
        subCategory: project.subCategory,
      });
    }

    if (isMultiVisit) {
      await syncVisitCrewOccupancy(tx, {
        companyId,
        projectId: id,
      });
    }
  });

  revalidateAfterProjectLifecycle({
    projectId: id,
    clientId: project.clientId,
  });
  revalidatePath("/employees");
  revalidatePath("/users");
  revalidatePath("/shifts", "layout");
  revalidatePath("/teams");
  revalidatePath("/teams/availability");
}

/**
 * In Progress → Planning (revert before finish / collection).
 * Blocked when unpaid or compiling invoices exist (Payment Due).
 * Keeps estimatedStartDate, startDate, and endDate (no data loss).
 */
export async function moveProjectToPlanning(id: string): Promise<void> {
  const session = await requireModule("projects");
  if (session.user.clientId) {
    throw new Error("Client portal users cannot change project status.");
  }

  const project = await prisma.project.findFirst({
    where: {
      id,
      companyId: session.user.companyId,
    },
    select: {
      id: true,
      status: true,
      clientId: true,
      subCategory: true,
      serviceArea: true,
      invoicePeriods: {
        where: {
          status: { in: ["AWAITING_PAYMENT", "OVERDUE", "PENDING_VERIFICATION", "COMPILING"] },
        },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!project) {
    throw new Error("Project not found.");
  }
  await assertSessionCanWriteProject(session, project);
  if (project.subCategory === "INTERNAL") {
    throw new Error("Internal projects stay In Progress and cannot move to Planning.");
  }
  if (project.status !== "IN_PROGRESS") {
    throw new Error("Only In Progress projects can move back to Planning.");
  }
  if (project.invoicePeriods.length > 0) {
    throw new Error(
      "This project has invoices awaiting payment. Resolve Payment Due before moving back to Planning."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: { status: PROJECT_PLANNING_STATUS },
    });
    await releaseAllProjectCrew(tx, id);
  });

  revalidateAfterProjectLifecycle({
    projectId: id,
    clientId: project.clientId,
  });
  revalidatePath("/employees");
  revalidatePath("/users");
  revalidatePath("/shifts", "layout");
  revalidatePath("/cico");
  revalidatePath("/progress");
}

/**
 * Ends / finishes a project: removes it from In Progress by marking COMPLETED,
 * issues outstanding invoices, and moves it onto Payment Due → Completed
 * Projects once paid. This is the supported close path for In Progress Regular
 * Cleaning (End Contract) — hard Delete is blocked while In Progress.
 * Also used for General / Facade Finish. Planning must start (work order) first.
 */
export async function finishProject(
  id: string,
  formData?: FormData
): Promise<FinishProjectResult> {
  const session = await requireModule("projects");
  if (session.user.clientId) {
    throw new Error("Client portal users cannot finish projects.");
  }

  const project = await prisma.project.findFirst({
    where: {
      id,
      companyId: session.user.companyId,
    },
    select: {
      id: true,
      status: true,
      clientId: true,
      subCategory: true,
      startDate: true,
      endDate: true,
      billingMode: true,
      contractPrice: true,
      requiresTaxInvoice: true,
      serviceArea: true,
      invoicePeriods: {
        select: {
          id: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          reconciledAt: true,
          taxInvoiceRequired: true,
          taxInvoiceDoneAt: true,
        },
      },
    },
  });
  if (!project) {
    throw new Error("Project not found.");
  }
  await assertSessionCanWriteProject(session, project);
  if (project.status === "COMPLETED") {
    throw new Error("Project is already finished.");
  }
  if (project.status === "CANCELLED") {
    throw new Error("Cancelled projects cannot be finished.");
  }
  if (isPlanningProjectStatus(project.status)) {
    throw new Error(
      "Receive the work order to start this project before finishing."
    );
  }
  if (isMilestoneSubCategory(project.subCategory)) {
    throw new Error(
      "General Cleaning, Facade Cleaning, and One-Time Landscaping complete after the client approves the last part and the last invoice is marked paid. Use Submit for Approval — do not finish the project manually."
    );
  }

  const hasUnpaidIssued = project.invoicePeriods.some((period) =>
    (UNPAID_INVOICE_STATUSES as readonly string[]).includes(period.status)
  );
  if (hasUnpaidIssued) {
    throw new Error("SETTLE_UNPAID_BEFORE_CLOSE");
  }

  if (isExtendableContractSubCategory(project.subCategory)) {
    return endContractCycleEarly(session.user.id, project, formData);
  }

  const hasOpenClientReview = project.invoicePeriods.some(
    (period) => period.status === "AWAITING_CLIENT_REVIEW"
  );
  if (hasOpenClientReview) {
    throw new Error("CLIENT_REVIEW_BEFORE_CLOSE");
  }

  if (project.billingMode === "MONTHLY") {
    const now = new Date();
    const hasDueUnreconciled = project.invoicePeriods.some((period) =>
      isMonthlyPeriodAwaitingReconcile(
        {
          status: period.status,
          periodEnd: period.periodEnd,
          reconciledAt: period.reconciledAt,
        },
        now
      )
    );
    if (hasDueUnreconciled) {
      throw new Error("RECONCILE_DUE_BEFORE_CLOSE");
    }
  }

  const hasOpenTaxInvoice = project.invoicePeriods.some(
    (period) =>
      period.taxInvoiceDoneAt == null &&
      [
        "AWAITING_PAYMENT",
        "OVERDUE",
        "PENDING_VERIFICATION",
        "PAID",
      ].includes(period.status)
  );
  if (hasOpenTaxInvoice) {
    throw new Error(
      "Upload and verify all required tax invoices before ending the contract or completing the project."
    );
  }

  const isContract = isContractSubCategory(project.subCategory);
  // General/Facade: record actual completion day so completed page can show real days.
  const actualEndDate =
    !isContract && project.startDate
      ? parseOptionalDateInput(todayDateInput(), "completion date")
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: {
        status: "COMPLETED",
        ...(actualEndDate ? { endDate: actualEndDate } : {}),
      },
    });
    // End Contract / Finish: release all crew → Unassigned (AVAILABLE) + portal.
    await releaseAllProjectCrew(tx, id);
  });

  const billingPath = project.clientId
    ? `/billing/${project.clientId}/${id}`
    : "/billing";

  let compiled = 0;
  let invoiceError: string | null = null;

  try {
    const issued = await issueInvoicesForFinishedProject(id);
    compiled = issued.compiled;
  } catch (error) {
    invoiceError =
      error instanceof Error
        ? error.message
        : "Failed to compile and send invoice.";
  }

  revalidateAfterProjectLifecycle({
    projectId: id,
    clientId: project.clientId,
  });
  revalidatePath("/employees");
  revalidatePath("/users");
  revalidatePath("/shifts", "layout");

  return {
    invoice: {
      compiled,
      error: invoiceError,
      billingPath,
    },
  };
}

/**
 * Mutual-approval flow — General / Facade via Submit for Approval; Regular
 * Cleaning via reconcile → client + HO review (see sendPeriodForClientReview).
 * OM+ clicks "Submit for Approval": compiles all progress reports into a PDF,
 * sends the package for Approve or Revise, and transitions the project from
 * In Progress → Waiting for Approval.
 *
 * The client-approve / revise / HO-review cycle is handled by the existing
 * billing/reconciliation actions (clientApproveBillingReview, etc.).
 * On client approve of the final GC/Facade part, clientApproveBillingReview will:
 *   - release crew + equipment (they return to the company)
 *   - auto-issue the invoice (period → AWAITING_PAYMENT)
 *   - keep the project In Progress until the last invoice is Mark Paid
 * Intermediate milestone approve keeps crew assigned. Regular/Security stay
 * assigned until contract end.
 */
export async function submitProjectForApproval(projectId: string) {
  const locale = await getServerLocale();
  try {
    const session = await requireModule("projects");
    if (session.user.clientId || session.user.vendorId) {
      throw new Error(translate(locale, "pages.projects.permissionDenied"));
    }
    const permissionUser = toPermissionUser(session);
    if (!canManageProjects(permissionUser)) {
      throw new Error(translate(locale, "pages.projects.permissionDenied"));
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: session.user.companyId },
      select: {
        id: true,
        name: true,
        status: true,
        subCategory: true,
        billingMode: true,
        startDate: true,
        endDate: true,
        clientId: true,
        serviceArea: true,
        contractPrice: true,
        invoicePeriods: {
          where: {
            status: { in: ["ONGOING", "COMPILING", "AWAITING_CLIENT_REVIEW"] },
          },
          orderBy: { periodStart: "asc" },
          select: {
            id: true,
            status: true,
            milestonePercent: true,
            periodStart: true,
            periodEnd: true,
          },
        },
      },
    });

    if (!project) throw new Error(translate(locale, "pages.projects.notFound"));
    await assertSessionCanWriteProject(session, project);

    if (isRgsInternalProject(project)) {
      throw new Error(
        translate(locale, "pages.projects.submitForApproval.internalNotAllowed")
      );
    }

    if (isContractSubCategory(project.subCategory)) {
      throw new Error(
        translate(locale, "pages.projects.submitForApproval.regularNotAllowed")
      );
    }

    if (!isMilestoneSubCategory(project.subCategory)) {
      throw new Error(
        translate(locale, "pages.projects.submitForApproval.notAllowed")
      );
    }

    if (project.status !== "IN_PROGRESS") {
      throw new Error(
        translate(locale, "pages.projects.submitForApproval.inProgressOnly")
      );
    }

    const today = toUtcDateOnly(new Date());

    // Find or create the invoice period to attach this review to.
    let periodId: string;

    if (project.billingMode === "MULTI_VISIT") {
      const nextVisit = await prisma.projectVisit.findFirst({
        where: { projectId: project.id, invoicePeriodId: null },
        orderBy: { visitIndex: "asc" },
      });
      if (!nextVisit) {
        throw new Error("Every visit already has a billing pack.");
      }
      const created = await prisma.projectInvoicePeriod.upsert({
        where: {
          projectId_periodStart_periodEnd: {
            projectId: project.id,
            periodStart: nextVisit.startDate,
            periodEnd: nextVisit.endDate,
          },
        },
        update: {
          label: `Visit ${nextVisit.visitIndex}`,
          amount: nextVisit.amount,
        },
        create: {
          projectId: project.id,
          periodStart: nextVisit.startDate,
          periodEnd: nextVisit.endDate,
          label: `Visit ${nextVisit.visitIndex}`,
          amount: nextVisit.amount,
          status: "ONGOING",
        },
      });
      await prisma.projectVisit.update({
        where: { id: nextVisit.id },
        data: { invoicePeriodId: created.id },
      });
      periodId = created.id;
    } else if (project.billingMode === "MILESTONE") {
      // Milestone: use the first ongoing milestone period.
      const ongoingMilestone = project.invoicePeriods.find(
        (p) => p.status === "ONGOING"
      );
      if (!ongoingMilestone) {
        const periodStart = project.startDate
          ? toUtcDateOnly(project.startDate)
          : today;
        const created = await prisma.projectInvoicePeriod.create({
          data: {
            projectId: project.id,
            periodStart,
            periodEnd: project.endDate
              ? toUtcDateOnly(project.endDate)
              : periodStart,
            label: "Milestone 1",
            status: "ONGOING",
            amount: decimalToNumber(project.contractPrice) ?? 0,
            milestonePercent: 100,
          },
        });
        periodId = created.id;
      } else {
        periodId = ongoingMilestone.id;
      }
    } else {
      // ON_COMPLETION: find or create a single completion period.
      const existing = project.invoicePeriods.find(
        (p) => p.status === "ONGOING" || p.status === "COMPILING"
      );

      if (existing) {
        periodId = existing.id;
        // Ensure label matches completion period convention.
        await prisma.projectInvoicePeriod.update({
          where: { id: existing.id },
          data: { label: "Completion" },
        });
      } else {
        const periodStart = project.startDate
          ? toUtcDateOnly(project.startDate)
          : today;
        const periodEnd =
          project.endDate
            ? toUtcDateOnly(project.endDate)
            : today.getTime() >= periodStart.getTime()
              ? today
              : periodStart;

        const created = await prisma.projectInvoicePeriod.upsert({
          where: {
            projectId_periodStart_periodEnd: {
              projectId: project.id,
              periodStart,
              periodEnd,
            },
          },
          update: { label: "Completion" },
          create: {
            projectId: project.id,
            periodStart,
            periodEnd,
            label: "Completion",
            status: "ONGOING",
          },
        });
        periodId = created.id;
      }
    }

    // Compile PRs into PDF + send to client for review (reuse existing billing action).
    const { sendPeriodForClientReview } = await import(
      "@/app/billing/reconciliation/actions"
    );
    await sendPeriodForClientReview(periodId, "PROGRESS");

    await prisma.project.update({
      where: { id: project.id },
      data: { status: "WAITING_FOR_APPROVAL" },
    });

    revalidateAfterProjectLifecycle({ projectId, clientId: project.clientId });

    return { periodId };
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.projects.submitForApproval.failed")
    );
  }
}

/**
 * Lengthen an In Progress Regular contract end date ("Extend To").
 * Requires extension proof; stores history without Extended By.
 */
export async function extendProjectContract(id: string, formData: FormData) {
  try {
    const session = await requireModule("projects");
    if (session.user.clientId) {
      throw new Error("Client portal users cannot extend contracts.");
    }

    const project = await prisma.project.findFirst({
      where: { id, companyId: session.user.companyId },
      select: {
        id: true,
        status: true,
        clientId: true,
        subCategory: true,
        endDate: true,
        serviceArea: true,
      },
    });
    if (!project) throw new Error("Project not found.");
    await assertSessionCanWriteProject(session, project);
    if (!isExtendableContractSubCategory(project.subCategory)) {
      throw new Error(
        "Only Regular Cleaning, Security, Parking, and Payroll Management contracts can be extended."
      );
    }
    if (project.status !== "IN_PROGRESS") {
      throw new Error("Only In Progress contracts can be extended.");
    }
    if (!project.endDate) {
      throw new Error("Contract end date is missing.");
    }

    const { endDate: extendTo } = parseProjectDateRange(formData);
    if (!extendTo) {
      throw new Error("Extend To date is required.");
    }
    const previousEnd = toUtcDateOnly(project.endDate);
    const nextEnd = toUtcDateOnly(extendTo);
    if (nextEnd.getTime() <= previousEnd.getTime()) {
      throw new Error("Extend To must be after the current contract end date.");
    }

    const proof = formData.get("extensionProof");
    if (!(proof instanceof File) || proof.size === 0) {
      throw new Error("Extension proof is required.");
    }
    const proofUrl = await saveUpload(proof, "contract-extensions", {
      fileBaseName: `extend_${id.slice(0, 8)}`,
    });
    const notes = String(formData.get("notes") ?? "").trim() || null;

    await prisma.$transaction(async (tx) => {
      await tx.clientContractExtension.create({
        data: {
          projectId: id,
          previousEndDate: previousEnd,
          newEndDate: nextEnd,
          proofUrl,
          notes,
        },
      });
      await tx.project.update({
        where: { id },
        data: { endDate: nextEnd },
      });
    });

    revalidateAfterProjectLifecycle({
      projectId: id,
      clientId: project.clientId,
    });
  } catch (error) {
    throw toActionError(error, "Failed to extend contract.");
  }
}

async function prepareLastContractPeriod(options: {
  projectId: string;
  startDate: Date;
  lastDay: Date;
}): Promise<string> {
  const periods = await prisma.projectInvoicePeriod.findMany({
    where: { projectId: options.projectId },
    select: {
      id: true,
      status: true,
      periodStart: true,
      periodEnd: true,
    },
    orderBy: { periodStart: "asc" },
  });

  const futureOngoingIds = periods
    .filter(
      (period) =>
        period.status === "ONGOING" &&
        period.periodStart.getTime() > options.lastDay.getTime()
    )
    .map((period) => period.id);
  if (futureOngoingIds.length > 0) {
    await prisma.projectInvoicePeriod.deleteMany({
      where: { id: { in: futureOngoingIds } },
    });
  }

  const remaining = periods.filter(
    (period) => !futureOngoingIds.includes(period.id)
  );
  const overlapping = remaining.find(
    (period) =>
      period.periodStart.getTime() <= options.lastDay.getTime() &&
      period.periodEnd.getTime() >= options.lastDay.getTime()
  );
  if (overlapping) {
    if (
      overlapping.status === "ONGOING" ||
      overlapping.status === "COMPILING" ||
      overlapping.status === "AWAITING_CLIENT_REVIEW"
    ) {
      await prisma.projectInvoicePeriod.update({
        where: { id: overlapping.id },
        data: {
          periodEnd: options.lastDay,
          label: "Final period",
        },
      });
    }
    return overlapping.id;
  }

  const previous = [...remaining]
    .filter((period) => period.periodEnd.getTime() < options.lastDay.getTime())
    .sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime())[0];
  const periodStart = previous
    ? addUtcDays(previous.periodEnd, 1)
    : options.startDate;
  if (periodStart.getTime() > options.lastDay.getTime()) {
    throw new Error("Last day is before the current billing period.");
  }

  const created = await prisma.projectInvoicePeriod.upsert({
    where: {
      projectId_periodStart_periodEnd: {
        projectId: options.projectId,
        periodStart,
        periodEnd: options.lastDay,
      },
    },
    update: { label: "Final period", status: "ONGOING" },
    create: {
      projectId: options.projectId,
      periodStart,
      periodEnd: options.lastDay,
      label: "Final period",
      status: "ONGOING",
    },
  });
  return created.id;
}

async function endContractCycleEarly(
  userId: string,
  project: {
    id: string;
    clientId: string | null;
    startDate: Date | null;
    endDate: Date | null;
    subCategory: string;
    contractPrice: Parameters<typeof decimalToNumber>[0];
  },
  formData?: FormData
): Promise<FinishProjectResult> {
  const lastMonthRaw = String(formData?.get("lastMonth") ?? "").trim();
  const lastMonthMatch = /^(\d{4})-(\d{2})$/.exec(lastMonthRaw);
  const lastDayFromMonth = lastMonthMatch
    ? new Date(
        Date.UTC(Number(lastMonthMatch[1]), Number(lastMonthMatch[2]), 0)
      )
    : null;
  const lastDay =
    lastDayFromMonth ??
    parseOptionalDateInput(String(formData?.get("lastDay") ?? ""), "last day");
  if (!lastDay) {
    throw new Error(
      project.subCategory === "PARKING"
        ? "Pick the last month of the parking contract."
        : "Enter the real last day on site."
    );
  }
  if (!project.startDate) {
    throw new Error("Set the contract start date before ending the contract.");
  }

  const start = toUtcDateOnly(project.startDate);
  const plannedEnd = project.endDate ? toUtcDateOnly(project.endDate) : null;
  const last = toUtcDateOnly(lastDay);
  if (last.getTime() < start.getTime()) {
    throw new Error("Last day cannot be before the contract start.");
  }
  if (plannedEnd && last.getTime() > plannedEnd.getTime()) {
    throw new Error(
      "Last day cannot be after the planned contract end. Use Extend Contract."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: project.id },
      data: { endDate: last, pendingEarlyEndReconcile: true },
    });
    await releaseAllProjectCrew(tx, project.id);
  });

  if (usesInvoicePeriods(project.subCategory)) {
    await prepareLastContractPeriod({
      projectId: project.id,
      startDate: start,
      lastDay: last,
    });
  }

  const billingPath = project.clientId
    ? `/billing/${project.clientId}/${project.id}`
    : "/billing";
  const finalized = await finalizePendingEarlyEndIfDue({
    projectId: project.id,
    userId,
    lastDay: last,
    clientId: project.clientId,
    contractPrice: project.contractPrice,
  });
  const invoiceError = finalized.error;

  revalidateAfterProjectLifecycle({
    projectId: project.id,
    clientId: project.clientId,
  });

  return {
    invoice: {
      compiled: 0,
      error: invoiceError,
      billingPath,
    },
  };
}

/**
 * After a Regular / Security job is Completed: same client and site, new dates,
 * new signed agreement. Old invoices stay. New periods open. Crew is re-assigned
 * separately.
 */
export async function renewProjectContract(id: string, formData: FormData) {
  const session = await requireModule("projects");
  if (session.user.clientId) {
    throw new Error("Client portal users cannot renew contracts.");
  }

  const project = await prisma.project.findFirst({
    where: { id, companyId: session.user.companyId },
    select: {
      id: true,
      status: true,
      clientId: true,
      subCategory: true,
      billingPeriodBasis: true,
      billingCycleStartDay: true,
      billingCycleEndDay: true,
      serviceArea: true,
    },
  });
  if (!project) throw new Error("Project not found.");
  await assertSessionCanWriteProject(session, project);
  if (!isExtendableContractSubCategory(project.subCategory)) {
    throw new Error(
      "Only Regular Cleaning, Security, Parking, and Payroll Management contracts can be renewed this way."
    );
  }
  if (project.status !== "COMPLETED") {
    throw new Error("Contract Renewed is only for a completed job.");
  }

  const { startDate, endDate } = parseProjectDateRange(formData);
  if (!startDate || !endDate) {
    throw new Error("New start date and end date are required.");
  }
  const nextStart = toUtcDateOnly(startDate);
  const nextEnd = toUtcDateOnly(endDate);
  if (nextEnd.getTime() <= nextStart.getTime()) {
    throw new Error("New end date must be after the new start date.");
  }

  const proof = formData.get("agreement");
  if (!(proof instanceof File) || proof.size === 0) {
    throw new Error("Upload the new signed agreement.");
  }
  const contractDocumentUrl = await saveUpload(proof, "contract-documents", {
    fileBaseName: `renew_${id.slice(0, 8)}`,
  });

  await prisma.project.update({
    where: { id },
    data: {
      status: "IN_PROGRESS",
      startDate: nextStart,
      endDate: nextEnd,
      contractDocumentUrl,
    },
  });

  if (usesInvoicePeriods(project.subCategory)) {
    const first = firstMonthlyPeriodBounds(
      project.billingPeriodBasis,
      nextStart,
      {
        fromDay: project.billingCycleStartDay,
        toDay: project.billingCycleEndDay,
      }
    );
    await prisma.projectInvoicePeriod.upsert({
      where: {
        projectId_periodStart_periodEnd: {
          projectId: id,
          periodStart: first.periodStart,
          periodEnd: first.periodEnd,
        },
      },
      update: { label: first.label, status: "ONGOING" },
      create: {
        projectId: id,
        periodStart: first.periodStart,
        periodEnd: first.periodEnd,
        label: first.label,
        status: "ONGOING",
      },
    });
  }

  revalidateAfterProjectLifecycle({
    projectId: id,
    clientId: project.clientId,
  });
}

/**
 * After a General / Facade job is Completed: same client and site, new start,
 * new signed paper, reassigned crew. Old invoices stay. Not Contract Renew.
 */
export async function redoProjectJob(id: string, formData: FormData) {
  const session = await requireModule("projects");
  if (session.user.clientId) {
    throw new Error("Client portal users cannot re-do jobs.");
  }

  const project = await prisma.project.findFirst({
    where: { id, companyId: session.user.companyId },
    select: {
      id: true,
      status: true,
      clientId: true,
      subCategory: true,
      billingMode: true,
      companyId: true,
      serviceArea: true,
      areaCatalogId: true,
      invoicePeriods: {
        select: { milestonePercent: true },
      },
    },
  });
  if (!project) throw new Error("Project not found.");
  await assertSessionCanWriteProject(session, project);
  if (!isRedoJobSubCategory(project.subCategory)) {
    throw new Error(
      "Re-do Job is only for General Cleaning, Facade Cleaning, and One-Time Landscaping."
    );
  }
  if (project.status !== "COMPLETED") {
    throw new Error("Re-do Job is only for a completed job.");
  }

  const startDate = parseOptionalDateInput(
    String(formData.get("startDate") ?? ""),
    "start date"
  );
  if (!startDate) throw new Error("New start date is required.");
  const nextStart = toUtcDateOnly(startDate);
  const durationDays = clampProjectDurationDays(
    Number(String(formData.get("durationDays") ?? ""))
  );
  const nextEnd = addUtcDays(nextStart, durationDays);

  const proof = formData.get("agreement");
  if (!(proof instanceof File) || proof.size === 0) {
    throw new Error("Upload the new signed paper.");
  }
  const contractDocumentUrl = await saveUpload(proof, "contract-documents", {
    fileBaseName: `redo_${id.slice(0, 8)}`,
  });

  const extras = [
    ...new Set(formData.getAll("employeeIds").map(String).filter(Boolean)),
  ];

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        startDate: nextStart,
        endDate: nextEnd,
        estimatedStartDate: nextStart,
        estimatedDurationDays: durationDays,
        contractDocumentUrl,
      },
    });

    if (project.billingMode === "MILESTONE") {
      const percentCount = [
        ...new Set(
          project.invoicePeriods
            .map((period) => period.milestonePercent)
            .filter((value): value is number => value != null)
        ),
      ].length;
      await createMilestoneSchedulePeriods(tx, {
        projectId: id,
        startDate: nextStart,
        installmentPercents: splitEvenlyPercents(
          percentCount >= 2 ? percentCount : 2
        ),
        contractPrice: null,
      });
    }

    if (project.billingMode === "MULTI_VISIT") {
      await tx.projectVisit.deleteMany({
        where: { projectId: id, invoicePeriodId: null },
      });
      const hasVisitFields = formData.getAll("visitStart").some((value) =>
        String(value ?? "").trim()
      );
      if (hasVisitFields) {
        const visits = parseProjectVisitsFromForm(formData, null);
        await tx.projectVisit.createMany({
          data: visits.map((visit) => ({
            projectId: id,
            visitIndex: visit.visitIndex,
            startDate: visit.startDate,
            endDate: visit.endDate,
            amount: visit.amount,
          })),
        });
      }
    }

    await releaseAllProjectCrew(tx, id);

    if (project.billingMode !== "MULTI_VISIT") {
      const nextIds = await nextCrewIdsWithTeams(tx, {
        companyId: project.companyId,
        projectId: id,
        subCategory: project.subCategory,
        areaCatalogId: project.areaCatalogId,
        serviceArea: project.serviceArea,
        formData,
        extraEmployeeIds: extras,
      });
      if (nextIds.length > 0) {
        await assertProjectStaffAssignable(tx, project.companyId, nextIds, {
          excludeProjectId: id,
          ...staffAssignableOptions(project.subCategory),
        });
        await tx.projectAssignment.createMany({
          data: nextIds.map((employeeId) => ({
            projectId: id,
            employeeId,
          })),
        });
        await markEmployeesOnProject(tx, nextIds, project.companyId);
        await stampEmployeeDepositSourceProject(tx, nextIds, {
          id,
          subCategory: project.subCategory,
        });
      }
    }
  });

  revalidateAfterProjectLifecycle({
    projectId: id,
    clientId: project.clientId,
  });
}

async function requireSiteCoverAccess(projectId: string) {
  const session = await requireModule("projects");
  if (session.user.clientId || session.user.vendorId) {
    throw new Error("Permission denied.");
  }
  const permissionUser = toPermissionUser(session);
  if (!canManageProjects(permissionUser)) {
    throw new Error("Permission denied.");
  }
  if (!projectId) throw new Error("Select a project.");

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: session.user.companyId },
    select: {
      id: true,
      name: true,
      status: true,
      companyId: true,
      serviceArea: true,
    },
  });
  if (!project) throw new Error("Project not found.");

  await assertCanApproveProjectServiceArea({
    userId: session.user.id,
    username: session.user.username,
    permissionUser,
    projectServiceArea: project.serviceArea,
    projectId: project.id,
  });

  return { session, project };
}

function revalidateSiteCoverPaths(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/billing/petty-cash");
  revalidatePath("/billing/payroll");
  revalidatePath("/billing/financial-report");
  revalidatePath("/cico");
  revalidatePath("/shifts", "layout");
}

export async function assignBackupEmployee(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const { session, project } = await requireSiteCoverAccess(projectId);
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  const coveringShiftId = String(formData.get("coveringShiftId") ?? "").trim();
  const coveredEmployeeId = String(formData.get("coveredEmployeeId") ?? "").trim();
  const startRaw = String(formData.get("backupStartDate") ?? "").trim();
  const endRaw = String(formData.get("backupEndDate") ?? "").trim();
  const dailyRate = parsePettyCashAmount(String(formData.get("dailyRate") ?? ""));

  if (!employeeId) throw new Error("Select a part-time employee.");
  if (!coveringShiftId || !coveredEmployeeId) {
    throw new Error("Select which shift this backup will cover.");
  }
  if (coveredEmployeeId === employeeId) {
    throw new Error("The backup cannot cover their own shift.");
  }

  const start = parseDateInput(startRaw);
  const end = parseDateInput(endRaw);
  if (start.getTime() > end.getTime()) {
    throw new Error("Backup end date must be on or after the start date.");
  }

  if (!isProjectOpenForSiteWork(project.status)) {
    throw new Error("Assign a backup only while the project is open for site work.");
  }

  const coveringShift = await prisma.projectShift.findFirst({
    where: { id: coveringShiftId, projectId },
    select: { id: true, startTime: true, endTime: true },
  });
  if (!coveringShift) {
    throw new Error("Select a shift on this project.");
  }

  const coveredAssignment = await prisma.projectAssignment.findFirst({
    where: {
      projectId,
      employeeId: coveredEmployeeId,
      isBackup: false,
      shiftId: coveringShift.id,
      employee: {
        companyId: session.user.companyId,
        employmentType: "FULL_TIME",
      },
    },
    select: { id: true },
  });
  if (!coveredAssignment) {
    throw new Error(
      "That shift belongs to a regular employee on this site. Assign staff to shifts under Human Resources → Shifts first."
    );
  }

  const overlappingDoubleShift = await prisma.doubleShiftAssignment.findFirst({
    where: {
      projectId,
      coveringShiftId: coveringShift.id,
      date: { gte: start, lte: end },
    },
    select: { id: true },
  });
  if (overlappingDoubleShift) {
    throw new Error(
      "A regular employee already has a double shift covering this shift in these dates. Remove that double shift first, or keep it instead of a backup."
    );
  }

  const overlappingBackup = await prisma.projectAssignment.findFirst({
    where: {
      projectId,
      isBackup: true,
      OR: [
        { shiftId: coveringShift.id },
        { coveredEmployeeId },
      ],
      backupStartDate: { lte: end },
      backupEndDate: { gte: start },
    },
    select: { id: true },
  });
  if (overlappingBackup) {
    throw new Error(
      "A part-time backup already covers this shift in these dates. Remove that backup first."
    );
  }

  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      ...partTimeRosterWhere(session.user.companyId),
    },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) {
    throw new Error("Select an available part-time employee.");
  }

  await prisma.$transaction(async (tx) => {
    await assertEmployeesNotOnOtherProject(tx, session.user.companyId, [employeeId], {
      excludeProjectId: projectId,
      message: "This employee is already assigned to another project.",
    });

    const existing = await tx.projectAssignment.findUnique({
      where: { projectId_employeeId: { projectId, employeeId } },
    });
    if (existing) {
      throw new Error("This employee is already assigned to this project.");
    }

    const assignment = await tx.projectAssignment.create({
      data: {
        projectId,
        employeeId,
        isBackup: true,
        shiftId: coveringShift.id,
        shiftStart: coveringShift.startTime,
        shiftEnd: coveringShift.endTime,
        coveredEmployeeId,
        backupStartDate: start,
        backupEndDate: end,
        dailyRate,
      },
    });

    await schedulePartTimePays({
      db: tx,
      companyId: session.user.companyId,
      projectId,
      employeeId,
      assignmentId: assignment.id,
      createdById: session.user.id,
      projectName: project.name,
      employeeFirstName: employee.firstName,
      employeeLastName: employee.lastName,
      dailyRate,
      start,
      end,
    });

    await markEmployeesOnProject(tx, [employeeId], session.user.companyId);
  });

  revalidateSiteCoverPaths(projectId);
}

export async function unassignBackupEmployee(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const { session } = await requireSiteCoverAccess(projectId);
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  if (!employeeId) {
    throw new Error("Select the backup assignment to remove.");
  }

  const assignment = await prisma.projectAssignment.findFirst({
    where: {
      projectId,
      employeeId,
      isBackup: true,
      project: { companyId: session.user.companyId },
    },
    select: { id: true },
  });
  if (!assignment) {
    throw new Error("Backup assignment not found.");
  }

  await prisma.$transaction(async (tx) => {
    await voidScheduledPartTimePays(tx, {
      projectId,
      employeeIds: [employeeId],
    });
    await releaseEmployeesFromProject(tx, projectId, [employeeId]);
  });

  revalidateSiteCoverPaths(projectId);
}

export async function assignDoubleShift(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const { session, project } = await requireSiteCoverAccess(projectId);
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "").trim();

  if (!employeeId) throw new Error("Select a regular employee.");
  if (!dateRaw) throw new Error("Select the double shift date.");

  if (!isProjectOpenForSiteWork(project.status)) {
    throw new Error(
      "Assign a double shift only while the project is open for site work."
    );
  }

  const date = parseDateInput(dateRaw);

  const assignment = await prisma.projectAssignment.findFirst({
    where: {
      projectId,
      employeeId,
      isBackup: false,
      employee: {
        companyId: session.user.companyId,
        employmentType: "FULL_TIME",
        status: "ACTIVE",
      },
    },
    select: { id: true, shiftId: true },
  });
  if (!assignment) {
    throw new Error("Select a regular employee already assigned to this site.");
  }

  const coveringShiftId = String(formData.get("coveringShiftId") ?? "").trim();
  const coveredEmployeeId = String(formData.get("coveredEmployeeId") ?? "").trim();
  if (!coveringShiftId || !coveredEmployeeId) {
    throw new Error("Select which shift this employee will take over.");
  }
  if (coveredEmployeeId === employeeId) {
    throw new Error("The covering employee cannot take over their own shift.");
  }

  const coveringShift = await prisma.projectShift.findFirst({
    where: { id: coveringShiftId, projectId },
    select: { id: true, number: true },
  });
  if (!coveringShift) {
    throw new Error("Select a shift on this project.");
  }
  if (assignment.shiftId && assignment.shiftId === coveringShift.id) {
    throw new Error("Choose a different shift from the one they already work.");
  }

  const coveredAssignment = await prisma.projectAssignment.findFirst({
    where: {
      projectId,
      employeeId: coveredEmployeeId,
      isBackup: false,
      shiftId: coveringShift.id,
      employee: {
        companyId: session.user.companyId,
        employmentType: "FULL_TIME",
      },
    },
    select: { id: true },
  });
  if (!coveredAssignment) {
    throw new Error(
      "That shift belongs to another regular employee on this site. Assign staff to shifts under Human Resources → Shifts first."
    );
  }

  const onLeave = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: "APPROVED",
      startDate: { lte: date },
      endDate: { gte: date },
    },
    select: { id: true },
  });
  if (onLeave) {
    throw new Error("This employee is on approved leave that day.");
  }

  const existing = await prisma.doubleShiftAssignment.findFirst({
    where: { employeeId, date },
    select: { id: true, projectId: true },
  });
  if (existing) {
    throw new Error("This employee already has a double shift on that date.");
  }

  const existingCover = await prisma.doubleShiftAssignment.findFirst({
    where: { projectId, coveringShiftId: coveringShift.id, date },
    select: { id: true },
  });
  if (existingCover) {
    throw new Error("Someone already covers that shift on this date.");
  }

  const backupCovering = await prisma.projectAssignment.findFirst({
    where: {
      projectId,
      isBackup: true,
      OR: [
        { shiftId: coveringShift.id },
        { coveredEmployeeId },
      ],
      backupStartDate: { lte: date },
      backupEndDate: { gte: date },
    },
    select: { id: true },
  });
  if (backupCovering) {
    throw new Error(
      "A part-time backup already covers this shift on that date. Remove the backup first, or keep the backup instead of a double shift."
    );
  }

  await prisma.doubleShiftAssignment.create({
    data: {
      projectId,
      employeeId,
      date,
      coveringShiftId: coveringShift.id,
      coveredEmployeeId,
      assignedById: session.user.id,
    },
  });

  revalidateSiteCoverPaths(projectId);
}

export async function unassignDoubleShift(formData: FormData) {
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  if (!assignmentId) {
    throw new Error("Select the double shift to remove.");
  }

  const existing = await prisma.doubleShiftAssignment.findFirst({
    where: { id: assignmentId },
    select: { id: true, projectId: true },
  });
  if (!existing) {
    throw new Error("Double shift assignment not found.");
  }

  await requireSiteCoverAccess(existing.projectId);
  await prisma.doubleShiftAssignment.delete({ where: { id: existing.id } });
  revalidateSiteCoverPaths(existing.projectId);
}

export async function saveProjectVisitAssignment(formData: FormData) {
  const session = await requireModule("projects");
  if (session.user.clientId || session.user.vendorId) {
    throw new Error("Permission denied.");
  }
  if (!canManageProjects(toPermissionUser(session))) {
    throw new Error("Permission denied.");
  }
  const companyId = session.user.companyId;
  if (!companyId) throw new Error("Company not found.");

  const visitId = String(formData.get("visitId") ?? "").trim();
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim();
  if (!visitId) throw new Error("Visit not found.");

  const locale = await getServerLocale();
  const visit = await prisma.projectVisit.findFirst({
    where: { id: visitId, project: { companyId } },
    select: { projectId: true, project: { select: { clientId: true, serviceArea: true } } },
  });
  if (!visit) throw new Error("Visit not found.");
  await assertSessionCanWriteProject(session, {
    id: visit.projectId,
    serviceArea: visit.project.serviceArea,
  });

  await prisma.$transaction(async (tx) => {
    await replaceProjectVisitAssignment(tx, {
      companyId,
      visitId,
      employeeId: employeeId || null,
      teamId: teamId || null,
      locale,
    });
  });

  revalidateAfterProjectLifecycle({
    projectId: visit.projectId,
    clientId: visit.project.clientId,
  });
  revalidatePath("/teams");
  revalidatePath("/teams/availability");
}

export async function clearProjectVisitAssignment(formData: FormData) {
  const session = await requireModule("projects");
  if (session.user.clientId || session.user.vendorId) {
    throw new Error("Permission denied.");
  }
  if (!canManageProjects(toPermissionUser(session))) {
    throw new Error("Permission denied.");
  }
  const companyId = session.user.companyId;
  if (!companyId) throw new Error("Company not found.");

  const visitId = String(formData.get("visitId") ?? "").trim();
  if (!visitId) throw new Error("Visit not found.");

  const locale = await getServerLocale();
  const visit = await prisma.projectVisit.findFirst({
    where: { id: visitId, project: { companyId } },
    select: { projectId: true, project: { select: { clientId: true, serviceArea: true } } },
  });
  if (!visit) throw new Error("Visit not found.");
  await assertSessionCanWriteProject(session, {
    id: visit.projectId,
    serviceArea: visit.project.serviceArea,
  });

  await prisma.$transaction(async (tx) => {
    await clearProjectVisitAssignmentRow(tx, {
      companyId,
      visitId,
      locale,
    });
  });

  revalidateAfterProjectLifecycle({
    projectId: visit.projectId,
    clientId: visit.project.clientId,
  });
  revalidatePath("/teams");
  revalidatePath("/teams/availability");
}
