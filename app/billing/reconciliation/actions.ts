"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ClientReviewKind, ClientReviewStatus } from "@prisma/client";

import {
  CLIENT_REVIEW_PROOF_FOLDER,
  CLIENT_REVIEW_PROOF_MAX_BYTES,
  CLIENT_REVIEW_PROOF_MIME,
  canIssueInvoiceAfterReview,
  isAwaitingClientAction,
  isInHoRevisedQueue,
} from "@/lib/client-billing-review";
import { prisma } from "@/lib/prisma";
import { assertCanApproveProjectServiceArea } from "@/lib/om-approval";
import { canAccess } from "@/lib/permissions";
import {
  decimalToNumber,
  formatContractPrice,
  formatMilestoneScheduleLabel,
  isMilestoneSubCategory,
  parseContractPrice,
} from "@/lib/project-billing";
import { addUtcDays } from "@/lib/invoice-period";
import { isContractCycleSubCategory } from "@/lib/project-contract";
import { COMPANY_IDENTITY_SELECT } from "@/lib/company-for-pdf";
import { generateProgressReviewPdf } from "@/lib/progress-review-pdf";
import { generateReconciliationReportPdf } from "@/lib/reconciliation-report-pdf";
import {
  requireSession,
  toPermissionUser,
} from "@/lib/session";
import { saveUpload } from "@/lib/upload";
import {
  clearPeriodReviewAmounts,
  loadPeriodReviewAmounts,
  setPeriodClientRequestedAmount,
  setPeriodHoProposedAmount,
} from "@/lib/review-amount-fields";
const COMPANY_BANK_SELECT = COMPANY_IDENTITY_SELECT;

function revalidateReviewPaths(opts: {
  projectId: string;
  clientId: string | null;
}) {
  revalidatePath("/billing");
  revalidatePath("/billing/reconciliation");
  revalidatePath("/billing/settlements");
  if (opts.clientId) {
    revalidatePath(`/billing/${opts.clientId}`);
    revalidatePath(`/billing/${opts.clientId}/${opts.projectId}`);
  }
  revalidatePath(`/projects/${opts.projectId}`);
  revalidatePath("/projects");
}

async function requireHoFinanceAccess() {
  const session = await requireSession();
  if (session.user.clientId || session.user.vendorId) {
    redirect("/dashboard");
  }
  const user = toPermissionUser(session);
  if (!canAccess(user, "reconciliation") && !canAccess(user, "projects")) {
    redirect("/dashboard");
  }
  return session;
}

async function requireClientPortal() {
  const session = await requireSession();
  if (!session.user.clientId) {
    throw new Error("Only client portal users can perform this action.");
  }
  return session;
}

function requireProofFile(
  value: FormDataEntryValue | null,
  opts: { required: boolean }
): File | null {
  if (!(value instanceof File) || value.size <= 0) {
    if (opts.required) throw new Error("A supporting document is required.");
    return null;
  }
  if (value.size > CLIENT_REVIEW_PROOF_MAX_BYTES) {
    throw new Error("File must be 10 MB or smaller.");
  }
  const mime = value.type || "";
  if (mime && !CLIENT_REVIEW_PROOF_MIME.has(mime)) {
    throw new Error("Upload an image or PDF only.");
  }
  return value;
}

async function logReviewEvent(opts: {
  invoicePeriodId: string;
  actorRole: "CLIENT" | "HO" | "SYSTEM";
  userId?: string | null;
  action: string;
  note?: string | null;
  proofPath?: string | null;
  statusAfter?: ClientReviewStatus | null;
}) {
  await prisma.billingClientReviewEvent.create({
    data: {
      invoicePeriodId: opts.invoicePeriodId,
      actorRole: opts.actorRole,
      userId: opts.userId ?? null,
      action: opts.action,
      note: opts.note ?? null,
      proofPath: opts.proofPath ?? null,
      statusAfter: opts.statusAfter ?? null,
    },
  });
}

/**
 * After HO reconcile (Regular) or when sending a progress package (General/Facade):
 * build the review PDF and mark AWAITING_CLIENT_REVIEW.
 */
export async function sendPeriodForClientReview(
  periodId: string,
  kind: ClientReviewKind
) {
  const session = await requireHoFinanceAccess();

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    include: {
      project: {
        include: {
          client: true,
          company: { select: COMPANY_BANK_SELECT },
        },
      },
    },
  });

  if (!period) throw new Error("Billing period not found.");
  if (
    period.status !== "ONGOING" &&
    period.status !== "COMPILING" &&
    period.status !== "AWAITING_CLIENT_REVIEW"
  ) {
    throw new Error("This period has already been invoiced.");
  }

  const project = period.project;
  let reviewReportPdfPath: string;

  if (kind === "RECONCILIATION") {
    if (
      project.billingMode !== "MONTHLY" ||
      !isContractCycleSubCategory(project.subCategory)
    ) {
      throw new Error(
        "Reconciliation review is only for Regular Cleaning and Security."
      );
    }
    if (!period.reconciledAt) {
      throw new Error("Reconcile this period before sending it to the client.");
    }

    const attendances = await prisma.attendance.findMany({
      where: {
        projectId: project.id,
        date: { gte: period.periodStart, lte: period.periodEnd },
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeNo: true },
        },
      },
      orderBy: [{ date: "asc" }, { checkIn: "asc" }],
    });

    const amount =
      decimalToNumber(period.amount) ?? decimalToNumber(project.contractPrice);

    reviewReportPdfPath = await generateReconciliationReportPdf({
      projectName: project.name,
      clientName: project.client?.name ?? null,
      location: project.location,
      periodLabel: period.label ?? "Billing period",
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      contractAmountLabel:
        amount != null ? formatContractPrice(amount) : null,
      rows: attendances.map((a) => ({
        date: a.date,
        employeeName: `${a.employee.firstName} ${a.employee.lastName}`.trim(),
        employeeNo: a.employee.employeeNo,
        checkIn: a.checkIn,
        checkOut: a.checkOut,
        note: a.note,
      })),
      company: project.company,
    });
  } else if (kind === "PAYROLL_MANAGEMENT") {
    if (project.subCategory !== "PAYROLL_MANAGEMENT") {
      throw new Error("This review is only for Payroll Management.");
    }
    const { writeFile, mkdir } = await import("fs/promises");
    const path = await import("path");
    const { buildInternalPayrollPdfBuffer } = await import(
      "@/lib/internal-payroll-pdf"
    );
    const { reviewToPayrollPdfEmployees } = await import(
      "@/lib/payroll-management-review"
    );
    const { snapshotToPayrollManagementReview } = await import(
      "@/lib/payroll-management-review"
    );
    const pm = await prisma.payrollManagementPeriod.findFirst({
      where: { invoicePeriodId: periodId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!pm) {
      throw new Error("Generate the wage sheet before sending it to the client.");
    }
    const review =
      snapshotToPayrollManagementReview(pm.pdfSnapshot) ?? [];
    const buffer = await buildInternalPayrollPdfBuffer({
      year: pm.year,
      month: pm.month,
      periodLabel: period.label ?? "Payroll Management",
      employees: reviewToPayrollPdfEmployees(
        review,
        pm.lines.map((line) => ({
          employeeName: line.employeeName,
          amount: decimalToNumber(line.amount) ?? 0,
          notes: line.notes,
        })),
        "Client adjustment"
      ),
      company: project.company,
      title: "Payroll Management Wage Sheet",
    });
    const folder = "uploads/payroll-management-reviews";
    const filename = `pm-review-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.pdf`;
    const uploadDir = path.join(process.cwd(), "public", folder);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);
    reviewReportPdfPath = `/${folder}/${filename}`;
  } else {
    if (!isMilestoneSubCategory(project.subCategory) && project.billingMode === "MONTHLY") {
      throw new Error(
        "Progress review is for General Cleaning, Facade Cleaning, and One-Time Landscaping."
      );
    }

    const reports =
      project.billingMode === "MILESTONE"
        ? await prisma.progressReport.findMany({
            where: {
              projectId: project.id,
              invoicePeriodId: null,
              reportDate: { lte: period.periodEnd },
            },
            include: {
              employee: {
                select: { firstName: true, lastName: true, employeeNo: true },
              },
              photos: { select: { url: true, caption: true } },
            },
            orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }],
          })
        : await prisma.progressReport.findMany({
            where: {
              projectId: project.id,
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

    const uniqueReports = reports;

    const amount =
      decimalToNumber(period.amount) ?? decimalToNumber(project.contractPrice);

    reviewReportPdfPath = await generateProgressReviewPdf({
      projectName: project.name,
      clientName: project.client?.name ?? null,
      location: project.location,
      periodLabel:
        period.label ??
        (period.milestonePercent != null
          ? formatMilestoneScheduleLabel(period.milestonePercent)
          : "Billing period"),
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      amountLabel: amount != null ? formatContractPrice(amount) : null,
      milestonePercent: period.milestonePercent,
      reports: uniqueReports,
      company: project.company,
    });
  }

  const now = new Date();
  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      status: "AWAITING_CLIENT_REVIEW",
      clientReviewKind: kind,
      clientReviewStatus: "AWAITING_CLIENT",
      reviewReportPdfPath,
      reviewSentToClientAt: now,
      clientReviewedAt: null,
      clientRevisionNote: null,
      clientRevisionProofPath: null,
      hoReviewNote: null,
      hoReviewProofPath: null,
      hoReviewedAt: null,
      hoReviewedById: null,
      reportCount:
        kind === "PROGRESS"
          ? (
              await prisma.progressReport.count({
                where: {
                  projectId: project.id,
                  reportDate: {
                    gte: period.periodStart,
                    lte: period.periodEnd,
                  },
                },
              })
            )
          : period.reportCount,
    },
  });
  await clearPeriodReviewAmounts(periodId);

  await logReviewEvent({
    invoicePeriodId: periodId,
    actorRole: "HO",
    userId: session.user.id,
    action: "SENT_TO_CLIENT",
    statusAfter: "AWAITING_CLIENT",
  });

  revalidateReviewPaths({
    projectId: project.id,
    clientId: project.clientId,
  });

  return { periodId, reviewReportPdfPath };
}

async function isLastVisitPeriod(periodId: string): Promise<boolean> {
  const visit = await prisma.projectVisit.findFirst({
    where: { invoicePeriodId: periodId },
    select: { projectId: true, visitIndex: true },
  });
  if (!visit) return false;
  const later = await prisma.projectVisit.count({
    where: {
      projectId: visit.projectId,
      visitIndex: { gt: visit.visitIndex },
    },
  });
  return later === 0;
}

async function schedulePercentsForProject(projectId: string) {
  const rows = await prisma.projectInvoicePeriod.findMany({
    where: { projectId },
    select: { milestonePercent: true },
  });
  return rows.map((row) => row.milestonePercent);
}

/** Client portal: approve reconcile/progress → auto-issue invoice + email. */
export async function clientApproveBillingReview(periodId: string) {
  const session = await requireClientPortal();

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    include: {
      project: {
        select: {
          id: true,
          clientId: true,
          billingMode: true,
          subCategory: true,
          endDate: true,
          paymentTermsDays: true,
        },
      },
    },
  });

  if (!period) throw new Error("Billing period not found.");
  if (period.project.clientId !== session.user.clientId) {
    throw new Error("You do not have access to this period.");
  }
  if (period.status !== "AWAITING_CLIENT_REVIEW") {
    throw new Error("This period is not waiting for your review.");
  }
  if (!isAwaitingClientAction(period.clientReviewStatus)) {
    throw new Error("This review is not open for approval.");
  }

  const { hoProposedAmount: proposedAmount } =
    await loadPeriodReviewAmounts(periodId);

  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      clientReviewStatus: "CLIENT_APPROVED",
      clientReviewedAt: new Date(),
      ...(proposedAmount != null && proposedAmount > 0
        ? { amount: proposedAmount, revisedInvoiceAmount: proposedAmount }
        : {}),
    },
  });

  await logReviewEvent({
    invoicePeriodId: periodId,
    actorRole: "CLIENT",
    userId: session.user.id,
    action: "CLIENT_APPROVED",
    statusAfter: "CLIENT_APPROVED",
  });

  if (period.project.subCategory === "PAYROLL_MANAGEMENT") {
    await prisma.payrollManagementPeriod.updateMany({
      where: { invoicePeriodId: periodId },
      data: {
        status: "CLIENT_APPROVED",
      },
    });
  }

  // Final GC/Facade approve: crew + equipment go home now (before invoice / pay).
  // Intermediate parts and Regular/Security stay assigned.
  const {
    shouldReleaseCrewAfterBillingReviewAgree,
    releaseProjectCrewAfterProgressApproved,
  } = await import("@/lib/workforce-crew");
  const shouldRelease = shouldReleaseCrewAfterBillingReviewAgree({
    subCategory: period.project.subCategory,
    billingMode: period.project.billingMode,
    milestonePercent: period.milestonePercent,
    schedulePercents: await schedulePercentsForProject(period.projectId),
    periodEnd: period.periodEnd,
    contractEndDate: period.project.endDate,
    isLastVisit: await isLastVisitPeriod(periodId),
  });
  if (shouldRelease) {
    await prisma.$transaction(async (tx) => {
      await releaseProjectCrewAfterProgressApproved(tx, period.projectId);
      await tx.project.update({
        where: { id: period.projectId },
        data: { status: "OFF_SITE" },
      });
    });
  }

  // Issue invoice (skips HO manage gate via internal flag path).
  await issueInvoiceAfterClientApproval(periodId, session.user.id);

  if (period.project.subCategory === "PAYROLL_MANAGEMENT") {
    const terms = period.project.paymentTermsDays ?? 14;
    const invoicedAt = new Date();
    const invoiceDueAt =
      terms <= 0 ? invoicedAt : addUtcDays(invoicedAt, terms);
    await prisma.payrollManagementPeriod.updateMany({
      where: { invoicePeriodId: periodId, invoicedAt: null },
      data: {
        status: "INVOICED",
        invoicedAt,
        invoiceDueAt,
      },
    });
  }

  revalidateReviewPaths({
    projectId: period.projectId,
    clientId: period.project.clientId,
  });

  return { periodId, invoiced: true };
}

/** Client portal: revise with note + required adjusted amount + optional proof → HO Revised queue. */
export async function clientReviseBillingReview(formData: FormData) {
  const session = await requireClientPortal();
  const periodId = String(formData.get("periodId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const requestedAmount = parseContractPrice(
    String(formData.get("clientRequestedAmount") ?? "")
  );
  const proof = requireProofFile(formData.get("proof"), { required: false });

  if (!periodId) throw new Error("Period is required.");
  if (!note) throw new Error("Please explain what is wrong or inaccurate.");
  if (requestedAmount == null || requestedAmount <= 0) {
    throw new Error("Enter the adjusted amount the client is requesting.");
  }

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    include: {
      project: { select: { id: true, clientId: true } },
    },
  });

  if (!period) throw new Error("Billing period not found.");
  if (period.project.clientId !== session.user.clientId) {
    throw new Error("You do not have access to this period.");
  }
  if (period.status !== "AWAITING_CLIENT_REVIEW") {
    throw new Error("This period is not waiting for your review.");
  }
  if (!isAwaitingClientAction(period.clientReviewStatus)) {
    throw new Error("This review is not open for revision.");
  }
  const currentAmounts = await loadPeriodReviewAmounts(periodId);
  const proposedBaseline =
    currentAmounts.hoProposedAmount ?? decimalToNumber(period.amount);
  if (
    proposedBaseline != null &&
    Math.round(proposedBaseline) === Math.round(requestedAmount)
  ) {
    throw new Error(
      "A revision must use a different amount. If the number is unchanged, choose Approve."
    );
  }

  let proofPath: string | null = null;
  if (proof) {
    proofPath = await saveUpload(proof, CLIENT_REVIEW_PROOF_FOLDER, {
      fileBaseName: `Client-Revise_${periodId.slice(-8)}`,
    });
  }

  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      clientReviewStatus: "CLIENT_REVISED",
      clientReviewedAt: new Date(),
      clientRevisionNote: note,
      clientRevisionProofPath: proofPath,
    },
  });
  await setPeriodClientRequestedAmount(periodId, requestedAmount);

  await logReviewEvent({
    invoicePeriodId: periodId,
    actorRole: "CLIENT",
    userId: session.user.id,
    action: "CLIENT_REVISED",
    note,
    proofPath,
    statusAfter: "CLIENT_REVISED",
  });

  revalidateReviewPaths({
    projectId: period.projectId,
    clientId: period.project.clientId,
  });

  return { periodId };
}

/**
 * HO: approve client revision — optional revised invoice value/number — then issue.
 */
export async function hoApproveClientRevision(formData: FormData) {
  const session = await requireHoFinanceAccess();
  const periodId = String(formData.get("periodId") ?? "").trim();
  const amountRaw = String(formData.get("revisedAmount") ?? "").trim();

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
          serviceArea: true,
          endDate: true,
        },
      },
    },
  });

  if (!period) throw new Error("Billing period not found.");
  if (period.status !== "AWAITING_CLIENT_REVIEW") {
    throw new Error("This period is not in client review.");
  }
  if (!isInHoRevisedQueue(period.clientReviewStatus)) {
    throw new Error("This period is not in the revised queue.");
  }

  const revisedAmount = amountRaw
    ? parseContractPrice(amountRaw)
    : decimalToNumber(period.amount);

  if (revisedAmount != null && revisedAmount <= 0) {
    throw new Error("Enter a valid revised invoice amount.");
  }

  // OM+ required whenever HO sets / confirms a revised invoice amount.
  await assertCanApproveProjectServiceArea({
    userId: session.user.id,
    username: session.user.username,
    permissionUser: toPermissionUser(session),
    projectServiceArea: period.project.serviceArea,
    projectId: period.project.id,
  });

  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      clientReviewStatus: "HO_APPROVED_REVISION",
      hoReviewedAt: new Date(),
      hoReviewedById: session.user.id,
      ...(revisedAmount != null ? { revisedInvoiceAmount: revisedAmount, amount: revisedAmount } : {}),
    },
  });

  await logReviewEvent({
    invoicePeriodId: periodId,
    actorRole: "HO",
    userId: session.user.id,
    action: "HO_APPROVED",
    note: revisedAmount != null ? formatContractPrice(revisedAmount) : null,
    statusAfter: "HO_APPROVED_REVISION",
  });

  // HO approve revision = both parties agree → same final-part crew-release gate.
  const {
    shouldReleaseCrewAfterBillingReviewAgree,
    releaseProjectCrewAfterProgressApproved,
  } = await import("@/lib/workforce-crew");
  const shouldReleaseOnHoApprove = shouldReleaseCrewAfterBillingReviewAgree({
    subCategory: period.project.subCategory,
    billingMode: period.project.billingMode,
    milestonePercent: period.milestonePercent,
    schedulePercents: await schedulePercentsForProject(period.projectId),
    periodEnd: period.periodEnd,
    contractEndDate: period.project.endDate,
    isLastVisit: await isLastVisitPeriod(periodId),
  });
  if (shouldReleaseOnHoApprove) {
    await prisma.$transaction(async (tx) => {
      await releaseProjectCrewAfterProgressApproved(tx, period.projectId);
      await tx.project.update({
        where: { id: period.projectId },
        data: { status: "OFF_SITE" },
      });
    });
  }

  await issueInvoiceAfterClientApproval(periodId, session.user.id);

  revalidateReviewPaths({
    projectId: period.projectId,
    clientId: period.project.clientId,
  });

  return { periodId, invoiced: true };
}

/** HO: reject client revision with note + proof → back to client. */
export async function hoRejectClientRevision(formData: FormData) {
  const session = await requireHoFinanceAccess();
  const periodId = String(formData.get("periodId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const proposedAmount = parseContractPrice(
    String(formData.get("hoProposedAmount") ?? "")
  );
  const proof = requireProofFile(formData.get("proof"), { required: false });

  if (!periodId) throw new Error("Period is required.");
  if (!note) throw new Error("Please explain why the revision is rejected.");
  if (proposedAmount == null || proposedAmount <= 0) {
    throw new Error("Enter the amount Head Office is proposing.");
  }

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    include: {
      project: { select: { id: true, clientId: true } },
    },
  });

  if (!period) throw new Error("Billing period not found.");
  if (period.status !== "AWAITING_CLIENT_REVIEW") {
    throw new Error("This period is not in client review.");
  }
  if (!isInHoRevisedQueue(period.clientReviewStatus)) {
    throw new Error("This period is not in the revised queue.");
  }
  const hoAmounts = await loadPeriodReviewAmounts(periodId);
  const hoBaseline =
    hoAmounts.clientRequestedAmount ?? decimalToNumber(period.amount);
  if (
    hoBaseline != null &&
    Math.round(hoBaseline) === Math.round(proposedAmount)
  ) {
    throw new Error(
      "A revision must use a different amount. If the number is unchanged, choose Approve."
    );
  }

  let proofPath: string | null = null;
  if (proof) {
    proofPath = await saveUpload(proof, CLIENT_REVIEW_PROOF_FOLDER, {
      fileBaseName: `HO-Reject_${periodId.slice(-8)}`,
    });
  }

  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      clientReviewStatus: "HO_REJECTED_REVISION",
      hoReviewNote: note,
      hoReviewProofPath: proofPath,
      hoReviewedAt: new Date(),
      hoReviewedById: session.user.id,
      clientReviewedAt: null,
    },
  });
  await setPeriodHoProposedAmount(periodId, proposedAmount);

  await logReviewEvent({
    invoicePeriodId: periodId,
    actorRole: "HO",
    userId: session.user.id,
    action: "HO_REJECTED",
    note,
    proofPath,
    statusAfter: "HO_REJECTED_REVISION",
  });

  revalidateReviewPaths({
    projectId: period.projectId,
    clientId: period.project.clientId,
  });

  return { periodId };
}

/**
 * Issue commercial invoice after client (or HO revision) approval.
 * Uses existing compile / milestone issue paths with an elevated session context.
 */
async function issueInvoiceAfterClientApproval(
  periodId: string,
  _actorUserId: string
) {
  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    select: {
      id: true,
      clientReviewStatus: true,
      milestonePercent: true,
      project: { select: { billingMode: true } },
    },
  });

  if (!period) throw new Error("Billing period not found.");
  if (!canIssueInvoiceAfterReview(period.clientReviewStatus)) {
    throw new Error("Client review is not approved yet.");
  }

  // Temporarily mark status so compile/milestone accept the period, then issue.
  // compileInvoicePeriod / issueMilestonePeriod require HO manage — we run them
  // via a privileged internal path by flipping to COMPILING-ready statuses.
  if (period.project.billingMode === "MILESTONE" && period.milestonePercent != null) {
    await prisma.projectInvoicePeriod.update({
      where: { id: periodId },
      data: { status: "ONGOING" },
    });
    await issueMilestonePeriodAfterReview(periodId);
  } else {
    await prisma.projectInvoicePeriod.update({
      where: { id: periodId },
      data: { status: "ONGOING" },
    });
    await compileInvoicePeriodAfterReview(periodId);
  }

  await logReviewEvent({
    invoicePeriodId: periodId,
    actorRole: "SYSTEM",
    userId: _actorUserId,
    action: "INVOICE_ISSUED",
    statusAfter: period.clientReviewStatus,
  });
}

/**
 * Internal: call compile without client redirect by temporarily using HO session.
 * When the caller is a client, we impersonate compile via direct DB+PDF path
 * exported below as wrappers that skip portal redirect.
 *
 * For simplicity, re-fetch and run the same compile logic by importing
 * compileInvoicePeriod — but that redirects clients. So we use a marker:
 * set compiledById after, and call specialized exports.
 */
async function compileInvoicePeriodAfterReview(periodId: string) {
  // Dynamically import to avoid circular init issues; the exported function
  // still checks clientId. Use prisma + a dedicated privileged compile instead.
  const { compileInvoicePeriodForApprovedReview } = await import(
    "@/app/projects/invoice-actions"
  );
  await compileInvoicePeriodForApprovedReview(periodId);
}

async function issueMilestonePeriodAfterReview(periodId: string) {
  const { issueMilestonePeriodForApprovedReview } = await import(
    "@/app/projects/invoice-actions"
  );
  await issueMilestonePeriodForApprovedReview(periodId);
}

/**
 * General / Facade: send the next ready milestone (or completion period) for
 * client progress review instead of invoicing immediately.
 */
export async function sendProgressForClientReview(periodId: string) {
  return sendPeriodForClientReview(periodId, "PROGRESS");
}

/**
 * No-portal clients: HO records the real-world approve/revise, then invoices.
 * There is no ERP back-and-forth — that already happened outside the system.
 */
export async function hoRecordOfflineClientReview(formData: FormData) {
  const session = await requireHoFinanceAccess();
  const periodId = String(formData.get("periodId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim().toLowerCase();
  const note = String(formData.get("note") ?? "").trim();
  const revisedAmount = parseContractPrice(
    String(formData.get("revisedAmount") ?? "")
  );

  if (!periodId) throw new Error("Period is required.");
  if (decision !== "approve" && decision !== "revise") {
    throw new Error("Choose Approved or Revised.");
  }

  const period = await prisma.projectInvoicePeriod.findUnique({
    where: { id: periodId },
    include: {
      project: {
        select: {
          id: true,
          clientId: true,
          billingMode: true,
          subCategory: true,
          endDate: true,
          client: { select: { hasPortalAccess: true } },
        },
      },
    },
  });

  if (!period) throw new Error("Billing period not found.");
  if (period.project.client?.hasPortalAccess !== false) {
    throw new Error("This client uses the portal review flow.");
  }
  if (period.status !== "AWAITING_CLIENT_REVIEW") {
    throw new Error("This period is not waiting for a client response.");
  }
  if (!isAwaitingClientAction(period.clientReviewStatus)) {
    throw new Error("This review is not open.");
  }

  const original = decimalToNumber(period.amount);
  if (decision === "revise") {
    if (!note) {
      throw new Error("Explain why the amount was revised.");
    }
    if (revisedAmount == null || revisedAmount <= 0) {
      throw new Error("Enter the revised invoice amount.");
    }
    if (original != null && Math.round(original) === Math.round(revisedAmount)) {
      throw new Error(
        "A revision must use a different amount. If the number is unchanged, choose Approve."
      );
    }
  }

  await prisma.projectInvoicePeriod.update({
    where: { id: periodId },
    data: {
      clientReviewStatus: "CLIENT_APPROVED",
      clientReviewedAt: new Date(),
      hoReviewedAt: new Date(),
      hoReviewedById: session.user.id,
      ...(decision === "revise"
        ? {
            clientRevisionNote: note,
            amount: revisedAmount,
            revisedInvoiceAmount: revisedAmount,
          }
        : {}),
    },
  });
  if (decision === "revise" && revisedAmount != null) {
    await setPeriodClientRequestedAmount(periodId, revisedAmount);
  }

  await logReviewEvent({
    invoicePeriodId: periodId,
    actorRole: "HO",
    userId: session.user.id,
    action: decision === "revise" ? "HO_APPROVED" : "CLIENT_APPROVED",
    note: decision === "revise" ? note : "Offline client approval recorded.",
    statusAfter: "CLIENT_APPROVED",
  });

  await issueInvoiceAfterClientApproval(periodId, session.user.id);

  revalidateReviewPaths({
    projectId: period.projectId,
    clientId: period.project.clientId,
  });

  return { periodId, invoiced: true };
}
