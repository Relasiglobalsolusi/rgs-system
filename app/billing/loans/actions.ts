"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import {
  BANK_LOAN_TENOR_MAX,
  BANK_LOAN_TENOR_MIN,
  parseBankLoanKind,
} from "@/lib/bank-loan";
import {
  listCompanyBankAccountOptions,
  parseFormCompanyBankAccountId,
} from "@/lib/company-bank-accounts";
import {
  listLoanFacilitySnapshots,
  getLoanFacilitySnapshot,
} from "@/lib/loan-facility-query";
import { parseLoanSource } from "@/lib/loan-facility";
import {
  createLoanDraw,
  createLoanRepayment,
  defaultFacilityName,
  resolveFacilityMonthlyInstallment,
} from "@/lib/loan-facility-write";
import { inferDocumentMime } from "@/lib/payment-document-verify";
import { taxInvoiceDateToUtcDate } from "@/lib/payment-document-verify";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { requireFinanceChild } from "@/lib/session";
import { buildBillingDocumentFileBase, saveUpload } from "@/lib/upload";

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

async function requireLoansAccess() {
  const session = await requireFinanceChild("loans");
  if (session.user.clientId || session.user.vendorId) {
    throw new Error("Loans are recorded by Head Office only.");
  }
  return session;
}

function requireImageOrPdfUpload(
  value: FormDataEntryValue | null,
  opts: { requiredMessage: string }
): File {
  if (!(value instanceof File) || value.size <= 0) {
    throw new Error(opts.requiredMessage);
  }
  if (value.size > UPLOAD_MAX_BYTES) {
    throw new Error("File must be 10 MB or smaller.");
  }
  const mime = inferDocumentMime(value);
  if (mime && mime !== "application/octet-stream" && !UPLOAD_MIME.has(mime)) {
    throw new Error("Upload an image or PDF.");
  }
  return value;
}

function optionalImageOrPdfUpload(value: FormDataEntryValue | null): File | null {
  if (!(value instanceof File) || value.size <= 0) return null;
  return requireImageOrPdfUpload(value, {
    requiredMessage: "Upload an image or PDF.",
  });
}

function parseRequiredDate(raw: string, message: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    throw new Error(message);
  }
  return taxInvoiceDateToUtcDate(raw.trim());
}

function parseMoney(raw: string, message: string): number {
  const cleaned = String(raw ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) throw new Error(message);
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) throw new Error(message);
  return Math.round(value);
}

function parseOptionalMoney(raw: string): number | null {
  if (!String(raw ?? "").trim()) return null;
  return parseMoney(raw, "Enter a valid amount.");
}

function parseAnnualRate(raw: string, required: boolean): Prisma.Decimal | null {
  const text = String(raw ?? "").trim().replace(",", ".");
  if (!text) {
    if (required) throw new Error("Enter the annual interest rate.");
    return null;
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Enter the annual interest rate.");
  }
  return new Prisma.Decimal(value);
}

function revalidateLoanPaths(facilityId?: string) {
  revalidatePath("/billing/loans");
  revalidatePath("/billing/purchase-invoices");
  revalidatePath("/billing/financial-report");
  if (facilityId) revalidatePath(`/billing/loans/${facilityId}`);
}

export async function listLoanBankAccounts() {
  const session = await requireLoansAccess();
  return listCompanyBankAccountOptions(session.user.companyId);
}

export async function listLoanFacilitiesAction() {
  const session = await requireLoansAccess();
  return listLoanFacilitySnapshots(session.user.companyId);
}

export async function createLoanFacility(formData: FormData) {
  const session = await requireLoansAccess();
  const source = parseLoanSource(formData.get("loanSource"));
  if (!source) {
    throw new Error("Choose Bank Loan or Shareholder Loan.");
  }
  const kind =
    source === "SHAREHOLDER"
      ? "STANDBY"
      : parseBankLoanKind(formData.get("bankLoanKind"));
  if (!kind) {
    throw new Error("Choose Standby Facility or Term Loan.");
  }
  const startDate = parseRequiredDate(
    String(formData.get("startDate") ?? ""),
    "Start date is required."
  );
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const chargesInterest =
    source === "BANK" ||
    formData.get("chargesInterest") === "on" ||
    formData.get("chargesInterest") === "true" ||
    formData.get("chargesInterest") === "Yes";
  const annualRate = parseAnnualRate(
    String(formData.get("annualRatePercent") ?? ""),
    chargesInterest
  );

  let vendorId: string | null = null;
  let lenderName = String(formData.get("lenderName") ?? "").trim();
  if (source === "BANK") {
    vendorId = String(formData.get("vendorId") ?? "").trim();
    if (!vendorId) throw new Error("Select a registered vendor.");
    const vendor = await prisma.vendor.findFirst({
      where: {
        id: vendorId,
        companyId: session.user.companyId,
        active: true,
      },
      select: { id: true, name: true },
    });
    if (!vendor) throw new Error("Select a registered vendor.");
    lenderName = vendor.name;
  } else if (!lenderName) {
    throw new Error("Enter the shareholder name.");
  }

  const name =
    String(formData.get("name") ?? "").trim() ||
    defaultFacilityName({ source, lenderName, kind });

  let facilityLimit: Prisma.Decimal | null = null;
  let principal: Prisma.Decimal | null = null;
  let tenorMonths: number | null = null;
  if (kind === "STANDBY") {
    const limit = parseOptionalMoney(String(formData.get("facilityLimit") ?? ""));
    facilityLimit = limit != null ? new Prisma.Decimal(limit) : null;
  } else {
    const principalNumber = parseMoney(
      String(formData.get("principal") ?? ""),
      "Enter the loan principal."
    );
    principal = new Prisma.Decimal(principalNumber);
    const tenorRaw = Number(String(formData.get("tenorMonths") ?? "").trim());
    tenorMonths = Math.round(tenorRaw);
    if (
      !Number.isFinite(tenorMonths) ||
      tenorMonths < BANK_LOAN_TENOR_MIN ||
      tenorMonths > BANK_LOAN_TENOR_MAX
    ) {
      throw new Error("Enter the tenor in months.");
    }
  }

  const monthlyInstallment = resolveFacilityMonthlyInstallment({
    kind,
    principal: decimalToNumber(principal),
    annualPercent: decimalToNumber(annualRate),
    tenorMonths,
  });

  const recordInitialDraw =
    formData.get("recordInitialDraw") === "on" ||
    formData.get("recordInitialDraw") === "true" ||
    formData.get("recordInitialDraw") === "Yes";
  const initialDrawAmount = recordInitialDraw
    ? parseMoney(
        String(formData.get("initialDrawAmount") ?? ""),
        "Enter the amount already received."
      )
    : null;
  const drawBankAccountId = recordInitialDraw
    ? await parseFormCompanyBankAccountId(formData, session.user.companyId, {
        requiredWhenAccountsExist: true,
        requiredMessage: "Select the company bank account.",
      })
    : await parseFormCompanyBankAccountId(formData, session.user.companyId, {
        requiredWhenAccountsExist: false,
      });

  const facility = await prisma.$transaction(async (tx) => {
    const created = await tx.loanFacility.create({
      data: {
        companyId: session.user.companyId,
        source,
        kind,
        name,
        lenderName,
        vendorId,
        bankAccountId: drawBankAccountId,
        facilityLimit,
        principal,
        chargesInterest,
        annualRatePercent: annualRate,
        tenorMonths,
        monthlyInstallment:
          monthlyInstallment != null
            ? new Prisma.Decimal(monthlyInstallment)
            : null,
        startDate,
        notes,
        createdById: session.user.id,
      },
      select: { id: true },
    });
    if (initialDrawAmount != null) {
      await createLoanDraw({
        db: tx,
        companyId: session.user.companyId,
        userId: session.user.id,
        facilityId: created.id,
        amount: initialDrawAmount,
        movementDate: startDate,
        bankAccountId: drawBankAccountId,
        notes: "Initial draw",
      });
    }
    return created;
  });

  revalidateLoanPaths(facility.id);
}

export async function recordLoanDrawAction(formData: FormData) {
  const session = await requireLoansAccess();
  const facilityId = String(formData.get("facilityId") ?? "").trim();
  if (!facilityId) throw new Error("Select the registered loan.");
  const amount = parseMoney(
    String(formData.get("amount") ?? ""),
    "Enter the amount drawn."
  );
  const movementDate = parseRequiredDate(
    String(formData.get("movementDate") ?? ""),
    "Date is required."
  );
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const bankAccountId = await parseFormCompanyBankAccountId(
    formData,
    session.user.companyId,
    {
      requiredWhenAccountsExist: true,
      requiredMessage: "Select the company bank account.",
    }
  );
  const file = optionalImageOrPdfUpload(formData.get("document"));
  const snapshot = await getLoanFacilitySnapshot(
    session.user.companyId,
    facilityId
  );
  if (!snapshot) throw new Error("Register the loan under Finance → Loans first.");
  const filePath = file
    ? await saveUpload(file, "uploads/purchase-invoices", {
        fileBaseName: buildBillingDocumentFileBase({
          prefix: "Loan-Draw",
          clientName: snapshot.lenderName,
          invoiceNumber: `DRAW-${snapshot.name}`,
        }),
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await createLoanDraw({
      db: tx,
      companyId: session.user.companyId,
      userId: session.user.id,
      facilityId,
      amount,
      movementDate,
      bankAccountId,
      notes,
      filePath,
    });
  });

  revalidateLoanPaths(facilityId);
}

export async function recordLoanRepaymentAction(formData: FormData) {
  const session = await requireLoansAccess();
  const facilityId = String(formData.get("facilityId") ?? "").trim();
  if (!facilityId) throw new Error("Select the registered loan.");
  const amount = parseMoney(
    String(formData.get("amount") ?? ""),
    "Enter the amount paid."
  );
  const movementDate = parseRequiredDate(
    String(formData.get("movementDate") ?? ""),
    "Date is required."
  );
  const invoiceRef = String(formData.get("invoiceRef") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const transferFee = parseOptionalMoney(
    String(formData.get("transferFeeIdr") ?? "")
  );
  const bankAccountId = await parseFormCompanyBankAccountId(
    formData,
    session.user.companyId,
    {
      requiredWhenAccountsExist: true,
      requiredMessage: "Select the company bank account.",
    }
  );
  const file = requireImageOrPdfUpload(formData.get("document"), {
    requiredMessage: "Upload the bank advice or payment proof.",
  });
  const snapshot = await getLoanFacilitySnapshot(
    session.user.companyId,
    facilityId
  );
  if (!snapshot) throw new Error("Register the loan under Finance → Loans first.");
  const filePath = await saveUpload(file, "uploads/purchase-invoices", {
    fileBaseName: buildBillingDocumentFileBase({
      prefix: "Bank-Loan",
      clientName: snapshot.lenderName,
      invoiceNumber: invoiceRef || snapshot.name,
    }),
  });

  await prisma.$transaction(async (tx) => {
    await createLoanRepayment({
      db: tx,
      companyId: session.user.companyId,
      userId: session.user.id,
      facilityId,
      amount,
      transferFeeIdr: transferFee,
      movementDate,
      bankAccountId,
      invoiceRef: invoiceRef || snapshot.name,
      filePath,
      notes,
    });
  });

  revalidateLoanPaths(facilityId);
}

export async function closeLoanFacilityAction(formData: FormData) {
  const session = await requireLoansAccess();
  const facilityId = String(formData.get("facilityId") ?? "").trim();
  if (!facilityId) throw new Error("Select the registered loan.");
  const snapshot = await getLoanFacilitySnapshot(
    session.user.companyId,
    facilityId
  );
  if (!snapshot) throw new Error("Loan not found.");
  if (snapshot.outstanding > 0) {
    throw new Error("This loan still has outstanding principal.");
  }
  await prisma.loanFacility.update({
    where: { id: facilityId },
    data: { status: "CLOSED" },
  });
  revalidateLoanPaths(facilityId);
}
