"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { taxInvoiceDateToUtcDate } from "@/lib/payment-document-verify";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { mintEquipmentAssets } from "@/lib/equipment-asset";
import { lockInventoryItemRow } from "@/lib/inventory-access";
import { nextWeightedAvgUnitCost, toDecimal, inventoryQtyFromDecimal, isWholeInventoryQty, normalizeInventoryQty } from "@/lib/inventory";
import { extractPurchaseInvoiceFields } from "@/lib/purchase-invoice-extract";
import type { ExtractPurchaseInvoiceResult } from "@/lib/purchase-invoice-extract-client";
import { parseManualVerifyReason } from "@/lib/in-house-document-verify";
import {
  assertPurchasePurposeProject,
  parsePurchasePurpose,
  purchaseCreatesStock,
} from "@/lib/purchase-purpose";
import { requireSession, toPermissionUser } from "@/lib/session";
import { nextPettyCashTopUpRef } from "@/lib/petty-cash";
import {
  exclusiveUnitCostFromInclusive,
  parsePpnRatePercent,
  ppnRateFromPercent,
} from "@/lib/vat";

type PurchaseLineInput = {
  itemId: string;
  quantity: number;
  unitPrice: number;
};

function parsePurchaseLinesJson(raw: string): PurchaseLineInput[] {
  if (!raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid purchase lines.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid purchase lines.");
  }
  return parsed.map((row, index) => {
    const itemId = String((row as { itemId?: unknown })?.itemId ?? "").trim();
    const quantity = Number((row as { quantity?: unknown })?.quantity);
    const unitPrice = Number((row as { unitPrice?: unknown })?.unitPrice);
    if (!itemId) {
      throw new Error(`Select an item for line ${index + 1}.`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Enter a valid quantity for line ${index + 1}.`);
    }
    if (!isWholeInventoryQty(quantity)) {
      throw new Error(`Quantity for line ${index + 1} must be a whole number.`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Enter a valid unit cost for line ${index + 1}.`);
    }
    return { itemId, quantity, unitPrice };
  });
}
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
  if (!canAccess(user, "projects") && !canAccess(user, "purchaseInvoices")) {
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

  const purchaseCategoryRawEarly = String(formData.get("purchaseCategory") ?? "")
    .trim()
    .toUpperCase();
  if (purchaseCategoryRawEarly === "PETTY_CASH") {
    if (session.user.vendorId) {
      throw new Error("Petty Cash top-ups are recorded by Head Office only.");
    }
    const amount = parseAmount(String(formData.get("amount") ?? "").trim());
    const invoiceAmount = decimalToNumber(amount);
    if (invoiceAmount == null || invoiceAmount <= 0) {
      throw new Error("Enter a valid amount.");
    }
    const invoiceDateRaw = String(formData.get("invoiceDate") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDateRaw)) {
      throw new Error("Date is required.");
    }
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const invoiceDate = taxInvoiceDateToUtcDate(invoiceDateRaw);
    const invoiceRef = nextPettyCashTopUpRef();
    const file = optionalImageOrPdfUpload(formData.get("document"), {
      sizeMessage: "File must be 10 MB or smaller.",
      typeMessage: "Upload an image or PDF.",
    });
    const filePath = file
      ? await saveUpload(file, "uploads/purchase-invoices", {
          fileBaseName: buildBillingDocumentFileBase({
            prefix: "Petty-Cash-Top-Up",
            clientName: "Petty Cash",
            invoiceNumber: invoiceRef,
          }),
        })
      : "";

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.create({
        data: {
          companyId: session.user.companyId,
          supplierName: "Petty Cash",
          vendorId: null,
          invoiceRef,
          invoiceDate,
          amount,
          filePath,
          notes: notesRaw || "Petty Cash top-up",
          includesPpn: false,
          purchaseCategory: "PETTY_CASH",
          purpose: "PETTY_CASH",
          paidAt: new Date(),
          createdById: session.user.id,
        },
      });
      await tx.pettyCashEntry.create({
        data: {
          companyId: session.user.companyId,
          kind: "TOP_UP",
          status: "POSTED",
          amount,
          entryDate: invoiceDate,
          description: notesRaw || `Petty Cash top-up ${invoiceRef}`,
          purchaseInvoiceId: invoice.id,
          createdById: session.user.id,
          postedAt: new Date(),
          proofPath: filePath || null,
        },
      });
    });

    revalidatePath("/billing/purchase-invoices");
    revalidatePath("/billing/petty-cash");
    revalidatePath("/billing/financial-report");
    return;
  }

  let supplierName = String(formData.get("supplierName") ?? "").trim();
  const vendorIdRaw = String(formData.get("vendorId") ?? "").trim();
  const invoiceRef = String(formData.get("invoiceRef") ?? "").trim();
  const invoiceDateRaw = String(formData.get("invoiceDate") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const linesRaw = String(formData.get("linesJson") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const includesPpn =
    formData.get("includesPpn") === "on" ||
    formData.get("includesPpn") === "true";
  const purchaseCategoryRaw = String(formData.get("purchaseCategory") ?? "")
    .trim()
    .toUpperCase();
  const purchaseCategory =
    purchaseCategoryRaw === "SERVICE" ? "SERVICE" : "PRODUCT";
  const purpose = parsePurchasePurpose(formData.get("purchasePurpose"));
  const projectIdRaw = String(formData.get("projectId") ?? "").trim();
  const ppnRateRaw = String(formData.get("ppnRatePercent") ?? "").trim();

  const portalVendorId = session.user.vendorId ?? null;
  const lines = parsePurchaseLinesJson(linesRaw);
  // HO purchases must specify catalog lines; vendor portal may still send header-only.
  if (!portalVendorId && lines.length === 0) {
    throw new Error("Add at least one purchased item.");
  }
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
  } else {
    if (!vendorIdRaw) {
      throw new Error("Select a registered vendor.");
    }
    const vendor = await prisma.vendor.findFirst({
      where: {
        id: vendorIdRaw,
        companyId: session.user.companyId,
        active: true,
      },
      select: { id: true, name: true },
    });
    if (!vendor) {
      throw new Error("Select a registered vendor.");
    }
    vendorId = vendor.id;
    supplierName = vendor.name;
  }

  if (!vendorId || !supplierName) {
    throw new Error("Select a registered vendor.");
  }
  if (!invoiceRef) {
    throw new Error("Invoice Number / Ref is required.");
  }

  let projectId: string | null = null;
  if (purpose === "PROJECT") {
    if (!projectIdRaw) {
      throw new Error("Select the project this purchase is for.");
    }
    const taggedProject = await prisma.project.findFirst({
      where: {
        id: projectIdRaw,
        companyId: session.user.companyId,
        status: { not: "CANCELLED" },
      },
      select: { id: true },
    });
    if (!taggedProject) {
      throw new Error("Select a valid project.");
    }
    projectId = taggedProject.id;
  }
  assertPurchasePurposeProject({ purpose, projectId });
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

  const invoiceDate = taxInvoiceDateToUtcDate(invoiceDateRaw);

  let lineTotal = 0;
  if (lines.length > 0) {
    const itemIds = [...new Set(lines.map((line) => line.itemId))];
    const catalog = await prisma.inventoryItem.findMany({
      where: {
        companyId: session.user.companyId,
        id: { in: itemIds },
        active: true,
        deletedAt: null,
      },
      select: { id: true, tracksStock: true },
    });
    if (catalog.length !== itemIds.length) {
      throw new Error("One or more items are missing from the catalog.");
    }
    lineTotal = lines.reduce(
      (sum, line) => sum + line.quantity * line.unitPrice,
      0
    );
    if (lineTotal < 0 || !Number.isFinite(lineTotal)) {
      throw new Error("Enter a valid amount.");
    }
  }

  const amount =
    lines.length > 0
      ? new Prisma.Decimal(Math.round(lineTotal * 100) / 100)
      : parseAmount(amountRaw);
  const invoiceAmount = decimalToNumber(amount);
  if (invoiceAmount == null) {
    throw new Error("Enter a valid amount.");
  }

  let ppnRatePercent: number | null = null;
  if (includesPpn) {
    ppnRatePercent = parsePpnRatePercent(ppnRateRaw);
    if (ppnRatePercent == null) {
      throw new Error("Enter the tax rate percent for this purchase.");
    }
  }

  const taxInvoiceManualReason = taxFile
    ? parseManualVerifyReason(formData.get("manualReason"))
    : null;

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
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.create({
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
          taxInvoiceManualReason,
          notes: notesRaw || null,
          includesPpn,
          purchaseCategory,
          ppnRatePercent,
          purpose,
          projectId,
          createdById: session.user.id,
        },
      });

      // Commercial invoice lines stay tax-inclusive when PPN applies.
      // Stock valuation / EquipmentAsset.unitCost always use ex-tax (DPP) unit cost.
      const ppnRate =
        includesPpn && ppnRatePercent != null
          ? ppnRateFromPercent(ppnRatePercent)
          : 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const totalPrice = line.quantity * line.unitPrice;
        const costUnitPrice =
          ppnRate > 0
            ? exclusiveUnitCostFromInclusive(line.unitPrice, ppnRate)
            : line.unitPrice;
        const costTotalPrice = line.quantity * costUnitPrice;
        const item = await tx.inventoryItem.findFirst({
          where: {
            id: line.itemId,
            companyId: session.user.companyId,
            active: true,
            deletedAt: null,
          },
          select: { id: true, tracksStock: true, itemType: true },
        });
        if (!item) {
          throw new Error("One or more items are missing from the catalog.");
        }

        const createdLine = await tx.purchaseInvoiceLine.create({
          data: {
            purchaseInvoiceId: invoice.id,
            itemId: item.id,
            quantity: toDecimal(line.quantity),
            unitPrice: toDecimal(line.unitPrice),
            totalPrice: toDecimal(totalPrice),
            sortOrder: i,
          },
        });

        if (!item.tracksStock || !purchaseCreatesStock(purpose)) continue;

        const locked = await lockInventoryItemRow(tx, item.id);
        if (!locked || !locked.active) {
          throw new Error("One or more items are missing from the catalog.");
        }
        const currentStock = inventoryQtyFromDecimal(locked.currentStock);
        const avgUnitCost = decimalToNumber(locked.avgUnitCost);
        const newAvg = nextWeightedAvgUnitCost({
          currentStock,
          avgUnitCost,
          purchaseQty: line.quantity,
          purchaseUnitPrice: costUnitPrice,
        });
        const newStock = normalizeInventoryQty(currentStock + line.quantity);

        const movement = await tx.inventoryMovement.create({
          data: {
            companyId: session.user.companyId,
            itemId: item.id,
            type: "PURCHASE",
            quantity: toDecimal(line.quantity),
            unitCost: toDecimal(costUnitPrice),
            totalCost: toDecimal(costTotalPrice),
            movedAt: invoiceDate,
            notes: notesRaw || null,
            createdById: session.user.id,
          },
        });

        await tx.inventoryPurchase.create({
          data: {
            companyId: session.user.companyId,
            itemId: item.id,
            vendorId: vendorId!,
            purchasedAt: invoiceDate,
            quantity: toDecimal(line.quantity),
            unitPrice: toDecimal(costUnitPrice),
            totalPrice: toDecimal(costTotalPrice),
            invoiceNo: invoiceRef,
            receiptUrl: filePath,
            notes: notesRaw || null,
            movementId: movement.id,
            purchaseInvoiceLineId: createdLine.id,
            createdById: session.user.id,
          },
        });

        await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            currentStock: toDecimal(newStock),
            lastUnitCost: toDecimal(costUnitPrice),
            avgUnitCost: toDecimal(newAvg),
          },
        });

        await mintEquipmentAssets(
          tx,
          session.user.companyId,
          item.id,
          line.quantity,
          { unitCost: costUnitPrice }
        );
      }
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
  revalidatePath("/billing/vat");
  revalidatePath("/inventory");
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

  const reason = parseManualVerifyReason(formData.get("manualReason"));

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
        taxInvoiceManualReason: reason,
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

/**
 * HO Finance: mark a purchase (AP) as paid after uploading proof of payment.
 * Closes the payable — Settlements / Payment views treat paidAt as settled.
 */
export async function markPurchaseInvoicePaid(formData: FormData) {
  const session = await requirePurchaseManageAccess();
  const locale = await getServerLocale();

  const purchaseInvoiceId = String(
    formData.get("purchaseInvoiceId") ?? ""
  ).trim();
  if (!purchaseInvoiceId) {
    throw new Error(
      translate(locale, "pages.billing.purchaseMarkPaidInvoiceRequired")
    );
  }

  const proof = requireImageOrPdfUpload(formData.get("paymentProof"), {
    requiredMessage: translate(locale, "pages.billing.choosePaymentProof"),
    sizeMessage: "Payment proof must be 10 MB or smaller.",
    typeMessage: translate(locale, "pages.billing.paymentProofImageOrPdf"),
  });

  const invoice = await prisma.purchaseInvoice.findFirst({
    where: {
      id: purchaseInvoiceId,
      companyId: session.user.companyId,
    },
    select: {
      id: true,
      supplierName: true,
      invoiceRef: true,
      paidAt: true,
      paymentProofPath: true,
    },
  });

  if (!invoice) {
    throw new Error(
      translate(locale, "pages.billing.purchaseMarkPaidNotFound")
    );
  }
  if (invoice.paidAt) {
    throw new Error(
      translate(locale, "pages.billing.purchaseMarkPaidAlreadyPaid")
    );
  }

  const paidAt = new Date();
  const paymentProofPath = await saveUpload(
    proof,
    "uploads/purchase-payment-proofs",
    {
      fileBaseName: buildBillingDocumentFileBase({
        prefix: "Proof-of-Payment",
        clientName: invoice.supplierName,
        invoiceNumber: invoice.invoiceRef,
        date: paidAt,
      }),
    }
  );

  try {
    await prisma.purchaseInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAt,
        paymentProofPath,
        paidById: session.user.id,
        paymentManualReason: parseManualVerifyReason(
          formData.get("manualReason")
        ),
      },
    });
  } catch (error) {
    await deleteLocalUpload(paymentProofPath);
    throw error;
  }

  if (
    invoice.paymentProofPath &&
    invoice.paymentProofPath !== paymentProofPath
  ) {
    await deleteLocalUpload(invoice.paymentProofPath);
  }

  revalidatePath("/billing/purchase-invoices");
  revalidatePath("/billing/settlements");
  revalidatePath("/vendors");

  return { id: invoice.id, paidAt };
}
