"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertCanApproveProjectServiceArea } from "@/lib/om-approval";
import { canAccess } from "@/lib/permissions";
import {
  requireSession,
  toPermissionUser,
} from "@/lib/session";
import { COMPANY_IDENTITY_SELECT } from "@/lib/company-for-pdf";
import { generateInvoicePeriodPdf } from "@/lib/progress-report-pdf";
import { overlayInvoiceCompanyBank } from "@/lib/company-bank-accounts";
import {
  parseRequiredTaxInvoiceSerial,
  requireTaxInvoiceSerialVerified,
} from "@/lib/tax-invoice-serial";
import { DEFAULT_PRODUCT_PPN_RATE_PERCENT } from "@/lib/vat";
import {
  commercialTaxIncludesIncomeTax,
  invoiceGrossFromExclusivePrice,
} from "@/lib/commercial-tax";
import {
  COMPLETION_INVOICE_LABEL,
  decimalToNumber,
  formatContractPrice,
  formatMilestoneScheduleLabel,
  isCompletionPeriodLabel,
  isMilestoneSubCategory,
  maxMilestonePercent,
  parseContractPrice,
  recalculateUnpaidMilestoneAmounts,
  usesInvoicePeriods,
} from "@/lib/project-billing";
import { isContractCycleSubCategory } from "@/lib/project-contract";
import { shouldCompleteProjectAfterSettlement } from "@/lib/project-settlement";
import { OPEN_COLLECTION_STATUSES } from "@/lib/billing";
import {
  customDayCyclePeriodBounds,
  dueAtFromClientPaymentTerms,
  invoiceIssueCalendarDate,
  isAnniversaryPeriodDue,
  isCalendarMonthPeriodBounds,
  isMonthlyPeriodAwaitingReconcile,
  isMonthlyPeriodReadyToSubmitInvoice,
  invoicingDayFromCycleToDay,
  matchingCustomDayCycleIndex,
  monthPeriodBounds,
  previousMonthPeriodBounds,
  resolveBillingCycleDays,
  resolveCustomDayCycleIndex,
  toUtcDateOnly,
} from "@/lib/invoice-period";
import {
  buildBillingDocumentFileBase,
  deleteLocalUpload,
  saveUpload,
} from "@/lib/upload";
import { PROJECT_LIST_VIEW_PATHS } from "@/lib/project-status";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import {
  canIssueCommercialInvoiceForProject,
  canIssueInvoiceAfterReview,
} from "@/lib/client-billing-review";
import {
  parseManualVerifyReason,
  parseOptionalManualVerifyReason,
} from "@/lib/in-house-document-verify";

const COMPANY_BANK_SELECT = COMPANY_IDENTITY_SELECT;

/** Reconstruct the commercial invoice number printed on the PDF. */
function commercialInvoiceNumber(period: {
  id: string;
  periodStart: Date;
  milestonePercent: number | null;
}): string {
  if (period.milestonePercent != null) {
    return `INV-M${String(period.milestonePercent).replace(".", "")}-${period.id
      .slice(-6)
      .toUpperCase()}`;
  }
  return `INV-${period.periodStart.getUTCFullYear()}${String(
    period.periodStart.getUTCMonth() + 1
  ).padStart(2, "0")}-${period.id.slice(-6).toUpperCase()}`;
}

/** Statuses that may be deleted (PAID is always blocked). */
const DELETABLE_INVOICE_PERIOD_STATUSES = [
  "ONGOING",
  "COMPILING",
  "AWAITING_CLIENT_REVIEW",
  "AWAITING_PAYMENT",
  "OVERDUE",
  "PENDING_VERIFICATION",
] as const;

const PAYMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
const PAYMENT_PROOF_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function requireImageOrPdfUpload(
  value: FormDataEntryValue | null,
  opts: { requiredMessage: string; sizeMessage: string; typeMessage: string }
): File {
  if (!(value instanceof File) || value.size <= 0) {
    throw new Error(opts.requiredMessage);
  }
  if (value.size > PAYMENT_PROOF_MAX_BYTES) {
    throw new Error(opts.sizeMessage);
  }
  const mime = value.type || "";
  if (mime && !PAYMENT_PROOF_MIME.has(mime)) {
    throw new Error(opts.typeMessage);
  }
  return value;
}

/**
 * Billing module or projects (legacy) manage access. Client portal is view-only,
 * except when issuing an invoice immediately after an approved client review.
 */
async function requireInvoiceManageAccess(opts?: {
  approvedReviewPeriodId?: string;
}) {
  const session = await requireSession();
  if (session.user.clientId) {
    if (opts?.approvedReviewPeriodId) {
      const period = await prisma.projectInvoicePeriod.findUnique({
        where: { id: opts.approvedReviewPeriodId },
        select: {
          clientReviewStatus: true,
          project: { select: { clientId: true } },
        },
      });
      if (
        period &&
        period.project.clientId === session.user.clientId &&
        canIssueInvoiceAfterReview(period.clientReviewStatus)
      ) {
        return session;
      }
    }
    redirect("/dashboard");
  }
  const user = toPermissionUser(session);
  if (!canAccess(user, "projects") && !canAccess(user, "invoicing")) {
    redirect("/dashboard");
  }
  return session;
}

async function requireTaxDocumentManageAccess() {
  const session = await requireSession();
  if (session.user.clientId || session.user.vendorId) {
    redirect("/dashboard");
  }
  const user = toPermissionUser(session);
  if (
    !canAccess(user, "projects") &&
    !canAccess(user, "invoicing") &&
    !canAccess(user, "taxInvoices")
  ) {
    redirect("/dashboard");
  }
  return session;
}

async function assertCanIssueCommercialInvoice(
  period: {
    clientReviewStatus: string | null | undefined;
  },
  projectStatus: string,
  opts: { approvedReview: boolean }
) {
  const locale = await getServerLocale();
  if (
    !canIssueCommercialInvoiceForProject(period, projectStatus, {
      approvedReview: opts.approvedReview,
    })
  ) {
    const awaitingReview =
      period.clientReviewStatus === "NONE" ||
      period.clientReviewStatus == null;
    throw new Error(
      translate(
        locale,
        awaitingReview
          ? "pages.billing.mutualApprovalBeforeInvoice"
          : "pages.billing.reviewPendingBeforeInvoice"
      )
    );
  }
}

/**
 * Milestone parts are independent cases. After a part is invoiced,
 * return the project to IN_PROGRESS so progress + next Submit for Approval
 * are not stuck on WAITING_FOR_APPROVAL.
 *
 * Final GC/Facade part: crew already released on client approve. Stay
 * In Progress (awaiting payment / invoiced) until Mark Paid sets COMPLETED.
 * Intermediate parts also stay IN_PROGRESS. Do not complete on invoice issue.
 */
async function applyProjectStatusAfterMilestoneIssue(opts: {
  projectId: string;
  projectStatus: string;
  milestonePercent?: number;
  schedulePercents?: Array<number | null | undefined>;
  approvedReview?: boolean;
}) {
  if (opts.projectStatus === "CANCELLED") return;
  if (opts.projectStatus === "COMPLETED") return;

  if (
    opts.projectStatus === "PLANNED" ||
    opts.projectStatus === "WAITING_FOR_APPROVAL"
  ) {
    await prisma.project.update({
      where: { id: opts.projectId },
      data: { status: "IN_PROGRESS" },
    });
  }
}

/** Client portal user must own the period's project client. */
async function requireClientInvoiceAccess(clientId: string | null) {
  const session = await requireSession();
  if (!session.user.clientId) {
    throw new Error("Only client portal users can submit payment proof.");
  }
  if (!clientId || session.user.clientId !== clientId) {
    throw new Error("You do not have access to this invoice.");
  }
  return session;
}

function revalidateBillingPaths(opts?: {
  projectId?: string;
  clientId?: string | null;
}) {
  revalidatePath("/billing");
  revalidatePath("/billing/tax-invoices");
  if (opts?.clientId) {
    revalidatePath(`/billing/${opts.clientId}`);
    revalidatePath(`/billing/tax-invoices/${opts.clientId}`);
    if (opts.projectId) {
      revalidatePath(`/billing/${opts.clientId}/${opts.projectId}`);
    }
  }
  if (opts?.projectId) {
    revalidatePath(`/projects/${opts.projectId}`);
  }
  // Compile may promote PLANNED → IN_PROGRESS; refresh stage lists.
  revalidatePath(PROJECT_LIST_VIEW_PATHS.all);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.planning);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.inProgress);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.pendingApproval);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.paymentDue);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.completed);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.history);
}

async function getOrCreatePeriod(
  projectId: string,
  periodStart: Date,
  periodEnd: Date,
  label: string
) {
  const existing = await prisma.projectInvoicePeriod.findUnique({
    where: {
      projectId_periodStart_periodEnd: {
        projectId,
        periodStart,
        periodEnd,
      },
    },
  });
  if (existing) {
    if (existing.label === label) return existing;
    return prisma.projectInvoicePeriod.update({
      where: { id: existing.id },
      data: { label },
    });
  }
  return prisma.projectInvoicePeriod.create({
    data: {
      projectId,
      periodStart,
      periodEnd,
      label,
      status: "ONGOING",
    },
  });
}

async function getOrCreateCustomCyclePeriod(
  projectId: string,
  fromDay: number,
  toDay: number,
  cycleIndex: number,
  anchor: Date
) {
  const bounds = customDayCyclePeriodBounds(
    fromDay,
    toDay,
    cycleIndex,
    anchor
  );
  return getOrCreatePeriod(
    projectId,
    bounds.periodStart,
    bounds.periodEnd,
    bounds.label
  );
}

/**
 * Drop unissued mismatched ONGOING rows so Regular Cleaning only keeps periods
 * that match the project's billing period basis.
 */
async function purgeMismatchedOngoingMonthlyPeriods(
  projectId: string,
  contractStart: Date,
  basis: "CALENDAR_MONTH" | "CONTRACT_CYCLE" | null | undefined,
  cycle?: { fromDay?: number | null; toDay?: number | null } | null
) {
  const days = resolveBillingCycleDays(
    contractStart,
    cycle?.fromDay,
    cycle?.toDay
  );
  const ongoing = await prisma.projectInvoicePeriod.findMany({
    where: {
      projectId,
      status: "ONGOING",
      milestonePercent: null,
      invoicePdfPath: null,
    },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      _count: { select: { reports: true } },
    },
  });

  for (const period of ongoing) {
    const matches =
      basis === "CALENDAR_MONTH"
        ? isCalendarMonthPeriodBounds(period.periodStart, period.periodEnd)
        : matchingCustomDayCycleIndex(
            days.fromDay,
            days.toDay,
            contractStart,
            period.periodStart,
            period.periodEnd
          ) != null;
    if (matches) continue;
    // Safe: no PDF. Unlink reports first so the period row can be removed.
    if (period._count.reports > 0) {
      await prisma.progressReport.updateMany({
        where: { invoicePeriodId: period.id },
        data: { invoicePeriodId: null },
      });
    }
    try {
      await prisma.projectInvoicePeriod.delete({ where: { id: period.id } });
    } catch {
      // Keep if still FK-protected.
    }
  }
}

/**
 * Ensure the cycle / calendar month containing `ref` (and prior when needed) exist.
 * Syncs project.invoicingDay from the custom cycle to-date (or contract start).
 */
async function ensureAnniversaryPeriodsForProject(
  project: {
    id: string;
    startDate: Date | null;
    billingMode: string;
    status: string;
    subCategory?: string | null;
    billingPeriodBasis?: "CALENDAR_MONTH" | "CONTRACT_CYCLE" | null;
    billingCycleStartDay?: number | null;
    billingCycleEndDay?: number | null;
    invoicingDay?: number | null;
  },
  ref: Date = new Date(),
  opts?: { includeNextIfDue?: boolean }
) {
  // Parking / Payroll Management never open periods; Security + Regular do.
  // Require subcategory so callers that omit it cannot accidentally sync.
  if (!usesInvoicePeriods(project.subCategory)) {
    return null;
  }
  if (
    project.billingMode !== "MONTHLY" ||
    project.status === "COMPLETED" ||
    project.status === "CANCELLED" ||
    !project.startDate
  ) {
    return null;
  }

  const includeNextIfDue = opts?.includeNextIfDue !== false;
  const contractStart = toUtcDateOnly(project.startDate);
  const today = toUtcDateOnly(ref);
  const basis = project.billingPeriodBasis ?? "CONTRACT_CYCLE";
  const days = resolveBillingCycleDays(
    contractStart,
    project.billingCycleStartDay,
    project.billingCycleEndDay
  );
  const invoicingDay =
    basis === "CALENDAR_MONTH"
      ? 1
      : invoicingDayFromCycleToDay(days.toDay);

  if (project.invoicingDay !== invoicingDay) {
    await prisma.project.update({
      where: { id: project.id },
      data: { invoicingDay },
    });
  }

  await purgeMismatchedOngoingMonthlyPeriods(project.id, contractStart, basis, {
    fromDay: project.billingCycleStartDay,
    toDay: project.billingCycleEndDay,
  });

  if (basis === "CALENDAR_MONTH") {
    const current = monthPeriodBounds(today);
    await getOrCreatePeriod(
      project.id,
      current.periodStart,
      current.periodEnd,
      current.label
    );
    const previous = previousMonthPeriodBounds(today);
    if (previous.periodEnd.getTime() >= contractStart.getTime()) {
      await getOrCreatePeriod(
        project.id,
        previous.periodStart,
        previous.periodEnd,
        previous.label
      );
    }
    if (
      includeNextIfDue &&
      isAnniversaryPeriodDue(today, current.periodEnd)
    ) {
      const nextRef = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 15)
      );
      const next = monthPeriodBounds(nextRef);
      await getOrCreatePeriod(
        project.id,
        next.periodStart,
        next.periodEnd,
        next.label
      );
    }
    return { contractStart, currentIndex: 1, invoicingDay };
  }

  const currentIndex = resolveCustomDayCycleIndex(
    days.fromDay,
    days.toDay,
    contractStart,
    today
  );
  await getOrCreateCustomCyclePeriod(
    project.id,
    days.fromDay,
    days.toDay,
    currentIndex,
    contractStart
  );
  if (currentIndex > 1) {
    await getOrCreateCustomCyclePeriod(
      project.id,
      days.fromDay,
      days.toDay,
      currentIndex - 1,
      contractStart
    );
  }

  // Ongoing contracts: open the next cycle once the current one is due.
  const currentBounds = customDayCyclePeriodBounds(
    days.fromDay,
    days.toDay,
    currentIndex,
    contractStart
  );
  if (
    includeNextIfDue &&
    isAnniversaryPeriodDue(today, currentBounds.periodEnd)
  ) {
    await getOrCreateCustomCyclePeriod(
      project.id,
      days.fromDay,
      days.toDay,
      currentIndex + 1,
      contractStart
    );
  }

  return { contractStart, currentIndex, invoicingDay };
}

async function cycleIndexForPeriodEnd(
  fromDay: number,
  toDay: number,
  anchor: Date,
  periodEnd: Date
): Promise<number> {
  const end = toUtcDateOnly(periodEnd);
  for (let i = 1; i < 2400; i += 1) {
    const bounds = customDayCyclePeriodBounds(fromDay, toDay, i, anchor);
    if (bounds.periodEnd.getTime() === end.getTime()) return i;
  }
  return resolveCustomDayCycleIndex(fromDay, toDay, anchor, end);
}

async function ensureNextContractCycleAfter(
  projectId: string,
  contractStart: Date,
  periodEnd: Date,
  basis?: "CALENDAR_MONTH" | "CONTRACT_CYCLE" | null,
  cycle?: { fromDay?: number | null; toDay?: number | null } | null
) {
  if (basis === "CALENDAR_MONTH") {
    const end = toUtcDateOnly(periodEnd);
    const nextRef = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 15)
    );
    const next = monthPeriodBounds(nextRef);
    await getOrCreatePeriod(
      projectId,
      next.periodStart,
      next.periodEnd,
      next.label
    );
    return;
  }
  const days = resolveBillingCycleDays(
    contractStart,
    cycle?.fromDay,
    cycle?.toDay
  );
  const index = await cycleIndexForPeriodEnd(
    days.fromDay,
    days.toDay,
    contractStart,
    periodEnd
  );
  await getOrCreateCustomCyclePeriod(
    projectId,
    days.fromDay,
    days.toDay,
    index + 1,
    contractStart
  );
}

async function deliverInvoice(_opts: {
  projectName: string;
  client: unknown;
  periodLabel: string;
  amount: number | null;
  pdfPath: string;
}) {
  // Invoices stay on the client Relasi Global Solusi account. No email or WhatsApp.
}

/** Sync anniversary cycles for one project (no path revalidation). */
export async function syncProjectMonthlyPeriods(projectId: string) {
  await requireInvoiceManageAccess();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found.");

  await ensureAnniversaryPeriodsForProject(project);
  return { clientId: project.clientId };
}

/**
 * Compile a monthly (Regular Cleaning) anniversary-cycle invoice period.
 * Prefer client Approve → auto-issue; HO compile is for approved-review / legacy.
 */
export async function compileInvoicePeriod(periodId: string) {
  return compileInvoicePeriodInner(periodId, { approvedReview: false });
}

/** Auto-issue after client (or HO revision) approval — allows client session. */
export async function compileInvoicePeriodForApprovedReview(periodId: string) {
  return compileInvoicePeriodInner(periodId, { approvedReview: true });
}

async function compileInvoicePeriodInner(
  periodId: string,
  opts: { approvedReview: boolean }
) {
  const session = await requireInvoiceManageAccess(
    opts.approvedReview ? { approvedReviewPeriodId: periodId } : undefined
  );

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    include: {
      project: {
        include: {
          client: true,
          company: {
            select: COMPANY_BANK_SELECT,
          },
        },
      },
    },
  });

  if (!period) throw new Error("Invoice period not found.");
  if (period.status === "PAID") {
    throw new Error("This period is already marked paid.");
  }
  if (
    period.status !== "ONGOING" &&
    period.status !== "COMPILING" &&
    period.status !== "AWAITING_CLIENT_REVIEW"
  ) {
    throw new Error("This period has already been invoiced.");
  }
  if (
    period.project.billingMode !== "MONTHLY" &&
    period.project.billingMode !== "ON_COMPLETION"
  ) {
    throw new Error(
      "Use milestone invoicing for General Cleaning, Facade Cleaning, or One-Time Landscaping."
    );
  }
  if (
    period.project.billingMode === "MONTHLY" &&
    !period.reconciledAt &&
    period.project.subCategory !== "PAYROLL_MANAGEMENT"
  ) {
    throw new Error(
      "Reconcile this billing period before submitting the invoice."
    );
  }
  await assertCanIssueCommercialInvoice(
    period,
    period.project.status,
    opts
  );

  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: { status: "COMPILING" },
  });

  try {
    // Only this project's progress reports whose reportDate falls in the period
    // (anniversary cycle for MONTHLY). Nothing else is included.
    const reports = await prisma.progressReport.findMany({
      where: {
        projectId: period.projectId,
        reportDate: {
          gte: period.periodStart,
          lte: period.periodEnd,
        },
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeNo: true },
        },
        photos: { select: { url: true, caption: true } },
      },
      orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }],
    });

    const submittedAt = new Date();
    const issuedAt = invoiceIssueCalendarDate(submittedAt);
    const dueAt = dueAtFromClientPaymentTerms(
      submittedAt,
      period.project.paymentTermsDays
    );
    // Revised amount (HO after client revise) > period amount > contract price.
    const revisedAmount = decimalToNumber(period.revisedInvoiceAmount);
    const periodAmount = decimalToNumber(period.amount);
    const contractPrice = decimalToNumber(period.project.contractPrice);
    const invoiceAmount =
      revisedAmount ??
      periodAmount ??
      invoiceGrossFromExclusivePrice(contractPrice, {
        chargedTaxKind: period.project.chargedTaxKind,
        requiresTaxInvoice: period.project.requiresTaxInvoice,
        pphRatePercent: decimalToNumber(period.project.pphRatePercent),
        isGovernmentContract: period.project.isGovernmentContract,
      }, decimalToNumber(period.ppnRatePercent));
    const amountLabel =
      invoiceAmount != null ? formatContractPrice(invoiceAmount) : null;
    const invoiceNumber =
      period.revisedInvoiceNumber?.trim() ||
      `INV-${period.periodStart.getUTCFullYear()}${String(
        period.periodStart.getUTCMonth() + 1
      ).padStart(2, "0")}-${periodId.slice(-6).toUpperCase()}`;

    const invoiceBank = await overlayInvoiceCompanyBank({
      companyId: period.project.companyId,
      company: period.project.company,
      periodBankAccountId: period.bankAccountId,
      projectBankAccountId: period.project.bankAccountId,
    });
    const invoicePdfPath = await generateInvoicePeriodPdf({
      projectName: period.project.name,
      clientName: period.project.client?.name ?? null,
      clientAddress: period.project.client?.address ?? null,
      clientEmail:
        period.project.client?.contactPersonEmail?.trim() ||
        period.project.client?.email ||
        null,
      clientPhone:
        period.project.client?.contactPersonPhone?.trim() ||
        period.project.client?.phone ||
        null,
      clientNpwp: period.project.client?.npwp ?? null,
      location: period.project.location,
      periodLabel: period.label ?? "Billing period",
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      reports,
      amountLabel,
      issuedAt,
      dueAt,
      paymentTermsDays: period.project.paymentTermsDays,
      invoiceNumber,
      isGovernmentContract: period.project.isGovernmentContract,
      company: invoiceBank.company,
      title:
        period.project.subCategory === "PAYROLL_MANAGEMENT"
          ? "Payroll Management Invoice"
          : period.project.billingMode === "ON_COMPLETION"
            ? "Completion Invoice"
          : "Monthly Progress Invoice",
    });

    await prisma.$transaction([
      prisma.progressReport.updateMany({
        where: {
          projectId: period.projectId,
          reportDate: {
            gte: period.periodStart,
            lte: period.periodEnd,
          },
        },
        data: { invoicePeriodId: periodId },
      }),
      prisma.projectInvoicePeriod.update({
        where: { id: periodId },
        data: {
          status: "AWAITING_PAYMENT",
          invoicePdfPath,
          reportCount: reports.length,
          submittedAt,
          dueAt,
          compiledById: session.user.id,
          compileNote: `Compiled ${reports.length} progress report(s) for this project/location in ${period.label ?? "the period"}. Combined invoice + proof PDF generated.`,
          bankAccountId: invoiceBank.bankAccountId,
          ...(invoiceAmount != null ? { amount: invoiceAmount } : {}),
          ...(period.project.requiresTaxInvoice && period.ppnRatePercent == null
            ? { ppnRatePercent: DEFAULT_PRODUCT_PPN_RATE_PERCENT }
            : {}),
          taxInvoiceRequired: period.project.requiresTaxInvoice,
        },
      }),
    ]);

    // One-shot GC/Facade: client approve already released crew. Stay In Progress
    // until the last invoice is marked paid — do not complete on invoice issue.
    if (period.project.status === "PLANNED") {
      await prisma.project.update({
        where: { id: period.projectId },
        data: { status: "IN_PROGRESS" },
      });
    } else if (
      period.project.status === "WAITING_FOR_APPROVAL" &&
      period.project.billingMode === "MONTHLY" &&
      isContractCycleSubCategory(period.project.subCategory)
    ) {
      // Regular reconcile approval: contract continues — return to In Progress.
      await prisma.project.update({
        where: { id: period.projectId },
        data: { status: "IN_PROGRESS" },
      });
    }

    if (period.project.subCategory === "PAYROLL_MANAGEMENT") {
      await prisma.payrollManagementPeriod.updateMany({
        where: { invoicePeriodId: periodId },
        data: {
          status: "INVOICED",
          invoicedAt: submittedAt,
        },
      });
    }

    await deliverInvoice({
      projectName: period.project.name,
      client: period.project.client,
      periodLabel: period.label ?? "Billing period",
      amount: invoiceAmount,
      pdfPath: invoicePdfPath,
    });

    // Keep the next anniversary / calendar-month cycle ready while the contract continues.
    if (
      period.project.billingMode === "MONTHLY" &&
      period.project.startDate &&
      period.project.status !== "COMPLETED" &&
      period.project.status !== "CANCELLED"
    ) {
      await ensureNextContractCycleAfter(
        period.projectId,
        toUtcDateOnly(period.project.startDate),
        period.periodEnd,
        period.project.billingPeriodBasis,
        {
          fromDay: period.project.billingCycleStartDay,
          toDay: period.project.billingCycleEndDay,
        }
      );
    }

    revalidateBillingPaths({
      projectId: period.projectId,
      clientId: period.project.clientId,
    });
    revalidatePath("/progress");

    return { invoicePdfPath, reportCount: reports.length };
  } catch (error) {
    // Leave the period re-compilable; do not stick forever on COMPILING.
    const restoreStatus =
      period.clientReviewStatus !== "NONE"
        ? "AWAITING_CLIENT_REVIEW"
        : "ONGOING";
    await prisma.projectInvoicePeriod.update({
      where: { id: periodId },
      data: {
        status: restoreStatus,
        compileNote:
          error instanceof Error
            ? `Compile failed: ${error.message}`
            : "Compile failed.",
      },
    });
    throw error;
  }
}

/**
 * Set or update the project contract price (monthly fee / total contract value).
 * Used from Invoice and Billing — not from project create/edit forms.
 * Period compile uses this unless the period already has its own amount.
 *
 * For MILESTONE projects: redistributes remaining unpaid schedule amounts from
 * (newContractPrice − sum of PAID amounts) by relative unpaid tranche %, leaving
 * PAID period amounts unchanged. Issued unpaid rows get a PDF-stale note when
 * their amount changes.
 */
export async function updateProjectContractPrice(formData: FormData) {
  const session = await requireInvoiceManageAccess();

  const projectId = String(formData.get("projectId") ?? "").trim();
  const priceRaw = String(formData.get("contractPrice") ?? "").trim();

  if (!projectId) throw new Error("Project is required.");

  const contractPrice = parseContractPrice(priceRaw);
  if (contractPrice == null || contractPrice <= 0) {
    throw new Error("Enter a valid contract price greater than zero.");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      clientId: true,
      billingMode: true,
      subCategory: true,
      serviceArea: true,
      chargedTaxKind: true,
      requiresTaxInvoice: true,
      pphRatePercent: true,
      isGovernmentContract: true,
      invoicePeriods: {
        where: { milestonePercent: { not: null } },
        orderBy: { milestonePercent: "asc" },
        select: {
          id: true,
          milestonePercent: true,
          amount: true,
          status: true,
          compileNote: true,
        },
      },
    },
  });

  if (!project) throw new Error("Project not found.");

  await assertCanApproveProjectServiceArea({
    userId: session.user.id,
    username: session.user.username,
    permissionUser: toPermissionUser(session),
    projectServiceArea: project.serviceArea,
    projectId: project.id,
  });

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: { contractPrice },
    });

    if (
      project.billingMode === "MILESTONE" &&
      isMilestoneSubCategory(project.subCategory) &&
      project.invoicePeriods.length > 0
    ) {
      const billedTotal =
        invoiceGrossFromExclusivePrice(contractPrice, {
          chargedTaxKind: project.chargedTaxKind,
          requiresTaxInvoice: project.requiresTaxInvoice,
          pphRatePercent: decimalToNumber(project.pphRatePercent),
          isGovernmentContract: project.isGovernmentContract,
        }) ?? contractPrice;
      const revisions = recalculateUnpaidMilestoneAmounts(
        project.invoicePeriods.map((p) => ({
          id: p.id,
          milestonePercent: p.milestonePercent,
          amount: decimalToNumber(p.amount),
          status: p.status,
          compileNote: p.compileNote,
        })),
        billedTotal
      );

      for (const rev of revisions) {
        if (!rev.amountChanged && !rev.needsPdfRefresh) continue;
        await tx.projectInvoicePeriod.update({
          where: { id: rev.id },
          data: {
            amount: rev.amount,
            ...(rev.needsPdfRefresh ? { compileNote: rev.compileNote } : {}),
          },
        });
      }
    }
  });

  revalidateBillingPaths({
    projectId: project.id,
    clientId: project.clientId,
  });

  return { contractPrice };
}

/**
 * Issue (compile + deliver) an existing scheduled milestone period.
 * Periods are created upfront on project create; staff only invoice when ready.
 */
async function issueMilestonePeriod(periodId: string) {
  return issueMilestonePeriodInner(periodId, { approvedReview: false });
}

/** Auto-issue milestone after client (or HO revision) approval. */
export async function issueMilestonePeriodForApprovedReview(periodId: string) {
  return issueMilestonePeriodInner(periodId, { approvedReview: true });
}

async function issueMilestonePeriodInner(
  periodId: string,
  opts: { approvedReview: boolean }
) {
  const session = await requireInvoiceManageAccess(
    opts.approvedReview ? { approvedReviewPeriodId: periodId } : undefined
  );

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    include: {
      project: {
        include: {
          client: true,
          company: {
            select: COMPANY_BANK_SELECT,
          },
          invoicePeriods: {
            orderBy: { milestonePercent: "asc" },
          },
        },
      },
    },
  });

  if (!period) throw new Error("Invoice period not found.");
  if (period.status === "PAID") {
    throw new Error("This period is already marked paid.");
  }
  if (
    period.status !== "ONGOING" &&
    period.status !== "COMPILING" &&
    period.status !== "AWAITING_CLIENT_REVIEW"
  ) {
    throw new Error("This milestone has already been invoiced.");
  }

  const project = period.project;
  if (project.billingMode !== "MILESTONE") {
    throw new Error("Milestone invoicing is only for milestone-billed projects.");
  }
  if (!isMilestoneSubCategory(project.subCategory)) {
    throw new Error(
      "Milestone payment schedules are only for General Cleaning, Facade Cleaning, and One-Time Landscaping."
    );
  }

  await assertCanIssueCommercialInvoice(
    period,
    project.status,
    opts
  );

  const milestonePercent = period.milestonePercent;
  if (milestonePercent == null || !Number.isFinite(milestonePercent)) {
    throw new Error("This period is not a milestone payment.");
  }

  const priorMax = maxMilestonePercent(
    project.invoicePeriods.map((p) => ({
      milestonePercent: p.milestonePercent,
      status: p.status,
    }))
  );

  if (milestonePercent <= priorMax) {
    throw new Error(
      `Milestone must be greater than the last invoiced progress (${priorMax}%).`
    );
  }

  // Must invoice in schedule order (next cumulative % only).
  // When issuing after client review, this period may already be AWAITING_CLIENT_REVIEW.
  const nextScheduled = project.invoicePeriods
    .filter(
      (p) =>
        p.milestonePercent != null &&
        (p.status === "ONGOING" ||
          p.status === "COMPILING" ||
          (opts.approvedReview &&
            p.status === "AWAITING_CLIENT_REVIEW" &&
            p.id === periodId)) &&
        p.milestonePercent > priorMax
    )
    .sort(
      (a, b) => (a.milestonePercent ?? 0) - (b.milestonePercent ?? 0)
    )[0];

  if (!nextScheduled || nextScheduled.id !== period.id) {
    throw new Error(
      nextScheduled
        ? `Invoice the ${nextScheduled.milestonePercent}% milestone before this one.`
        : "No next milestone is ready to invoice."
    );
  }

  const contractPrice = decimalToNumber(project.contractPrice);
  if (contractPrice == null || contractPrice <= 0) {
    throw new Error(
      "Set a contract price in Invoice and Billing before creating a milestone invoice."
    );
  }

  const slicePercent = milestonePercent - priorMax;
  const revisedAmount = decimalToNumber(period.revisedInvoiceAmount);
  let amount = revisedAmount ?? decimalToNumber(period.amount);
  // Explicit 0 = nothing left after a contract-price revision — do not
  // re-derive from contract × % (that would ignore money already paid).
  if (amount === 0) {
    throw new Error(
      "This milestone has amount Rp 0 after the contract price revision — nothing left to invoice."
    );
  }
  if (amount == null || amount < 0) {
    const exclusiveSlice =
      Math.round(((contractPrice * slicePercent) / 100) * 100) / 100;
    amount =
      invoiceGrossFromExclusivePrice(exclusiveSlice, {
        chargedTaxKind: project.chargedTaxKind,
        requiresTaxInvoice: project.requiresTaxInvoice,
        pphRatePercent: decimalToNumber(project.pphRatePercent),
        isGovernmentContract: project.isGovernmentContract,
      }) ?? exclusiveSlice;
  } else {
    amount = Math.round(amount * 100) / 100;
  }

  const today = toUtcDateOnly(new Date());
  const periodStart = toUtcDateOnly(period.periodStart);
  let periodEnd = today.getTime() < periodStart.getTime() ? periodStart : today;

  // Keep unique (projectId, start, end) if another row already owns this end date.
  const collision = await prisma.projectInvoicePeriod.findFirst({
    where: {
      projectId: project.id,
      periodStart,
      periodEnd,
      id: { not: period.id },
    },
  });
  if (collision) {
    periodEnd = new Date(
      Date.UTC(
        periodEnd.getUTCFullYear(),
        periodEnd.getUTCMonth(),
        periodEnd.getUTCDate() + 1
      )
    );
  }

  const label = formatMilestoneScheduleLabel(milestonePercent);

  await prisma.projectInvoicePeriod.update({
    where: { id: period.id },
    data: {
      status: "COMPILING",
      amount,
      label,
      periodEnd,
    },
  });

  try {
    const reports = await prisma.progressReport.findMany({
      where: {
        projectId: project.id,
        invoicePeriodId: null,
        reportDate: {
          lte: periodEnd,
        },
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeNo: true },
        },
        photos: { select: { url: true, caption: true } },
      },
      orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }],
    });

    const amountLabel = formatContractPrice(amount);
    const submittedAt = new Date();
    const issuedAt = invoiceIssueCalendarDate(submittedAt);
    const dueAt = dueAtFromClientPaymentTerms(
      submittedAt,
      project.paymentTermsDays
    );
    const invoiceNumber =
      period.revisedInvoiceNumber?.trim() ||
      `INV-M${String(milestonePercent).replace(".", "")}-${period.id
        .slice(-6)
        .toUpperCase()}`;
    const invoiceBank = await overlayInvoiceCompanyBank({
      companyId: project.companyId,
      company: project.company,
      periodBankAccountId: period.bankAccountId,
      projectBankAccountId: project.bankAccountId,
    });
    const invoicePdfPath = await generateInvoicePeriodPdf({
      projectName: project.name,
      clientName: project.client?.name ?? null,
      clientAddress: project.client?.address ?? null,
      clientEmail:
        project.client?.contactPersonEmail?.trim() ||
        project.client?.email ||
        null,
      clientPhone:
        project.client?.contactPersonPhone?.trim() ||
        project.client?.phone ||
        null,
      clientNpwp: project.client?.npwp ?? null,
      location: project.location,
      periodLabel: label,
      periodStart,
      periodEnd,
      reports,
      amountLabel,
      milestonePercent,
      issuedAt,
      dueAt,
      paymentTermsDays: project.paymentTermsDays,
      invoiceNumber,
      isGovernmentContract: project.isGovernmentContract,
      company: invoiceBank.company,
      title: "Payment Milestone Invoice",
    });

    await prisma.$transaction([
      prisma.progressReport.updateMany({
        where: {
          id: { in: reports.map((r) => r.id) },
        },
        data: { invoicePeriodId: period.id },
      }),
      prisma.projectInvoicePeriod.update({
        where: { id: period.id },
        data: {
          status: "AWAITING_PAYMENT",
          invoicePdfPath,
          reportCount: reports.length,
          submittedAt,
          dueAt,
          compiledById: session.user.id,
          compileNote: `${label} — ${amountLabel}. Compiled ${reports.length} report(s).`,
          bankAccountId: invoiceBank.bankAccountId,
          taxInvoiceRequired: project.requiresTaxInvoice,
          ...(project.requiresTaxInvoice
            ? { ppnRatePercent: DEFAULT_PRODUCT_PPN_RATE_PERCENT }
            : {}),
        },
      }),
    ]);

    await applyProjectStatusAfterMilestoneIssue({
      projectId: project.id,
      projectStatus: project.status,
      milestonePercent,
      schedulePercents: project.invoicePeriods.map((p) => p.milestonePercent),
      approvedReview: opts.approvedReview,
    });

    await deliverInvoice({
      projectName: project.name,
      client: project.client,
      periodLabel: label,
      amount,
      pdfPath: invoicePdfPath,
    });

    revalidateBillingPaths({
      projectId: project.id,
      clientId: project.clientId,
    });

    return {
      invoicePdfPath,
      reportCount: reports.length,
      amount,
      milestonePercent,
    };
  } catch (error) {
    const restoreStatus =
      period.clientReviewStatus !== "NONE"
        ? "AWAITING_CLIENT_REVIEW"
        : "ONGOING";
    await prisma.projectInvoicePeriod.update({
      where: { id: period.id },
      data: {
        status: restoreStatus,
        compileNote:
          error instanceof Error
            ? `Compile failed: ${error.message}`
            : "Compile failed.",
      },
    });
    throw error;
  }
}

/**
 * Resolve or create an ad-hoc milestone billing period (legacy projects without
 * a saved payment schedule, or when picking a cumulative % manually).
 */
async function ensureAdHocMilestonePeriod(
  formData: FormData,
  opts: {
    status: "ONGOING" | "COMPILING";
    requireIssueGate?: boolean;
  }
) {
  await requireInvoiceManageAccess();

  const projectId = String(formData.get("projectId") ?? "").trim();
  const percentRaw = Number(formData.get("milestonePercent") ?? NaN);
  const amountOverrideRaw = String(formData.get("amount") ?? "").trim();

  if (!projectId) throw new Error("Project is required.");
  if (!Number.isFinite(percentRaw) || percentRaw <= 0 || percentRaw > 100) {
    throw new Error("Enter a milestone progress between 1 and 100%.");
  }
  const milestonePercent = Math.round(percentRaw * 100) / 100;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      company: {
        select: COMPANY_BANK_SELECT,
      },
      invoicePeriods: {
        orderBy: { periodStart: "asc" },
      },
    },
  });

  if (!project) throw new Error("Project not found.");
  if (project.billingMode !== "MILESTONE") {
    throw new Error(
      "Milestone invoicing is only for General Cleaning, Facade Cleaning, and One-Time Landscaping."
    );
  }
  if (!isMilestoneSubCategory(project.subCategory)) {
    throw new Error(
      "Milestone payment schedules are only for General Cleaning, Facade Cleaning, and One-Time Landscaping."
    );
  }

  const scheduled = project.invoicePeriods.find(
    (p) =>
      p.milestonePercent === milestonePercent &&
      (p.status === "ONGOING" ||
        p.status === "COMPILING" ||
        p.status === "AWAITING_CLIENT_REVIEW")
  );
  if (scheduled) {
    return {
      periodId: scheduled.id,
      existingScheduled: true,
      project,
      milestonePercent,
      amount: decimalToNumber(scheduled.amount) ?? 0,
      periodStart: scheduled.periodStart,
      safeEnd: scheduled.periodEnd,
      label: scheduled.label ?? formatMilestoneScheduleLabel(milestonePercent),
    };
  }

  const contractPrice = decimalToNumber(project.contractPrice);
  if (contractPrice == null || contractPrice <= 0) {
    throw new Error(
      "Set a contract price in Invoice and Billing before creating a milestone invoice."
    );
  }

  const priorMax = maxMilestonePercent(
    project.invoicePeriods.map((p) => ({
      milestonePercent: p.milestonePercent,
      status: p.status,
    }))
  );

  if (milestonePercent <= priorMax) {
    throw new Error(
      `Milestone must be greater than the last invoiced progress (${priorMax}%).`
    );
  }

  const nextScheduled = project.invoicePeriods
    .filter(
      (p) =>
        p.milestonePercent != null &&
        (p.status === "ONGOING" || p.status === "COMPILING") &&
        p.milestonePercent > priorMax
    )
    .sort(
      (a, b) => (a.milestonePercent ?? 0) - (b.milestonePercent ?? 0)
    )[0];

  if (nextScheduled && nextScheduled.milestonePercent !== milestonePercent) {
    throw new Error(
      `This project has a payment schedule. Invoice the ${nextScheduled.milestonePercent}% milestone next (or pick that percent).`
    );
  }

  const slicePercent = milestonePercent - priorMax;
  const exclusiveSlice = (contractPrice * slicePercent) / 100;
  let amount = exclusiveSlice;

  if (amountOverrideRaw) {
    const override = Number(amountOverrideRaw.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(override) || override <= 0) {
      throw new Error("Invalid invoice amount override.");
    }
    amount = override;
  }

  amount =
    invoiceGrossFromExclusivePrice(amount, {
      chargedTaxKind: project.chargedTaxKind,
      requiresTaxInvoice: project.requiresTaxInvoice,
      pphRatePercent: decimalToNumber(project.pphRatePercent),
      isGovernmentContract: project.isGovernmentContract,
    }) ?? Math.round(amount * 100) / 100;

  const today = toUtcDateOnly(new Date());
  const lastDelivered = project.invoicePeriods
    .filter((p) =>
      [
        "AWAITING_PAYMENT",
        "PENDING_VERIFICATION",
        "PAID",
        "OVERDUE",
        "COMPILING",
      ].includes(p.status)
    )
    .sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime())[0];

  const periodStart = lastDelivered
    ? new Date(
        Date.UTC(
          lastDelivered.periodEnd.getUTCFullYear(),
          lastDelivered.periodEnd.getUTCMonth(),
          lastDelivered.periodEnd.getUTCDate() + 1
        )
      )
    : project.startDate
      ? toUtcDateOnly(project.startDate)
      : today;
  const periodEnd =
    today.getTime() < periodStart.getTime() ? periodStart : today;

  const label = formatMilestoneScheduleLabel(milestonePercent);

  let safeEnd = periodEnd;
  const collision = await prisma.projectInvoicePeriod.findUnique({
    where: {
      projectId_periodStart_periodEnd: {
        projectId,
        periodStart,
        periodEnd: safeEnd,
      },
    },
  });
  if (collision) {
    safeEnd = new Date(
      Date.UTC(
        safeEnd.getUTCFullYear(),
        safeEnd.getUTCMonth(),
        safeEnd.getUTCDate() + 1
      )
    );
  }

  if (opts.requireIssueGate) {
    await assertCanIssueCommercialInvoice(
      { clientReviewStatus: "NONE" },
      project.status,
      { approvedReview: false }
    );
  }

  const period = await prisma.projectInvoicePeriod.create({
    data: {
      projectId,
      periodStart,
      periodEnd: safeEnd,
      label,
      status: opts.status,
      amount,
      milestonePercent,
      bankAccountId: project.bankAccountId,
    },
  });

  return {
    periodId: period.id,
    existingScheduled: false,
    project,
    milestonePercent,
    amount,
    periodStart,
    safeEnd,
    label,
  };
}

/**
 * Legacy ad-hoc milestone UI: create (or reuse) a period, then send the
 * progress package for client + HO review instead of issuing immediately.
 */
export async function sendAdHocMilestoneForClientReview(formData: FormData) {
  const ready = await ensureAdHocMilestonePeriod(formData, {
    status: "ONGOING",
  });
  const { sendPeriodForClientReview } = await import(
    "@/app/billing/reconciliation/actions"
  );
  return sendPeriodForClientReview(ready.periodId, "PROGRESS");
}

/**
 * Create a milestone progress invoice for General / Facade projects.
 * Prefer {@link issueMilestonePeriod} when a schedule already exists.
 * Amount = contractPrice * (percent - alreadyInvoicedPercent) / 100
 * when using cumulative %, OR contractPrice * percent/100 when percent is
 * treated as the invoice slice. We use cumulative progress %:
 * e.g. 30 then 60 invoices 30% then another 30%.
 */
async function createMilestoneInvoice(formData: FormData) {
  const session = await requireInvoiceManageAccess();

  const ready = await ensureAdHocMilestonePeriod(formData, {
    status: "COMPILING",
    requireIssueGate: true,
  });

  if (ready.existingScheduled) {
    return issueMilestonePeriod(ready.periodId);
  }

  const {
    periodId,
    project,
    milestonePercent,
    amount,
    periodStart,
    safeEnd,
    label,
  } = ready;
  const projectId = project.id;
  const period = { id: periodId };

  const reports = await prisma.progressReport.findMany({
    where: {
      projectId,
      invoicePeriodId: null,
      reportDate: {
        lte: safeEnd,
      },
    },
    include: {
      employee: {
        select: { firstName: true, lastName: true, employeeNo: true },
      },
      photos: { select: { url: true, caption: true } },
    },
    orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }],
  });

  const amountLabel = formatContractPrice(amount);
  const submittedAt = new Date();
  const issuedAt = invoiceIssueCalendarDate(submittedAt);
  const dueAt = dueAtFromClientPaymentTerms(
    submittedAt,
    project.paymentTermsDays
  );
  const invoiceNumber = `INV-M${String(milestonePercent).replace(".", "")}-${period.id.slice(-6).toUpperCase()}`;
  const invoiceBank = await overlayInvoiceCompanyBank({
    companyId: project.companyId,
    company: project.company,
    projectBankAccountId: project.bankAccountId,
  });
  const invoicePdfPath = await generateInvoicePeriodPdf({
    projectName: project.name,
    clientName: project.client?.name ?? null,
    clientAddress: project.client?.address ?? null,
    clientEmail:
      project.client?.contactPersonEmail?.trim() ||
      project.client?.email ||
      null,
    clientPhone:
      project.client?.contactPersonPhone?.trim() ||
      project.client?.phone ||
      null,
    clientNpwp: project.client?.npwp ?? null,
    location: project.location,
    periodLabel: label,
    periodStart,
    periodEnd: safeEnd,
    reports,
    amountLabel,
    milestonePercent,
    issuedAt,
    dueAt,
    paymentTermsDays: project.paymentTermsDays,
    invoiceNumber,
    isGovernmentContract: project.isGovernmentContract,
    company: invoiceBank.company,
    title: "Payment Milestone Invoice",
  });

  await prisma.$transaction([
    prisma.progressReport.updateMany({
      where: {
        id: { in: reports.map((r) => r.id) },
      },
      data: { invoicePeriodId: period.id },
    }),
    prisma.projectInvoicePeriod.update({
      where: { id: period.id },
      data: {
        status: "AWAITING_PAYMENT",
        invoicePdfPath,
        reportCount: reports.length,
        submittedAt,
        dueAt,
        compiledById: session.user.id,
        compileNote: `${formatMilestoneScheduleLabel(milestonePercent)} — ${amountLabel}. Compiled ${reports.length} report(s).`,
        bankAccountId: invoiceBank.bankAccountId,
        taxInvoiceRequired: project.requiresTaxInvoice,
        ...(project.requiresTaxInvoice
          ? { ppnRatePercent: DEFAULT_PRODUCT_PPN_RATE_PERCENT }
          : {}),
      },
    }),
  ]);

  await applyProjectStatusAfterMilestoneIssue({
    projectId,
    projectStatus: project.status,
    milestonePercent,
    schedulePercents: project.invoicePeriods.map((p) => p.milestonePercent),
    approvedReview: false,
  });

  await deliverInvoice({
    projectName: project.name,
    client: project.client,
    periodLabel: label,
    amount,
    pdfPath: invoicePdfPath,
  });

  revalidateBillingPaths({
    projectId,
    clientId: project.clientId,
  });

  return {
    invoicePdfPath,
    reportCount: reports.length,
    amount,
    milestonePercent,
  };
}

/**
 * Void an unpaid invoice period and reopen Reconcile / Submit for Approval.
 * Unused ONGOING periods with no files are removed. PAID stays blocked.
 * Amount and progress links stay.
 */
export async function deleteInvoicePeriod(periodId: string) {
  await requireInvoiceManageAccess();

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    select: {
      id: true,
      status: true,
      reconciledAt: true,
      invoicePdfPath: true,
      paymentProofPath: true,
      taxInvoiceDocumentPath: true,
      reviewReportPdfPath: true,
      clientRevisionProofPath: true,
      hoReviewProofPath: true,
      submittedAt: true,
      reviewSentToClientAt: true,
      projectId: true,
      project: { select: { clientId: true } },
    },
  });

  if (!period) throw new Error("Invoice period not found.");
  if (period.status === "PAID") {
    throw new Error("Paid invoice periods cannot be deleted.");
  }
  if (
    !(DELETABLE_INVOICE_PERIOD_STATUSES as readonly string[]).includes(
      period.status
    )
  ) {
    throw new Error("This invoice period cannot be deleted.");
  }

  const neverStarted =
    period.status === "ONGOING" &&
    !period.reconciledAt &&
    !period.invoicePdfPath &&
    !period.submittedAt &&
    !period.reviewSentToClientAt &&
    !period.paymentProofPath &&
    !period.taxInvoiceDocumentPath;

  const filePaths = [
    period.invoicePdfPath,
    period.paymentProofPath,
    period.taxInvoiceDocumentPath,
    period.reviewReportPdfPath,
    period.clientRevisionProofPath,
    period.hoReviewProofPath,
  ];

  if (neverStarted) {
    await prisma.projectInvoicePeriod.delete({ where: { id: periodId } });
  } else {
    await prisma.projectInvoicePeriod.update({
      where: { id: periodId },
      data: {
        status: "ONGOING",
        reconciledAt: null,
        reconciledById: null,
        clientReviewKind: null,
        clientReviewStatus: "NONE",
        reviewReportPdfPath: null,
        reviewSentToClientAt: null,
        clientReviewedAt: null,
        clientRevisionNote: null,
        clientRevisionProofPath: null,
        hoReviewNote: null,
        hoReviewProofPath: null,
        hoReviewedAt: null,
        hoReviewedById: null,
        revisedInvoiceAmount: null,
        revisedInvoiceNumber: null,
        invoicePdfPath: null,
        submittedAt: null,
        dueAt: null,
        paidAt: null,
        compileNote: null,
        compiledById: null,
        paymentProofPath: null,
        paymentProofUploadedAt: null,
        paymentVerifiedAt: null,
        paymentVerifiedById: null,
        paymentManualReason: null,
        taxInvoiceManualReason: null,
        taxInvoiceRequired: false,
        taxInvoiceDocumentPath: null,
        taxInvoiceDocumentUploadedAt: null,
        taxInvoiceSerial: null,
        taxInvoiceIssuedAt: null,
        taxInvoiceDocumentHash: null,
        taxInvoiceDoneAt: null,
        taxInvoiceDoneById: null,
      },
    });
  }

  for (const path of filePaths) {
    await deleteLocalUpload(path);
  }

  revalidateBillingPaths({
    projectId: period.projectId,
    clientId: period.project.clientId,
  });

  return { id: period.id };
}

type MarkPaidPeriod = {
  id: string;
  status: string;
  periodEnd: Date;
  projectId: string;
  project: {
    id: string;
    clientId: string | null;
    status: string;
    billingMode: string;
    billingPeriodBasis?: "CALENDAR_MONTH" | "CONTRACT_CYCLE" | null;
    billingCycleStartDay?: number | null;
    billingCycleEndDay?: number | null;
    subCategory?: string | null;
    startDate: Date | null;
    endDate?: Date | null;
    invoicePeriods: {
      id: string;
      status: string;
      milestonePercent: number | null;
      taxInvoiceDoneAt?: Date | null;
    }[];
  };
};

/**
 * Shared PAID transition + Completed Projects move rules.
 * Caller must already enforce access and allowed source statuses.
 */
async function applyInvoicePeriodPaid(
  period: MarkPaidPeriod,
  opts?: { verifiedById?: string; paymentManualReason?: string }
) {
  const paidAt = new Date();
  await prisma.projectInvoicePeriod.update({
    where: { id: period.id },
    data: {
      status: "PAID",
      paidAt,
      taxInvoiceRequired: true,
      ...(opts?.paymentManualReason
        ? { paymentManualReason: opts.paymentManualReason }
        : {}),
      ...(opts?.verifiedById
        ? {
            paymentVerifiedAt: paidAt,
            paymentVerifiedById: opts.verifiedById,
          }
        : {}),
    },
  });

  const project = period.project;
  const periodsAfterPay = project.invoicePeriods.map((p) =>
    p.id === period.id ? { ...p, status: "PAID" as const } : p
  );
  const hasOpenCollection = periodsAfterPay.some((p) =>
    (OPEN_COLLECTION_STATUSES as readonly string[]).includes(p.status)
  );
  const lastCycleClosed =
    Boolean(project.endDate) &&
    toUtcDateOnly(period.periodEnd).getTime() >=
      toUtcDateOnly(project.endDate!).getTime();

  // Complete only after every issued/paid period has its tax invoice.
  // Regular / Security last cycle can complete here; next month may still open
  // before tax on earlier periods.
  const shouldMoveToHistory = shouldCompleteProjectAfterSettlement({
    billingMode: project.billingMode,
    subCategory: project.subCategory,
    projectStatus: project.status,
    endDate: project.endDate,
    lastPaidPeriodEnd: period.periodEnd,
    periods: periodsAfterPay,
  });

  if (shouldMoveToHistory) {
    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: project.id },
        data: { status: "COMPLETED" },
      });
      // Drop unissued leftover schedule/month rows so Completed Projects stays clean.
      await tx.projectInvoicePeriod.deleteMany({
        where: {
          projectId: project.id,
          status: "ONGOING",
        },
      });
      // Crew already released on last-pack approve or End Contract. Do not
      // release on Mark Paid.
    });
  } else if (
    project.billingMode === "MONTHLY" &&
    project.startDate &&
    project.status === "IN_PROGRESS" &&
    !hasOpenCollection &&
    !lastCycleClosed
  ) {
    // Contract continues — open the next anniversary / calendar-month cycle.
    await ensureNextContractCycleAfter(
      project.id,
      toUtcDateOnly(project.startDate),
      period.periodEnd,
      project.billingPeriodBasis,
      {
        fromDay: project.billingCycleStartDay,
        toDay: project.billingCycleEndDay,
      }
    );
  }

  revalidateBillingPaths({
    projectId: period.projectId,
    clientId: period.project.clientId,
  });

  return { movedToHistory: shouldMoveToHistory };
}

/**
 * Admin / ops: mark Payment received after uploading proof of payment.
 * Tax invoice (faktur) is tracked separately via markTaxInvoiceDone.
 * Files stay on this server. Head Office confirms in-house with a required reason.
 */
export async function markInvoicePeriodPaid(formData: FormData) {
  const session = await requireInvoiceManageAccess();

  const periodId = String(formData.get("periodId") ?? "").trim();
  if (!periodId) throw new Error("Invoice period is required.");

  const proof = requireImageOrPdfUpload(formData.get("paymentProof"), {
    requiredMessage: "Please upload proof of payment (image or PDF).",
    sizeMessage: "Payment proof must be 10 MB or smaller.",
    typeMessage:
      "Payment proof must be an image (JPEG, PNG, WebP, GIF) or PDF.",
  });

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    include: {
      project: {
        select: {
          id: true,
          clientId: true,
          status: true,
          billingMode: true,
          billingPeriodBasis: true,
          billingCycleStartDay: true,
          billingCycleEndDay: true,
          subCategory: true,
          startDate: true,
          endDate: true,
          contractPrice: true,
          invoicePeriods: {
            select: {
              id: true,
              status: true,
              milestonePercent: true,
              taxInvoiceDoneAt: true,
            },
          },
          client: { select: { name: true, shortCode: true } },
          company: { select: COMPANY_BANK_SELECT },
        },
      },
    },
  });
  if (!period) throw new Error("Invoice period not found.");
  if (period.status !== "AWAITING_PAYMENT" && period.status !== "OVERDUE") {
    throw new Error("Only awaiting/overdue invoices can be marked paid.");
  }

  const previousProof = period.paymentProofPath;
  const uploadedAt = new Date();
  const invoiceNumber = commercialInvoiceNumber(period);
  const paymentProofPath = await saveUpload(proof, "uploads/payment-proofs", {
    fileBaseName: buildBillingDocumentFileBase({
      prefix: "Proof-of-Payment",
      clientShortCode: period.project.client?.shortCode,
      clientName: period.project.client?.name,
      invoiceNumber,
      date: uploadedAt,
    }),
  });

  // Keep the uploaded proof on file; do not mark paid here.
  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      paymentProofPath,
      paymentProofUploadedAt: uploadedAt,
    },
  });

  if (previousProof && previousProof !== paymentProofPath) {
    await deleteLocalUpload(previousProof);
  }

  const reason = parseManualVerifyReason(formData.get("manualReason"));
  return applyInvoicePeriodPaid(period, {
    verifiedById: session.user.id,
    paymentManualReason: reason,
  });
}

/**
 * Client portal: upload proof of payment and submit for Head Office review.
 * Files stay on this server.
 */
export async function submitInvoicePaymentForVerification(formData: FormData) {
  const periodId = String(formData.get("periodId") ?? "").trim();
  if (!periodId) throw new Error("Invoice period is required.");

  const proof = requireImageOrPdfUpload(formData.get("paymentProof"), {
    requiredMessage: "Please upload an image or PDF as proof of payment.",
    sizeMessage: "Payment proof must be 10 MB or smaller.",
    typeMessage:
      "Payment proof must be an image (JPEG, PNG, WebP, GIF) or PDF.",
  });

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    include: {
      project: {
        select: {
          id: true,
          clientId: true,
          contractPrice: true,
          client: { select: { name: true, shortCode: true } },
          company: { select: COMPANY_BANK_SELECT },
        },
      },
    },
  });
  if (!period) throw new Error("Invoice period not found.");

  await requireClientInvoiceAccess(period.project.clientId);

  if (period.status !== "AWAITING_PAYMENT" && period.status !== "OVERDUE") {
    throw new Error(
      "Only awaiting or overdue invoices can be submitted for verification."
    );
  }

  const previousProof = period.paymentProofPath;
  const uploadedAt = new Date();
  const invoiceNumber = commercialInvoiceNumber(period);
  const paymentProofPath = await saveUpload(proof, "uploads/payment-proofs", {
    fileBaseName: buildBillingDocumentFileBase({
      prefix: "Proof-of-Payment",
      clientShortCode: period.project.client?.shortCode,
      clientName: period.project.client?.name,
      invoiceNumber,
      date: uploadedAt,
    }),
  });

  // Keep the uploaded proof on file for Head Office review.
  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      paymentProofPath,
      paymentProofUploadedAt: uploadedAt,
      paymentVerifiedAt: null,
      paymentVerifiedById: null,
    },
  });

  if (previousProof && previousProof !== paymentProofPath) {
    await deleteLocalUpload(previousProof);
  }

  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: { status: "PENDING_VERIFICATION" },
  });

  revalidateBillingPaths({
    projectId: period.projectId,
    clientId: period.project.clientId,
  });

  return { id: periodId, status: "PENDING_VERIFICATION" as const };
}

/**
 * Admin / ops: confirm client payment proof → PAID.
 * Head Office confirms in-house with a required reason. Cloud reader is optional.
 */
export async function verifyInvoicePeriodPayment(formData: FormData) {
  const session = await requireInvoiceManageAccess();
  const periodId = String(formData.get("periodId") ?? "").trim();
  if (!periodId) throw new Error("Invoice period is required.");
  const reason = parseManualVerifyReason(formData.get("manualReason"));

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    include: {
      project: {
        select: {
          id: true,
          clientId: true,
          status: true,
          billingMode: true,
          billingPeriodBasis: true,
          billingCycleStartDay: true,
          billingCycleEndDay: true,
          subCategory: true,
          startDate: true,
          endDate: true,
          contractPrice: true,
          invoicePeriods: {
            select: {
              id: true,
              status: true,
              milestonePercent: true,
              taxInvoiceDoneAt: true,
            },
          },
          client: { select: { name: true } },
          company: { select: COMPANY_BANK_SELECT },
        },
      },
    },
  });
  if (!period) throw new Error("Invoice period not found.");
  if (period.status !== "PENDING_VERIFICATION") {
    throw new Error("Only invoices pending verification can be verified.");
  }
  if (!period.paymentProofPath) {
    throw new Error("This invoice has no payment proof to review.");
  }

  return applyInvoicePeriodPaid(period, {
    verifiedById: session.user.id,
    paymentManualReason: reason,
  });
}

/**
 * Admin / ops: reject proof and return invoice to awaiting payment.
 */
export async function rejectInvoicePaymentVerification(periodId: string) {
  await requireInvoiceManageAccess();

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    include: {
      project: { select: { clientId: true } },
    },
  });
  if (!period) throw new Error("Invoice period not found.");
  if (period.status !== "PENDING_VERIFICATION") {
    throw new Error("Only invoices pending verification can be rejected.");
  }

  const previousProof = period.paymentProofPath;

  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      status: "AWAITING_PAYMENT",
      paymentProofPath: null,
      paymentProofUploadedAt: null,
      paymentVerifiedAt: null,
      paymentVerifiedById: null,
    },
  });

  await deleteLocalUpload(previousProof);

  revalidateBillingPaths({
    projectId: period.projectId,
    clientId: period.project.clientId,
  });

  return { id: periodId, status: "AWAITING_PAYMENT" as const };
}

/**
 * Upload tax invoice (faktur) document and mark sent after Head Office confirm.
 * Independent of payment received — can happen before or after PAID.
 */
export async function markTaxInvoiceDone(formData: FormData) {
  const session = await requireTaxDocumentManageAccess();
  const reason = parseOptionalManualVerifyReason(formData.get("manualReason"));

  const periodId = String(formData.get("periodId") ?? "").trim();
  if (!periodId) throw new Error("Invoice period is required.");

  const taxInvoiceFile = requireImageOrPdfUpload(
    formData.get("taxInvoiceDocument"),
    {
      requiredMessage:
        "Please upload the tax invoice (faktur pajak) document.",
      sizeMessage: "Tax invoice document must be 10 MB or smaller.",
      typeMessage:
        "Tax invoice document must be an image (JPEG, PNG, WebP, GIF) or PDF.",
    }
  );

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    include: {
      project: {
        select: {
          id: true,
          clientId: true,
          contractPrice: true,
          chargedTaxKind: true,
          client: { select: { name: true, shortCode: true, npwp: true } },
          company: { select: { name: true } },
        },
      },
    },
  });
  if (!period) throw new Error("Invoice period not found.");
  if (period.taxInvoiceDoneAt) {
    throw new Error("Tax Invoice already marked sent.");
  }

  const { parsePpnRatePercent } = await import("@/lib/vat");
  const ppnRateRaw = String(formData.get("ppnRatePercent") ?? "").trim();
  const ppnRatePercent = parsePpnRatePercent(ppnRateRaw);
  if (ppnRatePercent == null) {
    throw new Error("Enter a valid output PPN rate percent.");
  }
  requireTaxInvoiceSerialVerified(formData.get("taxInvoiceSerialVerified"));
  const taxInvoiceSerial = parseRequiredTaxInvoiceSerial(
    formData.get("taxInvoiceSerial")
  );

  const previousTaxDoc = period.taxInvoiceDocumentPath;
  const uploadedAt = new Date();
  const taxInvoiceDocumentPath = await saveUpload(
    taxInvoiceFile,
    "uploads/tax-invoices",
    {
      fileBaseName: buildBillingDocumentFileBase({
        prefix: "Tax-Invoice",
        clientShortCode: period.project.client?.shortCode,
        clientName: period.project.client?.name,
        invoiceNumber: commercialInvoiceNumber(period),
      }),
    }
  );

  // Keep the uploaded tax invoice on file; do not mark done here.
  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      taxInvoiceDocumentPath,
      taxInvoiceDocumentUploadedAt: uploadedAt,
      taxInvoiceSerial,
      ppnRatePercent,
    },
  });

  const withholdingFile = formData.get("withholdingSlip");
  if (
    withholdingFile instanceof File &&
    withholdingFile.size > 0 &&
    !commercialTaxIncludesIncomeTax(period.project.chargedTaxKind)
  ) {
    throw new Error("This project does not charge income tax.");
  }
  if (withholdingFile instanceof File && withholdingFile.size > 0) {
    const slip = requireImageOrPdfUpload(withholdingFile, {
      requiredMessage: "Please upload the withholding tax slip (bukti potong).",
      sizeMessage: "Withholding tax slip must be 10 MB or smaller.",
      typeMessage:
        "Withholding tax slip must be an image (JPEG, PNG, WebP, GIF) or PDF.",
    });
    const withholdingSlipPath = await saveUpload(slip, "uploads/tax-invoices", {
      fileBaseName: buildBillingDocumentFileBase({
        prefix: "Withholding-Slip",
        clientShortCode: period.project.client?.shortCode,
        clientName: period.project.client?.name,
        invoiceNumber: commercialInvoiceNumber(period),
      }),
    });
    await prisma.$executeRaw`
      UPDATE "ProjectInvoicePeriod"
      SET "withholdingSlipPath" = ${withholdingSlipPath},
          "withholdingSlipUploadedAt" = ${uploadedAt}
      WHERE id = ${periodId}
    `;
  }

  if (previousTaxDoc && previousTaxDoc !== taxInvoiceDocumentPath) {
    await deleteLocalUpload(previousTaxDoc);
  }

  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      taxInvoiceRequired: true,
      taxInvoiceDoneAt: uploadedAt,
      taxInvoiceDoneById: session.user.id,
      taxInvoiceManualReason: reason,
      ppnRatePercent,
    },
  });

  revalidateBillingPaths({
    projectId: period.projectId,
    clientId: period.project.clientId,
  });

  await tryCompleteSettledProject(period.projectId);
}

export async function uploadPeriodWithholdingSlip(formData: FormData) {
  const session = await requireTaxDocumentManageAccess();
  const periodId = String(formData.get("periodId") ?? "").trim();
  if (!periodId) throw new Error("Invoice period is required.");

  const slip = requireImageOrPdfUpload(formData.get("withholdingSlip"), {
    requiredMessage: "Please upload the withholding tax slip (bukti potong).",
    sizeMessage: "Withholding tax slip must be 10 MB or smaller.",
    typeMessage:
      "Withholding tax slip must be an image (JPEG, PNG, WebP, GIF) or PDF.",
  });

  const period = await prisma.projectInvoicePeriod.findFirst({
    where: {
      id: periodId,
      project: { companyId: session.user.companyId },
    },
    select: {
      id: true,
      periodStart: true,
      milestonePercent: true,
      withholdingSlipPath: true,
      project: {
        select: {
          id: true,
          clientId: true,
          chargedTaxKind: true,
          client: { select: { name: true, shortCode: true } },
        },
      },
    },
  });
  if (!period) throw new Error("Invoice period not found.");
  if (!commercialTaxIncludesIncomeTax(period.project.chargedTaxKind)) {
    throw new Error("This project does not charge income tax.");
  }
  if (period.withholdingSlipPath) {
    throw new Error("Withholding tax slip already uploaded.");
  }

  const withholdingSlipPath = await saveUpload(slip, "uploads/tax-invoices", {
    fileBaseName: buildBillingDocumentFileBase({
      prefix: "Withholding-Slip",
      clientShortCode: period.project.client?.shortCode,
      clientName: period.project.client?.name,
      invoiceNumber: commercialInvoiceNumber(period),
    }),
  });

  try {
    await prisma.projectInvoicePeriod.update({
      where: { id: period.id },
      data: {
        withholdingSlipPath,
        withholdingSlipUploadedAt: new Date(),
      },
    });
  } catch (error) {
    await deleteLocalUpload(withholdingSlipPath);
    throw error;
  }

  revalidateBillingPaths({
    projectId: period.project.id,
    clientId: period.project.clientId,
  });
}

async function tryCompleteSettledProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      status: true,
      billingMode: true,
      subCategory: true,
      endDate: true,
      invoicePeriods: {
        select: {
          status: true,
          periodEnd: true,
          taxInvoiceDoneAt: true,
          milestonePercent: true,
        },
      },
    },
  });
  if (!project || project.status === "CANCELLED" || project.status === "COMPLETED") {
    return;
  }
  const lastPaid = project.invoicePeriods
    .filter((row) => row.status === "PAID")
    .sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime())[0];
  if (!lastPaid) return;
  if (
    !shouldCompleteProjectAfterSettlement({
      billingMode: project.billingMode,
      subCategory: project.subCategory,
      projectStatus: project.status,
      endDate: project.endDate,
      lastPaidPeriodEnd: lastPaid.periodEnd,
      periods: project.invoicePeriods,
    })
  ) {
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: project.id },
      data: { status: "COMPLETED" },
    });
    await tx.projectInvoicePeriod.deleteMany({
      where: { projectId: project.id, status: "ONGOING" },
    });
  });
}

/**
 * Mark a MONTHLY billing period reconciled, compile the CICO reconciliation
 * report, and send it to the client portal for Approve / Revise.
 * Amount mode: Keep (contract / period amount) or Adjust (OM+ required).
 * Only open due periods (day after periodEnd) can be reconciled.
 */
export async function reconcileInvoicePeriod(formData: FormData) {
  const session = await requireInvoiceManageAccess();
  const periodId = String(formData.get("periodId") ?? "").trim();
  const amountMode = String(formData.get("amountMode") ?? "keep")
    .trim()
    .toLowerCase();
  const adjustRaw = String(formData.get("adjustedAmount") ?? "").trim();

  if (!periodId) throw new Error("Period is required.");

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    include: {
      project: {
        select: {
          id: true,
          clientId: true,
          billingMode: true,
          subCategory: true,
          status: true,
          serviceArea: true,
          contractPrice: true,
          chargedTaxKind: true,
          requiresTaxInvoice: true,
          pphRatePercent: true,
          isGovernmentContract: true,
        },
      },
    },
  });

  if (!period) throw new Error("Invoice period not found.");
  if (period.project.billingMode !== "MONTHLY") {
    throw new Error("Reconcile is only for monthly Regular Cleaning cycles.");
  }
  if (!isContractCycleSubCategory(period.project.subCategory)) {
    throw new Error("Reconcile is only for Regular Cleaning and Security contracts.");
  }
  if (
    period.project.status === "CANCELLED" ||
    period.project.status === "COMPLETED"
  ) {
    throw new Error("Ended or cancelled contracts cannot be reconciled here.");
  }
  if (period.status !== "ONGOING" && period.status !== "COMPILING") {
    throw new Error("This period has already been invoiced.");
  }
  if (period.reconciledAt) {
    throw new Error("This period is already reconciled.");
  }
  if (!isAnniversaryPeriodDue(new Date(), period.periodEnd)) {
    throw new Error(
      "This cycle is not due yet. Reconcile the day after the period ends."
    );
  }

  const previousAmount = period.amount;
  let amountUpdate: { amount: number } | Record<string, never> = {};
  if (amountMode === "adjust") {
    const adjusted = parseContractPrice(adjustRaw);
    if (adjusted == null || adjusted <= 0) {
      throw new Error("Enter a valid adjusted invoice amount.");
    }
    await assertCanApproveProjectServiceArea({
      userId: session.user.id,
      username: session.user.username,
      permissionUser: toPermissionUser(session),
      projectServiceArea: period.project.serviceArea,
      projectId: period.project.id,
    });
    amountUpdate = {
      amount:
        invoiceGrossFromExclusivePrice(adjusted, {
          chargedTaxKind: period.project.chargedTaxKind,
          requiresTaxInvoice: period.project.requiresTaxInvoice,
          pphRatePercent: decimalToNumber(period.project.pphRatePercent),
          isGovernmentContract: period.project.isGovernmentContract,
        }) ?? adjusted,
    };
  } else if (decimalToNumber(period.amount) == null) {
    const fallback = invoiceGrossFromExclusivePrice(
      decimalToNumber(period.project.contractPrice),
      {
        chargedTaxKind: period.project.chargedTaxKind,
        requiresTaxInvoice: period.project.requiresTaxInvoice,
        pphRatePercent: decimalToNumber(period.project.pphRatePercent),
        isGovernmentContract: period.project.isGovernmentContract,
      }
    );
    if (fallback != null && fallback > 0) {
      amountUpdate = { amount: fallback };
    }
  }

  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      reconciledAt: new Date(),
      reconciledById: session.user.id,
      ...amountUpdate,
    },
  });

  try {
    // Build CICO report + open client portal Approve/Revise.
    const { sendPeriodForClientReview } = await import(
      "@/app/billing/reconciliation/actions"
    );
    await sendPeriodForClientReview(periodId, "RECONCILIATION");
  } catch (error) {
    // Roll back reconcile mark + amount so staff can retry after fixing the failure.
    await prisma.projectInvoicePeriod.update({
      where: { id: periodId },
      data: {
        reconciledAt: null,
        reconciledById: null,
        amount: previousAmount,
      },
    });
    throw error;
  }

  revalidateBillingPaths({
    projectId: period.projectId,
    clientId: period.project.clientId,
  });
  revalidatePath("/billing/reconciliation");

  return { periodId, periodLabel: period.label };
}

/**
 * Reconcile the earliest due unreconciled anniversary cycle for an ongoing
 * Regular Cleaning contract.
 */
export async function reconcileDueInvoiceForProject(projectId: string): Promise<{
  reconciled: number;
  billingPath: string | null;
  periodLabel: string | null;
}> {
  await requireInvoiceManageAccess();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      clientId: true,
      billingMode: true,
      billingPeriodBasis: true,
      billingCycleStartDay: true,
      billingCycleEndDay: true,
      subCategory: true,
      status: true,
      startDate: true,
    },
  });

  if (!project) throw new Error("Project not found.");
  if (!isContractCycleSubCategory(project.subCategory)) {
    throw new Error("Reconcile is only for Regular Cleaning and Security contracts.");
  }
  if (project.billingMode !== "MONTHLY") {
    throw new Error("This project is not on monthly billing.");
  }
  if (project.status !== "IN_PROGRESS") {
    throw new Error("Only In Progress contracts can be reconciled this way.");
  }
  if (!project.startDate) {
    throw new Error(
      "Set the real contract start date (Move to In Progress) before reconciling."
    );
  }

  const billingPath = project.clientId
    ? `/billing/${project.clientId}/${project.id}`
    : "/billing";

  const today = toUtcDateOnly(new Date());
  await ensureAnniversaryPeriodsForProject(project, today);

  const openPeriods = await prisma.projectInvoicePeriod.findMany({
    where: {
      projectId,
      status: { in: ["ONGOING", "COMPILING"] },
      milestonePercent: null,
      reconciledAt: null,
    },
    orderBy: { periodStart: "asc" },
  });

  const duePeriod =
    openPeriods.find((p) =>
      isMonthlyPeriodAwaitingReconcile(
        {
          status: p.status,
          periodEnd: p.periodEnd,
          reconciledAt: p.reconciledAt,
        },
        today
      )
    ) ?? null;

  if (!duePeriod) {
    return { reconciled: 0, billingPath, periodLabel: null };
  }

  const reconcileForm = new FormData();
  reconcileForm.set("periodId", duePeriod.id);
  reconcileForm.set("amountMode", "keep");
  await reconcileInvoicePeriod(reconcileForm);

  return {
    reconciled: 1,
    billingPath,
    periodLabel: duePeriod.label,
  };
}

/**
 * Invoice the earliest due reconciled anniversary cycle for an ongoing Regular
 * Cleaning contract. Does NOT mark the project COMPLETED — the project stays
 * active; only this period’s invoice moves to Payment Due.
 */
export async function issueInvoiceForCurrentMonth(projectId: string): Promise<{
  compiled: number;
  billingPath: string | null;
  periodLabel: string | null;
}> {
  await requireInvoiceManageAccess();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      clientId: true,
      billingMode: true,
      billingPeriodBasis: true,
      billingCycleStartDay: true,
      billingCycleEndDay: true,
      subCategory: true,
      status: true,
      startDate: true,
    },
  });

  if (!project) throw new Error("Project not found.");
  if (!isContractCycleSubCategory(project.subCategory)) {
    throw new Error(
      "Invoice this month is only for Regular Cleaning and Security contracts."
    );
  }
  if (project.billingMode !== "MONTHLY") {
    throw new Error("This project is not on monthly billing.");
  }
  if (project.status === "CANCELLED") {
    throw new Error("Cancelled projects cannot be invoiced.");
  }
  if (project.status === "COMPLETED") {
    throw new Error(
      "This contract has already ended. Use Invoice and Billing for remaining periods."
    );
  }
  if (!project.startDate) {
    throw new Error(
      "Set the real contract start date (Move to In Progress) before invoicing."
    );
  }

  const billingPath = project.clientId
    ? `/billing/${project.clientId}/${project.id}`
    : "/billing";

  const today = toUtcDateOnly(new Date());
  await ensureAnniversaryPeriodsForProject(project, today);

  const openPeriods = await prisma.projectInvoicePeriod.findMany({
    where: {
      projectId,
      status: { in: ["ONGOING", "COMPILING"] },
      milestonePercent: null,
    },
    orderBy: { periodStart: "asc" },
  });

  const awaitingReconcile =
    openPeriods.find((p) =>
      isMonthlyPeriodAwaitingReconcile(
        {
          status: p.status,
          periodEnd: p.periodEnd,
          reconciledAt: p.reconciledAt,
        },
        today
      )
    ) ?? null;
  if (awaitingReconcile) {
    throw new Error(
      "Reconcile this billing period before submitting the invoice."
    );
  }

  const duePeriod =
    openPeriods.find((p) =>
      isMonthlyPeriodReadyToSubmitInvoice(
        {
          status: p.status,
          periodEnd: p.periodEnd,
          reconciledAt: p.reconciledAt,
        },
        today
      )
    ) ?? null;

  if (!duePeriod) {
    const alreadyIssuedDue = await prisma.projectInvoicePeriod.findFirst({
      where: {
        projectId,
        milestonePercent: null,
        periodEnd: { lt: today },
        status: { in: ["AWAITING_PAYMENT", "OVERDUE", "PENDING_VERIFICATION", "PAID"] },
      },
      orderBy: { periodEnd: "desc" },
      select: { label: true },
    });
    return {
      compiled: 0,
      billingPath,
      periodLabel: alreadyIssuedDue?.label ?? openPeriods[0]?.label ?? null,
    };
  }

  await compileInvoicePeriod(duePeriod.id);

  revalidateBillingPaths({
    projectId: project.id,
    clientId: project.clientId,
  });

  return {
    compiled: 1,
    billingPath,
    periodLabel: duePeriod.label,
  };
}

/**
 * After a project is marked COMPLETED, compile/issue outstanding invoices
 * (monthly open periods, or final 100% milestone) and email the client.
 */
export async function issueInvoicesForFinishedProject(projectId: string): Promise<{
  compiled: number;
  billingPath: string | null;
}> {
  const session = await requireInvoiceManageAccess();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      clientId: true,
      billingMode: true,
      billingPeriodBasis: true,
      billingCycleStartDay: true,
      billingCycleEndDay: true,
      startDate: true,
      contractPrice: true,
      subCategory: true,
      invoicePeriods: {
        select: {
          id: true,
          status: true,
          milestonePercent: true,
          periodStart: true,
        },
      },
    },
  });

  if (!project) throw new Error("Project not found.");

  const billingPath = project.clientId
    ? `/billing/${project.clientId}/${project.id}`
    : "/billing";

  // Parking / Payroll Management store commercial terms only — no periods.
  if (!usesInvoicePeriods(project.subCategory)) {
    return { compiled: 0, billingPath };
  }

  let compiled = 0;

  if (project.billingMode === "MONTHLY") {
    if (project.startDate) {
      await ensureAnniversaryPeriodsForProject(
        {
          id: project.id,
          startDate: project.startDate,
          billingMode: project.billingMode,
          billingPeriodBasis: project.billingPeriodBasis,
          billingCycleStartDay: project.billingCycleStartDay,
          billingCycleEndDay: project.billingCycleEndDay,
          subCategory: project.subCategory,
          // Force ensure even though finish may have set COMPLETED already.
          status: "IN_PROGRESS",
        },
        toUtcDateOnly(new Date()),
        // Do not open a future cycle — end-contract invoices open rows only.
        { includeNextIfDue: false }
      );
    }

    // End Contract skips the in-progress reconcile UX — mark open cycles reconciled.
    await prisma.projectInvoicePeriod.updateMany({
      where: {
        projectId,
        status: { in: ["ONGOING", "COMPILING"] },
        reconciledAt: null,
      },
      data: {
        reconciledAt: new Date(),
        reconciledById: session.user.id,
      },
    });

    const openPeriods = await prisma.projectInvoicePeriod.findMany({
      where: {
        projectId,
        status: { in: ["ONGOING", "COMPILING"] },
      },
      orderBy: { periodStart: "asc" },
      select: { id: true },
    });

    const errors: string[] = [];
    for (const period of openPeriods) {
      try {
        await compileInvoicePeriod(period.id);
        compiled += 1;
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : "Failed to compile invoice."
        );
      }
    }

    if (compiled === 0 && errors.length > 0) {
      throw new Error(errors[0]);
    }

    if (compiled === 0) {
      const latestPeriods = await prisma.projectInvoicePeriod.findMany({
        where: { projectId },
        select: { status: true },
      });
      const hasIssued = latestPeriods.some((p) =>
        ["AWAITING_PAYMENT", "PENDING_VERIFICATION", "PAID", "OVERDUE"].includes(p.status)
      );
      if (!hasIssued) {
        throw new Error(
          "No invoice could be compiled for this project. Open Invoice and Billing to issue it manually."
        );
      }
    }
  } else if (project.billingMode === "ON_COMPLETION") {
    // One completion invoice only — reuse any open seed/legacy row instead of
    // creating a second period with different dates ("On completion" vs
    // "Completion invoice").
    const issuedStatuses = [
      "AWAITING_PAYMENT",
      "PAID",
      "OVERDUE",
      "COMPILING",
    ] as const;
    const hasIssued = project.invoicePeriods.some((p) =>
      (issuedStatuses as readonly string[]).includes(p.status)
    );

    if (!hasIssued) {
      const today = toUtcDateOnly(new Date());
      const openPeriods = await prisma.projectInvoicePeriod.findMany({
        where: {
          projectId,
          status: { in: ["ONGOING", "COMPILING"] },
          milestonePercent: null,
        },
        orderBy: { periodStart: "asc" },
        select: {
          id: true,
          label: true,
          reportCount: true,
          invoicePdfPath: true,
        },
      });

      const preferred =
        openPeriods.find((p) => isCompletionPeriodLabel(p.label)) ??
        openPeriods[0] ??
        null;

      let targetId: string;
      if (preferred) {
        await prisma.projectInvoicePeriod.update({
          where: { id: preferred.id },
          data: { label: COMPLETION_INVOICE_LABEL },
        });
        targetId = preferred.id;
      } else {
        const periodStart = project.startDate
          ? toUtcDateOnly(project.startDate)
          : today;
        const periodEnd =
          today.getTime() < periodStart.getTime() ? periodStart : today;
        const created = await getOrCreatePeriod(
          projectId,
          periodStart,
          periodEnd,
          COMPLETION_INVOICE_LABEL
        );
        targetId = created.id;
      }

      await compileInvoicePeriod(targetId);
      compiled = 1;

      // Drop leftover open completion duplicates (no PDF / not the target).
      for (const period of openPeriods) {
        if (period.id === targetId) continue;
        if (period.invoicePdfPath) continue;
        try {
          await prisma.projectInvoicePeriod.delete({ where: { id: period.id } });
        } catch {
          // Keep if FK-protected (reports attached); display dedupe covers UI.
        }
      }
    }
  } else if (project.billingMode === "MULTI_VISIT") {
    // Each visit is invoiced only after that visit is approved.
  } else if (project.billingMode === "MILESTONE") {
    const priorMax = maxMilestonePercent(
      project.invoicePeriods.map((p) => ({
        milestonePercent: p.milestonePercent,
        status: p.status,
      }))
    );

    if (priorMax < 100) {
      const contractPrice = decimalToNumber(project.contractPrice);
      if (contractPrice == null || contractPrice <= 0) {
        throw new Error(
          "Set a contract price in Invoice and Billing before finishing this project."
        );
      }

      // Issue remaining scheduled ONGOING milestones in order through 100%.
      const remaining = [...project.invoicePeriods]
        .filter(
          (p) =>
            p.milestonePercent != null &&
            (p.status === "ONGOING" || p.status === "COMPILING") &&
            p.milestonePercent > priorMax
        )
        .sort(
          (a, b) => (a.milestonePercent ?? 0) - (b.milestonePercent ?? 0)
        );

      if (remaining.length > 0) {
        for (const period of remaining) {
          await issueMilestonePeriod(period.id);
          compiled += 1;
        }
      } else {
        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("milestonePercent", "100");
        await createMilestoneInvoice(formData);
        compiled = 1;
      }
    }
  } else {
    throw new Error(`Unsupported billing mode: ${project.billingMode}`);
  }

  revalidateBillingPaths({
    projectId: project.id,
    clientId: project.clientId,
  });

  return { compiled, billingPath };
}

/**
 * Ensures anniversary periods exist for MONTHLY (Regular Cleaning) projects
 * and counts due cycles awaiting reconcile / invoice submit.
 * Does not auto-compile — staff must Reconcile then Submit invoice.
 */
const COMPANY_ANNIVERSARY_SYNC_TTL_MS = 2 * 60 * 1000;
const companyAnniversarySyncedAt = new Map<string, number>();
const companyAnniversaryInFlight = new Map<
  string,
  Promise<{
    compiled: number;
    checked: number;
    dueReminders: number;
    errors: string[];
  }>
>();

async function runAnniversaryMonthlyInvoicingForCompany(companyId: string) {
  const last = companyAnniversarySyncedAt.get(companyId) ?? 0;
  if (Date.now() - last < COMPANY_ANNIVERSARY_SYNC_TTL_MS) {
    return { compiled: 0, checked: 0, dueReminders: 0, errors: [] };
  }
  const inFlight = companyAnniversaryInFlight.get(companyId);
  if (inFlight) return inFlight;

  const work = runAnniversaryMonthlyInvoicingForCompanyNow(companyId).finally(
    () => {
      companyAnniversaryInFlight.delete(companyId);
    }
  );
  companyAnniversaryInFlight.set(companyId, work);
  return work;
}

async function runAnniversaryMonthlyInvoicingForCompanyNow(companyId: string) {
  const today = toUtcDateOnly(new Date());

  const projects = await prisma.project.findMany({
    where: {
      companyId,
      billingMode: "MONTHLY",
      // In Progress only — Planning waits for work order; ended contracts block History.
      status: "IN_PROGRESS",
      startDate: { not: null },
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      startDate: true,
      billingMode: true,
      billingPeriodBasis: true,
      billingCycleStartDay: true,
      billingCycleEndDay: true,
      invoicingDay: true,
      status: true,
      subCategory: true,
    },
  });

  const compiled = 0;
  let dueReminders = 0;
  const errors: string[] = [];

  for (const project of projects) {
    if (!usesInvoicePeriods(project.subCategory)) continue;
    try {
      await ensureAnniversaryPeriodsForProject(project, today);
    } catch (error) {
      errors.push(
        `${project.name}: ${
          error instanceof Error ? error.message : "failed to sync periods"
        }`
      );
      continue;
    }

    const duePeriods = await prisma.projectInvoicePeriod.findMany({
      where: {
        projectId: project.id,
        status: { in: ["ONGOING", "COMPILING"] },
        milestonePercent: null,
        periodEnd: { lt: today },
      },
      orderBy: { periodStart: "asc" },
      select: { id: true, periodEnd: true, label: true },
    });

    for (const period of duePeriods) {
      if (!isAnniversaryPeriodDue(today, period.periodEnd)) continue;
      dueReminders += 1;
    }
  }

  companyAnniversarySyncedAt.set(companyId, Date.now());

  return {
    compiled,
    checked: projects.length,
    dueReminders,
    errors,
  };
}

/**
 * Soft auto-sync on app load: ensure anniversary cycles exist and count due
 * reminders. Does not submit invoices (reconcile → submit is staff-driven).
 * No-ops for client portal users or users without billing/projects access.
 */
export async function syncDueMonthlyInvoicesOnLoad(): Promise<{
  compiled: number;
  checked: number;
  dueReminders: number;
  errors: string[];
} | null> {
  const session = await requireSession();
  if (session.user.clientId) return null;

  const user = toPermissionUser(session);
  if (!canAccess(user, "projects") && !canAccess(user, "invoicing")) {
    return null;
  }

  return runAnniversaryMonthlyInvoicingForCompany(session.user.companyId);
}

/** Count open anniversary periods that are past their invoice-due day. */
export async function countDueMonthlyInvoiceReminders(): Promise<number> {
  const session = await requireSession();
  if (session.user.clientId) return 0;

  const today = toUtcDateOnly(new Date());
  return prisma.projectInvoicePeriod.count({
    where: {
      status: { in: ["ONGOING", "COMPILING"] },
      milestonePercent: null,
      periodEnd: { lt: today },
      project: {
        companyId: session.user.companyId,
        billingMode: "MONTHLY",
        status: "IN_PROGRESS",
        startDate: { not: null },
      },
    },
  });
}
