/**
 * Demo: one overseas equipment import so Expenses + Inventory show a real row.
 *
 * Usage: npx tsx prisma/seed-demo-import-equipment.ts
 *
 * Idempotent by invoice ref DEMO-IMPORT-EQP-001.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { mintEquipmentAssets } from "../lib/equipment-asset";
import {
  allocateImportStockCost,
  calculateImportLandedCost,
} from "../lib/import-landed-cost";
import {
  inventoryQtyFromDecimal,
  nextWeightedAvgUnitCost,
  toDecimal,
} from "../lib/inventory";
import { getNextInventorySku } from "../lib/inventory-sku";
import { getNextVendorShortCode } from "../lib/vendor-short-code";

const DEMO_INVOICE_REF = "DEMO-IMPORT-EQP-001";
const DEMO_VENDOR_NAME = "Ningbo CleanTech Co., Ltd.";
const DEMO_ITEM_NAME = "Demo Industrial Floor Scrubber";
const DEMO_QTY = 1;
const DEMO_FOREIGN_AMOUNT = 1200;
const DEMO_RATE = 16200;

const DEMO_PDF = `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>endobj
4 0 obj<< /Length 68 >>stream
BT /F1 12 Tf 72 720 Td (Demo factory invoice — overseas equipment) Tj ET
endstream
endobj
trailer<< /Root 1 0 R >>
%%EOF
`;

async function writeDemoPdf(fileName: string): Promise<string> {
  const dir = path.join(process.cwd(), "public", "uploads", "purchase-invoices");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), DEMO_PDF, "utf8");
  return `/uploads/purchase-invoices/${fileName}`;
}

export async function seedDemoImportEquipment(db?: PrismaClient) {
  const ownsClient = !db;
  const prisma = db ?? new PrismaClient();
  try {
    const company =
      (await prisma.company.findUnique({ where: { id: "rgs-company" } })) ??
      (await prisma.company.findFirst({ orderBy: { createdAt: "asc" } }));
    if (!company) {
      throw new Error("No company found. Run npm run db:seed first.");
    }

    const existing = await prisma.purchaseInvoice.findFirst({
      where: { companyId: company.id, invoiceRef: DEMO_INVOICE_REF },
      select: { id: true, reversedAt: true },
    });
    if (existing && !existing.reversedAt) {
      console.log(
        `Demo import ${DEMO_INVOICE_REF} already exists. Open Expenses and Inventory.`
      );
      return;
    }

    const createdBy =
      (await prisma.user.findFirst({
        where: { companyId: company.id, username: "vicko" },
        select: { id: true },
      })) ??
      (await prisma.user.findFirst({
        where: { companyId: company.id },
        select: { id: true },
      }));

    const vendor =
      (await prisma.vendor.findFirst({
        where: { companyId: company.id, name: DEMO_VENDOR_NAME },
      })) ??
      (await prisma.vendor.create({
        data: {
          companyId: company.id,
          name: DEMO_VENDOR_NAME,
          shortCode: await getNextVendorShortCode(company.id, prisma),
          vendorType: "OVERSEAS",
          email: "export@ningbocleantech.example",
          phone: "+86 574 0000 0000",
          address: "Beilun District, Ningbo, Zhejiang, China",
          contactPersonFirstName: "Wei",
          contactPersonLastName: "Chen",
          contactPersonPosition: "Export Manager",
          vendorSince: new Date(Date.UTC(2024, 0, 8)),
          active: true,
        },
      }));

    let item = await prisma.inventoryItem.findFirst({
      where: { companyId: company.id, name: DEMO_ITEM_NAME, deletedAt: null },
    });
    if (!item) {
      item = await prisma.inventoryItem.create({
        data: {
          companyId: company.id,
          sku: await getNextInventorySku(company.id, "Equipment", prisma),
          name: DEMO_ITEM_NAME,
          itemType: "Equipment",
          unit: "pcs",
          tracksStock: true,
          active: true,
        },
      });
    }

    const importInput = {
      foreignAmount: DEMO_FOREIGN_AMOUNT,
      exchangeRateToIdr: DEMO_RATE,
      customsRateToIdr: DEMO_RATE,
      freightIdr: 2_500_000,
      insuranceIdr: 400_000,
      bankFeeIdr: 150_000,
      clearanceCostIdr: 0,
      formEApplied: false,
      beaMasukApplied: true,
      beaMasukRatePercent: 5,
      ppnbmApplied: false,
      ppnApplied: true,
      pph22Applied: true,
      pph22Basis: "API" as const,
    };
    const landed = calculateImportLandedCost(importInput);
    const [allocated] = allocateImportStockCost({
      stockLandedCostIdr: landed.stockLandedCostIdr,
      headerForeignAmount: DEMO_FOREIGN_AMOUNT,
      lines: [{ quantity: DEMO_QTY, foreignAmount: DEMO_FOREIGN_AMOUNT }],
    });
    if (!allocated) {
      throw new Error("Could not allocate import stock cost.");
    }

    const invoiceDate = new Date();
    invoiceDate.setUTCHours(0, 0, 0, 0);
    const factoryFilePath = await writeDemoPdf(
      "demo-ningbo-factory-invoice.pdf"
    );
    const dutiesFilePath = await writeDemoPdf("demo-ningbo-import-duties.pdf");

    const invoiceRef = existing
      ? `${DEMO_INVOICE_REF}-R`
      : DEMO_INVOICE_REF;

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.create({
        data: {
          companyId: company.id,
          supplierName: vendor.name,
          vendorId: vendor.id,
          invoiceRef,
          invoiceDate,
          amount: toDecimal(landed.invoiceAmountIdr),
          filePath: factoryFilePath,
          notes:
            "Demo: one floor scrubber imported from an Overseas vendor. Handled By Head Office.",
          includesPpn: landed.ppnApplied,
          purchaseCategory: "PRODUCT",
          purpose: "STOCK",
          paymentTermsDays: 0,
          paidAt: new Date(),
          paidById: createdBy?.id ?? null,
          origin: "IMPORT",
          invoiceCurrency: "USD",
          invoiceForeignAmount: toDecimal(DEMO_FOREIGN_AMOUNT),
          exchangeRateToIdr: toDecimal(DEMO_RATE),
          customsRateToIdr: toDecimal(DEMO_RATE),
          invoiceAmountIdr: toDecimal(landed.invoiceAmountIdr),
          freightIdr: toDecimal(landed.freightIdr),
          insuranceIdr: toDecimal(landed.insuranceIdr),
          bankFeeIdr: toDecimal(landed.bankFeeIdr),
          clearanceCostIdr: toDecimal(0),
          formEApplied: landed.formEApplied,
          beaMasukApplied: landed.beaMasukApplied,
          beaMasukRatePercent: toDecimal(landed.beaMasukRatePercent),
          beaMasukAmountIdr: toDecimal(landed.beaMasukAmountIdr),
          ppnbmApplied: false,
          importPpnAmountIdr: toDecimal(landed.ppnAmountIdr),
          pph22Applied: landed.pph22Applied,
          pph22Basis: landed.pph22Basis,
          pph22RatePercent: toDecimal(landed.pph22RatePercent),
          pph22AmountIdr: toDecimal(landed.pph22AmountIdr),
          customsValueIdr: toDecimal(landed.customsValueIdr),
          importValueIdr: toDecimal(landed.importValueIdr),
          stockLandedCostIdr: toDecimal(landed.stockLandedCostIdr),
          importFulfillment: "INTERNAL",
          importPaidItems: "BOTH",
          importDutiesBillingId: "DEMO-BILLING-001",
          importDutiesFilePath: dutiesFilePath,
          importDutiesPaidAt: new Date(),
          importDutiesPaidById: createdBy?.id ?? null,
          createdById: createdBy?.id ?? null,
        },
      });

      const line = await tx.purchaseInvoiceLine.create({
        data: {
          purchaseInvoiceId: invoice.id,
          itemId: item.id,
          unit: "pcs",
          quantity: toDecimal(DEMO_QTY),
          unitPrice: toDecimal(allocated.unitCostIdr),
          totalPrice: toDecimal(allocated.totalCostIdr),
          sortOrder: 0,
        },
      });

      const currentStock = inventoryQtyFromDecimal(item.currentStock);
      const avgUnitCost = Number(item.avgUnitCost ?? 0) || null;
      const newAvg = nextWeightedAvgUnitCost({
        currentStock,
        avgUnitCost,
        purchaseQty: DEMO_QTY,
        purchaseUnitPrice: allocated.unitCostIdr,
      });
      const newStock = currentStock + DEMO_QTY;

      const movement = await tx.inventoryMovement.create({
        data: {
          companyId: company.id,
          itemId: item.id,
          type: "PURCHASE",
          quantity: toDecimal(DEMO_QTY),
          unitCost: toDecimal(allocated.unitCostIdr),
          totalCost: toDecimal(allocated.totalCostIdr),
          movedAt: invoiceDate,
          notes: "Demo overseas equipment import",
          createdById: createdBy?.id ?? null,
        },
      });

      await tx.inventoryPurchase.create({
        data: {
          companyId: company.id,
          itemId: item.id,
          vendorId: vendor.id,
          purchasedAt: invoiceDate,
          quantity: toDecimal(DEMO_QTY),
          unitPrice: toDecimal(allocated.unitCostIdr),
          totalPrice: toDecimal(allocated.totalCostIdr),
          invoiceNo: invoiceRef,
          receiptUrl: factoryFilePath,
          notes: "Demo overseas equipment import",
          movementId: movement.id,
          purchaseInvoiceLineId: line.id,
          createdById: createdBy?.id ?? null,
        },
      });

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          currentStock: toDecimal(newStock),
          lastUnitCost: toDecimal(allocated.unitCostIdr),
          avgUnitCost: toDecimal(newAvg),
        },
      });

      await mintEquipmentAssets(tx, company.id, item.id, DEMO_QTY, {
        unitCost: allocated.unitCostIdr,
      });
    });

    console.log(`Created demo import ${invoiceRef}.`);
    console.log(`  Vendor: ${vendor.name} (Overseas)`);
    console.log(`  Item: ${item.name} (${item.sku})`);
    console.log(`  Factory invoice: USD ${DEMO_FOREIGN_AMOUNT} @ ${DEMO_RATE}`);
    console.log("Open Expenses and Inventory, then hard-refresh.");
  } finally {
    if (ownsClient) {
      await prisma.$disconnect();
    }
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").endsWith("prisma/seed-demo-import-equipment.ts");

if (isDirectRun) {
  seedDemoImportEquipment().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
