"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import {
  BANK_LOAN_TENOR_MAX,
  BANK_LOAN_TENOR_MIN,
  parseBankLoanKind,
  parseLoanCalculationMethod,
  parseLoanInterestBasis,
  remainingTenorMonths,
} from "@/lib/bank-loan";
import { parseFormCompanyBankAccountId } from "@/lib/company-bank-accounts";
import { getLoanFacilitySnapshot } from "@/lib/loan-facility-query";
import { parseLoanSource, shareholderLoanInvoiceRef } from "@/lib/loan-facility";
import {
  createLoanDraw,
  createLoanEarlySettlement,
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
    if (required) throw new Error("Enter the interest rate.");
    return null;
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Enter the interest rate.");
  }
  return new Prisma.Decimal(value);
}

function revalidateLoanPaths(facilityId?: string) {
  revalidatePath("/billing/loans");
  revalidatePath("/billing/purchase-invoices");
  revalidatePath("/billing/financial-report");
  if (facilityId) revalidatePath(`/billing/loans/${facilityId}`);
}

export async function createLoanFacility(formData: FormData) {
  const session = await requireLoansAccess();
  const source = parseLoanSource(formData.get("loanSource"));
  if (!source) {
    throw new Error("Choose Bank Loan or Shareholder Loan.");
  }
  const kind = parseBankLoanKind(formData.get("bankLoanKind"));
  if (!kind) {
    throw new Error("Choose Standby Loan or Term Loan.");
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
  const interestRateBasis = chargesInterest
    ? parseLoanInterestBasis(formData.get("interestRateBasis"))
    : parseLoanInterestBasis(formData.get("interestRateBasis")) ?? "ANNUAL";
  if (chargesInterest && !interestRateBasis) {
    throw new Error("Choose Monthly Interest or Annual Interest.");
  }
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
    const limit = parseMoney(
      String(formData.get("facilityLimit") ?? ""),
      "Enter the Credit Ceiling."
    );
    facilityLimit = new Prisma.Decimal(limit);
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

  const calculationMethod =
    kind === "TERM"
      ? parseLoanCalculationMethod(formData.get("calculationMethod")) ?? "ANNUITY"
      : null;
  if (kind === "TERM" && !calculationMethod) {
    throw new Error("Choose Flat, Effective, or Annuity.");
  }
  const commitmentFeeApplies =
    kind === "STANDBY" &&
    (formData.get("commitmentFeeApplies") === "true" ||
      formData.get("commitmentFeeApplies") === "Yes");
  const commitmentFeeRate = commitmentFeeApplies
    ? parseAnnualRate(
        String(formData.get("commitmentFeeRatePercent") ?? ""),
        true
      )
    : null;
  const dayCountYear =
    Number(String(formData.get("dayCountYear") ?? "").trim()) === 365
      ? 365
      : 360;

  const monthlyInstallment = resolveFacilityMonthlyInstallment({
    kind,
    principal: decimalToNumber(principal),
    annualPercent: decimalToNumber(annualRate),
    tenorMonths,
    interestRateBasis,
    calculationMethod,
  });

  const recordInitialDraw =
    kind === "TERM" ||
    formData.get("recordInitialDraw") === "on" ||
    formData.get("recordInitialDraw") === "true" ||
    formData.get("recordInitialDraw") === "Yes";
  const initialDrawAmount = recordInitialDraw
    ? kind === "TERM"
      ? decimalToNumber(principal)
      : parseMoney(
          String(formData.get("initialDrawAmount") ?? ""),
          "Enter the amount drawn."
        )
    : null;
  const initialDrawDate = recordInitialDraw
    ? parseRequiredDate(
        String(formData.get("initialDrawDate") ?? "") ||
          String(formData.get("startDate") ?? ""),
        "Enter the date the money was drawn."
      )
    : null;
  const drawBankAccountId = recordInitialDraw
    ? await parseFormCompanyBankAccountId(formData, session.user.companyId, {
        requiredWhenAccountsExist: true,
        requiredMessage: "Select the company bank account.",
      })
    : null;

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
        interestRateBasis: interestRateBasis ?? "ANNUAL",
        annualRatePercent: annualRate,
        tenorMonths,
        calculationMethod,
        commitmentFeeApplies,
        commitmentFeeRatePercent: commitmentFeeRate,
        dayCountYear,
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
    if (initialDrawAmount != null && initialDrawDate != null) {
      await createLoanDraw({
        db: tx,
        companyId: session.user.companyId,
        userId: session.user.id,
        facilityId: created.id,
        amount: initialDrawAmount,
        movementDate: initialDrawDate,
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
  const snapshot = await getLoanFacilitySnapshot(
    session.user.companyId,
    facilityId
  );
  if (!snapshot) throw new Error("Register the loan under Finance → Loans first.");
  if (snapshot.source === "BANK" && !invoiceRef) {
    throw new Error("Enter the loan account or bank reference.");
  }
  const resolvedRef =
    invoiceRef ||
    (snapshot.source === "SHAREHOLDER"
      ? shareholderLoanInvoiceRef(movementDate)
      : snapshot.name);
  const file = requireImageOrPdfUpload(formData.get("document"), {
    requiredMessage: "Upload the payment proof.",
  });
  const filePath = await saveUpload(file, "uploads/purchase-invoices", {
    fileBaseName: buildBillingDocumentFileBase({
      prefix: "Bank-Loan",
      clientName: snapshot.lenderName,
      invoiceNumber: resolvedRef,
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
      invoiceRef: resolvedRef,
      filePath,
      notes,
      standbyPayment: "PRINCIPAL",
    });
  });

  revalidateLoanPaths(facilityId);
}

export async function updateLoanFacilityVariables(formData: FormData) {
  const session = await requireLoansAccess();
  const facilityId = String(formData.get("facilityId") ?? "").trim();
  if (!facilityId) throw new Error("Select the registered loan.");
  const snapshot = await getLoanFacilitySnapshot(
    session.user.companyId,
    facilityId
  );
  if (!snapshot) throw new Error("Loan not found.");
  if (snapshot.status !== "ACTIVE") {
    throw new Error("This loan is already closed.");
  }

  const dayCountYear =
    Number(String(formData.get("dayCountYear") ?? "").trim()) === 365
      ? 365
      : 360;
  const interestRateBasis = snapshot.chargesInterest
    ? parseLoanInterestBasis(formData.get("interestRateBasis"))
    : parseLoanInterestBasis(formData.get("interestRateBasis")) ??
      snapshot.interestRateBasis;
  if (snapshot.chargesInterest && !interestRateBasis) {
    throw new Error("Choose Monthly Interest or Annual Interest.");
  }
  const annualRate = parseAnnualRate(
    String(formData.get("annualRatePercent") ?? ""),
    snapshot.chargesInterest
  );
  const commitmentFeeApplies =
    snapshot.kind === "STANDBY" &&
    (formData.get("commitmentFeeApplies") === "true" ||
      formData.get("commitmentFeeApplies") === "Yes");
  const commitmentFeeRate = commitmentFeeApplies
    ? parseAnnualRate(
        String(formData.get("commitmentFeeRatePercent") ?? ""),
        true
      )
    : null;
  let tenorMonths = snapshot.tenorMonths;
  let calculationMethod = snapshot.calculationMethod;
  if (snapshot.kind === "TERM") {
    const tenorRaw = Number(String(formData.get("tenorMonths") ?? "").trim());
    tenorMonths = Math.round(tenorRaw);
    if (
      !Number.isFinite(tenorMonths) ||
      tenorMonths < BANK_LOAN_TENOR_MIN ||
      tenorMonths > BANK_LOAN_TENOR_MAX
    ) {
      throw new Error("Enter the tenor in months.");
    }
    calculationMethod =
      parseLoanCalculationMethod(formData.get("calculationMethod")) ??
      snapshot.calculationMethod ??
      "ANNUITY";
    if (!calculationMethod) {
      throw new Error("Choose Flat, Effective, or Annuity.");
    }
  }

  const monthlyInstallment = resolveFacilityMonthlyInstallment({
    kind: snapshot.kind,
    principal: snapshot.principal ?? snapshot.outstanding,
    annualPercent: decimalToNumber(annualRate),
    tenorMonths,
    interestRateBasis,
    calculationMethod,
  });

  await prisma.loanFacility.update({
    where: { id: facilityId },
    data: {
      dayCountYear,
      interestRateBasis: interestRateBasis ?? snapshot.interestRateBasis,
      annualRatePercent: annualRate,
      tenorMonths,
      calculationMethod,
      commitmentFeeApplies,
      commitmentFeeRatePercent: commitmentFeeRate,
      monthlyInstallment:
        monthlyInstallment != null
          ? new Prisma.Decimal(monthlyInstallment)
          : snapshot.kind === "TERM"
            ? null
            : undefined,
    },
  });
  revalidateLoanPaths(facilityId);
}

export async function extendLoanFacilityAction(formData: FormData) {
  const session = await requireLoansAccess();
  const facilityId = String(formData.get("facilityId") ?? "").trim();
  if (!facilityId) throw new Error("Select the registered loan.");
  const snapshot = await getLoanFacilitySnapshot(
    session.user.companyId,
    facilityId
  );
  if (!snapshot) throw new Error("Loan not found.");
  if (snapshot.status !== "ACTIVE") {
    throw new Error("This loan is already closed.");
  }

  if (snapshot.kind === "STANDBY") {
    const limit = parseMoney(
      String(formData.get("facilityLimit") ?? ""),
      "Enter the new credit ceiling."
    );
    if (limit < snapshot.outstanding) {
      throw new Error(
        "The new credit ceiling cannot be below outstanding principal."
      );
    }
    await prisma.loanFacility.update({
      where: { id: facilityId },
      data: { facilityLimit: new Prisma.Decimal(limit) },
    });
    revalidateLoanPaths(facilityId);
    return;
  }

  const annualRate = parseAnnualRate(
    String(formData.get("annualRatePercent") ?? ""),
    snapshot.chargesInterest
  );
  const remainingMonths = remainingTenorMonths(
    snapshot.startDate,
    snapshot.tenorMonths ?? 0
  );
  const monthlyInstallment = resolveFacilityMonthlyInstallment({
    kind: "TERM",
    principal: snapshot.outstanding,
    annualPercent: decimalToNumber(annualRate),
    tenorMonths: remainingMonths,
    interestRateBasis: snapshot.interestRateBasis,
  });
  await prisma.loanFacility.update({
    where: { id: facilityId },
    data: {
      annualRatePercent: annualRate,
      monthlyInstallment:
        monthlyInstallment != null
          ? new Prisma.Decimal(monthlyInstallment)
          : null,
    },
  });
  revalidateLoanPaths(facilityId);
}

export async function settleEarlyLoanAction(formData: FormData) {
  const session = await requireLoansAccess();
  const facilityId = String(formData.get("facilityId") ?? "").trim();
  if (!facilityId) throw new Error("Select the registered loan.");
  const movementDate = parseRequiredDate(
    String(formData.get("movementDate") ?? ""),
    "Date is required."
  );
  const invoiceRef = String(formData.get("invoiceRef") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const penaltyPercentRaw = String(formData.get("penaltyPercent") ?? "")
    .trim()
    .replace(",", ".");
  const penaltyPercent = Number(penaltyPercentRaw || "0");
  if (!Number.isFinite(penaltyPercent) || penaltyPercent < 0 || penaltyPercent > 20) {
    throw new Error("Enter the early settlement penalty percent.");
  }
  const penaltyAmount = parseOptionalMoney(String(formData.get("penaltyAmount") ?? ""));
  const adminFeeAmount = parseOptionalMoney(String(formData.get("adminFeeAmount") ?? ""));
  const transferFee = parseOptionalMoney(String(formData.get("transferFeeIdr") ?? ""));
  const bankAccountId = await parseFormCompanyBankAccountId(
    formData,
    session.user.companyId,
    {
      requiredWhenAccountsExist: true,
      requiredMessage: "Select the company bank account.",
    }
  );
  const snapshot = await getLoanFacilitySnapshot(
    session.user.companyId,
    facilityId
  );
  if (!snapshot) throw new Error("Register the loan under Finance → Loan first.");
  if (snapshot.source === "BANK" && !invoiceRef) {
    throw new Error("Enter the loan account or bank reference.");
  }
  const resolvedSettleRef =
    invoiceRef ||
    (snapshot.source === "SHAREHOLDER"
      ? shareholderLoanInvoiceRef(movementDate)
      : snapshot.name);
  const file = requireImageOrPdfUpload(formData.get("document"), {
    requiredMessage: "Upload the payment proof.",
  });
  const filePath = await saveUpload(file, "uploads/purchase-invoices", {
    fileBaseName: buildBillingDocumentFileBase({
      prefix: "Loan-Settle-Early",
      clientName: snapshot.lenderName,
      invoiceNumber: resolvedSettleRef,
    }),
  });

  await prisma.$transaction(async (tx) => {
    await createLoanEarlySettlement({
      db: tx,
      companyId: session.user.companyId,
      userId: session.user.id,
      facilityId,
      movementDate,
      penaltyPercent,
      penaltyAmount,
      adminFeeAmount,
      transferFeeIdr: transferFee,
      bankAccountId,
      invoiceRef: resolvedSettleRef,
      filePath,
      notes,
    });
  });

  revalidateLoanPaths(facilityId);
}
