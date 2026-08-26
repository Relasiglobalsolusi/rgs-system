import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import PurchaseTaxDocumentsClient from "@/components/billing/PurchaseTaxDocumentsClient";
import AppShell from "@/components/layout/AppShell";
import BackLink from "@/components/ui/BackLink";
import { PageDocumentActions } from "@/components/ui/PageDocumentActions";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDisplayDate } from "@/lib/format-date";
import { commercialTaxIncludesIncomeTax } from "@/lib/commercial-tax";
import { governmentTaxKindLabelKey } from "@/lib/government-tax";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { purchaseImportInputVat } from "@/lib/import-landed-cost";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatContractPrice } from "@/lib/project-billing";
import { listPurchaseDocumentSlots } from "@/lib/purchase-invoice-documents";
import { canAccess } from "@/lib/permissions";
import { requireFinanceChild, toPermissionUser } from "@/lib/session";
import { formatTaxInvoiceSerial } from "@/lib/tax-invoice-serial";

const metaLabelClassName =
  "w-36 shrink-0 px-4 py-2.5 text-left align-top text-xs font-semibold uppercase tracking-[0.12em] text-subtle sm:w-52 sm:px-5";
const metaValueClassName = "px-4 py-2.5 align-top text-text sm:px-5";
const sectionTitleClassName = "text-base font-semibold tracking-tight text-text";

function money(value: number | null | undefined): string {
  return formatContractPrice(value ?? 0);
}

export default async function PurchaseTaxDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ purchaseId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await requireFinanceChild("taxInvoices");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const { purchaseId } = await params;
  const query = await searchParams;
  const backView =
    query.from === "income" || query.from === "other" || query.from === "output"
      ? query.from
      : "input";

  if (session.user.clientId || session.user.vendorId) {
    redirect("/billing");
  }

  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id: purchaseId, companyId: session.user.companyId },
    include: {
      vendor: { select: { name: true } },
      handlingVendor: { select: { name: true } },
    },
  });

  if (!invoice) {
    notFound();
  }

  const user = toPermissionUser(session);
  const canManage =
    canAccess(user, "taxInvoices") ||
    canAccess(user, "purchaseInvoices") ||
    canAccess(user, "projects");
  const showWithholdingSlip = commercialTaxIncludesIncomeTax(
    invoice.includedTaxKind
  );

  const storedRatePercent = decimalToNumber(invoice.ppnRatePercent);
  const goodsVat = purchaseImportInputVat({
    origin: invoice.origin,
    amount: decimalToNumber(invoice.amount) ?? 0,
    includesPpn: invoice.includesPpn,
    ppnRatePercent: storedRatePercent,
    importPpnAmountIdr: decimalToNumber(invoice.importPpnAmountIdr),
    importValueIdr: decimalToNumber(invoice.importValueIdr),
  });
  const pph22Idr = decimalToNumber(invoice.pph22AmountIdr) ?? 0;
  const handlingDpp = decimalToNumber(invoice.handlingFeeIdr) ?? 0;
  const handlingPaid =
    decimalToNumber(invoice.handlingFeeAmountPaidIdr) ?? handlingDpp;
  const handlingPpn = invoice.handlingFeeIncludesPpn
    ? Math.max(0, handlingPaid - handlingDpp)
    : 0;
  const governmentAmount = decimalToNumber(invoice.amount) ?? 0;
  const isGovernment = invoice.purchaseCategory === "GOVERNMENT";
  const isImport = invoice.origin === "IMPORT";

  const slots = listPurchaseDocumentSlots({
    origin: invoice.origin,
    purchaseCategory: invoice.purchaseCategory,
    filePath: invoice.filePath,
    taxInvoiceFilePath: invoice.taxInvoiceFilePath,
    importDutiesFilePath: invoice.importDutiesFilePath,
    handlingInvoicePath: invoice.handlingFeeTaxInvoicePath,
    paymentProofPath: invoice.paymentProofPath,
    withholdingSlipPath: invoice.withholdingSlipPath,
    includesPpn: invoice.includesPpn,
    handlingIncludesPpn: invoice.handlingFeeIncludesPpn,
    showWithholding: showWithholdingSlip,
    hasHandling: Boolean(
      invoice.handlingVendorId ||
        invoice.handlingFeeIdr ||
        invoice.handlingFeeTaxInvoicePath
    ),
    hasInvoice: invoice.hasInvoice,
    hasCustomsFees: invoice.hasCustomsFees,
  });
  const taxSlots = slots.filter((slot) => {
    if (slot.kind === "tax") {
      return invoice.includesPpn || Boolean(slot.href);
    }
    if (slot.kind === "handlingTax") {
      return invoice.handlingFeeIncludesPpn || Boolean(slot.href);
    }
    if (slot.kind === "withholding") {
      return showWithholdingSlip || Boolean(slot.href);
    }
    return ["duties", "government"].includes(slot.kind);
  });
  const uploadKinds = new Set(["tax", "withholding", "government", "duties"]);
  const files = (taxSlots.length > 0 ? taxSlots : slots.slice(0, 1)).map(
    (slot) => ({
      id: slot.kind,
      title:
        slot.kind === "government"
          ? t("pages.vat.supportingTaxDocument")
          : t(slot.titleKey),
      hint: slot.hintKey ? t(slot.hintKey) : undefined,
      href: slot.href,
      canUpload: canManage && !slot.href && uploadKinds.has(slot.kind),
    })
  );

  const kindLabel = isGovernment
    ? invoice.governmentTaxKind
      ? t(governmentTaxKindLabelKey(invoice.governmentTaxKind))
      : t("pages.billing.governmentChip")
    : isImport
      ? t("pages.vat.inputSourceImport")
      : invoice.purchaseCategory === "SERVICE"
        ? t("pages.vat.inputSourceService")
        : invoice.purchaseCategory === "VEHICLE"
          ? t("pages.vat.inputSourceVehicle")
          : t("pages.vat.inputSourceItems");

  const readyDocuments = files.flatMap((file) =>
    file.href
      ? [
          {
            href: file.href,
            label: file.title,
            icon: "download" as const,
          },
        ]
      : []
  );

  return (
    <AppShell
      title={t("pages.vat.taxDetail")}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BackLink href={`/billing/tax-invoices?view=${backView}`}>
          {t("pages.vat.backToTax")}
        </BackLink>
        <PageDocumentActions documents={readyDocuments} />
      </div>

      <div className="space-y-5">
        <SectionCard className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3.5 sm:px-5">
            <StatusBadge status="info">{kindLabel}</StatusBadge>
            {goodsVat.ppn > 0 || handlingPpn > 0 ? (
              <StatusBadge status="success">
                {t("pages.vat.tabs.input")}
              </StatusBadge>
            ) : null}
            {pph22Idr > 0 ||
            invoice.governmentTaxKind === "PPH_22" ||
            invoice.governmentTaxKind === "PPH_25" ||
            invoice.governmentTaxKind === "PPH_29" ? (
              <StatusBadge status="success">
                {t("pages.vat.tabs.income")}
              </StatusBadge>
            ) : null}
            {isGovernment &&
            invoice.governmentTaxKind &&
            invoice.governmentTaxKind !== "PPN" &&
            invoice.governmentTaxKind !== "PPH_22" &&
            invoice.governmentTaxKind !== "PPH_25" &&
            invoice.governmentTaxKind !== "PPH_29" ? (
              <StatusBadge status="success">
                {t("pages.vat.tabs.other")}
              </StatusBadge>
            ) : null}
          </div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.billing.purchaseSupplier")}
                </th>
                <td className={`${metaValueClassName} font-medium`}>
                  {invoice.vendor?.name ?? invoice.supplierName}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.billing.purchaseInvoiceRef")}
                </th>
                <td className={`${metaValueClassName} tabular-nums`}>
                  {invoice.invoiceRef}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.vat.columns.date")}
                </th>
                <td className={metaValueClassName}>
                  {formatDisplayDate(
                    invoice.taxInvoiceIssuedAt ?? invoice.invoiceDate
                  )}
                </td>
              </tr>
              {invoice.taxInvoiceSerial ||
              (invoice.includesPpn && !isGovernment) ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.vat.columns.taxInvoiceNumber")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {invoice.taxInvoiceSerial
                      ? formatTaxInvoiceSerial(invoice.taxInvoiceSerial)
                      : "—"}
                  </td>
                </tr>
              ) : null}
              {goodsVat.ppn > 0 ? (
                <>
                  <tr className="border-b border-border">
                    <th scope="row" className={metaLabelClassName}>
                      {isImport
                        ? t("pages.billing.purchaseImportPpnOnGoods")
                        : t("pages.billing.purchaseImportPpnOnItems")}
                    </th>
                    <td className={`${metaValueClassName} tabular-nums font-semibold`}>
                      {money(goodsVat.ppn)}
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <th scope="row" className={metaLabelClassName}>
                      {t("pages.vat.columns.dpp")}
                    </th>
                    <td className={`${metaValueClassName} tabular-nums`}>
                      {money(goodsVat.dpp)}
                    </td>
                  </tr>
                </>
              ) : null}
              {handlingPpn > 0 ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchaseImportPpnOnHandling")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums font-semibold`}>
                    {money(handlingPpn)}
                  </td>
                </tr>
              ) : null}
              {pph22Idr > 0 ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchaseImportPph22")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums font-semibold`}>
                    {money(pph22Idr)}
                  </td>
                </tr>
              ) : null}
              {isGovernment &&
              invoice.governmentTaxKind &&
              invoice.governmentTaxKind !== "PPN" ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t(governmentTaxKindLabelKey(invoice.governmentTaxKind))}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums font-semibold`}>
                    {money(governmentAmount)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard className="p-5 sm:p-6">
          <h3 className={sectionTitleClassName}>
            {t("pages.vat.taxDocuments")}
          </h3>
          <div className="mt-4">
            <PurchaseTaxDocumentsClient
              purchaseInvoiceId={invoice.id}
              supplierName={invoice.vendor?.name ?? invoice.supplierName}
              invoiceRef={invoice.invoiceRef}
              files={files}
              showWithholdingSlip={showWithholdingSlip}
            />
          </div>
          <p className="mt-4 text-sm">
            <Link
              href={`/billing/purchase-invoices/${invoice.id}`}
              className="font-medium text-primary hover:underline"
            >
              {t("pages.vat.relatedExpense")}
            </Link>
          </p>
        </SectionCard>
      </div>
    </AppShell>
  );
}
