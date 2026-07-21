/**
 * Sample purchase invoices for the demo company (rgs-company / admin's company).
 *
 * Usage: npx tsx prisma/seed-purchase-invoices.ts
 *
 * Idempotent by invoiceRef — skips refs that already exist for the company.
 * Does not delete existing data.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { buildBillingDocumentFileBase } from "../lib/upload";

const prisma = new PrismaClient();

/** Minimal valid PDF so "View" does not 404. */
const PLACEHOLDER_PDF = Buffer.from(
  `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 44 >>stream
BT /F1 12 Tf 40 80 Td (Sample purchase invoice) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000361 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
440
%%EOF
`
);

type SampleInvoice = {
  supplierName: string;
  invoiceRef: string;
  invoiceDate: Date;
  amount: string;
  includesPpn: boolean;
  notes: string | null;
};

const SAMPLES: SampleInvoice[] = [
  {
    supplierName: "PT Sumber Alat Kebersihan",
    invoiceRef: "SAK-2026-0412",
    invoiceDate: new Date(Date.UTC(2026, 5, 12)),
    amount: "4850000.00",
    includesPpn: true,
    notes: "Bulk mop heads and microfiber cloths for Q3 stock.",
  },
  {
    supplierName: "CV Mandiri Chemical",
    invoiceRef: "MC-INV-7781",
    invoiceDate: new Date(Date.UTC(2026, 6, 3)),
    amount: "12750000.00",
    includesPpn: true,
    notes: "Floor cleaner concentrate + disinfectant (20L drums).",
  },
  {
    supplierName: "Toko Plastik Jaya",
    invoiceRef: "TPJ/06/2901",
    invoiceDate: new Date(Date.UTC(2026, 5, 28)),
    amount: "890000.00",
    includesPpn: false,
    notes: null,
  },
  {
    supplierName: "PT Indo Uniform Supply",
    invoiceRef: "IUS-202607-015",
    invoiceDate: new Date(Date.UTC(2026, 6, 8)),
    amount: "6420000.00",
    includesPpn: true,
    notes: "Staff uniforms — size mix for new site crew.",
  },
  {
    supplierName: "UD Berkah Sparepart",
    invoiceRef: "BS-4509",
    invoiceDate: new Date(Date.UTC(2026, 4, 20)),
    amount: "2150000.00",
    includesPpn: false,
    notes: "Vacuum motor replacements (2 units).",
  },
  {
    supplierName: "PT Graha Office Mart",
    invoiceRef: "GOM-PI-2026-883",
    invoiceDate: new Date(Date.UTC(2026, 6, 15)),
    amount: "1575000.00",
    includesPpn: true,
    notes: "Trash bags, gloves, and restroom consumables.",
  },
];

async function ensurePlaceholderPdf(
  supplierName: string,
  invoiceRef: string
): Promise<string> {
  const folder = "uploads/purchase-invoices";
  const uploadDir = path.join(process.cwd(), "public", folder);
  await mkdir(uploadDir, { recursive: true });

  const base = buildBillingDocumentFileBase({
    prefix: "Purchase-Invoice",
    clientName: supplierName,
    invoiceNumber: invoiceRef,
  });
  const filename = `${base}.pdf`;
  const fullPath = path.join(uploadDir, filename);
  await writeFile(fullPath, PLACEHOLDER_PDF);
  return `/${folder}/${filename}`;
}

async function main() {
  console.log("Seeding sample purchase invoices…");

  const company =
    (await prisma.company.findUnique({ where: { id: "rgs-company" } })) ??
    (await prisma.company.findFirst({ orderBy: { createdAt: "asc" } }));

  if (!company) {
    throw new Error("No company found. Run npm run db:seed first.");
  }

  const admin = await prisma.user.findFirst({
    where: {
      companyId: company.id,
      OR: [{ username: "vicko" }, { email: "vicko@rgs.co.id" }],
    },
    select: { id: true, name: true },
  });

  // Always ensure placeholder PDFs exist (even if DB rows were seeded earlier).
  for (const sample of SAMPLES) {
    await ensurePlaceholderPdf(sample.supplierName, sample.invoiceRef);
  }

  const existing = await prisma.purchaseInvoice.findMany({
    where: {
      companyId: company.id,
      invoiceRef: { in: SAMPLES.map((s) => s.invoiceRef) },
    },
    select: { invoiceRef: true },
  });
  const existingRefs = new Set(existing.map((row) => row.invoiceRef));

  const toCreate = SAMPLES.filter((s) => !existingRefs.has(s.invoiceRef));

  if (toCreate.length === 0) {
    console.log(
      `All ${SAMPLES.length} sample invoice refs already exist for ${company.name} (${company.id}). Placeholder PDFs refreshed.`
    );
    console.log("Refresh /billing/purchase-invoices (hard refresh if needed).");
    return;
  }

  const rows: Prisma.PurchaseInvoiceCreateManyInput[] = [];

  for (const sample of toCreate) {
    const filePath = await ensurePlaceholderPdf(
      sample.supplierName,
      sample.invoiceRef
    );
    rows.push({
      companyId: company.id,
      supplierName: sample.supplierName,
      invoiceRef: sample.invoiceRef,
      invoiceDate: sample.invoiceDate,
      amount: new Prisma.Decimal(sample.amount),
      filePath,
      notes: sample.notes,
      includesPpn: sample.includesPpn,
      createdById: admin?.id ?? null,
    });
  }

  const result = await prisma.purchaseInvoice.createMany({ data: rows });

  console.log(
    `Created ${result.count} purchase invoice(s) for ${company.name} (${company.id}).`
  );
  for (const sample of toCreate) {
    console.log(
      `  • ${sample.supplierName} — ${sample.invoiceRef} — ${sample.amount} (PPN: ${sample.includesPpn ? "yes" : "no"})`
    );
  }
  if (admin) {
    console.log(`Created by: ${admin.name}`);
  }
  console.log("");
  console.log("Refresh /billing/purchase-invoices (hard refresh if needed).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
