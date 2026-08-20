"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { addUtcDays } from "@/lib/invoice-period";
import {
  canUnlockInternalPayroll,
} from "@/lib/internal-payroll-lock";
import {
  formatPayrollManagementWindowLabel,
  computePayrollManagementTotals,
  parsePayrollManagementLinesJson,
  periodMoneyNumbers,
  payrollManagementWindowForCutoffMonth,
  resolvePayrollManagementFeePercent,
  resolvePayrollManagementTaxPercent,
} from "@/lib/payroll-management";
import {
  loadPayrollManagementReview,
  reviewToPayrollLines,
  snapshotToPayrollManagementReview,
  type PayrollManagementReviewEmployee,
} from "@/lib/payroll-management-review";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/permissions";
import {
  decimalToNumber,
  payrollManagementFeePercent,
} from "@/lib/project-billing";
import { getServerLocale, localeToBcp47 } from "@/lib/i18n/locale";
import { requireModule, toPermissionUser } from "@/lib/session";
import { saveUpload } from "@/lib/upload";

async function requirePayrollManagementAccess() {
  const session = await requireModule("invoicing");
  if (session.user.clientId || session.user.vendorId) {
    throw new Error("Not authorized to manage payroll management billing.");
  }
  if (!canAccess(toPermissionUser(session), "invoicing")) {
    throw new Error("Not authorized to manage payroll management billing.");
  }
  return session;
}

async function requirePayrollManagementView() {
  const session = await requireModule("invoicing");
  if (session.user.vendorId) {
    throw new Error("Not authorized to view payroll management billing.");
  }
  if (session.user.clientId) return session;
  if (!canAccess(toPermissionUser(session), "invoicing")) {
    throw new Error("Not authorized to view payroll management billing.");
  }
  return session;
}

function payrollCutoffDays(project: {
  payrollCutoffStartDay?: number | null;
  payrollCutoffEndDay?: number | null;
}) {
  const endDay = project.payrollCutoffEndDay ?? 1;
  const startDay =
    project.payrollCutoffStartDay ?? (endDay === 31 ? 1 : endDay + 1);
  return { startDay, endDay };
}

function projectPayrollTaxPercent(project: {
  payrollTaxPercent?: Parameters<typeof decimalToNumber>[0];
}) {
  return resolvePayrollManagementTaxPercent(
    decimalToNumber(project.payrollTaxPercent)
  );
}

function revalidatePayrollPaths(clientId: string | null, projectId: string) {
  if (clientId) {
    revalidatePath(`/billing/${clientId}/${projectId}`);
  }
  revalidatePath("/billing/financial-report");
}

function actorName(session: {
  user: { name?: string | null; username?: string | null };
}) {
  return (
    session.user.name?.trim() ||
    (typeof session.user.username === "string" ? session.user.username : "") ||
    "Head Office"
  );
}

function assertPeriodEditable(status: string | undefined, pdfLocked: boolean) {
  if (pdfLocked) {
    throw new Error(
      "This period is locked. Head Office must unlock it with a reason before changing pay."
    );
  }
  if (
    status === "AWAITING_CLIENT" ||
    status === "CLIENT_APPROVED" ||
    status === "WAGES_PAID" ||
    status === "INVOICED" ||
    status === "REIMBURSED"
  ) {
    throw new Error("This period is locked.");
  }
}

async function livePayrollManagementReview(options: {
  companyId: string;
  projectId: string;
  projectName: string;
  year: number;
  month: number;
  startDay: number;
  endDay: number;
  contractStart?: Date | null;
  contractEnd?: Date | null;
}): Promise<PayrollManagementReviewEmployee[]> {
  return loadPayrollManagementReview(options);
}

export async function getPayrollManagementWorkspace(
  projectId: string,
  year: number,
  month: number
) {
  const session = await requirePayrollManagementView();
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      companyId: session.user.companyId,
      subCategory: "PAYROLL_MANAGEMENT",
      ...(session.user.clientId ? { clientId: session.user.clientId } : {}),
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      startDate: true,
      endDate: true,
      serviceFeePercent: true,
      paymentTermsDays: true,
      payrollCutoffStartDay: true,
      payrollCutoffEndDay: true,
      payrollTaxPercent: true,
      client: { select: { paymentTermsDays: true } },
    },
  });
  if (!project) return null;

  const feePercent =
    payrollManagementFeePercent(decimalToNumber(project.serviceFeePercent)) ??
    0;
  const taxPercent = projectPayrollTaxPercent(project);
  const { startDay, endDay } = payrollCutoffDays(project);
  const window = payrollManagementWindowForCutoffMonth({
    year,
    month,
    cutoffDay: endDay,
    contractStart: project.startDate,
    contractEnd: project.endDate,
  });
  const period = await prisma.payrollManagementPeriod.findUnique({
    where: {
      projectId_year_month: { projectId, year, month },
    },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });

  const numbers = period
    ? periodMoneyNumbers(period)
    : {
        wagesTotal: 0,
        feeAmount: 0,
        taxPercent,
        taxAmount: 0,
        clientBillAmount: 0,
        serviceFeePercent: feePercent,
      };

  const snapshot = snapshotToPayrollManagementReview(period?.pdfSnapshot);
  const review =
    period?.pdfLocked && snapshot
      ? snapshot
      : await livePayrollManagementReview({
          companyId: session.user.companyId,
          projectId: project.id,
          projectName: project.name,
          year,
          month,
          startDay,
          endDay,
          contractStart: project.startDate,
          contractEnd: project.endDate,
        });

  return {
    projectId: project.id,
    projectName: project.name,
    clientId: project.clientId,
    serviceFeePercent: feePercent,
    taxPercent,
    paymentTermsDays:
      project.paymentTermsDays ?? project.client?.paymentTermsDays ?? 14,
    cutoffStartDay: startDay,
    cutoffEndDay: endDay,
    cutoffLabel: formatPayrollManagementWindowLabel(
      window,
      localeToBcp47(await getServerLocale())
    ),
    canUnlock: canUnlockInternalPayroll(toPermissionUser(session)),
    review,
    lock: {
      locked: Boolean(period?.pdfLocked),
      lockedAt: period?.pdfLockedAt?.toISOString() ?? null,
      lockedByName: period?.pdfLockedByName ?? null,
      unlockedAt: period?.pdfUnlockedAt?.toISOString() ?? null,
      unlockedByName: period?.pdfUnlockedByName ?? null,
      unlockReason: period?.pdfUnlockReason ?? null,
    },
    period: period
      ? {
          id: period.id,
          status: period.status,
          notes: period.notes,
          wagesPaidAt: period.wagesPaidAt?.toISOString() ?? null,
          invoicedAt: period.invoicedAt?.toISOString() ?? null,
          invoiceDueAt: period.invoiceDueAt?.toISOString() ?? null,
          reimbursedAt: period.reimbursedAt?.toISOString() ?? null,
          paymentProofPath: period.paymentProofPath,
          ...numbers,
          lines: period.lines.map((line) => ({
            id: line.id,
            employeeName: line.employeeName,
            amount: decimalToNumber(line.amount) ?? 0,
            accountNumber: line.accountNumber,
            notes: line.notes,
          })),
        }
      : null,
    payrollCutoffStartDay: startDay,
    payrollCutoffEndDay: endDay,
  };
}

async function syncPayrollManagementPeriodFromCico(options: {
  companyId: string;
  userId: string;
  projectId: string;
  year: number;
  month: number;
  replaceLines: boolean;
}) {
  const project = await prisma.project.findFirst({
    where: {
      id: options.projectId,
      companyId: options.companyId,
      subCategory: "PAYROLL_MANAGEMENT",
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      payrollCutoffStartDay: true,
      payrollCutoffEndDay: true,
      serviceFeePercent: true,
      payrollTaxPercent: true,
      startDate: true,
      endDate: true,
    },
  });
  if (!project) throw new Error("Payroll Management project not found.");

  const existing = await prisma.payrollManagementPeriod.findUnique({
    where: {
      projectId_year_month: {
        projectId: options.projectId,
        year: options.year,
        month: options.month,
      },
    },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  assertPeriodEditable(existing?.status, Boolean(existing?.pdfLocked));

  const { startDay, endDay } = payrollCutoffDays(project);
  const review = await livePayrollManagementReview({
    companyId: options.companyId,
    projectId: project.id,
    projectName: project.name,
    year: options.year,
    month: options.month,
    startDay,
    endDay,
    contractStart: project.startDate,
    contractEnd: project.endDate,
  });

  const feePercent = resolvePayrollManagementFeePercent(
    decimalToNumber(project.serviceFeePercent)
  );
  const taxPercent = projectPayrollTaxPercent(project);
  const shouldWriteLines =
    options.replaceLines || !existing || existing.lines.length === 0;
  const lines = shouldWriteLines
    ? reviewToPayrollLines(review)
    : existing.lines.map((line, index) => ({
        employeeName: line.employeeName,
        amount: decimalToNumber(line.amount) ?? 0,
        accountNumber: line.accountNumber,
        notes: line.notes,
        sortOrder: index,
      }));
  const totals = computePayrollManagementTotals(lines, feePercent, taxPercent);

  const period = await prisma.payrollManagementPeriod.upsert({
    where: {
      projectId_year_month: {
        projectId: options.projectId,
        year: options.year,
        month: options.month,
      },
    },
    create: {
      projectId: options.projectId,
      year: options.year,
      month: options.month,
      status: lines.length > 0 ? "WAGES_ENTERED" : "DRAFT",
      serviceFeePercent: new Prisma.Decimal(feePercent),
      taxRatePercent: new Prisma.Decimal(totals.taxPercent),
      taxAmount: new Prisma.Decimal(totals.taxAmount),
      wagesTotal: totals.wagesTotal,
      feeAmount: totals.feeAmount,
      clientBillAmount: totals.clientBillAmount,
      createdById: options.userId,
      lines: { create: lines },
    },
    update: shouldWriteLines
      ? {
          status: lines.length > 0 ? "WAGES_ENTERED" : "DRAFT",
          serviceFeePercent: new Prisma.Decimal(feePercent),
          taxRatePercent: new Prisma.Decimal(totals.taxPercent),
          taxAmount: new Prisma.Decimal(totals.taxAmount),
          wagesTotal: totals.wagesTotal,
          feeAmount: totals.feeAmount,
          clientBillAmount: totals.clientBillAmount,
          lines: {
            deleteMany: {},
            create: lines,
          },
        }
      : {},
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });

  return { project, period, review, feePercent };
}

export async function fillPayrollManagementFromCico(formData: FormData) {
  const session = await requirePayrollManagementAccess();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  if (!projectId) throw new Error("Project is required.");

  const result = await syncPayrollManagementPeriodFromCico({
    companyId: session.user.companyId,
    userId: session.user.id,
    projectId,
    year,
    month,
    replaceLines: true,
  });
  revalidatePayrollPaths(result.project.clientId, projectId);
}

export async function lockPayrollManagementPeriodForExport(options: {
  companyId: string;
  userId: string;
  actorName: string;
  projectId: string;
  year: number;
  month: number;
}) {
  let existing = await prisma.payrollManagementPeriod.findUnique({
    where: {
      projectId_year_month: {
        projectId: options.projectId,
        year: options.year,
        month: options.month,
      },
    },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });

  const project = await prisma.project.findFirst({
    where: {
      id: options.projectId,
      companyId: options.companyId,
      subCategory: "PAYROLL_MANAGEMENT",
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      payrollCutoffStartDay: true,
      payrollCutoffEndDay: true,
      serviceFeePercent: true,
      payrollTaxPercent: true,
      startDate: true,
      endDate: true,
    },
  });
  if (!project) throw new Error("Payroll Management project not found.");

  const feePercent = resolvePayrollManagementFeePercent(
    decimalToNumber(project.serviceFeePercent)
  );
  const { startDay, endDay } = payrollCutoffDays(project);

  if (existing?.pdfLocked) {
    if (
      existing.status !== "AWAITING_CLIENT" &&
      existing.status !== "CLIENT_APPROVED" &&
      existing.status !== "INVOICED"
    ) {
      await sendPayrollManagementPeriodToClient({
        project,
        period: existing,
        year: options.year,
        month: options.month,
        userId: options.userId,
      });
    }
    return {
      project,
      period: existing,
      review: snapshotToPayrollManagementReview(existing.pdfSnapshot) ?? [],
      feePercent,
    };
  }

  if (!existing || existing.lines.length === 0) {
    const synced = await syncPayrollManagementPeriodFromCico({
      companyId: options.companyId,
      userId: options.userId,
      projectId: options.projectId,
      year: options.year,
      month: options.month,
      replaceLines: !existing || existing.lines.length === 0,
    });
    existing = synced.period;
  }
  if (!existing) {
    throw new Error("Could not prepare this payroll period.");
  }

  const review = await livePayrollManagementReview({
    companyId: options.companyId,
    projectId: project.id,
    projectName: project.name,
    year: options.year,
    month: options.month,
    startDay,
    endDay,
    contractStart: project.startDate,
    contractEnd: project.endDate,
  });

  const taxPercent = projectPayrollTaxPercent(project);
  const totals = computePayrollManagementTotals(
    existing.lines.map((line) => ({
      amount: decimalToNumber(line.amount) ?? 0,
    })),
    feePercent,
    taxPercent
  );
  const now = new Date();
  const period = await prisma.payrollManagementPeriod.update({
    where: { id: existing.id },
    data: {
      pdfLocked: true,
      pdfLockedAt: now,
      pdfLockedById: options.userId,
      pdfLockedByName: options.actorName,
      pdfSnapshot: review as unknown as Prisma.InputJsonValue,
      taxRatePercent: new Prisma.Decimal(totals.taxPercent),
      taxAmount: new Prisma.Decimal(totals.taxAmount),
      wagesTotal: totals.wagesTotal,
      feeAmount: totals.feeAmount,
      clientBillAmount: totals.clientBillAmount,
    },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });

  await sendPayrollManagementPeriodToClient({
    project,
    period,
    year: options.year,
    month: options.month,
    userId: options.userId,
  });

  revalidatePayrollPaths(project.clientId, options.projectId);
  return { project, period, review, feePercent };
}

async function sendPayrollManagementPeriodToClient(options: {
  project: {
    id: string;
    clientId: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    payrollCutoffEndDay?: number | null;
    payrollCutoffStartDay?: number | null;
  };
  period: {
    id: string;
    invoicePeriodId?: string | null;
    clientBillAmount?: Parameters<typeof decimalToNumber>[0];
  };
  year: number;
  month: number;
  userId: string;
}) {
  const { endDay } = payrollCutoffDays(options.project);
  const window = payrollManagementWindowForCutoffMonth({
    year: options.year,
    month: options.month,
    cutoffDay: endDay,
    contractStart: options.project.startDate,
    contractEnd: options.project.endDate,
  });
  if (window.start.getTime() > window.end.getTime()) {
    throw new Error("This cutoff month is outside the contract.");
  }
  const amount = decimalToNumber(options.period.clientBillAmount) ?? 0;
  const invoicePeriod = options.period.invoicePeriodId
    ? await prisma.projectInvoicePeriod.findUnique({
        where: { id: options.period.invoicePeriodId },
      })
    : await prisma.projectInvoicePeriod.upsert({
        where: {
          projectId_periodStart_periodEnd: {
            projectId: options.project.id,
            periodStart: window.start,
            periodEnd: window.end,
          },
        },
        update: {
          amount,
          reconciledAt: new Date(),
          reconciledById: options.userId,
          label: `Payroll ${options.year}-${String(options.month).padStart(2, "0")}`,
        },
        create: {
          projectId: options.project.id,
          periodStart: window.start,
          periodEnd: window.end,
          amount,
          reconciledAt: new Date(),
          reconciledById: options.userId,
          label: `Payroll ${options.year}-${String(options.month).padStart(2, "0")}`,
          status: "ONGOING",
        },
      });
  if (!invoicePeriod) {
    throw new Error("Could not open the client review period.");
  }
  if (!options.period.invoicePeriodId) {
    await prisma.payrollManagementPeriod.update({
      where: { id: options.period.id },
      data: { invoicePeriodId: invoicePeriod.id },
    });
  }
  const { sendPeriodForClientReview } = await import(
    "@/app/billing/reconciliation/actions"
  );
  await sendPeriodForClientReview(invoicePeriod.id, "PAYROLL_MANAGEMENT");
  await prisma.payrollManagementPeriod.update({
    where: { id: options.period.id },
    data: { status: "AWAITING_CLIENT" },
  });
}

export async function savePayrollManagementPeriod(formData: FormData) {
  const session = await requirePayrollManagementAccess();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const lines = parsePayrollManagementLinesJson(
    String(formData.get("linesJson") ?? "")
  );

  if (!projectId) throw new Error("Project is required.");
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Select a valid year.");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Select a valid month.");
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      companyId: session.user.companyId,
      subCategory: "PAYROLL_MANAGEMENT",
    },
    select: {
      id: true,
      clientId: true,
      serviceFeePercent: true,
      payrollTaxPercent: true,
    },
  });
  if (!project) throw new Error("Payroll Management project not found.");

  const existing = await prisma.payrollManagementPeriod.findUnique({
    where: { projectId_year_month: { projectId, year, month } },
    select: { id: true, status: true, pdfLocked: true },
  });
  assertPeriodEditable(existing?.status, Boolean(existing?.pdfLocked));

  const feePercent = resolvePayrollManagementFeePercent(
    decimalToNumber(project.serviceFeePercent)
  );
  const taxPercent = projectPayrollTaxPercent(project);
  const totals = computePayrollManagementTotals(lines, feePercent, taxPercent);
  const status = lines.length > 0 ? "WAGES_ENTERED" : "DRAFT";

  await prisma.$transaction(async (tx) => {
    const period = await tx.payrollManagementPeriod.upsert({
      where: { projectId_year_month: { projectId, year, month } },
      update: {
        status,
        serviceFeePercent: new Prisma.Decimal(feePercent),
        taxRatePercent: new Prisma.Decimal(totals.taxPercent),
        taxAmount: new Prisma.Decimal(totals.taxAmount),
        wagesTotal: new Prisma.Decimal(totals.wagesTotal),
        feeAmount: new Prisma.Decimal(totals.feeAmount),
        clientBillAmount: new Prisma.Decimal(totals.clientBillAmount),
        notes,
      },
      create: {
        projectId,
        year,
        month,
        status,
        serviceFeePercent: new Prisma.Decimal(feePercent),
        taxRatePercent: new Prisma.Decimal(totals.taxPercent),
        taxAmount: new Prisma.Decimal(totals.taxAmount),
        wagesTotal: new Prisma.Decimal(totals.wagesTotal),
        feeAmount: new Prisma.Decimal(totals.feeAmount),
        clientBillAmount: new Prisma.Decimal(totals.clientBillAmount),
        notes,
        createdById: session.user.id,
      },
    });

    await tx.payrollManagementLine.deleteMany({ where: { periodId: period.id } });
    if (lines.length > 0) {
      await tx.payrollManagementLine.createMany({
        data: lines.map((line, index) => ({
          periodId: period.id,
          employeeName: line.employeeName,
          amount: new Prisma.Decimal(line.amount),
          accountNumber: line.accountNumber,
          notes: line.notes,
          sortOrder: index,
        })),
      });
    }
  });

  revalidatePayrollPaths(project.clientId, projectId);
  return { year, month };
}

export async function markPayrollManagementWagesPaid(formData: FormData) {
  const session = await requirePayrollManagementAccess();
  const periodId = String(formData.get("periodId") ?? "").trim();
  if (!periodId) throw new Error("Period is required.");

  const period = await prisma.payrollManagementPeriod.findFirst({
    where: {
      id: periodId,
      project: {
        companyId: session.user.companyId,
        subCategory: "PAYROLL_MANAGEMENT",
      },
    },
    select: {
      id: true,
      status: true,
      wagesTotal: true,
      wagesPaidAt: true,
      projectId: true,
      project: { select: { clientId: true } },
    },
  });
  if (!period) throw new Error("Period not found.");
  if (period.wagesPaidAt) {
    revalidatePayrollPaths(period.project.clientId, period.projectId);
    return;
  }
  if (
    period.status !== "WAGES_ENTERED" &&
    period.status !== "CLIENT_APPROVED"
  ) {
    throw new Error("Save the employee pay list before marking wages paid.");
  }
  if ((decimalToNumber(period.wagesTotal) ?? 0) <= 0) {
    throw new Error("Add at least one wage line before marking wages paid.");
  }

  await prisma.payrollManagementPeriod.update({
    where: { id: period.id },
    data: {
      status: "WAGES_PAID",
      wagesPaidAt: new Date(),
      wagesPaidById: session.user.id,
    },
  });

  revalidatePayrollPaths(period.project.clientId, period.projectId);
}

export async function recordPayrollManagementInvoice(formData: FormData) {
  const session = await requirePayrollManagementAccess();
  const periodId = String(formData.get("periodId") ?? "").trim();
  if (!periodId) throw new Error("Period is required.");

  const period = await prisma.payrollManagementPeriod.findFirst({
    where: {
      id: periodId,
      project: {
        companyId: session.user.companyId,
        subCategory: "PAYROLL_MANAGEMENT",
      },
    },
    include: {
      project: {
        select: {
          id: true,
          clientId: true,
          paymentTermsDays: true,
          client: { select: { paymentTermsDays: true } },
        },
      },
    },
  });
  if (!period) throw new Error("Period not found.");
  if (period.status !== "WAGES_PAID") {
    throw new Error("Mark the wage bill as paid before recording the client invoice.");
  }

  const terms =
    period.project.paymentTermsDays ??
    period.project.client?.paymentTermsDays ??
    14;
  const invoicedAt = new Date();
  const invoiceDueAt =
    terms <= 0 ? invoicedAt : addUtcDays(invoicedAt, terms);

  await prisma.payrollManagementPeriod.update({
    where: { id: period.id },
    data: {
      status: "INVOICED",
      invoicedAt,
      invoicedById: session.user.id,
      invoiceDueAt,
    },
  });

  revalidatePayrollPaths(period.project.clientId, period.projectId);
}

export async function markPayrollManagementReimbursed(formData: FormData) {
  const session = await requirePayrollManagementAccess();
  const periodId = String(formData.get("periodId") ?? "").trim();
  if (!periodId) throw new Error("Period is required.");

  const period = await prisma.payrollManagementPeriod.findFirst({
    where: {
      id: periodId,
      project: {
        companyId: session.user.companyId,
        subCategory: "PAYROLL_MANAGEMENT",
      },
    },
    select: {
      id: true,
      status: true,
      projectId: true,
      paymentProofPath: true,
      project: { select: { clientId: true } },
    },
  });
  if (!period) throw new Error("Period not found.");
  if (period.status !== "INVOICED") {
    throw new Error("Record the client invoice before marking reimbursed.");
  }

  const proof = formData.get("paymentProof");
  let paymentProofPath = period.paymentProofPath;
  if (proof instanceof File && proof.size > 0) {
    paymentProofPath = await saveUpload(proof, "uploads/payment-proofs");
  }

  await prisma.payrollManagementPeriod.update({
    where: { id: period.id },
    data: {
      status: "REIMBURSED",
      reimbursedAt: new Date(),
      reimbursedById: session.user.id,
      paymentProofPath,
    },
  });

  revalidatePayrollPaths(period.project.clientId, period.projectId);
}

export async function unlockPayrollManagementPeriod(formData: FormData) {
  const session = await requirePayrollManagementAccess();
  if (!canUnlockInternalPayroll(toPermissionUser(session))) {
    throw new Error("Only Head Office can unlock a locked payroll period.");
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!projectId) throw new Error("Project is required.");
  if (!reason) throw new Error("Please enter a reason to unlock this period.");

  const period = await prisma.payrollManagementPeriod.findFirst({
    where: {
      projectId,
      year,
      month,
      project: {
        companyId: session.user.companyId,
        subCategory: "PAYROLL_MANAGEMENT",
      },
    },
    select: {
      id: true,
      status: true,
      projectId: true,
      project: { select: { clientId: true } },
    },
  });
  if (!period) throw new Error("Period not found.");
  if (
    period.status === "WAGES_PAID" ||
    period.status === "INVOICED" ||
    period.status === "REIMBURSED"
  ) {
    throw new Error("This period is already paid or invoiced and cannot be unlocked.");
  }

  await prisma.payrollManagementPeriod.update({
    where: { id: period.id },
    data: {
      pdfLocked: false,
      pdfUnlockedAt: new Date(),
      pdfUnlockedById: session.user.id,
      pdfUnlockedByName: actorName(session),
      pdfUnlockReason: reason,
    },
  });

  revalidatePayrollPaths(period.project.clientId, period.projectId);
}
