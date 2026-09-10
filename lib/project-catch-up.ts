import type { Prisma, ProjectCatchUpKind } from "@prisma/client";

import { COMPLETION_INVOICE_LABEL, parseContractPrice } from "@/lib/project-billing";
import { type CatchUpCompleteTarget } from "@/lib/project-catch-up-periods";
import {
  dueAtFromClientPaymentTerms,
  parseDateInput,
} from "@/lib/invoice-period";
import { formFiles, saveAndSerializeUploads } from "@/lib/upload-paths";

export {
  catchUpPageByOrdinal,
  listCatchUpIntakePages,
  listHistoricalCatchUpPeriods,
  listMonthlyCatchUpPeriods,
  resolveCatchUpCompleteTarget,
  usesMonthlyCatchUpPeriods,
  type CatchUpCompleteTarget,
  type CatchUpIntakePage,
} from "@/lib/project-catch-up-periods";

export function parseCatchUpKind(formData: FormData): ProjectCatchUpKind {
  const raw = String(formData.get("projectOngoing") ?? "").trim();
  if (raw === "Yes" || raw === "ONGOING") return "ONGOING";
  if (raw === "Completed" || raw === "COMPLETED") return "COMPLETED";
  return "NONE";
}

export type PreparedCatchUpExpense = {
  category: "CATCH_UP_INVENTORY" | "CATCH_UP_WAGE";
  reason: string;
  amount: number;
  employeeId: string | null;
  proofPath: string | null;
};

export type PreparedCatchUpComplete = {
  target: CatchUpCompleteTarget;
  clientAmount: number;
  invoicePath: string;
  taxPath: string;
  payment: {
    paid: boolean;
    amount: number | null;
    proofPath: string | null;
    paidAt: Date | null;
    bankAccountId: string | null;
  };
  expenses: PreparedCatchUpExpense[];
};

async function requireCatchUpDocuments(
  formData: FormData,
  invoiceName: string,
  taxName: string
): Promise<{ invoicePath: string; taxPath: string }> {
  const invoices = formFiles(formData, invoiceName);
  const taxes = formFiles(formData, taxName);
  if (invoices.length === 0) {
    throw new Error("Upload the invoice.");
  }
  if (taxes.length === 0) {
    throw new Error("Upload the tax invoice.");
  }
  const invoicePath = await saveAndSerializeUploads(
    invoices,
    "uploads/invoices",
    { fileBaseName: "catch-up-invoice" }
  );
  const taxPath = await saveAndSerializeUploads(
    taxes,
    "uploads/tax-invoices",
    { fileBaseName: "catch-up-tax-invoice" }
  );
  if (!invoicePath || !taxPath) {
    throw new Error("Upload the invoice and the tax invoice.");
  }
  return { invoicePath, taxPath };
}

async function requireUploads(
  formData: FormData,
  field: string,
  folder: string,
  fileBaseName: string,
  message: string
): Promise<string> {
  const files = formFiles(formData, field);
  if (files.length === 0) {
    throw new Error(message);
  }
  const path = await saveAndSerializeUploads(files, folder, { fileBaseName });
  if (!path) {
    throw new Error(message);
  }
  return path;
}

function parseMoneyOrZero(formData: FormData, name: string, label: string): number {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return 0;
  const amount = parseContractPrice(raw);
  if (amount == null || amount < 0) {
    throw new Error(`Enter the ${label}.`);
  }
  return amount;
}

export function parseCatchUpPeriodsDone(formData: FormData): number | null {
  const raw = String(formData.get("catchUpPeriodsDone") ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 120) {
    throw new Error("Enter how many billing periods are already done.");
  }
  return value;
}

export async function prepareCompleteCatchUpPeriod(opts: {
  formData: FormData;
  target: CatchUpCompleteTarget;
}): Promise<PreparedCatchUpComplete> {
  const clientAmount = parseContractPrice(
    String(opts.formData.get("clientAmount") ?? "")
  );
  if (clientAmount == null || clientAmount <= 0) {
    throw new Error("Enter how much the client pays.");
  }

  const docs = await requireCatchUpDocuments(
    opts.formData,
    "catchUpInvoice",
    "catchUpTaxInvoice"
  );

  const paidAtRaw = String(opts.formData.get("catchUpPaidAt") ?? "").trim();
  if (!paidAtRaw) {
    throw new Error("Enter the paid date.");
  }
  let paidAt: Date;
  try {
    paidAt = parseDateInput(paidAtRaw);
  } catch {
    throw new Error("Enter the paid date.");
  }

  const bankAccountId =
    String(opts.formData.get("catchUpBankAccountId") ?? "").trim() ||
    String(opts.formData.get("bankAccountId") ?? "").trim() ||
    null;
  if (!bankAccountId) {
    throw new Error("Choose the bank that received payment.");
  }

  const received =
    parseContractPrice(String(opts.formData.get("catchUpPaymentAmount") ?? "")) ??
    clientAmount;
  if (received == null || received <= 0) {
    throw new Error("Enter how much was received.");
  }
  const proofPath = await requireUploads(
    opts.formData,
    "catchUpPaymentProof",
    "uploads/payment-proofs",
    "catch-up-payment",
    "Upload payment proof."
  );

  const staffTotal = parseMoneyOrZero(
    opts.formData,
    "staffTotal",
    "total staff cost"
  );
  const materialTotal = parseMoneyOrZero(
    opts.formData,
    "materialTotal",
    "total material cost"
  );

  const expenses: PreparedCatchUpExpense[] = [];
  if (staffTotal > 0) {
    const staffPdf = await requireUploads(
      opts.formData,
      "catchUpStaffPdf",
      "uploads/catch-up-staff",
      "catch-up-staff",
      "Upload the compiled staff cost PDF."
    );
    expenses.push({
      category: "CATCH_UP_WAGE",
      reason: "Staff cost for this catch-up period",
      amount: staffTotal,
      employeeId: null,
      proofPath: staffPdf,
    });
  }
  if (materialTotal > 0) {
    const supplierProof = await requireUploads(
      opts.formData,
      "catchUpSupplierInvoices",
      "uploads/catch-up-materials",
      "catch-up-materials",
      "Upload the supplier invoices for material costs."
    );
    expenses.push({
      category: "CATCH_UP_INVENTORY",
      reason: "Material cost for this catch-up period",
      amount: materialTotal,
      employeeId: null,
      proofPath: supplierProof,
    });
  }

  return {
    target: {
      ...opts.target,
      label:
        opts.target.kind === "job"
          ? COMPLETION_INVOICE_LABEL
          : opts.target.label,
    },
    clientAmount,
    invoicePath: docs.invoicePath,
    taxPath: docs.taxPath,
    payment: {
      paid: true,
      amount: received,
      proofPath,
      paidAt,
      bankAccountId,
    },
    expenses,
  };
}

export async function persistCompleteCatchUpPeriod(
  tx: Prisma.TransactionClient,
  opts: {
    projectId: string;
    plan: PreparedCatchUpComplete;
    bankAccountId: string | null;
    paymentTermsDays: number | null;
    companyId: string;
    userId: string;
  }
): Promise<void> {
  const now = new Date();
  const periodStart = parseDateInput(opts.plan.target.periodStart);
  const periodEnd = parseDateInput(opts.plan.target.periodEnd);
  const existing = await tx.projectInvoicePeriod.findUnique({
    where: {
      projectId_periodStart_periodEnd: {
        projectId: opts.projectId,
        periodStart,
        periodEnd,
      },
    },
    select: {
      id: true,
      isCatchUp: true,
      invoicePdfPath: true,
      status: true,
    },
  });

  if (existing?.isCatchUp && existing.invoicePdfPath) {
    throw new Error("This period is already completed.");
  }
  if (
    existing &&
    !existing.isCatchUp
  ) {
    throw new Error("This period already exists. Please recheck.");
  }

  const periodData = {
    label: opts.plan.target.label,
    status: opts.plan.payment.paid ? "PAID" : "AWAITING_PAYMENT",
    amount: opts.plan.clientAmount,
    bankAccountId: opts.plan.payment.bankAccountId ?? opts.bankAccountId,
    invoicePdfPath: opts.plan.invoicePath,
    submittedAt: now,
    dueAt: dueAtFromClientPaymentTerms(
      opts.plan.payment.paidAt ?? now,
      opts.paymentTermsDays
    ),
    paidAt: opts.plan.payment.paid
      ? opts.plan.payment.paidAt ?? now
      : null,
    paymentProofPath: opts.plan.payment.proofPath,
    paymentProofUploadedAt: opts.plan.payment.proofPath ? now : null,
    paymentVerifiedAt: opts.plan.payment.paid ? now : null,
    taxInvoiceRequired: true,
    taxInvoiceDocumentPath: opts.plan.taxPath,
    taxInvoiceDocumentUploadedAt: now,
    taxInvoiceDoneAt: now,
    isCatchUp: true,
  } as const;

  if (existing) {
    await tx.projectInvoicePeriod.update({
      where: { id: existing.id },
      data: periodData,
    });
  } else {
    await tx.projectInvoicePeriod.create({
      data: {
        projectId: opts.projectId,
        periodStart,
        periodEnd,
        ...periodData,
      },
    });
  }

  for (const expense of opts.plan.expenses) {
    await tx.projectExpense.create({
      data: {
        category: expense.category,
        amount: expense.amount,
        reason: expense.reason,
        incurredAt: periodEnd,
        companyId: opts.companyId,
        projectId: opts.projectId,
        createdById: opts.userId,
        employeeId: expense.employeeId,
        isCatchUp: true,
        proofPath: expense.proofPath,
      },
    });
  }
}

export function assertCompleteTargetMatchesForm(
  target: CatchUpCompleteTarget,
  formData: FormData
): void {
  const start = String(formData.get("periodStart") ?? "").trim();
  const end = String(formData.get("periodEnd") ?? "").trim();
  const kind = String(formData.get("completeKind") ?? "").trim();
  if (
    start !== target.periodStart ||
    end !== target.periodEnd ||
    kind !== target.kind
  ) {
    throw new Error("This period is no longer open for catch-up.");
  }
}
