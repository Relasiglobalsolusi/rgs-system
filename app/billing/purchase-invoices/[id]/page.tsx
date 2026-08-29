import Link from "next/link";
import { redirect } from "next/navigation";

import PurchaseInvoiceDetailClient from "@/components/billing/PurchaseInvoiceDetailClient";
import AppShell from "@/components/layout/AppShell";
import BackLink from "@/components/ui/BackLink";
import { PageDocumentActions } from "@/components/ui/PageDocumentActions";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDisplayDate } from "@/lib/format-date";
import {
  commercialTaxIncludesIncomeTax,
  commercialTaxKindLabelKey,
} from "@/lib/commercial-tax";
import { governmentTaxKindLabelKey } from "@/lib/government-tax";
import { localizeInventoryItemType } from "@/lib/i18n/labels";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import {
  getPurchasePaymentDisplay,
  isCashPaymentTerms,
  isPurchaseTaxIncomplete,
} from "@/lib/invoice-period";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  decimalToNumber,
  formatContractPrice,
} from "@/lib/project-billing";
import {
  formatPurchaseListedAmount,
  purchaseNeedsImportBankRate,
} from "@/lib/purchase-amount-display";
import { formatBankAccountOptionLabel } from "@/lib/company-bank-accounts";
import { formatVendorBankAccountLabel } from "@/lib/vendor-bank-accounts";
import { listPurchaseDocumentSlots } from "@/lib/purchase-invoice-documents";
import { formatTaxInvoiceSerial } from "@/lib/tax-invoice-serial";
import {
  getPurchaseRecordStatus,
  purchaseRecordStatusLabelKey,
} from "@/lib/purchase-record-status";
import { isPrepaidCardTopUpInvoice } from "@/lib/advance-cash-expense";
import {
  displayImportCifBreakdown,
  formatImportCifFormulaLabel,
  formatImportCifNowLabel,
  formatImportForeignAmount,
  impliedFactoryCustomsRateFromStoredCif,
  importWarehouseFactoryPortionIdr,
  parseCustomsRatesMap,
  summarizeImportCif,
  summarizeImportVendorRemittance,
} from "@/lib/import-landed-cost";
import ImportCifValueBlock from "@/components/billing/ImportCifValueBlock";
import { requireFinanceChild, toPermissionUser } from "@/lib/session";

const metaLabelClassName =
  "w-36 shrink-0 px-4 py-2.5 text-left align-top text-xs font-semibold uppercase tracking-[0.12em] text-subtle sm:w-52 sm:px-5";
const metaValueClassName =
  "min-w-0 break-words px-4 py-2.5 align-top text-text sm:px-5";
const sectionTitleClassName = "text-base font-semibold tracking-tight text-text";
const sectionCardClassName = "p-5 sm:p-6";

function money(value: number | null | undefined): string {
  return formatContractPrice(value ?? 0);
}

export default async function PurchaseInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireFinanceChild("purchaseInvoices");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const { id } = await params;

  if (session.user.clientId || session.user.vendorId) {
    redirect("/billing");
  }

  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id, companyId: session.user.companyId },
    include: {
      vendor: { select: { name: true, vendorType: true } },
      bankAccount: {
        select: {
          id: true,
          bankName: true,
          accountNumber: true,
          accountHolder: true,
          label: true,
          sortOrder: true,
        },
      },
      vendorBankAccount: {
        select: {
          bankName: true,
          accountNumber: true,
          accountHolder: true,
          label: true,
        },
      },
      employee: {
        select: { firstName: true, lastName: true, employeeNo: true },
      },
      handlingVendor: { select: { name: true } },
      project: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      paidBy: { select: { name: true } },
      loanFacility: { select: { id: true, name: true } },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          item: {
            select: { name: true, sku: true, unit: true, itemType: true },
          },
        },
      },
    },
  });

  if (!invoice) {
    redirect("/billing/purchase-invoices");
  }

  const handlingVendors = await prisma.vendor.findMany({
    where: {
      companyId: session.user.companyId,
      active: true,
    },
    select: { id: true, name: true, vendorType: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const user = toPermissionUser(session);
  const canManage =
    canAccess(user, "purchaseInvoices") || canAccess(user, "projects");
  const termsDays = invoice.paymentTermsDays ?? 14;
  const payment = getPurchasePaymentDisplay(
    {
      invoiceDate: invoice.invoiceDate,
      paidAt: invoice.paidAt,
      paymentTermsDays: termsDays,
    },
    new Date()
  );
  const isPaid = Boolean(invoice.paidAt);
  const isImport = invoice.origin === "IMPORT";
  const taxIncomplete = isPurchaseTaxIncomplete(invoice);
  const recordStatus = getPurchaseRecordStatus(invoice);
  const documents = listPurchaseDocumentSlots({
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
    showWithholding: commercialTaxIncludesIncomeTax(invoice.includedTaxKind),
    hasHandling: Boolean(
      invoice.handlingVendorId ||
        invoice.handlingFeeIdr ||
        invoice.handlingFeeTaxInvoicePath
    ),
    hasInvoice: invoice.hasInvoice,
    hasCustomsFees: invoice.hasCustomsFees,
  });

  const purposeLabel = isPrepaidCardTopUpInvoice(invoice)
    ? t("pages.billing.vehicleExpenseKindPrepaid")
    : invoice.purchaseCategory === "VEHICLE"
      ? invoice.vehicleExpenseKind === "PURCHASE"
        ? t("pages.billing.vehicleExpenseKindPurchase")
        : invoice.vehicleExpenseKind === "SERVICING"
          ? t("pages.billing.vehicleExpenseKindServicing")
          : invoice.vehicleExpenseKind === "MODIFICATION"
            ? t("pages.billing.vehicleExpenseKindModification")
            : invoice.vehicleExpenseKind === "OTHER"
              ? t("pages.billing.vehicleExpenseKindOther")
              : invoice.vehicleExpenseKind === "FUEL"
                ? t("pages.billing.vehicleExpenseKindFuel")
                : t("pages.billing.purchaseCategoryVehicle")
      : invoice.purpose === "PROJECT"
        ? t("pages.billing.purchasePurposeProject")
        : invoice.purpose === "INTERNAL"
          ? t("pages.billing.purchasePurposeInternal")
          : invoice.purpose === "PETTY_CASH"
            ? t("pages.billing.purchaseCategoryPettyCash")
            : t("pages.billing.purchasePurposeStock");
  const categoryLabel =
    invoice.purchaseCategory === "SERVICE"
      ? t("pages.billing.purchaseCategoryService")
      : invoice.purchaseCategory === "PETTY_CASH"
        ? t("pages.billing.purchaseCategoryPettyCash")
        : invoice.purchaseCategory === "GOVERNMENT"
          ? t("pages.billing.purchaseCategoryGovernment")
          : invoice.purchaseCategory === "VEHICLE"
            ? t("pages.billing.purchaseCategoryVehicle")
            : invoice.purchaseCategory === "BANK_LOAN"
              ? t("pages.billing.purchaseCategoryBankLoan")
              : invoice.purchaseCategory === "EMPLOYEE_PAYMENT"
                ? t("pages.billing.purchaseCategoryEmployee")
                : t("pages.billing.purchaseCategoryProduct");
  const employeePaymentKindLabel =
    invoice.employeePaymentKind === "INTERNAL_PAYROLL"
      ? t("pages.billing.employeePaymentInternalPayroll")
      : invoice.employeePaymentKind === "THR"
        ? t("pages.billing.employeePaymentThr")
        : invoice.employeePaymentKind === "CASH_ADVANCE"
          ? t("pages.billing.employeePaymentCashAdvance")
          : null;
  const factoryAmountIdr = decimalToNumber(invoice.invoiceAmountIdr) ?? 0;
  const bankRate = decimalToNumber(invoice.exchangeRateToIdr);
  const paidBankRate = decimalToNumber(invoice.paidExchangeRateToIdr);
  const importFxDifference = decimalToNumber(invoice.importFxDifferenceIdr);
  const customsRate = decimalToNumber(invoice.customsRateToIdr);
  const invoiceForeignAmount = decimalToNumber(invoice.invoiceForeignAmount);
  const customsRatesMap = parseCustomsRatesMap(invoice.customsRatesToIdr);
  const invoiceWithDeclared = invoice as typeof invoice & {
    declaredValue?: unknown;
    declaredCurrency?: string | null;
    declaredCustomsRate?: unknown;
  };
  const declaredValue = decimalToNumber(invoiceWithDeclared.declaredValue);
  const declaredCustomsRate = decimalToNumber(
    invoiceWithDeclared.declaredCustomsRate
  );
  const cif = summarizeImportCif({
    currency: invoice.invoiceCurrency,
    foreignAmount: invoiceForeignAmount,
    declaredValue,
    declaredCurrency: invoiceWithDeclared.declaredCurrency,
    declaredCustomsRate,
    freightCurrency: invoice.freightCurrency,
    freightForeignAmount: decimalToNumber(invoice.freightForeignAmount),
    freightIdr: decimalToNumber(invoice.freightIdr),
    freightIncludedInInvoice: invoice.freightIncludedInInvoice,
    freightCustomsRateToIdr: decimalToNumber(invoice.freightCustomsRateToIdr),
    insuranceCurrency: invoice.insuranceCurrency,
    insuranceForeignAmount: decimalToNumber(invoice.insuranceForeignAmount),
    insuranceIdr: decimalToNumber(invoice.insuranceIdr),
    insuranceIncludedInInvoice: invoice.insuranceIncludedInInvoice,
    insuranceCustomsRateToIdr: decimalToNumber(
      invoice.insuranceCustomsRateToIdr
    ),
    customsRateToIdr: customsRate,
    customsRatesToIdr: customsRatesMap,
  });
  const cifIdr = decimalToNumber(invoice.customsValueIdr);
  const declaredApplies = (declaredValue ?? 0) > 0;
  const cifDisplayCurrency = declaredApplies
    ? invoiceWithDeclared.declaredCurrency || invoice.invoiceCurrency
    : invoice.invoiceCurrency;
  const cifDisplayForeignAmount = declaredApplies
    ? declaredValue
    : invoiceForeignAmount;
  const storedDisplayCustomsRate = declaredApplies
    ? declaredCustomsRate ?? customsRate
    : customsRate;
  const impliedDisplayCustomsRate = impliedFactoryCustomsRateFromStoredCif({
    currency: cifDisplayCurrency,
    foreignAmount: cifDisplayForeignAmount,
    customsValueIdr: cifIdr,
    idrExtra: cif.idrAmount,
  });
  const cifDisplay = displayImportCifBreakdown(cif, {
    currency: cifDisplayCurrency,
    foreignAmount: cifDisplayForeignAmount,
    customsRateToIdr: storedDisplayCustomsRate || impliedDisplayCustomsRate,
    customsRatesToIdr: customsRatesMap,
    storedCustomsValueIdr: cifIdr,
    formatIdr: formatContractPrice,
  });
  const cifFormulaLabel =
    cifDisplay.formula ||
    formatImportCifFormulaLabel(
      cifDisplay.foreignLines,
      cifDisplay.idrAmount,
      cifDisplay.customsValueIdr,
      formatContractPrice
    );
  const cifNowLabel = formatImportCifNowLabel({
    currency: invoice.invoiceCurrency ?? "USD",
    foreignAmount: invoiceForeignAmount ?? 0,
    freightCurrency: invoice.freightCurrency,
    freightForeignAmount: decimalToNumber(invoice.freightForeignAmount),
    insuranceCurrency: invoice.insuranceCurrency,
    insuranceForeignAmount: decimalToNumber(invoice.insuranceForeignAmount),
    formatIdr: formatContractPrice,
  });
  const customsRateRows = cifDisplay.appliedCustomsRates;
  const netSettlement = paidBankRate != null && paidBankRate > 0;
  const remittance = summarizeImportVendorRemittance({
    foreignAmount: invoiceForeignAmount ?? 0,
    currency: invoice.invoiceCurrency,
    invoiceAmountIdr: factoryAmountIdr,
    exchangeRateToIdr: bankRate ?? 0,
    freightCurrency: invoice.freightCurrency,
    freightForeignAmount: decimalToNumber(invoice.freightForeignAmount),
    freightIdr: decimalToNumber(invoice.freightIdr),
    freightIncludedInInvoice: invoice.freightIncludedInInvoice,
    freightRateToIdr: decimalToNumber(invoice.freightRateToIdr),
    insuranceCurrency: invoice.insuranceCurrency,
    insuranceForeignAmount: decimalToNumber(invoice.insuranceForeignAmount),
    insuranceIdr: decimalToNumber(invoice.insuranceIdr),
    insuranceIncludedInInvoice: invoice.insuranceIncludedInInvoice,
    insuranceRateToIdr: decimalToNumber(invoice.insuranceRateToIdr),
    bankFeeCurrency: netSettlement ? undefined : invoice.bankFeeCurrency,
    bankFeeForeignAmount: netSettlement
      ? undefined
      : decimalToNumber(invoice.bankFeeForeignAmount),
    bankFeeIdr: netSettlement
      ? undefined
      : decimalToNumber(invoice.bankFeeIdr),
    fullAmountFeeCurrency: netSettlement
      ? undefined
      : invoice.fullAmountFeeCurrency,
    fullAmountFeeForeignAmount: netSettlement
      ? undefined
      : decimalToNumber(invoice.fullAmountFeeForeignAmount),
    fullAmountFeeIdr: netSettlement
      ? undefined
      : decimalToNumber(invoice.fullAmountFeeIdr),
    localBankFeeIdr: netSettlement
      ? 0
      : decimalToNumber(invoice.localBankFeeIdr),
  });
  const beaMasukIdr = decimalToNumber(invoice.beaMasukAmountIdr) ?? 0;
  const ppnbmIdr = decimalToNumber(invoice.ppnbmAmountIdr) ?? 0;
  const importPpnIdr = decimalToNumber(invoice.importPpnAmountIdr) ?? 0;
  const pph22Idr = decimalToNumber(invoice.pph22AmountIdr) ?? 0;
  const dutiesTotalIdr = beaMasukIdr + ppnbmIdr + importPpnIdr + pph22Idr;
  const handlingFeeDppIdr = decimalToNumber(invoice.handlingFeeIdr) ?? 0;
  const handlingFeePaidIdr =
    decimalToNumber(invoice.handlingFeeAmountPaidIdr) ?? handlingFeeDppIdr;
  const handlingPpnIdr = invoice.handlingFeeIncludesPpn
    ? Math.max(0, handlingFeePaidIdr - handlingFeeDppIdr)
    : 0;
  const handlingFeeIdr = handlingFeeDppIdr;
  const shippingCostIdr = decimalToNumber(invoice.shippingIdr) ?? 0;
  const vendorPaymentIdr = remittance.paidToVendorIdr || factoryAmountIdr;
  const vatCreditIdr = importPpnIdr + handlingPpnIdr;
  const taxCreditIdr = vatCreditIdr + pph22Idr;
  const grandTotalSpendIdr =
    vendorPaymentIdr + dutiesTotalIdr + handlingFeePaidIdr + shippingCostIdr;
  const storedWarehouse = decimalToNumber(invoice.stockLandedCostIdr);
  const liveWarehouse =
    importWarehouseFactoryPortionIdr({
      paidToVendorIdr: remittance.paidToVendorIdr,
      customsValueIdr: cifIdr ?? 0,
    }) +
    beaMasukIdr +
    ppnbmIdr +
    handlingFeeDppIdr +
    shippingCostIdr;
  const warehouseCostIdr =
    invoice.importDutiesPaidAt && storedWarehouse != null
      ? storedWarehouse
      : liveWarehouse;
  const showDutiesSection =
    invoice.importFulfillment !== "OUTSOURCED" || dutiesTotalIdr > 0;
  const warehouseReady = Boolean(invoice.importDutiesPaidAt);
  const hideServiceBreakdown =
    invoice.purchaseCategory === "SERVICE" ||
    invoice.purchaseCategory === "BANK_LOAN";
  const showLineWarehouseCosts =
    !hideServiceBreakdown && (!isImport || warehouseReady);
  const paymentForLabel =
    invoice.purchaseCategory === "GOVERNMENT"
      ? invoice.governmentTaxKind
        ? t(governmentTaxKindLabelKey(invoice.governmentTaxKind))
        : t("pages.billing.governmentChip")
      : invoice.purchaseCategory === "BANK_LOAN"
        ? invoice.bankLoanKind === "STANDBY"
          ? t("pages.billing.bankLoanKindStandby")
          : invoice.bankLoanKind === "TERM"
            ? t("pages.billing.bankLoanKindTerm")
            : t("pages.billing.purchaseCategoryBankLoan")
        : isImport
          ? t("pages.billing.purchaseOriginChipImport")
          : invoice.purchaseCategory === "VEHICLE"
            ? t("pages.billing.purchaseCategoryVehicle")
            : null;

  const readyDocuments = documents.flatMap((doc) =>
    doc.href
      ? [
          {
            href: doc.href,
            label: t(doc.titleKey),
            icon: "download" as const,
          },
        ]
      : []
  );

  return (
    <AppShell title={invoice.supplierName}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BackLink href="/billing/purchase-invoices">
          {t("pages.billing.purchaseBackToExpenses")}
        </BackLink>
        <PageDocumentActions documents={readyDocuments} />
      </div>

      <div className="space-y-5">
        <SectionCard className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3.5 sm:px-5">
            {invoice.reversedAt ? (
              <StatusBadge status="danger">
                {t("pages.billing.purchaseReversed")}
              </StatusBadge>
            ) : invoice.freeOfCharge ? (
              <StatusBadge status="success">
                {t("pages.billing.purchaseFreeOfChargeChip")}
              </StatusBadge>
            ) : isPaid ? (
              <StatusBadge status="success">
                {t("pages.billing.vendorStatusPaid")}
              </StatusBadge>
            ) : payment.key === "overdue" ? (
              <StatusBadge status="danger">
                {t("pages.billing.vendorStatusOverdue")}
              </StatusBadge>
            ) : (
              <StatusBadge status="info">
                {t("pages.billing.vendorStatusOpen")}
              </StatusBadge>
            )}
            {paymentForLabel ? (
              <StatusBadge
                status="info"
                lines={[
                  t("pages.billing.purchasePaymentForChip"),
                  paymentForLabel,
                ]}
              />
            ) : null}
            {taxIncomplete ? (
              <StatusBadge status="pending">
                {t("pages.billing.vendorStatusTaxMissing")}
              </StatusBadge>
            ) : null}
            {!invoice.reversedAt && !recordStatus.complete ? (
              <StatusBadge status="pending">
                {t(purchaseRecordStatusLabelKey(recordStatus.key))}
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
                  {invoice.supplierName}
                </td>
              </tr>
              {invoice.hasInvoice ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {invoice.purchaseCategory === "GOVERNMENT"
                      ? t("pages.billing.importDutiesBillingId")
                      : t("pages.billing.purchaseInvoiceRef")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {invoice.invoiceRef}
                  </td>
                </tr>
              ) : (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchaseInvoiceRef")}
                  </th>
                  <td className={metaValueClassName}>
                    {t("pages.billing.purchaseInvoiceRefNone")}
                  </td>
                </tr>
              )}
              {invoice.taxInvoiceSerial ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.vat.columns.taxInvoiceNumber")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {formatTaxInvoiceSerial(invoice.taxInvoiceSerial)}
                  </td>
                </tr>
              ) : null}
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {invoice.hasInvoice
                    ? t("pages.billing.purchaseInvoiceDate")
                    : t("pages.billing.purchaseDate")}
                </th>
                <td className={metaValueClassName}>
                  {formatDisplayDate(invoice.invoiceDate)}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.billing.purchaseCategory")}
                </th>
                <td className={metaValueClassName}>
                  {categoryLabel}
                  {employeePaymentKindLabel ? ` · ${employeePaymentKindLabel}` : ""}
                </td>
              </tr>
              {invoice.employee ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.employeePaymentEmployee")}
                  </th>
                  <td className={metaValueClassName}>
                    {`${invoice.employee.firstName} ${invoice.employee.lastName}`.trim()}
                    <span className="ml-2 font-mono text-xs text-muted">
                      {invoice.employee.employeeNo}
                    </span>
                  </td>
                </tr>
              ) : null}
              {invoice.purchaseCategory === "SERVICE" ||
              invoice.purchaseCategory === "VEHICLE" ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchasePurpose")}
                  </th>
                  <td className={metaValueClassName}>{purposeLabel}</td>
                </tr>
              ) : null}
              {invoice.vehiclePlate ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {invoice.vehicleExpenseKind === "PURCHASE" ||
                    !invoice.vehicleExpenseKind
                      ? t("pages.billing.purchaseVehiclePlate")
                      : t("pages.billing.vehicleFor")}
                  </th>
                  <td className={`${metaValueClassName} font-mono`}>
                    {invoice.vehiclePlate}
                  </td>
                </tr>
              ) : null}
              {invoice.vehicleYear != null ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchaseVehicleYear")}
                  </th>
                  <td className={metaValueClassName}>{invoice.vehicleYear}</td>
                </tr>
              ) : null}
              {invoice.vehicleOtherCostDescription ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.vehicleOtherCostDescription")}
                  </th>
                  <td className={metaValueClassName}>
                    {invoice.vehicleOtherCostDescription}
                  </td>
                </tr>
              ) : null}
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.billing.payFromAccount")}
                </th>
                <td className={metaValueClassName}>
                  {invoice.bankAccount
                    ? formatBankAccountOptionLabel(invoice.bankAccount)
                    : t("pages.billing.payFromPending")}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.billing.payToAccount")}
                </th>
                <td className={metaValueClassName}>
                  {invoice.vendorBankAccount
                    ? formatVendorBankAccountLabel(invoice.vendorBankAccount)
                    : t("pages.billing.payToPending")}
                </td>
              </tr>
              {invoice.includedTaxKind ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchaseIncludedTaxKind")}
                  </th>
                  <td className={metaValueClassName}>
                    {invoice.includedTaxKind === "OTHER" && invoice.otherTaxName
                      ? invoice.otherTaxName
                      : t(commercialTaxKindLabelKey(invoice.includedTaxKind))}
                  </td>
                </tr>
              ) : null}
              {invoice.includesPpn && invoice.ppnRatePercent != null ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchasePpnRate")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {`${decimalToNumber(invoice.ppnRatePercent)}%`}
                  </td>
                </tr>
              ) : null}
              {invoice.pphRatePercent != null ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchasePphRate")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {`${decimalToNumber(invoice.pphRatePercent)}%`}
                  </td>
                </tr>
              ) : null}
              {invoice.project ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchaseProject")}
                  </th>
                  <td className={metaValueClassName}>{invoice.project.name}</td>
                </tr>
              ) : null}
              {invoice.purchaseCategory === "GOVERNMENT" ||
              invoice.purchaseCategory === "BANK_LOAN" ? null : (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchasePaymentTerms")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {isCashPaymentTerms(termsDays)
                      ? t("common.paymentTerms.cashShort")
                      : t("common.paymentTerms.netShort", { days: termsDays })}
                  </td>
                </tr>
              )}
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {isPaid
                    ? t("pages.billing.purchasePaidAt")
                    : t("pages.billing.paymentDue")}
                </th>
                <td className={metaValueClassName}>
                  {isPaid && invoice.paidAt
                    ? formatDisplayDate(invoice.paidAt)
                    : payment.dueAt
                      ? formatDisplayDate(payment.dueAt, { timeZone: "UTC" })
                      : "—"}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {isImport
                    ? t("pages.billing.purchaseFactoryInvoice")
                    : t("pages.billing.purchaseAmount")}
                </th>
                <td className={`${metaValueClassName} text-base font-semibold tabular-nums`}>
                  {invoice.freeOfCharge
                    ? t("pages.billing.purchaseFreeOfChargeChip")
                    : formatPurchaseListedAmount(invoice)}
                </td>
              </tr>
              {invoice.purchaseCategory === "BANK_LOAN" && invoice.loanSource ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.loanSource")}
                  </th>
                  <td className={metaValueClassName}>
                    {invoice.loanSource === "SHAREHOLDER"
                      ? t("pages.billing.loanSourceShareholder")
                      : t("pages.billing.loanSourceBank")}
                  </td>
                </tr>
              ) : null}
              {invoice.loanFacility ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.loanFacility")}
                  </th>
                  <td className={metaValueClassName}>
                    <Link
                      href={`/billing/loans/${invoice.loanFacility.id}`}
                      className="text-primary hover:underline"
                    >
                      {invoice.loanFacility.name}
                    </Link>
                  </td>
                </tr>
              ) : null}
              {invoice.purchaseCategory === "BANK_LOAN" && invoice.bankLoanKind ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.bankLoanKind")}
                  </th>
                  <td className={metaValueClassName}>
                    {invoice.bankLoanKind === "STANDBY"
                      ? t("pages.billing.bankLoanKindStandby")
                      : t("pages.billing.bankLoanKindTerm")}
                  </td>
                </tr>
              ) : null}
              {invoice.loanProvisionAmount != null ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.loanProvisionPaid")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {money(decimalToNumber(invoice.loanProvisionAmount))}
                  </td>
                </tr>
              ) : null}
              {invoice.loanAdminFeeAmount != null ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.loanAdminFeePaid")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {money(decimalToNumber(invoice.loanAdminFeeAmount))}
                  </td>
                </tr>
              ) : null}
              {invoice.loanInterestAmount != null &&
              (decimalToNumber(invoice.loanInterestAmount) ?? 0) > 0 ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.loanInterestPaid")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {money(decimalToNumber(invoice.loanInterestAmount))}
                  </td>
                </tr>
              ) : null}
              {invoice.loanPrincipalAmount != null &&
              (decimalToNumber(invoice.loanPrincipalAmount) ?? 0) > 0 ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.loanPrincipalReturned")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {money(decimalToNumber(invoice.loanPrincipalAmount))}
                  </td>
                </tr>
              ) : null}
              {invoice.bankLoanFacilityLimit != null ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.bankLoanFacilityLimit")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {money(decimalToNumber(invoice.bankLoanFacilityLimit))}
                  </td>
                </tr>
              ) : null}
              {invoice.bankLoanPrincipal != null ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {invoice.bankLoanKind === "STANDBY"
                      ? t("pages.billing.bankLoanDrawnAmount")
                      : t("pages.billing.bankLoanPrincipal")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {money(decimalToNumber(invoice.bankLoanPrincipal))}
                  </td>
                </tr>
              ) : null}
              {invoice.bankLoanAnnualRatePercent != null ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.bankLoanAnnualRate")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {`${decimalToNumber(invoice.bankLoanAnnualRatePercent)}%`}
                  </td>
                </tr>
              ) : null}
              {invoice.bankLoanTenorMonths != null ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.bankLoanTenorMonths")}
                  </th>
                  <td className={metaValueClassName}>
                    {invoice.bankLoanTenorMonths}
                  </td>
                </tr>
              ) : null}
              {invoice.bankLoanMonthlyInstallment != null ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.bankLoanMonthlyInstallment")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {money(decimalToNumber(invoice.bankLoanMonthlyInstallment))}
                  </td>
                </tr>
              ) : null}
              {invoice.transferFeeIdr != null ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchaseTransferFee")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {money(decimalToNumber(invoice.transferFeeIdr))}
                  </td>
                </tr>
              ) : null}
              {invoice.freeOfCharge && invoice.freeOfChargeReason ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchaseFreeOfChargeReason")}
                  </th>
                  <td className={metaValueClassName}>
                    {invoice.freeOfChargeReason}
                  </td>
                </tr>
              ) : null}
              {invoice.shippingIdr != null ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {invoice.purchaseCategory === "SERVICE"
                      ? t("pages.billing.purchaseRelatedCost")
                      : t("pages.billing.purchaseShippingCost")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {invoice.purchaseCategory === "SERVICE" &&
                    invoice.otherTaxName
                      ? `${invoice.otherTaxName} · `
                      : ""}
                    {invoice.shippingCurrency && invoice.shippingCurrency !== "IDR"
                      ? `${invoice.shippingCurrency} ${decimalToNumber(invoice.shippingForeignAmount)} · ${money(decimalToNumber(invoice.shippingIdr))}`
                      : money(decimalToNumber(invoice.shippingIdr))}
                  </td>
                </tr>
              ) : null}
              {invoice.hasCustomsFees && declaredValue != null && declaredValue > 0 ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchaseDeclaredValue")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {invoice.declaredCurrency && invoice.declaredCurrency !== "IDR"
                      ? `${formatImportForeignAmount(invoice.declaredCurrency, declaredValue)}${
                          declaredCustomsRate != null && declaredCustomsRate > 0
                            ? ` · ${t("pages.billing.purchaseImportCustomsRate")} ${money(declaredCustomsRate)}`
                            : ""
                        }`
                      : money(declaredValue)}
                  </td>
                </tr>
              ) : null}
              {invoice.notes ? (
                <tr>
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchaseNotes")}
                  </th>
                  <td className={metaValueClassName}>{invoice.notes}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </SectionCard>

        {isImport ? (
          <SectionCard className="overflow-hidden p-0">
            <div className="border-b border-border px-5 py-4 sm:px-6">
              <h3 className={sectionTitleClassName}>
                {t("pages.billing.purchaseImportBreakdown")}
              </h3>
            </div>
            <div className="grid gap-px bg-border lg:grid-cols-2">
              <div className="bg-card p-5 sm:p-6">
                <p className="mb-3 text-base font-semibold tracking-tight text-text">
                  {t("pages.billing.purchaseImportPayLaterTitle")}
                </p>
                {remittance.bankRate > 0 ? (
                  <>
                <CompactRow
                  label={t("pages.billing.purchaseFactoryInvoice")}
                  value={remittanceLineValue(remittance.factory)}
                />
                {remittance.freight.includedInInvoice ? (
                  <CompactRow
                    label={t("pages.billing.purchaseImportFreight")}
                    value={remittanceLineValue(remittance.freight)}
                  />
                ) : null}
                {remittance.insurance.includedInInvoice ? (
                  <CompactRow
                    label={t("pages.billing.purchaseImportInsurance")}
                    value={remittanceLineValue(remittance.insurance)}
                  />
                ) : null}
                <CompactRow
                  label={t("pages.billing.purchaseImportBankCharge")}
                  value={
                    remittance.bankCharge.vendorIdr > 0
                      ? remittanceLineValue(remittance.bankCharge)
                      : money(decimalToNumber(invoice.bankFeeIdr) ?? 0)
                  }
                />
                <CompactRow
                  label={
                    paidBankRate != null && paidBankRate > 0
                      ? t("pages.billing.purchaseImportBookingRate")
                      : isCashPaymentTerms(invoice.paymentTermsDays ?? 0)
                        ? t("pages.billing.purchaseImportRate")
                        : t("pages.billing.purchaseImportBookingRate")
                  }
                  value={
                    remittance.bankRate > 0 ? money(remittance.bankRate) : "—"
                  }
                />
                {paidBankRate != null && paidBankRate > 0 ? (
                  <CompactRow
                    label={t("pages.billing.purchaseImportRate")}
                    value={money(paidBankRate)}
                  />
                ) : null}
                {importFxDifference != null && importFxDifference !== 0 ? (
                  <CompactRow
                    label={t("pages.billing.purchaseImportRateDifference")}
                    value={money(Math.abs(importFxDifference))}
                  />
                ) : null}
                {importFxDifference != null && importFxDifference !== 0 ? (
                  <p className="mt-1 text-xs leading-relaxed text-subtle">
                    {importFxDifference > 0
                      ? t("pages.billing.purchaseImportRateDifferenceExpenseHint")
                      : t("pages.billing.purchaseImportRateDifferenceIncomeHint")}
                  </p>
                ) : null}
                <CompactRow
                  label={t("pages.billing.purchaseImportAmountSent")}
                  value={money(remittance.amountSentIdr)}
                />
                {remittance.fullAmountFeeIdr > 0 ? (
                  <CompactRow
                    label={t("pages.billing.purchaseImportFullAmountFee")}
                    value={money(remittance.fullAmountFeeIdr)}
                  />
                ) : null}
                <CompactRow
                  label={t("pages.billing.purchaseImportLocalBankFee")}
                  value={money(remittance.telexIdr)}
                />
                {remittance.separateFreightIdr > 0 ? (
                  <CompactRow
                    label={t("pages.billing.purchaseImportFreightSeparate")}
                    value={remittanceLineValue(remittance.freight)}
                  />
                ) : null}
                {remittance.separateInsuranceIdr > 0 ? (
                  <CompactRow
                    label={t("pages.billing.purchaseImportInsuranceSeparate")}
                    value={remittanceLineValue(remittance.insurance)}
                  />
                ) : null}
                <CompactRow
                  label={t("pages.billing.purchaseImportPaidToVendorTotal")}
                  value={money(vendorPaymentIdr)}
                  emphasize
                />
                <p className="mt-2 text-xs leading-relaxed text-subtle">
                  {t("pages.billing.purchaseImportPaidToVendorHint")}
                </p>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-subtle">
                    {t("pages.billing.purchaseImportBankRateWhenPaid")}
                  </p>
                )}
              </div>

              <div className="bg-card p-5 sm:p-6">
                <p className="mb-3 text-base font-semibold tracking-tight text-text">
                  {t("pages.billing.purchaseImportFactoryNowTitle")}
                </p>
                {(cifIdr ?? 0) > 0 ? (
                <ImportCifValueBlock
                  title={t("pages.billing.purchaseImportCustomsValue")}
                  titleClassName="text-base"
                  formulaClassName="text-xl"
                  chips={customsRateRows.map((row) => ({
                    currency: row.currency,
                    customsRateLabel: t("pages.billing.purchaseImportCustomsRate"),
                    rateLabel: money(row.rate),
                  }))}
                  formula={
                    cifFormulaLabel ||
                    (cifIdr != null ? money(cifIdr) : "—")
                  }
                />
                ) : (
                  <div className="space-y-2">
                    <p className="text-base font-semibold tracking-tight text-text">
                      {t("pages.billing.purchaseImportCustomsValue")}
                    </p>
                    {cifNowLabel ? (
                      <p className="text-xl font-semibold tabular-nums tracking-tight text-text">
                        {cifNowLabel}
                      </p>
                    ) : null}
                    <p className="text-sm leading-relaxed text-subtle">
                      {t("pages.billing.purchaseImportCifNowHint")}
                    </p>
                  </div>
                )}

                {showDutiesSection ? (
                  <div className="mt-4">
                    <CompactHead
                      label={t("pages.billing.purchaseImportDutiesSectionTitle")}
                    />
                    {invoice.importDutiesPaidAt || dutiesTotalIdr > 0 ? (
                      <>
                    <CompactRow
                      label={t("pages.billing.purchaseImportBeaMasuk")}
                      value={money(beaMasukIdr)}
                    />
                    {ppnbmIdr > 0 ? (
                      <CompactRow
                        label={t("pages.billing.purchaseImportPpnbm")}
                        value={money(ppnbmIdr)}
                      />
                    ) : null}
                    <CompactRow
                      label={t("pages.billing.purchaseImportPpn")}
                      value={money(importPpnIdr)}
                    />
                    <CompactRow
                      label={t("pages.billing.purchaseImportPph22")}
                      value={money(pph22Idr)}
                    />
                    <CompactRow
                      label={t("pages.billing.importDutiesBillingId")}
                      value={invoice.importDutiesBillingId || "—"}
                    />
                    <CompactRow
                      label={t("pages.billing.purchaseImportDutiesTotal")}
                      value={money(dutiesTotalIdr)}
                      emphasize
                    />
                      </>
                    ) : null}
                    <p className="mt-2 text-xs leading-relaxed text-subtle">
                      {t("pages.billing.purchaseImportCustomsRateDutiesHint")}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4">
                  <CompactHead label={t("pages.billing.handlingFee")} />
                  <CompactRow
                    label={t("pages.billing.importFulfillment")}
                    value={
                      invoice.importFulfillment === "OUTSOURCED"
                        ? t("pages.billing.importOutsourced")
                        : t("pages.billing.importHandledInternally")
                    }
                  />
                  <CompactRow
                    label={t("pages.billing.handlingVendor")}
                    value={
                      invoice.handlingVendor?.name ??
                      t("pages.billing.handlingByHeadOffice")
                    }
                  />
                  <CompactRow
                    label={t("pages.billing.handlingFee")}
                    value={money(handlingFeeIdr)}
                    emphasize
                  />
                </div>
              </div>

              <div className="bg-card p-5 sm:p-6">
                <p className="mb-3 text-base font-semibold tracking-tight text-text">
                  {t("pages.billing.purchaseImportCredits")}
                </p>
                {warehouseReady ? (
                  <>
                <div className="space-y-4">
                  <CreditTotal
                    label={t("pages.billing.purchaseImportVatCredit")}
                    amount={vatCreditIdr}
                  />
                  {importPpnIdr > 0 && handlingPpnIdr > 0 ? (
                    <div className="space-y-1 pl-0.5">
                      <CompactRow
                        label={t("pages.billing.purchaseImportPpnOnGoods")}
                        value={money(importPpnIdr)}
                      />
                      <CompactRow
                        label={t("pages.billing.purchaseImportPpnOnHandling")}
                        value={money(handlingPpnIdr)}
                      />
                    </div>
                  ) : null}
                  <CreditTotal
                    label={t("pages.billing.purchaseImportPph22Credit")}
                    amount={pph22Idr}
                  />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-subtle">
                  {t("pages.billing.purchaseImportTaxCreditNote")}
                </p>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-subtle">
                    {t("pages.billing.purchaseImportWarehouseAfterDuties")}
                  </p>
                )}
              </div>

              <div className="bg-card p-5 sm:p-6">
                <p className="mb-3 text-base font-semibold tracking-tight text-text">
                  {t("pages.billing.purchaseImportStockCost")}
                </p>
                {warehouseReady ? (
                  <>
                {shippingCostIdr > 0 ? (
                  <CompactRow
                    label={t("pages.billing.purchaseShippingCost")}
                    value={money(shippingCostIdr)}
                  />
                ) : null}
                <CompactRow
                  label={t("pages.billing.purchaseImportGrandTotalSpend")}
                  value={money(grandTotalSpendIdr)}
                  emphasize
                />
                <CompactRow
                  label={t("pages.billing.purchaseImportStockCost")}
                  value={money(warehouseCostIdr)}
                  emphasize
                />
                <p className="mt-3 text-xs leading-relaxed text-subtle">
                  {t("pages.billing.purchaseImportWarehouseSpendHint")}
                </p>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-subtle">
                    {t("pages.billing.purchaseImportWarehouseAfterDuties")}
                  </p>
                )}
              </div>
            </div>
          </SectionCard>
        ) : null}

        <SectionCard className={sectionCardClassName}>
          <h3 className={sectionTitleClassName}>
            {t("pages.billing.purchaseWhatWeBought")}
          </h3>
          {invoice.lines.length === 0 ? (
            <p className="mt-3 text-sm text-subtle">
              {t("pages.billing.purchaseNoLineItems")}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-[0.08em] text-subtle">
                    <th className="py-2 pr-3">{t("pages.billing.purchaseLineItem")}</th>
                    {hideServiceBreakdown ? null : (
                      <th className="py-2 pr-3">{t("pages.billing.purchaseLineQty")}</th>
                    )}
                    {showLineWarehouseCosts ? (
                      <th className="py-2 pr-3">
                        {t("pages.billing.purchaseLineUnitCost")}
                      </th>
                    ) : null}
                    {hideServiceBreakdown || showLineWarehouseCosts ? (
                      <th className="py-2 text-right">
                        {hideServiceBreakdown
                          ? t("pages.billing.purchaseAmount")
                          : t("pages.billing.purchaseExpenseLineTotal")}
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line) => {
                    const qty = decimalToNumber(line.quantity) ?? 0;
                    const unit = line.unit || line.item?.unit || "";
                    return (
                      <tr key={line.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-text">
                            {line.item?.name ?? line.description ?? "—"}
                          </p>
                          {line.item?.sku ? (
                            <p className="mt-0.5 text-xs text-subtle">
                              {line.item.sku}
                              {line.item.itemType
                                ? ` · ${localizeInventoryItemType(line.item.itemType, locale)}`
                                : ""}
                            </p>
                          ) : null}
                        </td>
                        {hideServiceBreakdown ? null : (
                          <td className="py-2.5 pr-3 tabular-nums text-text">
                            {qty}
                            {unit ? ` ${unit}` : ""}
                          </td>
                        )}
                        {showLineWarehouseCosts ? (
                          <td className="py-2.5 pr-3 tabular-nums text-text">
                            {money(decimalToNumber(line.unitPrice))}
                          </td>
                        ) : null}
                        {hideServiceBreakdown || showLineWarehouseCosts ? (
                          <td className="py-2.5 text-right tabular-nums font-medium text-text">
                            {money(decimalToNumber(line.totalPrice))}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {isImport && !warehouseReady ? (
                <p className="mt-3 text-sm text-subtle">
                  {t("pages.billing.purchaseImportWarehouseAfterDuties")}
                </p>
              ) : null}
            </div>
          )}
        </SectionCard>

        {invoice.isVehicleLease ? (
          <SectionCard className={sectionCardClassName}>
            <h3 className={sectionTitleClassName}>
              {t("pages.billing.purchaseVehicleLease")}
            </h3>
            <p className="mt-1 text-sm text-subtle">
              {t("pages.billing.purchaseVehicleLeaseHint")}
            </p>
            <table className="mt-4 w-full text-sm">
              <tbody>
                {(
                  [
                    ["purchaseLeaseOtr", invoice.leaseOtrAmount],
                    ["purchaseLeaseDownPayment", invoice.leaseDownPayment],
                    ["purchaseLeaseAdminFee", invoice.leaseAdminFee],
                    ["purchaseLeaseInsurance", invoice.leaseInsuranceAmount],
                    ["purchaseLeaseFiduciary", invoice.leaseFiduciaryFee],
                    ["purchaseLeaseProvision", invoice.leaseProvisionFee],
                    ["purchaseLeaseOtherFee", invoice.leaseOtherFee],
                    ["purchaseLeaseMonthly", invoice.leaseMonthlyInstallment],
                  ] as const
                ).map(([key, value]) => (
                  <tr key={key} className="border-b border-border last:border-0">
                    <th scope="row" className={metaLabelClassName}>
                      {t(`pages.billing.${key}`)}
                    </th>
                    <td className={`${metaValueClassName} tabular-nums`}>
                      {money(decimalToNumber(value))}
                    </td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchaseLeaseTenor")}
                  </th>
                  <td className={metaValueClassName}>
                    {invoice.leaseTenorMonths ?? "—"}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.purchaseLeaseInterest")}
                  </th>
                  <td className={metaValueClassName}>
                    {decimalToNumber(invoice.leaseInterestPercentYear) ?? "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </SectionCard>
        ) : null}

        <SectionCard className={sectionCardClassName}>
          <h3 className={sectionTitleClassName}>
            {t("pages.billing.purchaseDocuments")}
          </h3>
          <p className="mt-1 text-sm text-subtle">
            {t("pages.billing.purchaseDocumentsHint")}
          </p>
          <div className="mt-4">
            <PurchaseInvoiceDetailClient
              purchaseInvoiceId={invoice.id}
              supplierName={invoice.supplierName}
              invoiceRef={invoice.invoiceRef}
              documents={documents}
              canManage={canManage && !invoice.reversedAt}
              canMarkPaid={canManage && !invoice.reversedAt}
              isPaid={isPaid}
              needsImportBankRate={purchaseNeedsImportBankRate(invoice)}
              invoiceCurrency={invoice.invoiceCurrency}
              invoiceForeignAmount={invoiceForeignAmount}
              bookingRate={bankRate}
              showWithholdingSlip={commercialTaxIncludesIncomeTax(
                invoice.includedTaxKind
              )}
              showLocalTaxUpload={
                invoice.includesPpn &&
                invoice.origin !== "IMPORT" &&
                invoice.purchaseCategory !== "GOVERNMENT" &&
                invoice.purchaseCategory !== "PETTY_CASH" &&
                invoice.hasInvoice
              }
              canMarkDutiesPaid={
                canManage &&
                !invoice.reversedAt &&
                invoice.origin === "IMPORT" &&
                (
                  (
                    invoice.importFulfillment !== "OUTSOURCED" &&
                    !invoice.importDutiesPaidAt
                  ) ||
                  (
                    invoice.handlingDueWithDuties &&
                    !invoice.handlingVendorId
                  )
                )
              }
              needsHandlingWithDuties={
                invoice.handlingDueWithDuties && !invoice.handlingVendorId
              }
              handlingVendors={handlingVendors.map((vendor) => ({
                id: vendor.id,
                name: vendor.name,
                vendorType: vendor.vendorType,
              }))}
              importDutiesBillingId={invoice.importDutiesBillingId}
              isImport={isImport}
              importArrival={{
                invoiceCurrency: invoice.invoiceCurrency,
                invoiceForeignAmount,
                freightCurrency: invoice.freightCurrency,
                freightForeignAmount: decimalToNumber(
                  invoice.freightForeignAmount
                ),
                freightIncludedInInvoice: invoice.freightIncludedInInvoice,
                freightCustomsRateToIdr: decimalToNumber(
                  invoice.freightCustomsRateToIdr
                ),
                insuranceCurrency: invoice.insuranceCurrency,
                insuranceForeignAmount: decimalToNumber(
                  invoice.insuranceForeignAmount
                ),
                insuranceIncludedInInvoice: invoice.insuranceIncludedInInvoice,
                insuranceCustomsRateToIdr: decimalToNumber(
                  invoice.insuranceCustomsRateToIdr
                ),
                customsRatesToIdr: invoice.customsRatesToIdr,
                customsRateToIdr: customsRate,
                formEApplied: invoice.formEApplied,
                beaMasukApplied: invoice.beaMasukApplied,
                beaMasukRatePercent: decimalToNumber(
                  invoice.beaMasukRatePercent
                ),
                beaMasukAmountIdr: beaMasukIdr,
                ppnbmApplied: invoice.ppnbmApplied,
                ppnbmRatePercent: decimalToNumber(invoice.ppnbmRatePercent),
                ppnbmAmountIdr: ppnbmIdr,
                includesPpn: invoice.includesPpn,
                ppnRatePercent: decimalToNumber(invoice.ppnRatePercent),
                importPpnAmountIdr: importPpnIdr,
                pph22Applied: invoice.pph22Applied,
                pph22Basis: invoice.pph22Basis,
                pph22RatePercent: decimalToNumber(invoice.pph22RatePercent),
                pph22AmountIdr: pph22Idr,
                declaredValue,
                declaredCurrency: invoiceWithDeclared.declaredCurrency,
                hasCustomsFees: invoice.hasCustomsFees,
                totalQuantity: invoice.lines.reduce(
                  (sum, line) => sum + (decimalToNumber(line.quantity) ?? 0),
                  0
                ),
              }}
            />
          </div>
          {invoice.createdBy?.name ? (
            <p className="mt-4 text-xs text-subtle">
              {t("pages.billing.purchaseUploadedBy", {
                name: invoice.createdBy.name,
              })}
              <span className="mx-1.5 text-border-strong" aria-hidden>
                ·
              </span>
              {formatDisplayDate(invoice.createdAt)}
            </p>
          ) : null}
        </SectionCard>
      </div>
    </AppShell>
  );
}

function remittanceLineValue(line: {
  storedAsIdr: boolean;
  currency: string;
  foreignAmount: number | null;
  vendorIdr: number;
}): string {
  if (
    !line.storedAsIdr &&
    line.foreignAmount != null &&
    line.foreignAmount > 0
  ) {
    return formatImportForeignAmount(line.currency, line.foreignAmount);
  }
  return money(line.vendorIdr);
}

function CompactHead({ label }: { label: string }) {
  return (
    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
      {label}
    </p>
  );
}

function CompactRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/70 py-1.5 last:border-0">
      <span className="text-xs text-subtle">{label}</span>
      <span
        className={
          emphasize
            ? "text-sm font-semibold tabular-nums text-text"
            : "text-sm tabular-nums text-text"
        }
      >
        {value}
      </span>
    </div>
  );
}

function CreditTotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm font-semibold leading-snug text-text">
        {label}
      </span>
      <span className="text-xl font-semibold tabular-nums tracking-tight text-text">
        {money(amount)}
      </span>
    </div>
  );
}
