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
import { generateInvoicePeriodPdf } from "@/lib/progress-report-pdf";
import {
  sendInvoiceEmail,
  sendInvoiceWhatsAppStub,
} from "@/lib/invoice-delivery";
import { formatContactPersonName } from "@/lib/contact-person";
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
} from "@/lib/project-billing";
import { isContractSubCategory } from "@/lib/project-contract";
import {
  isProjectFullyPaid,
  OPEN_COLLECTION_STATUSES,
} from "@/lib/billing";
import {
  contractCyclePeriodBounds,
  dueAtFromClientPaymentTerms,
  invoiceIssueCalendarDate,
  isAnniversaryPeriodDue,
  isCalendarMonthPeriodBounds,
  isMonthlyPeriodAwaitingReconcile,
  isMonthlyPeriodReadyToSubmitInvoice,
  invoicingDayFromContractStart,
  matchingContractCycleIndex,
  monthPeriodBounds,
  previousMonthPeriodBounds,
  resolveContractCycleIndex,
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
import { resolveCompanyBankDetails } from "@/lib/company-bank";
import {
  taxInvoiceDateToUtcDate,
  utcCalendarDateString,
  verifyPaymentProof,
  verifyTaxInvoiceDocument,
  type TaxInvoiceConflictKind,
} from "@/lib/payment-document-verify";
import { paymentVerifyFailureMessage } from "@/lib/payment-verify-messages";
import { canIssueInvoiceAfterReview } from "@/lib/client-billing-review";

const COMPANY_BANK_SELECT = {
  name: true,
  email: true,
  phone: true,
  address: true,
  bankName: true,
  bankAccountNumber: true,
  bankAccountName: true,
} as const;

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
  revalidatePath("/invoicing");
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
  return prisma.projectInvoicePeriod.upsert({
    where: {
      projectId_periodStart_periodEnd: {
        projectId,
        periodStart,
        periodEnd,
      },
    },
    // Refresh label so monthly rows pick up date-range wording on revisit.
    update: { label },
    create: {
      projectId,
      periodStart,
      periodEnd,
      label,
      status: "ONGOING",
    },
  });
}

async function getOrCreateContractCyclePeriod(
  projectId: string,
  contractStart: Date,
  cycleIndex: number
) {
  const bounds = contractCyclePeriodBounds(contractStart, cycleIndex);
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
  basis: "CALENDAR_MONTH" | "CONTRACT_CYCLE" | null | undefined
) {
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
        : matchingContractCycleIndex(
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
 * Syncs project.invoicingDay from the real contract start for Contract Cycle.
 */
async function ensureAnniversaryPeriodsForProject(
  project: {
    id: string;
    startDate: Date | null;
    billingMode: string;
    status: string;
    billingPeriodBasis?: "CALENDAR_MONTH" | "CONTRACT_CYCLE" | null;
  },
  ref: Date = new Date(),
  opts?: { includeNextIfDue?: boolean }
) {
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
  const invoicingDay =
    basis === "CALENDAR_MONTH"
      ? 1
      : invoicingDayFromContractStart(contractStart);

  await prisma.project.update({
    where: { id: project.id },
    data: { invoicingDay },
  });

  await purgeMismatchedOngoingMonthlyPeriods(project.id, contractStart, basis);

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

  const currentIndex = resolveContractCycleIndex(contractStart, today);
  await getOrCreateContractCyclePeriod(project.id, contractStart, currentIndex);
  if (currentIndex > 1) {
    await getOrCreateContractCyclePeriod(
      project.id,
      contractStart,
      currentIndex - 1
    );
  }

  // Ongoing contracts: open the next cycle once the current one is due.
  const currentBounds = contractCyclePeriodBounds(contractStart, currentIndex);
  if (
    includeNextIfDue &&
    isAnniversaryPeriodDue(today, currentBounds.periodEnd)
  ) {
    await getOrCreateContractCyclePeriod(
      project.id,
      contractStart,
      currentIndex + 1
    );
  }

  return { contractStart, currentIndex, invoicingDay };
}

async function cycleIndexForPeriodEnd(
  contractStart: Date,
  periodEnd: Date
): Promise<number> {
  const end = toUtcDateOnly(periodEnd);
  for (let i = 1; i < 2400; i += 1) {
    const bounds = contractCyclePeriodBounds(contractStart, i);
    if (bounds.periodEnd.getTime() === end.getTime()) return i;
  }
  return resolveContractCycleIndex(contractStart, end);
}

async function ensureNextContractCycleAfter(
  projectId: string,
  contractStart: Date,
  periodEnd: Date,
  basis?: "CALENDAR_MONTH" | "CONTRACT_CYCLE" | null
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
  const index = await cycleIndexForPeriodEnd(contractStart, periodEnd);
  await getOrCreateContractCyclePeriod(projectId, contractStart, index + 1);
}

async function deliverInvoice(opts: {
  projectName: string;
  client: {
    email: string | null;
    name: string;
    phone: string | null;
    contactPersonFirstName: string | null;
    contactPersonLastName: string | null;
    contactPersonEmail: string | null;
    contactPersonPhone: string | null;
  } | null;
  periodLabel: string;
  amount: number | null;
  pdfPath: string;
}) {
  const amountLabel =
    opts.amount != null ? formatContractPrice(opts.amount) : null;
  const toEmail =
    opts.client?.contactPersonEmail?.trim() || opts.client?.email;
  const toPhone =
    opts.client?.contactPersonPhone?.trim() || opts.client?.phone;
  await sendInvoiceEmail({
    toEmail,
    clientName: opts.client?.name,
    contactPersonName: formatContactPersonName(
      opts.client?.contactPersonFirstName,
      opts.client?.contactPersonLastName
    ),
    projectName: opts.projectName,
    periodLabel: opts.periodLabel,
    amountLabel,
    pdfPublicPath: opts.pdfPath,
  });
  await sendInvoiceWhatsAppStub({
    toEmail,
    clientName: opts.client?.name,
    projectName: opts.projectName,
    periodLabel: opts.periodLabel,
    amountLabel,
    pdfPublicPath: opts.pdfPath,
    phone: toPhone,
  });
}

/** Sync anniversary cycles for one project (no path revalidation). */
export async function syncProjectMonthlyPeriods(projectId: string) {
  await requireInvoiceManageAccess();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found.");

  await ensureAnniversaryPeriodsForProject(project);
  return { clientId: project.clientId };
}

export async function ensureProjectInvoicePeriods(projectId: string) {
  const { clientId } = await syncProjectMonthlyPeriods(projectId);

  revalidateBillingPaths({
    projectId,
    clientId,
  });
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
      "Use milestone invoicing for General / Facade Cleaning projects."
    );
  }
  if (period.project.billingMode === "MONTHLY" && !period.reconciledAt) {
    throw new Error(
      "Reconcile this billing period before submitting the invoice."
    );
  }
  // Client-approval path: must be approved. HO may still compile after approval.
  if (
    period.clientReviewStatus !== "NONE" &&
    !canIssueInvoiceAfterReview(period.clientReviewStatus)
  ) {
    throw new Error(
      "Wait for the client to approve the reconciliation (or resolve a revision) before invoicing."
    );
  }

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
      period.project.client?.paymentTermsDays
    );
    // Revised amount (HO after client revise) > period amount > contract price.
    const revisedAmount = decimalToNumber(period.revisedInvoiceAmount);
    const periodAmount = decimalToNumber(period.amount);
    const contractPrice = decimalToNumber(period.project.contractPrice);
    const invoiceAmount = revisedAmount ?? periodAmount ?? contractPrice;
    const amountLabel =
      invoiceAmount != null ? formatContractPrice(invoiceAmount) : null;
    const invoiceNumber =
      period.revisedInvoiceNumber?.trim() ||
      `INV-${period.periodStart.getUTCFullYear()}${String(
        period.periodStart.getUTCMonth() + 1
      ).padStart(2, "0")}-${periodId.slice(-6).toUpperCase()}`;

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
      paymentTermsDays: period.project.client?.paymentTermsDays,
      invoiceNumber,
      company: period.project.company,
      title:
        period.project.billingMode === "ON_COMPLETION"
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
          ...(invoiceAmount != null ? { amount: invoiceAmount } : {}),
          ...(period.project.requiresTaxInvoice
            ? { taxInvoiceRequired: true }
            : {}),
        },
      }),
    ]);

    // Issuing an invoice leaves Planning — same as milestone compile — so
    // Payment Due / In Progress stay consistent without a manual move.
    if (
      period.project.status === "PLANNED" ||
      period.project.status === "ON_HOLD"
    ) {
      await prisma.project.update({
        where: { id: period.projectId },
        data: { status: "IN_PROGRESS" },
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
        period.project.billingPeriodBasis
      );
    }

    revalidateBillingPaths({
      projectId: period.projectId,
      clientId: period.project.clientId,
    });
    revalidatePath("/reports");

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
      const revisions = recalculateUnpaidMilestoneAmounts(
        project.invoicePeriods.map((p) => ({
          id: p.id,
          milestonePercent: p.milestonePercent,
          amount: decimalToNumber(p.amount),
          status: p.status,
          compileNote: p.compileNote,
        })),
        contractPrice
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
export async function issueMilestonePeriod(periodId: string) {
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
      "Milestone payment schedules are only for General Cleaning and Facade Cleaning."
    );
  }

  if (
    period.clientReviewStatus !== "NONE" &&
    !canIssueInvoiceAfterReview(period.clientReviewStatus)
  ) {
    throw new Error(
      "Send the progress package for client approval before invoicing this milestone."
    );
  }

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
    amount = Math.round(((contractPrice * slicePercent) / 100) * 100) / 100;
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
      project.client?.paymentTermsDays
    );
    const invoiceNumber =
      period.revisedInvoiceNumber?.trim() ||
      `INV-M${String(milestonePercent).replace(".", "")}-${period.id
        .slice(-6)
        .toUpperCase()}`;
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
      paymentTermsDays: project.client?.paymentTermsDays,
      invoiceNumber,
      company: project.company,
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
          ...(project.requiresTaxInvoice ? { taxInvoiceRequired: true } : {}),
        },
      }),
    ]);

    if (milestonePercent >= 100 && project.status !== "CANCELLED") {
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "COMPLETED" },
      });
    } else if (
      project.status === "PLANNED" ||
      project.status === "ON_HOLD"
    ) {
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "IN_PROGRESS" },
      });
    }

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
 * Create a milestone progress invoice for General / Facade projects.
 * Prefer {@link issueMilestonePeriod} when a schedule already exists.
 * Amount = contractPrice * (percent - alreadyInvoicedPercent) / 100
 * when using cumulative %, OR contractPrice * percent/100 when percent is
 * treated as the invoice slice. We use cumulative progress %:
 * e.g. 30 then 60 invoices 30% then another 30%.
 */
export async function createMilestoneInvoice(formData: FormData) {
  const session = await requireInvoiceManageAccess();

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
    throw new Error("Milestone invoicing is only for General / Facade projects.");
  }
  if (!isMilestoneSubCategory(project.subCategory)) {
    throw new Error(
      "Milestone payment schedules are only for General Cleaning and Facade Cleaning."
    );
  }

  // If a matching scheduled ONGOING period exists, issue that instead of creating a duplicate.
  const scheduled = project.invoicePeriods.find(
    (p) =>
      p.milestonePercent === milestonePercent &&
      (p.status === "ONGOING" || p.status === "COMPILING")
  );
  if (scheduled) {
    return issueMilestonePeriod(scheduled.id);
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

  // Prefer invoicing the next scheduled period when a plan exists.
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
  let amount = (contractPrice * slicePercent) / 100;

  if (amountOverrideRaw) {
    const override = Number(amountOverrideRaw.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(override) || override <= 0) {
      throw new Error("Invalid invoice amount override.");
    }
    amount = override;
  }

  amount = Math.round(amount * 100) / 100;

  const today = toUtcDateOnly(new Date());
  const lastDelivered = project.invoicePeriods
    .filter((p) =>
      ["AWAITING_PAYMENT", "PENDING_VERIFICATION", "PAID", "OVERDUE", "COMPILING"].includes(p.status)
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
  const periodEnd = today.getTime() < periodStart.getTime() ? periodStart : today;

  const label = formatMilestoneScheduleLabel(milestonePercent);

  // Avoid unique collisions if same-day re-invoice: bump end by seconds via date-only uniqueness —
  // if same start/end exists, nudge end forward by 1 day for uniqueness (rare same-day double).
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

  const period = await prisma.projectInvoicePeriod.create({
    data: {
      projectId,
      periodStart,
      periodEnd: safeEnd,
      label,
      status: "COMPILING",
      amount,
      milestonePercent,
    },
  });

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
    project.client?.paymentTermsDays
  );
  const invoiceNumber = `INV-M${String(milestonePercent).replace(".", "")}-${period.id.slice(-6).toUpperCase()}`;
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
    paymentTermsDays: project.client?.paymentTermsDays,
    invoiceNumber,
    company: project.company,
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
        ...(project.requiresTaxInvoice ? { taxInvoiceRequired: true } : {}),
      },
    }),
  ]);

  // Final milestone: mark project completed.
  if (milestonePercent >= 100 && project.status !== "CANCELLED") {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "COMPLETED" },
    });
  } else if (
    project.status === "PLANNED" ||
    project.status === "ON_HOLD"
  ) {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "IN_PROGRESS" },
    });
  }

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
 * Delete an unused or unpaid invoice period.
 * Allows ONGOING / COMPILING / AWAITING_PAYMENT / OVERDUE / PENDING_VERIFICATION.
 * Blocks PAID. Removes the period row and any local invoice PDF / payment proof.
 * Linked progress reports are unlinked (SetNull), not deleted.
 */
export async function deleteInvoicePeriod(periodId: string) {
  await requireInvoiceManageAccess();

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    select: {
      id: true,
      status: true,
      invoicePdfPath: true,
      paymentProofPath: true,
      taxInvoiceDocumentPath: true,
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

  const pdfPath = period.invoicePdfPath;
  const proofPath = period.paymentProofPath;
  const taxDocPath = period.taxInvoiceDocumentPath;

  await prisma.projectInvoicePeriod.delete({ where: { id: periodId } });
  await deleteLocalUpload(pdfPath);
  await deleteLocalUpload(proofPath);
  await deleteLocalUpload(taxDocPath);

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
    startDate: Date | null;
    invoicePeriods: {
      id: string;
      status: string;
      milestonePercent: number | null;
    }[];
  };
};

/**
 * Shared PAID transition + Completed Projects move rules.
 * Caller must already enforce access and allowed source statuses.
 */
async function applyInvoicePeriodPaid(
  period: MarkPaidPeriod,
  opts?: { verifiedById?: string }
) {
  const paidAt = new Date();
  await prisma.projectInvoicePeriod.update({
    where: { id: period.id },
    data: {
      status: "PAID",
      paidAt,
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
  const maxPaidOrIssued = maxMilestonePercent(periodsAfterPay);

  // Final collection on an ended / fully invoiced contract → Completed Projects.
  // Partial milestone payments (remaining schedule or progress < 100%) stay active.
  const shouldMoveToHistory =
    !hasOpenCollection &&
    isProjectFullyPaid(periodsAfterPay) &&
    (project.status === "COMPLETED" ||
      project.billingMode === "ON_COMPLETION" ||
      maxPaidOrIssued >= 100);

  if (shouldMoveToHistory) {
    await prisma.$transaction([
      prisma.project.update({
        where: { id: project.id },
        data: { status: "COMPLETED" },
      }),
      // Drop unissued leftover schedule/month rows so Completed Projects stays clean.
      prisma.projectInvoicePeriod.deleteMany({
        where: {
          projectId: project.id,
          status: "ONGOING",
        },
      }),
    ]);
  } else if (
    project.billingMode === "MONTHLY" &&
    project.startDate &&
    project.status === "IN_PROGRESS" &&
    !hasOpenCollection
  ) {
    // Contract continues — open the next anniversary / calendar-month cycle.
    await ensureNextContractCycleAfter(
      project.id,
      toUtcDateOnly(project.startDate),
      period.periodEnd,
      project.billingPeriodBasis
    );
  }

  revalidateBillingPaths({
    projectId: period.projectId,
    clientId: period.project.clientId,
  });

  return { movedToHistory: shouldMoveToHistory };
}

async function findTaxInvoiceConflict(query: {
  serial: string | null;
  documentHash: string;
  issuedDate: string | null;
  invoiceAmount: number;
  excludeId: string;
}): Promise<TaxInvoiceConflictKind | null> {
  const excludePeriod =
    query.excludeId.length > 0 ? { id: { not: query.excludeId } } : {};

  if (query.serial) {
    const bySerial = await prisma.projectInvoicePeriod.findFirst({
      where: {
        ...excludePeriod,
        taxInvoiceSerial: query.serial,
      },
      select: { id: true },
    });
    if (bySerial) return "serial";

    const byPurchaseSerial = await prisma.purchaseInvoice.findFirst({
      where: { taxInvoiceSerial: query.serial },
      select: { id: true },
    });
    if (byPurchaseSerial) return "serial";
  }

  const byHash = await prisma.projectInvoicePeriod.findFirst({
    where: {
      ...excludePeriod,
      taxInvoiceDocumentHash: query.documentHash,
    },
    select: { id: true },
  });
  if (byHash) return "document_hash";

  const byPurchaseHash = await prisma.purchaseInvoice.findFirst({
    where: { taxInvoiceDocumentHash: query.documentHash },
    select: { id: true },
  });
  if (byPurchaseHash) return "document_hash";

  if (query.issuedDate) {
    const byDateAmount = await prisma.projectInvoicePeriod.findFirst({
      where: {
        ...excludePeriod,
        taxInvoiceIssuedAt: taxInvoiceDateToUtcDate(query.issuedDate),
        amount: query.invoiceAmount,
        OR: [{ status: "PAID" }, { taxInvoiceDoneAt: { not: null } }],
      },
      select: { id: true },
    });
    if (byDateAmount) return "date_amount";
  }

  return null;
}

/**
 * Admin / ops: mark Payment received after uploading proof of payment.
 * Tax invoice (faktur) is tracked separately via markTaxInvoiceDone.
 * Upload is stored first; AI verification must pass before PAID.
 */
export async function markInvoicePeriodPaid(formData: FormData) {
  await requireInvoiceManageAccess();
  const locale = await getServerLocale();

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
          startDate: true,
          contractPrice: true,
          invoicePeriods: {
            select: { id: true, status: true, milestonePercent: true },
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

  // Persist upload even when verification fails (audit trail); do not mark PAID.
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

  const periodAmount = decimalToNumber(period.amount);
  const contractPrice = decimalToNumber(period.project.contractPrice);
  const invoiceAmount = periodAmount ?? contractPrice;
  const companyBank = resolveCompanyBankDetails(period.project.company);

  const verification = await verifyPaymentProof({
    paymentProof: proof,
    invoiceAmount,
    invoiceIssuedDate: utcCalendarDateString(period.submittedAt),
    companyBank,
    invoiceNumber,
    clientName: period.project.client?.name ?? null,
  });

  if (!verification.ok) {
    const lines = verification.failures.map((code) =>
      paymentVerifyFailureMessage(locale, code, verification.details)
    );
    const header = translate(locale, "pages.billing.paymentVerifyRejected");
    throw new Error([header, ...lines.map((line) => `• ${line}`)].join("\n"));
  }

  return applyInvoicePeriodPaid(period);
}

/**
 * Client portal: upload proof of payment and submit for admin verification.
 * Status becomes PENDING_VERIFICATION (not PAID).
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
          client: { select: { name: true, shortCode: true } },
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
  const paymentProofPath = await saveUpload(proof, "uploads/payment-proofs", {
    fileBaseName: buildBillingDocumentFileBase({
      prefix: "Proof-of-Payment",
      clientShortCode: period.project.client?.shortCode,
      clientName: period.project.client?.name,
      invoiceNumber: commercialInvoiceNumber(period),
      date: uploadedAt,
    }),
  });

  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      status: "PENDING_VERIFICATION",
      paymentProofPath,
      paymentProofUploadedAt: uploadedAt,
      paymentVerifiedAt: null,
      paymentVerifiedById: null,
    },
  });

  if (previousProof && previousProof !== paymentProofPath) {
    await deleteLocalUpload(previousProof);
  }

  revalidateBillingPaths({
    projectId: period.projectId,
    clientId: period.project.clientId,
  });

  return { id: periodId, status: "PENDING_VERIFICATION" as const };
}

/**
 * Admin / ops: confirm client payment proof → PAID (same Completed Projects rules).
 */
export async function verifyInvoicePeriodPayment(periodId: string) {
  const session = await requireInvoiceManageAccess();

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    include: {
      project: {
        select: {
          id: true,
          clientId: true,
          status: true,
          billingMode: true,
          startDate: true,
          invoicePeriods: {
            select: { id: true, status: true, milestonePercent: true },
          },
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

  return applyInvoicePeriodPaid(period, { verifiedById: session.user.id });
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
 * Upload tax invoice (faktur) document, AI-verify it, then mark tax invoice sent.
 * Independent of payment received — can happen before or after PAID.
 */
export async function markTaxInvoiceDone(formData: FormData) {
  const session = await requireInvoiceManageAccess();
  const locale = await getServerLocale();

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
          client: { select: { name: true, shortCode: true, npwp: true } },
          company: { select: { name: true } },
        },
      },
    },
  });
  if (!period) throw new Error("Invoice period not found.");
  if (!period.taxInvoiceRequired) {
    throw new Error("This invoice does not require a Tax Invoice.");
  }
  if (period.taxInvoiceDoneAt) {
    throw new Error("Tax Invoice already marked sent.");
  }

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

  // Persist upload even when verification fails (audit trail); do not mark done.
  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      taxInvoiceDocumentPath,
      taxInvoiceDocumentUploadedAt: uploadedAt,
    },
  });

  if (previousTaxDoc && previousTaxDoc !== taxInvoiceDocumentPath) {
    await deleteLocalUpload(previousTaxDoc);
  }

  const periodAmount = decimalToNumber(period.amount);
  const contractPrice = decimalToNumber(period.project.contractPrice);
  const invoiceAmount = periodAmount ?? contractPrice;

  const verification = await verifyTaxInvoiceDocument({
    taxInvoiceDocument: taxInvoiceFile,
    invoiceAmount,
    clientNpwp: period.project.client?.npwp ?? null,
    clientName: period.project.client?.name ?? null,
    companyName: period.project.company?.name ?? null,
    direction: "keluaran",
    excludeId: periodId,
    findTaxInvoiceConflict,
  });

  if (!verification.ok) {
    const lines = verification.failures.map((code) =>
      paymentVerifyFailureMessage(locale, code, verification.details)
    );
    const header = translate(locale, "pages.billing.taxInvoiceVerifyRejected");
    throw new Error([header, ...lines.map((line) => `• ${line}`)].join("\n"));
  }

  const tax = verification.tax;
  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      taxInvoiceDoneAt: uploadedAt,
      taxInvoiceDoneById: session.user.id,
      ...(tax
        ? {
            taxInvoiceSerial: tax.serial,
            taxInvoiceDocumentHash: tax.documentHash,
            taxInvoiceIssuedAt: tax.issuedDate
              ? taxInvoiceDateToUtcDate(tax.issuedDate)
              : null,
          }
        : {}),
    },
  });

  revalidateBillingPaths({
    projectId: period.projectId,
    clientId: period.project.clientId,
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
        },
      },
    },
  });

  if (!period) throw new Error("Invoice period not found.");
  if (period.project.billingMode !== "MONTHLY") {
    throw new Error("Reconcile is only for monthly Regular Cleaning cycles.");
  }
  if (!isContractSubCategory(period.project.subCategory)) {
    throw new Error("Reconcile is only for Regular Cleaning contracts.");
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
    });
    amountUpdate = { amount: adjusted };
  } else if (decimalToNumber(period.amount) == null) {
    const fallback = decimalToNumber(period.project.contractPrice);
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
      subCategory: true,
      status: true,
      startDate: true,
    },
  });

  if (!project) throw new Error("Project not found.");
  if (!isContractSubCategory(project.subCategory)) {
    throw new Error("Reconcile is only for Regular Cleaning contracts.");
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
      subCategory: true,
      status: true,
      startDate: true,
    },
  });

  if (!project) throw new Error("Project not found.");
  if (!isContractSubCategory(project.subCategory)) {
    throw new Error(
      "Invoice this month is only for Regular Cleaning contracts."
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
      startDate: true,
      contractPrice: true,
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

  let compiled = 0;

  if (project.billingMode === "MONTHLY") {
    if (project.startDate) {
      await ensureAnniversaryPeriodsForProject(
        {
          id: project.id,
          startDate: project.startDate,
          billingMode: project.billingMode,
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
async function runAnniversaryMonthlyInvoicingForCompany(companyId: string) {
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
      status: true,
    },
  });

  let compiled = 0;
  let dueReminders = 0;
  const errors: string[] = [];

  for (const project of projects) {
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

  return {
    compiled,
    checked: projects.length,
    dueReminders,
    errors,
  };
}

/**
 * Company-wide sync of due Regular Cleaning anniversary periods (no auto-issue).
 * Also used from billing / projects page load.
 */
export async function runMonthlyInvoicing() {
  const session = await requireInvoiceManageAccess();
  const result = await runAnniversaryMonthlyInvoicingForCompany(
    session.user.companyId
  );

  revalidatePath("/billing");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/invoicing");
  revalidatePath(PROJECT_LIST_VIEW_PATHS.inProgress);
  revalidatePath(PROJECT_LIST_VIEW_PATHS.paymentDue);

  return result;
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
