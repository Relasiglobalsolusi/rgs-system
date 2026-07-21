"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  nextCompanyScopedSortOrder,
  persistCompanyScopedReorder,
} from "@/lib/persist-reorder";
import { projectHistoryWhere, UNPAID_INVOICE_STATUSES } from "@/lib/billing";
import { isProjectSubCategory } from "@/lib/project-subcategory";
import {
  clampProjectDurationDays,
  daysBetweenDates,
  isContractSubCategory,
  MAX_PROJECT_DURATION_DAYS,
  MIN_PROJECT_DURATION_DAYS,
  todayDateInput,
} from "@/lib/project-contract";
import {
  assertBillingModeForSubCategory,
  allowedBillingModesForSubCategory,
  buildMilestoneSchedule,
  defaultBillingMode,
  isBillingMode,
  isMilestoneSubCategory,
  parseMilestoneInstallmentsFromFormData,
} from "@/lib/project-billing";
import {
  clampInvoicingDay,
  firstMonthlyPeriodBounds,
  invoicingDayFromContractStart,
  isMonthlyPeriodAwaitingReconcile,
  parseBillingPeriodBasis,
  toUtcDateOnly,
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
  availableFullTimeCrewWhere,
  markEmployeesOnProject,
  partTimeRosterWhere,
} from "@/lib/workforce-crew";

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
  dailyProgress: { select: { photos: { select: { url: true } } } },
  progressReports: { select: { photos: { select: { url: true } } } },
} as const;

type ProjectDeleteFiles = {
  invoicePeriods: {
    invoicePdfPath: string | null;
    paymentProofPath: string | null;
    taxInvoiceDocumentPath: string | null;
  }[];
  dailyProgress: { photos: { url: string }[] }[];
  progressReports: { photos: { url: string }[] }[];
};

function collectProjectUploadPaths(project: ProjectDeleteFiles) {
  const paths: string[] = [];
  for (const period of project.invoicePeriods) {
    if (period.invoicePdfPath) paths.push(period.invoicePdfPath);
    if (period.paymentProofPath) paths.push(period.paymentProofPath);
    if (period.taxInvoiceDocumentPath) paths.push(period.taxInvoiceDocumentPath);
  }
  for (const day of project.dailyProgress) {
    for (const photo of day.photos) paths.push(photo.url);
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
  revalidatePath(PROJECT_LIST_VIEW_PATHS.paymentDue);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.completed);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.history);
  revalidatePath("/dashboard");
  revalidatePath("/clients");
  revalidatePath("/billing");
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

  return { id: project.id, name: project.name };
}

function parseLocationFields(formData: FormData) {
  const location = String(formData.get("location") ?? "").trim();
  const latitudeRaw = String(formData.get("latitude") ?? "").trim();
  const longitudeRaw = String(formData.get("longitude") ?? "").trim();
  const radiusRaw = String(formData.get("locationRadiusMeters") ?? "50").trim();

  const latitude = latitudeRaw ? Number(latitudeRaw) : null;
  const longitude = longitudeRaw ? Number(longitudeRaw) : null;
  const locationRadiusMeters = Number(radiusRaw) || 50;

  if (!location) throw new Error("Location address is required.");
  if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error("Set the site location on the map.");
  }

  return { location, latitude, longitude, locationRadiusMeters };
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
    const subCategory = parseSubCategory(formData);
    const serviceArea = parseServiceArea(formData.get("serviceArea"));
    const { location, latitude, longitude, locationRadiusMeters } =
      parseLocationFields(formData);
    const billingMode = resolveBillingMode(formData, subCategory);
    const { invoicingDay } = billingDefaults(subCategory, billingMode);
    const isContract = isContractSubCategory(subCategory);
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

    if (isPlanning) {
      estimatedStartDate = estimatedFromForm;
      if (!estimatedStartDate) {
        throw new Error(
          isContract
            ? "Contract start date is required."
            : "Estimated project start date is required."
        );
      }
      // Regular + General/Facade: keep duration-derived end as a planned horizon;
      // real start stays null until Move to In Progress.
      startDate = null;
      endDate = formEndDate;
      if (!isContract && !endDate) {
        throw new Error("Estimated project completion date is required.");
      }
      if (!isContract) {
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
          isContract
            ? "Contract start date is required."
            : "Project start date is required."
        );
      }
      if (!isContract && !endDate) {
        throw new Error("Estimated project completion date is required.");
      }
      estimatedStartDate = estimatedFromForm ?? startDate;
      if (!isContract) {
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
      where: { id: clientId, companyId: company.id },
      select: { id: true, npwp: true },
    });
    if (!client) throw new Error("Client not found.");
    const { requiresTaxInvoice } = taxInvoiceDefaultsFromClient(client);

    const project = await prisma.$transaction(async (tx) => {
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
          // Contract price is set later in Invoice and Billing for milestone projects.
          contractPrice: null,
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

      return created;
    });

    // Planning: assign staff only when moving to In Progress (not at create).
    if (!isPlanning && employeeIds.length > 0) {
      await prisma.projectAssignment.createMany({
        data: employeeIds.map((employeeId) => ({
          projectId: project.id,
          employeeId,
        })),
        skipDuplicates: true,
      });
    }

    revalidatePath("/projects");
    revalidatePath("/dashboard");
    revalidatePath("/clients");
    revalidatePath("/billing");
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
    const subCategory = parseSubCategory(formData);
    const serviceArea = parseServiceArea(formData.get("serviceArea"));
    const { location, latitude, longitude, locationRadiusMeters } =
      parseLocationFields(formData);
    // Payment schedule is create-only — Edit Project does not rebuild milestone periods.
    const existing = await prisma.project.findUnique({
      where: { id },
      select: {
        status: true,
        companyId: true,
        billingMode: true,
        estimatedDurationDays: true,
        estimatedStartDate: true,
        startDate: true,
      },
    });
    if (!existing) {
      throw new Error("Project not found.");
    }

    const billingMode = resolveBillingMode(
      formData,
      subCategory,
      existing.billingMode
    );
    const { invoicingDay } = billingDefaults(subCategory, billingMode);
    const isPlanning = isPlanningProjectStatus(existing.status);
    const isContract = isContractSubCategory(subCategory);
    const billingPeriodBasis = isContract
      ? parseBillingPeriodBasis(formData.get("billingPeriodBasis")) ??
        "CONTRACT_CYCLE"
      : null;

    let startDate = formStartDate;
    let endDate = formEndDate;
    let estimatedStartDate = existing.estimatedStartDate;
    let estimatedDurationDays: number | null | undefined =
      existing.estimatedDurationDays;

    if (isPlanning) {
      estimatedStartDate = estimatedFromForm ?? existing.estimatedStartDate;
      if (!estimatedStartDate) {
        throw new Error(
          isContract
            ? "Contract start date is required."
            : "Estimated project start date is required."
        );
      }
      // Planning keeps real start null; end is the duration-derived horizon.
      startDate = null;
      if (!isContract && !endDate) {
        throw new Error("Estimated project completion date is required.");
      }
      if (!isContract) {
        estimatedDurationDays = resolveEstimatedDurationDays({
          formDurationDays,
          startDate: estimatedStartDate,
          endDate,
          existing: existing.estimatedDurationDays,
        });
      }
    } else {
      if (!startDate) {
        throw new Error(
          isContract
            ? "Contract start date is required."
            : "Project start date is required."
        );
      }
      if (!isContract && !endDate) {
        throw new Error("Estimated project completion date is required.");
      }
      if (!isContract) {
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
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, companyId: existing.companyId },
        select: { id: true, npwp: true },
      });
      if (!client) throw new Error("Client not found.");
      requiresTaxInvoice = taxInvoiceDefaultsFromClient(client).requiresTaxInvoice;
    }

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
          estimatedDurationDays: isContract ? null : estimatedDurationDays,
          startDate,
          endDate,
          status: existing.status,
          subCategory,
          serviceArea,
          invoicingDay,
          billingMode,
          billingPeriodBasis,
          requiresTaxInvoice,
          // Preserve contractPrice when still milestone-eligible; clear otherwise.
          ...(isMilestoneSubCategory(subCategory) ? {} : { contractPrice: null }),
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
      await prisma.projectAssignment.deleteMany({ where: { projectId: id } });

      if (employeeIds.length > 0) {
        await prisma.projectAssignment.createMany({
          data: employeeIds.map((employeeId) => ({
            projectId: id,
            employeeId,
          })),
        });
      }
    }

    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    revalidatePath("/dashboard");
    revalidatePath("/clients");
    revalidatePath("/billing");
  } catch (error) {
    throw toActionError(error, "Failed to update project.");
  }
}

/**
 * Permanently deletes a project (active, Payment Due, or history).
 * Cascades assignments, invoice periods, progress reports/photos; removes PDFs.
 * No recycle bin — irreversible.
 * Planning / In Progress / On Hold: admin accounts only (enforced here).
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
  revalidatePath(PROJECT_LIST_VIEW_PATHS.paymentDue);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.completed);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.history);
  revalidatePath(`/projects/${opts.projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/billing");
  revalidatePath("/clients");
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
  const { startDate, endDate: formEndDate } = parseProjectDateRange(formData);
  const formDurationDays = parseDurationDays(formData);
  const assignStaffLater =
    String(formData.get("assignStaffLater") ?? "").trim() === "true";
  const employeeIds = [
    ...new Set(formData.getAll("employeeIds").map(String).filter(Boolean)),
  ];

  if (!startDate) {
    throw new Error(
      isContract
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
  if (isContract) {
    // Keep planned contract end from Planning when the dialog does not send one.
    endDate = formEndDate ?? project.endDate;
  } else if (!endDate) {
    throw new Error("Estimated project completion date is required.");
  }

  const estimatedDurationDays = isContract
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
    // Available FT crew (Operations Cleaning/GC) + Part Time Roster
    const validCount = await prisma.employee.count({
      where: {
        id: { in: employeeIds },
        OR: [
          availableFullTimeCrewWhere(companyId),
          partTimeRosterWhere(companyId),
        ],
      },
    });
    if (validCount !== employeeIds.length) {
      throw new Error(
        "Select Available full-time Operations crew (Cleaning/GC) and/or Part Time Roster staff only."
      );
    }
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
        ...(isContract
          ? {}
          : { estimatedDurationDays }),
        ...(invoicingDay != null ? { invoicingDay } : {}),
      },
    });

    // Regular Cleaning: open the first billing period immediately.
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
      await tx.projectAssignment.deleteMany({ where: { projectId: id } });
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
  if (project.status !== "IN_PROGRESS" && project.status !== "ON_HOLD") {
    throw new Error("Only In Progress projects can move back to Planning.");
  }
  if (project.invoicePeriods.length > 0) {
    throw new Error(
      "This project has invoices awaiting payment. Resolve Payment Due before moving back to Planning."
    );
  }

  await prisma.project.update({
    where: { id },
    data: { status: PROJECT_PLANNING_STATUS },
  });

  revalidateAfterProjectLifecycle({
    projectId: id,
    clientId: project.clientId,
  });
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

  await prisma.project.update({
    where: { id },
    data: {
      status: "COMPLETED",
      ...(actualEndDate ? { endDate: actualEndDate } : {}),
    },
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

  return {
    invoice: {
      compiled,
      error: invoiceError,
      billingPath,
    },
  };
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
