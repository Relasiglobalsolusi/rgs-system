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
  isCommercialProjectSubCategory,
  isProjectSubCategory,
  isServiceProjectSubCategory,
  serviceAreaForSubCategory,
  subCategoryForServiceArea,
} from "@/lib/project-subcategory";
import {
  clampProjectDurationDays,
  daysBetweenDates,
  isContractSubCategory,
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
} from "@/lib/project-billing";
import {
  clampInvoicingDay,
  firstMonthlyPeriodBounds,
  invoicingDayFromContractStart,
  isMonthlyPeriodAwaitingReconcile,
  parseBillingPeriodBasis,
  PAYMENT_TERMS_DAYS_OPTIONS,
  toUtcDateOnly,
  type PaymentTermsDaysOption,
} from "@/lib/invoice-period";
import { taxInvoiceDefaultsFromClient } from "@/lib/npwp";
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
  canDeleteActiveStageProjects,
  canManageProjects,
  getInProgressCleaningProjectDeleteBlockReason,
  isAdminDeletableProjectStatus,
  isInProgressCleaningProjectDeleteBlocked,
} from "@/lib/project-access";
import {
  isPlanningProjectStatus,
  PROJECT_LIST_VIEW_PATHS,
  PROJECT_PLANNING_STATUS,
} from "@/lib/project-status";
import type { BillingMode, ProjectStatus } from "@prisma/client";
import {
  assertEmployeesNotOnOtherProject,
  assertProjectCrewEligible,
  markEmployeesOnProject,
  releaseAllProjectCrew,
  releaseEmployeesFromProject,
} from "@/lib/workforce-crew";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { DEFAULT_LOCATION_RADIUS_METERS } from "@/lib/geo";
import { resolveProjectSiteCoordinates } from "@/lib/project-site-location";

const projectDeleteSelect = {
  id: true,
  name: true,
  clientId: true,
  status: true,
  subCategory: true,
  invoicePeriods: {
    select: {
      invoicePdfPath: true,
      paymentProofPath: true,
      taxInvoiceDocumentPath: true,
    },
  },
  progressReports: { select: { photos: { select: { url: true } } } },
} as const;

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
  }
) {
  const conflictMessages = await projectStaffConflictMessages();
  await assertProjectCrewEligible(
    db,
    companyId,
    employeeIds,
    options?.crewErrorMessage,
    { allowInHouseCleaning: options?.allowInHouseCleaning }
  );
  await assertEmployeesNotOnOtherProject(db, companyId, employeeIds, {
    excludeProjectId: options?.excludeProjectId,
    message: conflictMessages.generic,
    messageForProject: conflictMessages.forProject,
  });
}

type ProjectDeleteFiles = {
  invoicePeriods: {
    invoicePdfPath: string | null;
    paymentProofPath: string | null;
    taxInvoiceDocumentPath: string | null;
  }[];
  progressReports: { photos: { url: string }[] }[];
};

function collectProjectUploadPaths(project: ProjectDeleteFiles) {
  const paths: string[] = [];
  for (const period of project.invoicePeriods) {
    if (period.invoicePdfPath) paths.push(period.invoicePdfPath);
    if (period.paymentProofPath) paths.push(period.paymentProofPath);
    if (period.taxInvoiceDocumentPath) paths.push(period.taxInvoiceDocumentPath);
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
  revalidatePath("/shifts");
  revalidatePath("/cico");
  revalidatePath("/attendance");
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
  revalidatePath("/shifts");
  revalidatePath("/cico");
  revalidatePath("/attendance");

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
  const locationRadiusMeters =
    Number(radiusRaw) || DEFAULT_LOCATION_RADIUS_METERS;

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
 * Non-cleaning areas lock a 1:1 subcategory; Cleaning requires a commercial cleaning type.
 */
function resolveSubCategoryAndServiceArea(formData: FormData) {
  const serviceArea = parseServiceArea(formData.get("serviceArea"));
  const lockedSub = subCategoryForServiceArea(serviceArea);
  if (lockedSub) {
    return { subCategory: lockedSub, serviceArea };
  }

  const subCategory = parseSubCategory(formData);
  if (!isCommercialProjectSubCategory(subCategory)) {
    throw new Error("Choose a cleaning subcategory for Cleaning projects.");
  }
  return {
    subCategory,
    serviceArea: serviceAreaForSubCategory(subCategory),
  };
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
  if (amount == null || amount < 0) {
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

type ServiceCommercialFields = {
  contractPrice: number | null;
  setupCost: number | null;
  profitSharePercent: number | null;
  monthlyClientFee: number | null;
  serviceFeePercent: number | null;
  paymentTermsDays: number | null;
};

function parseServiceCommercialFields(
  formData: FormData,
  subCategory: string,
  clientPaymentTermsDays: number
): ServiceCommercialFields {
  const empty: ServiceCommercialFields = {
    contractPrice: null,
    setupCost: null,
    profitSharePercent: null,
    monthlyClientFee: null,
    serviceFeePercent: null,
    paymentTermsDays: null,
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
    };
  }

  if (subCategory === "PAYROLL_MANAGEMENT") {
    return {
      ...empty,
      serviceFeePercent: parsePercentField(formData, "serviceFeePercent", {
        required: true,
        label: "Service fee %",
      }),
      paymentTermsDays: parseProjectPaymentTermsDays(
        formData,
        clientPaymentTermsDays
      ),
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
      },
    });
  }
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
    const { subCategory, serviceArea } =
      resolveSubCategoryAndServiceArea(formData);
    const { location, latitude, longitude, locationRadiusMeters } =
      await parseLocationFields(formData);
    const billingMode = resolveBillingMode(formData, subCategory);
    const { invoicingDay } = billingDefaults(subCategory, billingMode);
    const isContract = isContractSubCategory(subCategory);
    const isService = isServiceProjectSubCategory(subCategory);
    const isMonthTimeline = usesMonthDurationTimeline(subCategory);
    const billingPeriodBasis = isContract
      ? parseBillingPeriodBasis(formData.get("billingPeriodBasis")) ??
        "CONTRACT_CYCLE"
      : null;

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

    // Month-timeline services (Security/Parking) and Regular use contract-style dates.
    // Payroll: start required; end optional. GC/Facade: day duration required.
    const requiresEndDate =
      (!isContract && !isService && !isMonthTimeline) ||
      subCategory === "SECURITY" ||
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
          isContract || subCategory === "SECURITY"
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
          isContract || subCategory === "SECURITY"
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
      select: { id: true, npwp: true, paymentTermsDays: true },
    });
    if (!client) {
      throw new Error(
        "Client not found or is deleted. Choose an active client."
      );
    }
    const { requiresTaxInvoice } = taxInvoiceDefaultsFromClient(client);
    const serviceFields = isService
      ? parseServiceCommercialFields(
          formData,
          subCategory,
          client.paymentTermsDays
        )
      : null;

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
          // Cleaning contract price is set later in Invoice and Billing.
          // Security / Parking / Payroll store commercial terms at create.
          contractPrice: serviceFields?.contractPrice ?? null,
          setupCost: serviceFields?.setupCost ?? null,
          profitSharePercent: serviceFields?.profitSharePercent ?? null,
          monthlyClientFee: serviceFields?.monthlyClientFee ?? null,
          serviceFeePercent: serviceFields?.serviceFeePercent ?? null,
          paymentTermsDays: serviceFields?.paymentTermsDays ?? null,
          subCategory,
          serviceArea,
          requiresTaxInvoice,
          companyId: company.id,
          clientId,
          sortOrder,
        },
      });

      if (milestoneInstallments) {
        await createMilestoneSchedulePeriods(tx, {
          projectId: created.id,
          // Prefer real start; fall back to estimate for schedule anchoring.
          startDate: startDate ?? estimatedStartDate,
          installmentPercents: milestoneInstallments,
          contractPrice: null,
        });
      }

      // Regular In Progress create: open the first billing period immediately.
      // Security / Parking / Payroll never create ProjectInvoicePeriod rows.
      if (
        !isPlanning &&
        isContract &&
        billingMode === "MONTHLY" &&
        startDate
      ) {
        const first = firstMonthlyPeriodBounds(
          billingPeriodBasis,
          toUtcDateOnly(startDate)
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
          },
        });
      }

      // Planning: assign staff only when moving to In Progress (not at create).
      if (!isPlanning && employeeIds.length > 0) {
        await assertProjectStaffAssignable(tx, company.id, employeeIds, {
          excludeProjectId: created.id,
        });
        await tx.projectAssignment.createMany({
          data: employeeIds.map((employeeId) => ({
            projectId: created.id,
            employeeId,
          })),
          skipDuplicates: true,
        });
        await markEmployeesOnProject(tx, employeeIds, company.id);
      }

      return created;
    });

    revalidatePath("/projects");
    revalidatePath("/dashboard");
    revalidatePath("/clients");
    revalidatePath("/billing");
    revalidatePath("/employees");
    revalidatePath("/users");
    revalidatePath("/shifts");
  } catch (error) {
    throw toActionError(error, "Failed to create project.");
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
      },
    });
    if (!existing) {
      throw new Error("Project not found.");
    }

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
        const nextIds = [...new Set(employeeIds.filter(Boolean))];
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
                allowInHouseCleaning: true,
              });
              await tx.projectAssignment.createMany({
                data: addedIds.map((employeeId) => ({
                  projectId: id,
                  employeeId,
                })),
                skipDuplicates: true,
              });
              await markEmployeesOnProject(tx, addedIds, existing.companyId);
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
      revalidatePath("/attendance");
      return;
    }

    const { subCategory, serviceArea } =
      resolveSubCategoryAndServiceArea(formData);
    const billingMode = resolveBillingMode(
      formData,
      subCategory,
      existing.billingMode
    );
    const { invoicingDay } = billingDefaults(subCategory, billingMode);
    const isPlanning = isPlanningProjectStatus(existing.status);
    const isContract = isContractSubCategory(subCategory);
    const isService = isServiceProjectSubCategory(subCategory);
    const isMonthTimeline = usesMonthDurationTimeline(subCategory);
    const billingPeriodBasis = isContract
      ? parseBillingPeriodBasis(formData.get("billingPeriodBasis")) ??
        "CONTRACT_CYCLE"
      : null;
    const requiresEndDate =
      (!isContract && !isService && !isMonthTimeline) ||
      subCategory === "SECURITY" ||
      isContract;

    let startDate = formStartDate;
    const endDate = formEndDate;
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
          isContract || subCategory === "SECURITY"
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
          isContract || subCategory === "SECURITY"
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

    // Ignore form tax fields — derive With/Without tax from the client NPWP.
    let requiresTaxInvoice = false;
    let clientPaymentTermsDays = 14;
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, companyId: existing.companyId, active: true },
        select: { id: true, npwp: true, paymentTermsDays: true },
      });
      if (!client) {
        throw new Error(
          "Client not found or is deleted. Choose an active client."
        );
      }
      requiresTaxInvoice = taxInvoiceDefaultsFromClient(client).requiresTaxInvoice;
      clientPaymentTermsDays = client.paymentTermsDays;
    }

    const serviceFields = isService
      ? parseServiceCommercialFields(
          formData,
          subCategory,
          existing.paymentTermsDays ?? clientPaymentTermsDays
        )
      : null;

    const leavingMilestone =
      existing.billingMode === "MILESTONE" && billingMode !== "MILESTONE";

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
          invoicingDay,
          billingMode,
          billingPeriodBasis,
          requiresTaxInvoice,
          // Milestone: preserve price set in billing. Service: persist form terms.
          // Cleaning non-milestone: clear contract price.
          ...(isService
            ? {
                contractPrice: serviceFields?.contractPrice ?? null,
                setupCost: serviceFields?.setupCost ?? null,
                profitSharePercent: serviceFields?.profitSharePercent ?? null,
                monthlyClientFee: serviceFields?.monthlyClientFee ?? null,
                serviceFeePercent: serviceFields?.serviceFeePercent ?? null,
                paymentTermsDays: serviceFields?.paymentTermsDays ?? null,
              }
            : isMilestoneSubCategory(subCategory)
              ? {
                  setupCost: null,
                  profitSharePercent: null,
                  monthlyClientFee: null,
                  serviceFeePercent: null,
                  paymentTermsDays: null,
                }
              : {
                  contractPrice: null,
                  setupCost: null,
                  profitSharePercent: null,
                  monthlyClientFee: null,
                  serviceFeePercent: null,
                  paymentTermsDays: null,
                }),
          clientId: clientId || null,
        },
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
      const nextIds = [...new Set(employeeIds.filter(Boolean))];
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
            });
            await tx.projectAssignment.createMany({
              data: addedIds.map((employeeId) => ({
                projectId: id,
                employeeId,
              })),
              skipDuplicates: true,
            });
            await markEmployeesOnProject(tx, addedIds, existing.companyId);
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
    revalidatePath("/shifts");
    revalidatePath("/cico");
    revalidatePath("/attendance");
  } catch (error) {
    throw toActionError(error, "Failed to update project.");
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
 * Permanently deletes a Completed Projects entry (COMPLETED + all invoices PAID).
 * Prefer deleteProject for active / Payment Due lists.
 */
export async function deleteProjectHistory(id: string) {
  const session = await requireModule("projects");
  if (session.user.clientId) {
    throw new Error("Client portal users cannot delete completed projects.");
  }

  const project = await prisma.project.findFirst({
    where: {
      id,
      companyId: session.user.companyId,
      ...projectHistoryWhere(),
    },
    select: projectDeleteSelect,
  });

  if (!project) {
    throw new Error(
      "Project not found in history, or it is still active / awaiting payment."
    );
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
  revalidatePath("/shifts");
  revalidatePath("/cico");
  revalidatePath("/attendance");
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
    },
  });
  if (!project) {
    throw new Error("Project not found.");
  }
  if (!isPlanningProjectStatus(project.status)) {
    throw new Error("Only Planning projects can move to In Progress.");
  }

  const isContract = isContractSubCategory(project.subCategory);
  const isService = isServiceProjectSubCategory(project.subCategory);
  const isMonthTimeline = usesMonthDurationTimeline(project.subCategory);
  const { startDate, endDate: formEndDate } = parseProjectDateRange(formData);
  const formDurationDays = parseDurationDays(formData);
  const assignStaffLater =
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
      (isContract || project.subCategory === "SECURITY") &&
      !endDate
    ) {
      throw new Error("Contract end date is required.");
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

  if (!assignStaffLater && employeeIds.length > 0) {
    const companyId = session.user.companyId;
    if (!companyId) throw new Error("Company not found.");
    await assertProjectStaffAssignable(prisma, companyId, employeeIds, {
      excludeProjectId: id,
    });
  }

  const contractStart = toUtcDateOnly(startDate);
  const billingPeriodBasis =
    project.billingPeriodBasis ?? (isContract ? "CONTRACT_CYCLE" : null);
  const invoicingDay = isContract
    ? billingPeriodBasis === "CALENDAR_MONTH"
      ? 1
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
        ...(isContract && !project.billingPeriodBasis
          ? { billingPeriodBasis: "CONTRACT_CYCLE" }
          : {}),
        // Never clear the planning estimate.
        estimatedStartDate: project.estimatedStartDate ?? contractStart,
        ...(isContract || isService ? {} : { estimatedDurationDays }),
        ...(invoicingDay != null ? { invoicingDay } : {}),
      },
    });

    // Regular Cleaning only: open the first billing period immediately.
    // Security / Parking / Payroll Management never create invoice periods.
    if (isContract && project.billingMode === "MONTHLY") {
      const first = firstMonthlyPeriodBounds(
        billingPeriodBasis,
        contractStart
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
    if (!assignStaffLater && employeeIds.length > 0) {
      const previous = await tx.projectAssignment.findMany({
        where: { projectId: id },
        select: { employeeId: true },
      });
      const previousIds = previous.map((row) => row.employeeId);
      const nextSet = new Set(employeeIds);
      const removedIds = previousIds.filter((employeeId) => !nextSet.has(employeeId));
      if (removedIds.length > 0) {
        await releaseEmployeesFromProject(tx, id, removedIds);
      }
      await tx.projectAssignment.createMany({
        data: employeeIds.map((employeeId) => ({
          projectId: id,
          employeeId,
        })),
        skipDuplicates: true,
      });
      const companyId = session.user.companyId;
      if (companyId) {
        await markEmployeesOnProject(tx, employeeIds, companyId);
      }
    }
  });

  revalidateAfterProjectLifecycle({
    projectId: id,
    clientId: project.clientId,
  });
  revalidatePath("/employees");
  revalidatePath("/users");
  revalidatePath("/shifts");
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
  revalidatePath("/shifts");
  revalidatePath("/cico");
  revalidatePath("/attendance");
}

/**
 * Ends / finishes a project: removes it from In Progress by marking COMPLETED,
 * issues outstanding invoices, and moves it onto Payment Due → Completed
 * Projects once paid. This is the supported close path for In Progress Regular
 * Cleaning (End Contract) — hard Delete is blocked while In Progress.
 * Also used for General / Facade Finish. Planning must start (work order) first.
 */
export async function finishProject(id: string): Promise<FinishProjectResult> {
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
      billingMode: true,
      requiresTaxInvoice: true,
      invoicePeriods: {
        select: {
          id: true,
          status: true,
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

  const hasUnpaidIssued = project.invoicePeriods.some((period) =>
    (UNPAID_INVOICE_STATUSES as readonly string[]).includes(period.status)
  );
  if (hasUnpaidIssued) {
    throw new Error("SETTLE_UNPAID_BEFORE_CLOSE");
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

  const hasOpenTaxInvoice =
    project.requiresTaxInvoice &&
    project.invoicePeriods.some(
      (period) =>
        period.taxInvoiceRequired &&
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
  revalidatePath("/shifts");

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
 * On client approve, clientApproveBillingReview will:
 *   - release crew + equipment
 *   - auto-issue the invoice (period → AWAITING_PAYMENT)
 *   - project stays non-COMPLETED until fully paid (Payment Due workflow)
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

    if (project.subCategory === "INTERNAL") {
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

    if (project.billingMode === "MILESTONE") {
      // Milestone: use the first ongoing milestone period.
      const ongoingMilestone = project.invoicePeriods.find(
        (p) => p.status === "ONGOING"
      );
      if (!ongoingMilestone) {
        throw new Error(
          translate(
            locale,
            "pages.projects.submitForApproval.noOngoingMilestone"
          )
        );
      }
      periodId = ongoingMilestone.id;
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

    // Transition project to Waiting for Approval.
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "WAITING_FOR_APPROVAL" },
    });

    // Compile PRs into PDF + send to client for review (reuse existing billing action).
    const { sendPeriodForClientReview } = await import(
      "@/app/billing/reconciliation/actions"
    );
    await sendPeriodForClientReview(periodId, "PROGRESS");

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
      },
    });
    if (!project) throw new Error("Project not found.");
    if (!isContractSubCategory(project.subCategory)) {
      throw new Error("Only Regular Cleaning contracts can be extended.");
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
