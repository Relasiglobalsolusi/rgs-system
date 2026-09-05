import type { Prisma, ProjectCatchUpKind } from "@prisma/client";

import { COMPLETION_INVOICE_LABEL, parseContractPrice } from "@/lib/project-billing";
import { type CatchUpCompleteTarget } from "@/lib/project-catch-up-periods";
import {
  dueAtFromClientPaymentTerms,
  parseDateInput,
} from "@/lib/invoice-period";
import { formFiles, saveAndSerializeUploads } from "@/lib/upload-paths";

export {
  listHistoricalCatchUpPeriods,
  listMonthlyCatchUpPeriods,
  resolveCatchUpCompleteTarget,
  usesMonthlyCatchUpPeriods,
  type CatchUpCompleteTarget,
} from "@/lib/project-catch-up-periods";

export function parseCatchUpKind(formData: FormData): ProjectCatchUpKind {
  const raw = String(formData.get("projectOngoing") ?? "").trim();
  if (raw === "Yes" || raw === "ONGOING") return "ONGOING";
  if (raw === "Completed" || raw === "COMPLETED") return "COMPLETED";
  return "NONE";
}

function parseYes(formData: FormData, name: string): boolean {
  const raw = String(formData.get(name) ?? "").trim();
  return raw === "Yes" || raw === "on" || raw === "true";
}

function parsePositiveQty(raw: string): number | null {
  const value = Number(String(raw).replace(",", ".").trim());
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export type PreparedCatchUpExpense = {
  category: "CATCH_UP_INVENTORY" | "CATCH_UP_WAGE";
  reason: string;
  amount: number;
  employeeId: string | null;
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

async function optionalPayment(
  formData: FormData,
  receivedName: string,
  amountName: string,
  proofName: string
): Promise<{ paid: boolean; amount: number | null; proofPath: string | null }> {
  if (!parseYes(formData, receivedName)) {
    return { paid: false, amount: null, proofPath: null };
  }
  const amount = parseContractPrice(String(formData.get(amountName) ?? ""));
  if (amount == null || amount <= 0) {
    throw new Error("Enter how much was received.");
  }
  const proofs = formFiles(formData, proofName);
  if (proofs.length === 0) {
    throw new Error("Upload payment proof.");
  }
  const proofPath = await saveAndSerializeUploads(
    proofs,
    "uploads/payment-proofs",
    { fileBaseName: "catch-up-payment" }
  );
  return { paid: true, amount, proofPath };
}

function parseInventoryExpenses(
  formData: FormData,
  catalog: Map<string, { name: string; unit: string }>
): PreparedCatchUpExpense[] {
  const count = Number(String(formData.get("inventoryCount") ?? "0"));
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Inventory lines are invalid.");
  }
  const expenses: PreparedCatchUpExpense[] = [];
  for (let index = 0; index < count; index += 1) {
    const itemId = String(formData.get(`inventoryItemId.${index}`) ?? "").trim();
    const typedName = String(formData.get(`inventoryName.${index}`) ?? "").trim();
    const qtyRaw = String(formData.get(`inventoryQty.${index}`) ?? "").trim();
    const amountRaw = String(formData.get(`inventoryAmount.${index}`) ?? "");
    if (!itemId && !typedName && !qtyRaw && !amountRaw.trim()) continue;

    const catalogItem = itemId ? catalog.get(itemId) : undefined;
    const name = typedName || catalogItem?.name || "";
    const qty = parsePositiveQty(qtyRaw);
    const amount = parseContractPrice(amountRaw);
    if (!name) {
      throw new Error("Name each inventory item issued.");
    }
    if (qty == null) {
      throw new Error("Enter the quantity issued for each inventory item.");
    }
    if (amount == null || amount <= 0) {
      throw new Error("Enter the cost of each inventory item issued.");
    }
    const unit = catalogItem?.unit ? ` ${catalogItem.unit}` : "";
    expenses.push({
      category: "CATCH_UP_INVENTORY",
      reason: `Inventory: ${name} × ${qty}${unit}`,
      amount,
      employeeId: null,
    });
  }
  return expenses;
}

function parseStaffExpenses(formData: FormData): PreparedCatchUpExpense[] {
  const count = Number(String(formData.get("staffCount") ?? "0"));
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Staff lines are invalid.");
  }
  const expenses: PreparedCatchUpExpense[] = [];
  for (let index = 0; index < count; index += 1) {
    const employeeId = String(
      formData.get(`staffEmployeeId.${index}`) ?? ""
    ).trim();
    const staffName = String(formData.get(`staffName.${index}`) ?? "").trim();
    const amountRaw = String(formData.get(`staffPay.${index}`) ?? "");
    if (!employeeId && !staffName && !amountRaw.trim()) continue;
    if (!employeeId && !staffName) {
      throw new Error("Choose the staff issued for each pay line.");
    }
    const amount = parseContractPrice(amountRaw);
    if (amount == null || amount <= 0) {
      throw new Error("Enter staff pay for each person issued.");
    }
    expenses.push({
      category: "CATCH_UP_WAGE",
      reason: staffName ? `Staff pay: ${staffName}` : "Staff pay",
      amount,
      employeeId: employeeId || null,
    });
  }
  return expenses;
}

export async function prepareCompleteCatchUpPeriod(opts: {
  formData: FormData;
  target: CatchUpCompleteTarget;
  inventoryCatalog: Map<string, { name: string; unit: string }>;
  requirePayment?: boolean;
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
  if (opts.requirePayment) {
    const markedPaid = parseYes(opts.formData, "catchUpPaymentReceived");
    if (!markedPaid) {
      throw new Error(
        "A completed job needs the amount received and payment proof."
      );
    }
  }
  const payment = await optionalPayment(
    opts.formData,
    "catchUpPaymentReceived",
    "catchUpPaymentAmount",
    "catchUpPaymentProof"
  );

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
    payment,
    expenses: [
      ...parseInventoryExpenses(opts.formData, opts.inventoryCatalog),
      ...parseStaffExpenses(opts.formData),
    ],
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
    !existing.isCatchUp &&
    existing.status !== "ONGOING" &&
    existing.status !== "COMPILING"
  ) {
    throw new Error("This period is already in the live billing flow.");
  }

  const periodData = {
    label: opts.plan.target.label,
    status: opts.plan.payment.paid ? "PAID" : "AWAITING_PAYMENT",
    amount: opts.plan.clientAmount,
    bankAccountId: opts.bankAccountId,
    invoicePdfPath: opts.plan.invoicePath,
    submittedAt: now,
    dueAt: dueAtFromClientPaymentTerms(now, opts.paymentTermsDays),
    paidAt: opts.plan.payment.paid ? now : null,
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
    throw new Error("This period is no longer the next one to complete.");
  }
}
