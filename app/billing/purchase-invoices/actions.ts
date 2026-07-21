"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import {
  resolveCompanyNpwpFromEnv,
  taxInvoiceDateToUtcDate,
  verifyPurchaseTaxInvoice,
  type TaxInvoiceConflictKind,
  type TaxInvoiceExtractStored,
} from "@/lib/payment-document-verify";
import { paymentVerifyFailureMessage } from "@/lib/payment-verify-messages";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { extractPurchaseInvoiceFields } from "@/lib/purchase-invoice-extract";
import type { ExtractPurchaseInvoiceResult } from "@/lib/purchase-invoice-extract-client";
import { requireSession, toPermissionUser } from "@/lib/session";
import {
  buildBillingDocumentFileBase,
  deleteLocalUpload,
  saveUpload,
} from "@/lib/upload";

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

async function requirePurchaseManageAccess() {
  const session = await requireSession();
  if (session.user.clientId) {
    redirect("/dashboard");
  }
  const user = toPermissionUser(session);
  if (!canAccess(user, "projects") && !canAccess(user, "invoicing")) {
    redirect("/dashboard");
  }
  return session;
}

function requireImageOrPdfUpload(
  value: FormDataEntryValue | null,
  opts: { requiredMessage: string; sizeMessage: string; typeMessage: string }
): File {
  if (!(value instanceof File) || value.size <= 0) {
    throw new Error(opts.requiredMessage);
  }
  if (value.size > UPLOAD_MAX_BYTES) {
    throw new Error(opts.sizeMessage);
  }
  const mime = value.type || "";
  if (mime && !UPLOAD_MIME.has(mime)) {
    throw new Error(opts.typeMessage);
  }
  return value;
}

function optionalImageOrPdfUpload(
  value: FormDataEntryValue | null,
  opts: { sizeMessage: string; typeMessage: string }
): File | null {
  if (!(value instanceof File) || value.size <= 0) {
    return null;
  }
  if (value.size > UPLOAD_MAX_BYTES) {
    throw new Error(opts.sizeMessage);
  }
  const mime = value.type || "";
  if (mime && !UPLOAD_MIME.has(mime)) {
    throw new Error(opts.typeMessage);
  }
  return value;
}

function parseAmount(raw: string): Prisma.Decimal {
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) {
    throw new Error("Amount is required.");
  }
  // Prefer last comma/dot as decimal separator when both appear (IDR-style).
  let normalized = cleaned;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    const parts = cleaned.split(",");
    normalized =
      parts.length === 2 && parts[1]!.length <= 2
        ? `${parts[0]!.replace(/\./g, "")}.${parts[1]}`
        : cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }

  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error("Enter a valid amount.");
  }
  return new Prisma.Decimal(normalized);
}

async function savePurchaseTaxInvoiceFile(
  file: File,
  supplierName: string,
  invoiceRef: string
): Promise<string> {
  return saveUpload(file, "uploads/purchase-invoices", {
    fileBaseName: buildBillingDocumentFileBase({
      prefix: "Purchase-Tax-Invoice",
      clientName: supplierName,
      invoiceNumber: invoiceRef,
    }),
  });
}

function taxInvoicePersistFields(tax: TaxInvoiceExtractStored | undefined) {
  if (!tax) return {};
  return {
    taxInvoiceSerial: tax.serial,
    taxInvoiceDocumentHash: tax.documentHash,
    taxInvoiceIssuedAt: tax.issuedDate
      ? taxInvoiceDateToUtcDate(tax.issuedDate)
      : null,
  };
}

/**
 * Uniqueness across purchases (+ keluaran periods for serial/hash).
 */
async function findPurchaseTaxInvoiceConflict(query: {
  serial: string | null;
  documentHash: string;
  issuedDate: string | null;
  invoiceAmount: number;
  excludeId: string;
}): Promise<TaxInvoiceConflictKind | null> {
  const excludePurchase =
    query.excludeId.length > 0 ? { id: { not: query.excludeId } } : {};

  if (query.serial) {
    const byPurchaseSerial = await prisma.purchaseInvoice.findFirst({
      where: {
        ...excludePurchase,
        taxInvoiceSerial: query.serial,
      },
      select: { id: true },
    });
    if (byPurchaseSerial) return "serial";

    const byPeriodSerial = await prisma.projectInvoicePeriod.findFirst({
      where: { taxInvoiceSerial: query.serial },
      select: { id: true },
    });
    if (byPeriodSerial) return "serial";
  }

  const byPurchaseHash = await prisma.purchaseInvoice.findFirst({
    where: {
      ...excludePurchase,
      taxInvoiceDocumentHash: query.documentHash,
    },
    select: { id: true },
  });
  if (byPurchaseHash) return "document_hash";

  const byPeriodHash = await prisma.projectInvoicePeriod.findFirst({
    where: { taxInvoiceDocumentHash: query.documentHash },
    select: { id: true },
  });
  if (byPeriodHash) return "document_hash";

  if (query.issuedDate) {
    const byPurchaseDateAmount = await prisma.purchaseInvoice.findFirst({
      where: {
        ...excludePurchase,
        taxInvoiceIssuedAt: taxInvoiceDateToUtcDate(query.issuedDate),
        amount: query.invoiceAmount,
        taxInvoiceFilePath: { not: null },
      },
      select: { id: true },
    });
    if (byPurchaseDateAmount) return "date_amount";
  }

  return null;
}

async function rejectPurchaseTaxVerify(
  verification: Awaited<ReturnType<typeof verifyPurchaseTaxInvoice>>
): Promise<never> {
  const locale = await getServerLocale();
  if (verification.ok) {
    throw new Error("Tax invoice verification failed unexpectedly.");
  }
  const lines = verification.failures.map((code) =>
    paymentVerifyFailureMessage(locale, code, verification.details)
  );
  const header = translate(locale, "pages.billing.purchaseTaxInvoiceVerifyRejected");
  throw new Error([header, ...lines.map((line) => `• ${line}`)].join("\n"));
}

/**
 * Soft-fill commercial purchase invoice fields from an uploaded bill.
 * Never blocks save — failures return `{ ok: false }` for client toast/manual entry.
 */
export async function extractPurchaseInvoiceFromUpload(
  formData: FormData
): Promise<ExtractPurchaseInvoiceResult> {
  const session = await requirePurchaseManageAccess();

  const file = formData.get("document");
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false, code: "extract_failed" };
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return { ok: false, code: "extract_failed" };
  }
  const mime = file.type || "";
  if (mime && !UPLOAD_MIME.has(mime)) {
    return { ok: false, code: "extract_failed" };
  }

  const portalVendorId = session.user.vendorId ?? null;
  const vendors = await prisma.vendor.findMany({
    where: {
      companyId: session.user.companyId,
      active: true,
      ...(portalVendorId ? { id: portalVendorId } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return extractPurchaseInvoiceFields(file, vendors);
}

export async function createPurchaseInvoice(formData: FormData) {
  const session = await requirePurchaseManageAccess();

  let supplierName = String(formData.get("supplierName") ?? "").trim();
  const vendorIdRaw = String(formData.get("vendorId") ?? "").trim();
  const invoiceRef = String(formData.get("invoiceRef") ?? "").trim();
  const invoiceDateRaw = String(formData.get("invoiceDate") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const includesPpn =
    formData.get("includesPpn") === "on" ||
    formData.get("includesPpn") === "true";

  const portalVendorId = session.user.vendorId ?? null;
  let vendorId: string | null = null;

  // Vendor portal: always attribute uploads to the signed-in vendor.
  if (portalVendorId) {
    const vendor = await prisma.vendor.findFirst({
      where: {
        id: portalVendorId,
        companyId: session.user.companyId,
        active: true,
      },
      select: { id: true, name: true },
    });
    if (!vendor) {
      throw new Error("Vendor not found.");
    }
    vendorId = vendor.id;
    supplierName = vendor.name;
  } else if (vendorIdRaw) {
    const vendor = await prisma.vendor.findFirst({
      where: {
        id: vendorIdRaw,
        companyId: session.user.companyId,
        active: true,
      },
      select: { id: true, name: true },
    });
    if (!vendor) {
      throw new Error("Vendor not found.");
    }
    vendorId = vendor.id;
    supplierName = vendor.name;
  }

  if (!supplierName) {
    throw new Error("Vendor name is required.");
  }
  if (!invoiceRef) {
    throw new Error("Invoice Number / Ref is required.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDateRaw)) {
    throw new Error("Invoice Date is required.");
  }

  const file = requireImageOrPdfUpload(formData.get("document"), {
    requiredMessage: "Upload the purchase invoice document.",
    sizeMessage: "File must be 10 MB or smaller.",
    typeMessage: "Upload an image or PDF.",
  });

  const taxFile =
    includesPpn
      ? optionalImageOrPdfUpload(formData.get("taxInvoiceDocument"), {
          sizeMessage: "Tax invoice file must be 10 MB or smaller.",
          typeMessage: "Upload an image or PDF for the tax invoice.",
        })
      : null;

  const amount = parseAmount(amountRaw);
  const invoiceDate = taxInvoiceDateToUtcDate(invoiceDateRaw);
  const invoiceAmount = decimalToNumber(amount);
  if (invoiceAmount == null) {
    throw new Error("Enter a valid amount.");
  }

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { name: true },
  });

  let verifiedTax: TaxInvoiceExtractStored | undefined;
  if (taxFile) {
    const verification = await verifyPurchaseTaxInvoice({
      taxInvoiceDocument: taxFile,
      invoiceAmount,
      supplierName,
      companyName: company?.name ?? null,
      companyNpwp: resolveCompanyNpwpFromEnv(),
      findTaxInvoiceConflict: findPurchaseTaxInvoiceConflict,
    });
    if (!verification.ok) {
      await rejectPurchaseTaxVerify(verification);
    }
    verifiedTax = verification.tax;
  }

  const filePath = await saveUpload(file, "uploads/purchase-invoices", {
    fileBaseName: buildBillingDocumentFileBase({
      prefix: "Purchase-Invoice",
      clientName: supplierName,
      invoiceNumber: invoiceRef,
    }),
  });

  let taxInvoiceFilePath: string | null = null;
  if (taxFile) {
    try {
      taxInvoiceFilePath = await savePurchaseTaxInvoiceFile(
        taxFile,
        supplierName,
        invoiceRef
      );
    } catch (error) {
      await deleteLocalUpload(filePath);
      throw error;
    }
  }

  try {
    await prisma.purchaseInvoice.create({
      data: {
        companyId: session.user.companyId,
        supplierName,
        vendorId,
        invoiceRef,
        invoiceDate,
        amount,
        filePath,
        taxInvoiceFilePath,
        taxInvoiceUploadedAt: taxInvoiceFilePath ? new Date() : null,
        ...taxInvoicePersistFields(verifiedTax),
        notes: notesRaw || null,
        includesPpn,
        createdById: session.user.id,
      },
    });
  } catch (error) {
    await deleteLocalUpload(filePath);
    if (taxInvoiceFilePath) {
      await deleteLocalUpload(taxInvoiceFilePath);
    }
    throw error;
  }

  revalidatePath("/billing/purchase-invoices");
  revalidatePath("/billing/tax-invoices");
}

export async function uploadPurchaseTaxInvoice(formData: FormData) {
  const session = await requirePurchaseManageAccess();

  const purchaseInvoiceId = String(formData.get("purchaseInvoiceId") ?? "").trim();
  if (!purchaseInvoiceId) {
    throw new Error("Purchase invoice is required.");
  }

  const portalVendorId = session.user.vendorId ?? null;
  const invoice = await prisma.purchaseInvoice.findFirst({
    where: {
      id: purchaseInvoiceId,
      companyId: session.user.companyId,
      ...(portalVendorId ? { vendorId: portalVendorId } : {}),
    },
    select: {
      id: true,
      supplierName: true,
      invoiceRef: true,
      amount: true,
      taxInvoiceFilePath: true,
      company: { select: { name: true } },
    },
  });

  if (!invoice) {
    throw new Error("Purchase invoice not found.");
  }

  const taxFile = requireImageOrPdfUpload(formData.get("taxInvoiceDocument"), {
    requiredMessage: "Upload the tax invoice document.",
    sizeMessage: "File must be 10 MB or smaller.",
    typeMessage: "Upload an image or PDF.",
  });

  const invoiceAmount = decimalToNumber(invoice.amount);
  if (invoiceAmount == null) {
    throw new Error("This purchase has no amount on file.");
  }

  const verification = await verifyPurchaseTaxInvoice({
    taxInvoiceDocument: taxFile,
    invoiceAmount,
    supplierName: invoice.supplierName,
    companyName: invoice.company?.name ?? null,
    companyNpwp: resolveCompanyNpwpFromEnv(),
    excludePurchaseInvoiceId: invoice.id,
    findTaxInvoiceConflict: findPurchaseTaxInvoiceConflict,
  });

  if (!verification.ok) {
    await rejectPurchaseTaxVerify(verification);
  }

  const taxInvoiceFilePath = await savePurchaseTaxInvoiceFile(
    taxFile,
    invoice.supplierName,
    invoice.invoiceRef
  );

  try {
    await prisma.purchaseInvoice.update({
      where: { id: invoice.id },
      data: {
        taxInvoiceFilePath,
        taxInvoiceUploadedAt: new Date(),
        ...taxInvoicePersistFields(verification.tax),
      },
    });
  } catch (error) {
    await deleteLocalUpload(taxInvoiceFilePath);
    throw error;
  }

  if (
    invoice.taxInvoiceFilePath &&
    invoice.taxInvoiceFilePath !== taxInvoiceFilePath
  ) {
    await deleteLocalUpload(invoice.taxInvoiceFilePath);
  }

  revalidatePath("/billing/purchase-invoices");
  revalidatePath("/billing/tax-invoices");
}
