/**
 * One-off sample invoice PDF for visual QA of the commercial template.
 * Usage: npx tsx scripts/generate-sample-invoice-pdf.ts
 */
import { generateInvoicePeriodPdf } from "../lib/progress-report-pdf";

async function main() {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15));
  const dueAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 29));

  const publicPath = await generateInvoicePeriodPdf({
    projectName: "Menara BCA Glass Facade Wash",
    clientName: "PT Blueit Nusantara",
    clientAddress: "Jl. M.H. Thamrin No.1, Menteng, Jakarta Pusat 10310",
    clientEmail: "billing@blueit.example",
    clientPhone: "+62 21 5555 0101",
    clientNpwp: "10.0.0.1-012.000",
    location: "Menara BCA, Jakarta Pusat",
    periodLabel: "Milestone 30%",
    periodStart,
    periodEnd,
    reports: [
      {
        reportDate: periodEnd,
        stageLabel: "Facade wash — upper levels",
        notes: "Completed scheduled glass facade wash for levels 12–18. Weather clear; no safety incidents.",
        createdAt: periodEnd,
        employee: {
          firstName: "Andi",
          lastName: "Pratama",
          employeeNo: "FC-0012",
        },
        photos: [],
      },
    ],
    amountLabel: "Rp 45.000.000",
    milestonePercent: 30,
    dueAt,
    invoiceNumber: "INV-M30-SAMPLE1",
    company: {
      name: "Relasi Global Solusi",
      email: "contact@rgs.co.id",
      phone: "+62 21 2295 2228",
      address:
        "Jl. Daan Mogot KM 14.5 Ruko Point 8, Blok F6\nRT 002 | RW 014, Jakarta Barat 11750",
    },
    title: "Payment Milestone Invoice",
  });

  console.log("Sample invoice PDF written to:");
  console.log(`  public${publicPath}`);
  console.log(`  Open: ${publicPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
