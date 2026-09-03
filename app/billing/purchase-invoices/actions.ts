"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { getServerLocale } from "@/lib/i18n/locale";
import { nextOpenWagePayrollPeriod } from "@/lib/internal-payroll-lock";
import { translate } from "@/lib/i18n/translate";
import {
  inferDocumentMime,
  taxInvoiceDateToUtcDate,
} from "@/lib/payment-document-verify";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import {
  isEquipmentItemType,
  mintVehicleAssetByPlate,
} from "@/lib/equipment-asset";
import {
  listCompanyBankAccountOptions,
  parseFormCompanyBankAccountId,
} from "@/lib/company-bank-accounts";
import {
  parseRequiredVehiclePlate,
  parseRequiredVehicleYear,
  parseVehicleCondition,
  formatVehicleIdentityLabel,
} from "@/lib/vehicle-plate";
import { unwindAndReversePurchaseInvoice } from "@/lib/purchase-invoice-reverse";
import {
  toDecimal,
  isWholeInventoryQty,
  normalizeInventoryQty,
} from "@/lib/inventory";
import { isVehicleItemType } from "@/lib/inventory-sku";
import {
  applyPurchaseLineStockIn,
  stockInPendingPurchaseLines,
} from "@/lib/purchase-stock-in";
import {
  isVehicleOperatingExpenseKind,
  parseVehicleExpenseKind,
} from "@/lib/vehicle-expense";
import {
  calculateVehicleLease,
  parseVehicleLeaseFromForm,
} from "@/lib/vehicle-lease";
import {
  allowsDecimalInventoryQty,
  normalizeInventoryUnit,
  stockQuantityFromPurchase,
} from "@/lib/inventory-units";
import {
  parseOptionalManualVerifyReason,
} from "@/lib/in-house-document-verify";
import {
  parseRequiredTaxInvoiceSerial,
  requireTaxInvoiceSerialVerified,
} from "@/lib/tax-invoice-serial";
import {
  assertPurchasePurposeProject,
  parsePurchaseCategory,
  parsePurchasePurpose,
  purchaseCreatesStock,
  resolvePurchasePurpose,
} from "@/lib/purchase-purpose";
import { requireSession, toPermissionUser } from "@/lib/session";
import { creditPrepaidCardFromExpense } from "@/lib/advance-cash-expense";
import { prepaidTopUpLabel } from "@/lib/prepaid-card";
import { formatEmployeeName } from "@/lib/employee-user-link";
import {
  nextPettyCashTopUpRef,
  pettyCashTopUpDescription,
} from "@/lib/petty-cash";
import { writeRecordChange } from "@/lib/record-change";
import { capitalizeProper, titleCaseWords } from "@/lib/text-case";
import {
  commercialTaxIncludesIncomeTax,
  commercialTaxIncludesVat,
  commercialTaxRequiresRatePercent,
  parseCommercialPphRatePercent,
  parseCommercialTaxKind,
  parseOtherTaxName,
  type CommercialTaxKind,
} from "@/lib/commercial-tax";
import {
  bpjsProgramFromGovernmentKind,
  governmentPayeeName,
  isBpjsGovernmentKind,
  parseGovernmentTaxKind,
} from "@/lib/government-tax";
import {
  getBpjsFinancePeriod,
  releaseBpjsKesehatanHeldShare,
} from "@/lib/bpjs-finance";
import { vendorMatchesPurchaseOrigin } from "@/lib/vendor-type";
import {
  applyExclusiveVat,
  assertInclusiveCreditableTax,
  exclusiveUnitCostFromInclusive,
  parsePpnRatePercent,
  ppnRateFromPercent,
} from "@/lib/vat";
import {
  createLoanFeePayment,
  createLoanRepayment,
  recordLoanInterestBillPaid,
} from "@/lib/loan-facility-write";
import {
  isLoanFeePurpose,
  parseLoanPaymentPurpose,
  shareholderLoanInvoiceRef,
} from "@/lib/loan-facility";
import { getLoanFacilitySnapshot } from "@/lib/loan-facility-query";
import {
  isCashPaymentTerms,
  PAYMENT_TERMS_DAYS_OPTIONS,
  type PaymentTermsDaysOption,
} from "@/lib/invoice-period";
import {
  buildBillingDocumentFileBase,
  deleteLocalUpload,
  saveUpload,
} from "@/lib/upload";
import {
  formFiles,
  saveAndAppendUploads,
} from "@/lib/upload-paths";
import {
  allocateImportStockCost,
  calculateImportLandedCost,
  importRateDifferenceIdr,
  importRemittanceFeesGoToWarehouse,
  isHandlingByHeadOffice,
  normalizeImportCurrency,
  parseImportDecimal,
  parseImportFormPayload,
  summarizeImportVendorRemittance,
  type ImportFormPayload,
  type ImportLandedCostResult,
} from "@/lib/import-landed-cost";
import { purchaseNeedsImportBankRate } from "@/lib/purchase-amount-display";
import { todayDateInput } from "@/lib/project-contract";
import { setPurchaseHandlingHasTaxInvoice } from "@/lib/review-amount-fields";

type PurchaseLineInput = {
  itemId?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  foreignAmount?: number;
  unit?: string;
  packContents?: number;
};

function parsePurchaseLinesJson(
  raw: string,
  options: { requireCatalogItem: boolean }
): PurchaseLineInput[] {
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
    const description = String(
      (row as { description?: unknown })?.description ?? ""
    ).trim();
    const quantity = Number((row as { quantity?: unknown })?.quantity);
    const unitPrice = Number((row as { unitPrice?: unknown })?.unitPrice);
    const unit = String((row as { unit?: unknown })?.unit ?? "").trim();
    const packRaw = (row as { packContents?: unknown })?.packContents;
    const packContents =
      packRaw == null || packRaw === "" ? undefined : Number(packRaw);
    const foreignRaw = (row as { foreignAmount?: unknown })?.foreignAmount;
    const foreignAmount =
      foreignRaw == null || foreignRaw === ""
        ? undefined
        : Number(foreignRaw);
    if (options.requireCatalogItem && !itemId) {
      throw new Error(`Select an item for line ${index + 1}.`);
    }
    if (!options.requireCatalogItem && !description) {
      throw new Error(`Describe the service for line ${index + 1}.`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Enter a valid quantity for line ${index + 1}.`);
    }
    if (
      !allowsDecimalInventoryQty(unit || "pcs") &&
      !isWholeInventoryQty(quantity)
    ) {
      throw new Error(`Quantity for line ${index + 1} must be a whole number.`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Enter a valid unit cost for line ${index + 1}.`);
    }
    if (
      packContents != null &&
      (!Number.isFinite(packContents) || packContents <= 0)
    ) {
      throw new Error(`Enter how many are in each pack for line ${index + 1}.`);
    }
    if (
      foreignAmount != null &&
      (!Number.isFinite(foreignAmount) || foreignAmount < 0)
    ) {
      throw new Error(`Enter a valid invoice share for line ${index + 1}.`);
    }
    return {
      itemId: itemId || undefined,
      description: description || undefined,
      quantity,
      unitPrice,
      foreignAmount,
      unit: unit || undefined,
      packContents,
    };
  });
}

function formFlagTrue(formData: FormData, key: string): boolean {
  const raw = String(formData.get(key) ?? "")
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "on" || raw === "yes";
}

function parseFocShipping(
  formData: FormData,
  rateError = "Enter the Bank Rate for this shipping cost."
): {
  currency: string | null;
  foreignAmount: number | null;
  rateToIdr: number | null;
  idr: number | null;
} {
  const amount = parseImportDecimal(
    String(formData.get("shippingForeignAmount") ?? "")
  );
  if (amount == null || amount <= 0) {
    return {
      currency: null,
      foreignAmount: null,
      rateToIdr: null,
      idr: null,
    };
  }
  const currency = normalizeImportCurrency(
    String(formData.get("shippingCurrency") ?? ""),
    "IDR"
  );
  if (currency === "IDR") {
    return {
      currency: "IDR",
      foreignAmount: amount,
      rateToIdr: null,
      idr: Math.round(amount * 100) / 100,
    };
  }
  const rate = parseImportDecimal(
    String(formData.get("shippingRateToIdr") ?? "")
  );
  if (rate == null || rate <= 0) {
    throw new Error(rateError);
  }
  return {
    currency,
    foreignAmount: amount,
    rateToIdr: rate,
    idr: Math.round(amount * rate * 100) / 100,
  };
}

function optionalDecimal(value: number | null | undefined): Prisma.Decimal | null {
  if (value == null || !Number.isFinite(value)) return null;
  return new Prisma.Decimal(value);
}

function parseImportFulfillment(
  value: FormDataEntryValue | null
): "INTERNAL" | "OUTSOURCED" {
  return String(value ?? "").trim().toUpperCase() === "OUTSOURCED"
    ? "OUTSOURCED"
    : "INTERNAL";
}

function parsePurchasePaymentTermsDays(
  formData: FormData
): PaymentTermsDaysOption {
  const raw = Number(String(formData.get("paymentTermsDays") ?? "").trim());
  if (!(PAYMENT_TERMS_DAYS_OPTIONS as readonly number[]).includes(raw)) {
    throw new Error("Select Cash or Net payment terms.");
  }
  return raw as PaymentTermsDaysOption;
}

function parseHandlingHasTaxInvoice(formData: FormData): boolean | null {
  const raw = String(formData.get("handlingHasTaxInvoice") ?? "")
    .trim()
    .toLowerCase();
  if (raw === "true" || raw === "yes") return true;
  if (raw === "false" || raw === "no") return false;
  return null;
}

function parseHandlingFee(
  formData: FormData,
  required: boolean
): {
  handlingFeeIdr: number | null;
  handlingFeeIncludesPpn: boolean;
  handlingFeePpnRatePercent: number | null;
  handlingFeeAmountPaidIdr: number | null;
} {
  const raw = String(formData.get("handlingFeeIdr") ?? "").trim();
  if (!raw) {
    if (required) throw new Error("Enter the handling fee.");
    return {
      handlingFeeIdr: null,
      handlingFeeIncludesPpn: false,
      handlingFeePpnRatePercent: null,
      handlingFeeAmountPaidIdr: null,
    };
  }
  const fee = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(fee) || fee < 0) {
    throw new Error("Enter a valid handling fee.");
  }
  if (required && fee <= 0) {
    throw new Error("Enter the handling fee.");
  }
  const charged = formData.get("handlingFeeIncludesPpn") === "true";
  if (!charged) {
    return {
      handlingFeeIdr: fee,
      handlingFeeIncludesPpn: false,
      handlingFeePpnRatePercent: null,
      handlingFeeAmountPaidIdr: fee,
    };
  }
  const rate = parsePpnRatePercent(
    String(formData.get("handlingFeePpnRatePercent") ?? "")
  );
  if (rate == null) {
    throw new Error("Enter the handling fee Value Added Tax rate.");
  }
  const split = applyExclusiveVat(fee, ppnRateFromPercent(rate));
  return {
    handlingFeeIdr: split.dpp,
    handlingFeeIncludesPpn: true,
    handlingFeePpnRatePercent: rate,
    handlingFeeAmountPaidIdr: split.gross,
  };
}

function outsourcedImportPayload(payload: ImportFormPayload): ImportFormPayload {
  return {
    ...payload,
    formEApplied: false,
    beaMasukApplied: false,
    beaMasukRatePercent: 0,
    beaMasukAmountIdr: null,
    ppnbmApplied: false,
    ppnbmRatePercent: 0,
    ppnbmAmountIdr: null,
    ppnApplied: false,
    ppnAmountIdr: null,
    pph22Applied: false,
    pph22AmountIdr: null,
    clearanceCostIdr: 0,
  };
}

/** Arrival: lock factory CIF. Warehouse factory Rupiah uses the stored Booking / Bank Rate. */
function lockImportArrivalPayload(
  invoice: {
    invoiceCurrency: string | null;
    invoiceForeignAmount: Prisma.Decimal | null;
    exchangeRateToIdr: Prisma.Decimal | null;
    paidAt: Date | null;
    paymentTermsDays?: number | null;
    paidExchangeRateToIdr?: Prisma.Decimal | null;
    freightCurrency: string | null;
    freightForeignAmount: Prisma.Decimal | null;
    freightIncludedInInvoice: boolean | null;
    freightRateToIdr: Prisma.Decimal | null;
    insuranceCurrency: string | null;
    insuranceForeignAmount: Prisma.Decimal | null;
    insuranceIncludedInInvoice: boolean | null;
    insuranceRateToIdr: Prisma.Decimal | null;
    bankFeeCurrency: string | null;
    bankFeeForeignAmount: Prisma.Decimal | null;
    bankFeeIdr: Prisma.Decimal | null;
    fullAmountFeeCurrency: string | null;
    fullAmountFeeForeignAmount: Prisma.Decimal | null;
    fullAmountFeeIdr: Prisma.Decimal | null;
    localBankFeeIdr: Prisma.Decimal | null;
    declaredValue: Prisma.Decimal | null;
    declaredCurrency: string | null;
    hasCustomsFees: boolean;
  },
  payload: ImportFormPayload
): ImportFormPayload {
  const declaredValue = decimalToNumber(invoice.declaredValue) ?? 0;
  if (invoice.hasCustomsFees && declaredValue > 0) {
    const declaredCurrency = normalizeImportCurrency(
      invoice.declaredCurrency ?? payload.declaredCurrency,
      "IDR"
    );
    const declaredCustomsRate =
      declaredCurrency === "IDR"
        ? undefined
        : payload.declaredCustomsRate ||
          payload.customsRatesToIdr?.[declaredCurrency] ||
          payload.customsRateToIdr;
    return {
      ...payload,
      foreignAmount: 0,
      exchangeRateToIdr: 0,
      declaredValue,
      declaredCurrency,
      declaredCustomsRate,
      freightForeignAmount: 0,
      freightIdr: undefined,
      insuranceForeignAmount: 0,
      insuranceIdr: undefined,
      bankFeeForeignAmount: 0,
      localBankFeeIdr: 0,
    };
  }

  return {
    ...payload,
    currency: normalizeImportCurrency(
      invoice.invoiceCurrency ?? payload.currency,
      "USD"
    ),
    foreignAmount:
      decimalToNumber(invoice.invoiceForeignAmount) ?? payload.foreignAmount,
    exchangeRateToIdr: decimalToNumber(invoice.exchangeRateToIdr) ?? 0,
    freightIncludedInInvoice: invoice.freightIncludedInInvoice !== false,
    freightCurrency: invoice.freightCurrency ?? payload.freightCurrency,
    freightForeignAmount: decimalToNumber(invoice.freightForeignAmount) ?? 0,
    freightIdr: undefined,
    freightRateToIdr:
      decimalToNumber(invoice.freightRateToIdr) ?? payload.freightRateToIdr,
    freightCustomsRateToIdr: payload.freightCustomsRateToIdr,
    insuranceIncludedInInvoice: invoice.insuranceIncludedInInvoice !== false,
    insuranceCurrency: invoice.insuranceCurrency ?? payload.insuranceCurrency,
    insuranceForeignAmount: decimalToNumber(invoice.insuranceForeignAmount) ?? 0,
    insuranceIdr: undefined,
    insuranceRateToIdr:
      decimalToNumber(invoice.insuranceRateToIdr) ?? payload.insuranceRateToIdr,
    insuranceCustomsRateToIdr: payload.insuranceCustomsRateToIdr,
    ...(importRemittanceFeesGoToWarehouse(invoice)
      ? {
          bankFeeCurrency: invoice.bankFeeCurrency ?? payload.bankFeeCurrency,
          bankFeeForeignAmount:
            decimalToNumber(invoice.bankFeeForeignAmount) ?? 0,
          bankFeeIdr: decimalToNumber(invoice.bankFeeIdr) ?? undefined,
          fullAmountFeeCurrency:
            invoice.fullAmountFeeCurrency ?? payload.fullAmountFeeCurrency,
          fullAmountFeeForeignAmount:
            decimalToNumber(invoice.fullAmountFeeForeignAmount) ?? 0,
          fullAmountFeeIdr:
            decimalToNumber(invoice.fullAmountFeeIdr) ?? undefined,
          localBankFeeIdr: decimalToNumber(invoice.localBankFeeIdr) ?? 0,
        }
      : {
          bankFeeForeignAmount: 0,
          localBankFeeIdr: 0,
          fullAmountFeeForeignAmount: 0,
        }),
    declaredValue: undefined,
    declaredCurrency: undefined,
    declaredCustomsRate: undefined,
  };
}

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/jpg",
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

async function requirePurchaseTaxDocumentAccess() {
  const session = await requireSession();
  if (session.user.clientId) {
    redirect("/dashboard");
  }
  const user = toPermissionUser(session);
  if (
    !canAccess(user, "projects") &&
    !canAccess(user, "purchaseInvoices") &&
    !canAccess(user, "taxInvoices")
  ) {
    redirect("/dashboard");
  }
  return session;
}

export async function listPurchasePayoutBankAccounts() {
  const session = await requirePurchaseManageAccess();
  return listCompanyBankAccountOptions(session.user.companyId);
}

export async function listVendorBankAccountsForExpense(vendorId: string) {
  const session = await requirePurchaseManageAccess();
  const id = vendorId.trim();
  if (!id) return [];
  const vendor = await prisma.vendor.findFirst({
    where: { id, companyId: session.user.companyId, active: true },
    select: { id: true },
  });
  if (!vendor) return [];
  return prisma.vendorBankAccount.findMany({
    where: { vendorId: vendor.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      bankName: true,
      accountNumber: true,
      accountHolder: true,
      label: true,
    },
  });
}

export async function listEmployeesForExpense() {
  const session = await requirePurchaseManageAccess();
  const employees = await prisma.employee.findMany({
    where: {
      companyId: session.user.companyId,
      archivedFromDirectory: false,
      status: { in: ["ACTIVE", "ON_LEAVE", "LEAVE_PENDING"] },
    },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
      category: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ employeeNo: "asc" }],
  });
  const departments = await prisma.employeeCategory.findMany({
    where: { companyId: session.user.companyId, active: true },
    select: { id: true, name: true, slug: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return {
    employees: employees.map((employee) => ({
      id: employee.id,
      employeeNo: employee.employeeNo,
      firstName: employee.firstName,
      lastName: employee.lastName,
      department: employee.category,
    })),
    departments,
  };
}

export async function listPrepaidCardsForExpense() {
  const session = await requirePurchaseManageAccess();
  const cards = await prisma.prepaidCard.findMany({
    where: {
      companyId: session.user.companyId,
      status: { in: ["STANDBY", "ACTIVE"] },
    },
    select: {
      id: true,
      cardNumber: true,
      kind: true,
      status: true,
      currentBalance: true,
      custodianEmployee: { select: { firstName: true, lastName: true } },
      vehicleItem: {
        select: {
          name: true,
          sku: true,
          equipmentAssets: {
            select: { assetCode: true, vehicleYear: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
    },
    orderBy: { cardNumber: "asc" },
  });
  return cards.map((card) => ({
    id: card.id,
    cardNumber: card.cardNumber,
    kind: card.kind,
    status: card.status,
    currentBalance: decimalToNumber(card.currentBalance) ?? 0,
    custodianName: card.custodianEmployee
      ? `${card.custodianEmployee.firstName} ${card.custodianEmployee.lastName}`.trim()
      : null,
    vehicleName: card.vehicleItem?.name ?? null,
    vehicleSku: card.vehicleItem?.sku ?? null,
    vehiclePlate: card.vehicleItem
      ? card.vehicleItem.equipmentAssets
          .map((asset) => asset.assetCode)
          .filter(Boolean)
          .join(" / ")
      : null,
    vehicleYear:
      card.vehicleItem?.equipmentAssets.find((asset) => asset.vehicleYear != null)
        ?.vehicleYear ?? null,
  }));
}

/** Live inventory vehicles for servicing / modification / other vehicle costs. */
export async function listVehiclesForExpense() {
  const session = await requirePurchaseManageAccess();
  const assets = await prisma.equipmentAsset.findMany({
    where: {
      companyId: session.user.companyId,
      status: { not: "RETIRED" },
      item: { itemType: { equals: "Vehicle", mode: "insensitive" } },
    },
    select: {
      id: true,
      assetCode: true,
      vehicleYear: true,
      isVehicleLease: true,
      item: { select: { name: true, sku: true } },
    },
    orderBy: [{ assetCode: "asc" }, { id: "asc" }],
  });
  return assets.map((asset) => ({
    id: asset.id,
    plate: asset.assetCode,
    name: asset.item.name,
    sku: asset.item.sku,
    year: asset.vehicleYear,
    isVehicleLease: asset.isVehicleLease,
    label: formatVehicleIdentityLabel({
      plate: asset.assetCode,
      name: asset.item.name,
      sku: asset.item.sku,
      year: asset.vehicleYear,
    }),
  }));
}

export async function listCompanyBpjsVirtualAccounts() {
  const session = await requirePurchaseManageAccess();
  const company = await prisma.company.findFirst({
    where: { id: session.user.companyId },
    select: {
      bpjsKesehatanVirtualAccount: true,
      bpjsKetenagakerjaanVirtualAccount: true,
    },
  });
  return {
    kesehatan: company?.bpjsKesehatanVirtualAccount ?? "",
    ketenagakerjaan: company?.bpjsKetenagakerjaanVirtualAccount ?? "",
  };
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
  const mime = inferDocumentMime(value);
  if (mime && mime !== "application/octet-stream" && !UPLOAD_MIME.has(mime)) {
    throw new Error(opts.typeMessage);
  }
  return value;
}

function requireImageOrPdfUploads(
  formData: FormData,
  name: string,
  opts: { requiredMessage: string; sizeMessage: string; typeMessage: string }
): File[] {
  const files = formFiles(formData, name).map((file) =>
    requireImageOrPdfUpload(file, opts)
  );
  if (files.length === 0) {
    throw new Error(opts.requiredMessage);
  }
  return files;
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
  const mime = inferDocumentMime(value);
  if (mime && mime !== "application/octet-stream" && !UPLOAD_MIME.has(mime)) {
    throw new Error(opts.typeMessage);
  }
  return value;
}

function parseBillingId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Billing ID is required.");
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 12 && digits.length <= 18) return digits;
  if (trimmed.length >= 8) return trimmed;
  throw new Error("Enter a valid DJP Billing ID.");
}

function parseVirtualAccount(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Enter the virtual account number.");
  }
  const compact = trimmed.replace(/\s+/g, "");
  if (compact.length < 8 || compact.length > 32) {
    throw new Error("Enter a valid virtual account number.");
  }
  return compact;
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

function parseOptionalAmount(raw: string): Prisma.Decimal | null {
  if (!String(raw ?? "").trim()) return null;
  const amount = parseAmount(raw);
  const value = decimalToNumber(amount);
  if (value == null || value < 0) {
    throw new Error("Enter a valid amount.");
  }
  return value === 0 ? null : amount;
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

export async function createPurchaseInvoice(formData: FormData) {
  const session = await requirePurchaseManageAccess();
  const locale = await getServerLocale();
  const bankAccountId = await parseFormCompanyBankAccountId(
    formData,
    session.user.companyId,
    {
      requiredWhenAccountsExist: true,
      requiredMessage: translate(
        locale,
        "pages.billing.purchaseBankAccountRequired"
      ),
    }
  );

  const transferFeeIdr = parseOptionalAmount(
    String(formData.get("transferFeeIdr") ?? "")
  );
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
    const holderEmployeeId = String(formData.get("employeeId") ?? "").trim();
    if (!holderEmployeeId) {
      throw new Error("Select which employee receives this Petty Cash top-up.");
    }
    const holder = await prisma.employee.findFirst({
      where: {
        id: holderEmployeeId,
        companyId: session.user.companyId,
        archivedFromDirectory: false,
        status: { in: ["ACTIVE", "ON_LEAVE"] },
      },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!holder) {
      throw new Error("Select a valid employee.");
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

    const holderName = formatEmployeeName(holder);
    const topUpDescription = pettyCashTopUpDescription({
      employeeName: holderName,
      invoiceRef,
      notes: notesRaw,
    });
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
          notes: notesRaw || `Petty Cash top-up · ${holderName}`,
          includesPpn: false,
          purchaseCategory: "PETTY_CASH",
          purpose: "PETTY_CASH",
          paidAt: new Date(),
          bankAccountId,
          createdById: session.user.id,
          transferFeeIdr,
          employeeId: holder.id,
        },
      });
      await tx.pettyCashEntry.create({
        data: {
          companyId: session.user.companyId,
          kind: "TOP_UP",
          status: "POSTED",
          amount,
          entryDate: invoiceDate,
          description: topUpDescription,
          purchaseInvoiceId: invoice.id,
          createdById: session.user.id,
          postedAt: new Date(),
          proofPath: filePath || null,
          employeeId: holder.id,
          holderEmployeeId: holder.id,
        },
      });
    });

    revalidatePath("/billing/purchase-invoices");
    revalidatePath("/billing/petty-cash");
    revalidatePath("/billing/financial-report");
    return;
  }

  const vehicleExpenseKindEarly = String(formData.get("vehicleExpenseKind") ?? "")
    .trim()
    .toUpperCase();
  const openCardTopUpEarly = String(formData.get("openCardTopUp") ?? "") === "1";
  if (
    (purchaseCategoryRawEarly === "VEHICLE" &&
      vehicleExpenseKindEarly === "PREPAID_CARD") ||
    openCardTopUpEarly
  ) {
    if (session.user.vendorId) {
      throw new Error("Prepaid card top-ups are recorded by Head Office only.");
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
    const prepaidCardId = String(formData.get("prepaidCardId") ?? "").trim();
    if (!prepaidCardId) {
      throw new Error("Choose the prepaid card to top up.");
    }
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const invoiceDate = taxInvoiceDateToUtcDate(invoiceDateRaw);
    const selectedCard = await prisma.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
      select: { id: true, kind: true, cardNumber: true, status: true },
    });
    if (!selectedCard) {
      throw new Error("Choose the prepaid card to top up.");
    }
    if (openCardTopUpEarly && selectedCard.kind !== "OPEN") {
      throw new Error("Choose an Open Card to top up.");
    }
    if (
      purchaseCategoryRawEarly === "VEHICLE" &&
      vehicleExpenseKindEarly === "PREPAID_CARD" &&
      selectedCard.kind !== "VEHICLE"
    ) {
      throw new Error("Choose a Vehicle Card to top up.");
    }
    const isOpen = selectedCard.kind === "OPEN";
    const invoiceRef = nextPettyCashTopUpRef().replace(
      /^PC-/,
      isOpen ? "OPC-" : "PPC-"
    );
    const file = optionalImageOrPdfUpload(formData.get("document"), {
      sizeMessage: "File must be 10 MB or smaller.",
      typeMessage: "Upload an image or PDF.",
    });
    const filePath = file
      ? await saveUpload(file, "uploads/purchase-invoices", {
          fileBaseName: buildBillingDocumentFileBase({
            prefix: "Prepaid-Card-Top-Up",
            clientName: "Prepaid Card",
            invoiceNumber: invoiceRef,
          }),
        })
      : "";

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.create({
        data: {
          companyId: session.user.companyId,
          supplierName: "Prepaid Card",
          vendorId: null,
          invoiceRef,
          invoiceDate,
          amount,
          filePath,
          notes: notesRaw || prepaidTopUpLabel(selectedCard.kind, selectedCard.cardNumber),
          includesPpn: false,
          purchaseCategory: isOpen ? "SERVICE" : "VEHICLE",
          purpose: isOpen ? "INTERNAL" : "STOCK",
          paidAt: new Date(),
          bankAccountId,
          createdById: session.user.id,
          transferFeeIdr,
          prepaidCardId: selectedCard.id,
        },
      });
      await creditPrepaidCardFromExpense(tx, {
        companyId: session.user.companyId,
        userId: session.user.id,
        prepaidCardId: selectedCard.id,
        amount,
        invoiceRef,
        invoiceDate,
        notes: notesRaw,
        filePath,
        purchaseInvoiceId: invoice.id,
      });
    });

    revalidatePath("/billing/purchase-invoices");
    revalidatePath("/billing/petty-cash");
    revalidatePath("/billing/financial-report");
    return;
  }

  if (purchaseCategoryRawEarly === "GOVERNMENT") {
    if (session.user.vendorId) {
      throw new Error("Government bills are recorded by Head Office only.");
    }
    const governmentTaxKind = parseGovernmentTaxKind(
      formData.get("governmentTaxKind")
    );
    const isBpjs = isBpjsGovernmentKind(governmentTaxKind);
    const invoiceRef = isBpjs
      ? parseVirtualAccount(String(formData.get("invoiceRef") ?? ""))
      : parseBillingId(String(formData.get("invoiceRef") ?? ""));
    const notesRaw = String(formData.get("notes") ?? "").trim();
    if (!notesRaw && !isBpjs) {
      throw new Error("Describe what this government bill is for.");
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
    const invoiceDate = taxInvoiceDateToUtcDate(invoiceDateRaw);
    const supplierName = governmentPayeeName(governmentTaxKind);
    const file = requireImageOrPdfUpload(formData.get("document"), {
      requiredMessage: isBpjs
        ? "Upload the payment proof."
        : "Upload the billing notice or payment invoice.",
      sizeMessage: "File must be 10 MB or smaller.",
      typeMessage: "Upload an image or PDF.",
    });
    const filePath = await saveUpload(file, "uploads/purchase-invoices", {
      fileBaseName: buildBillingDocumentFileBase({
        prefix: isBpjs ? "BPJS" : "Government-Billing",
        clientName: supplierName,
        invoiceNumber: invoiceRef,
      }),
    });

    let governmentOperatingAmount: Prisma.Decimal | null = null;
    let bpjsYear: number | null = null;
    let bpjsMonth: number | null = null;
    let bpjsCompanyShare = 0;
    if (isBpjs) {
      const year = Number(String(formData.get("bpjsYear") ?? "").trim());
      const month = Number(String(formData.get("bpjsMonth") ?? "").trim());
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw new Error("Enter the contribution year.");
      }
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error("Enter the contribution month.");
      }
      bpjsYear = year;
      bpjsMonth = month;
      const period = await getBpjsFinancePeriod(
        session.user.companyId,
        year,
        month
      );
      const program = bpjsProgramFromGovernmentKind(governmentTaxKind);
      const line = period.lines.find((row) => row.program === program);
      if (!line) {
        bpjsCompanyShare = invoiceAmount;
      } else if (line.companyDue > 0) {
        bpjsCompanyShare = Math.min(invoiceAmount, line.companyDue);
      } else if (line.remaining > 0) {
        bpjsCompanyShare = 0;
      } else {
        bpjsCompanyShare = invoiceAmount;
      }
      governmentOperatingAmount = new Prisma.Decimal(bpjsCompanyShare);
    }

    const notes =
      notesRaw ||
      (isBpjs && bpjsYear != null && bpjsMonth != null
        ? `${supplierName} ${String(bpjsYear)}-${String(bpjsMonth).padStart(2, "0")}`
        : notesRaw);

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.create({
        data: {
          companyId: session.user.companyId,
          supplierName,
          vendorId: null,
          invoiceRef,
          invoiceDate,
          amount,
          filePath,
          notes,
          includesPpn: false,
          purchaseCategory: "GOVERNMENT",
          governmentTaxKind,
          governmentOperatingAmount,
          purpose: "INTERNAL",
          origin: "LOCAL",
          paidAt: new Date(),
          bankAccountId,
          createdById: session.user.id,
          transferFeeIdr,
        },
      });
      if (isBpjs && bpjsYear != null && bpjsMonth != null) {
        await tx.bpjsRemittance.create({
          data: {
            companyId: session.user.companyId,
            year: bpjsYear,
            month: bpjsMonth,
            program: bpjsProgramFromGovernmentKind(governmentTaxKind),
            amount,
            paidAt: invoiceDate,
            reference: invoiceRef,
            notes,
            createdById: session.user.id,
            purchaseInvoiceId: invoice.id,
            companyShareAmount: new Prisma.Decimal(bpjsCompanyShare),
          },
        });
        if (invoiceRef) {
          await tx.company.update({
            where: { id: session.user.companyId },
            data:
              governmentTaxKind === "BPJS_KESEHATAN"
                ? { bpjsKesehatanVirtualAccount: invoiceRef }
                : { bpjsKetenagakerjaanVirtualAccount: invoiceRef },
          });
        }
        if (governmentTaxKind === "BPJS_KESEHATAN") {
          await releaseBpjsKesehatanHeldShare(tx, session.user.companyId);
        }
      }
    });

    revalidatePath("/billing/purchase-invoices");
    revalidatePath("/billing/tax-invoices");
    revalidatePath("/billing/financial-report");
    revalidatePath("/billing/bpjs");
    revalidatePath("/billing/bpjs/kesehatan");
    revalidatePath("/billing/bpjs/ketenagakerjaan");
    return;
  }

  if (purchaseCategoryRawEarly === "BANK_LOAN") {
    if (session.user.vendorId) {
      throw new Error("Loan payments are recorded by Head Office only.");
    }
    const facilityId = String(formData.get("loanFacilityId") ?? "").trim();
    if (!facilityId) {
      throw new Error("Select the registered loan.");
    }
    const facility = await getLoanFacilitySnapshot(
      session.user.companyId,
      facilityId
    );
    if (!facility) {
      throw new Error("Register the loan under Finance → Loans first.");
    }
    const paymentPurpose = parseLoanPaymentPurpose(
      formData.get("loanPaymentPurpose")
    );
    const invoiceRefRaw = String(formData.get("invoiceRef") ?? "").trim();
    if (
      facility.source === "BANK" &&
      !invoiceRefRaw &&
      !isLoanFeePurpose(paymentPurpose)
    ) {
      throw new Error("Enter the loan account or bank reference.");
    }
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const amount = parseAmount(String(formData.get("amount") ?? "").trim());
    const invoiceAmount = decimalToNumber(amount);
    if (invoiceAmount == null || invoiceAmount <= 0) {
      throw new Error("Enter a valid amount.");
    }
    const invoiceDateRaw = String(formData.get("invoiceDate") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDateRaw)) {
      throw new Error("Date is required.");
    }
    const invoiceDate = taxInvoiceDateToUtcDate(invoiceDateRaw);
    const invoiceRef =
      invoiceRefRaw ||
      (facility.source === "SHAREHOLDER"
        ? shareholderLoanInvoiceRef(invoiceDate)
        : invoiceRefRaw);
    const file = requireImageOrPdfUpload(formData.get("document"), {
      requiredMessage: "Upload the payment proof.",
      sizeMessage: "File must be 10 MB or smaller.",
      typeMessage: "Upload an image or PDF.",
    });
    const filePath = await saveUpload(file, "uploads/purchase-invoices", {
      fileBaseName: buildBillingDocumentFileBase({
        prefix: "Bank-Loan",
        clientName: facility.lenderName,
        invoiceNumber: invoiceRef || facility.name,
      }),
    });

    if (isLoanFeePurpose(paymentPurpose)) {
      if (facility.source !== "BANK") {
        throw new Error(
          "Bank Provision and Bank Admin Fee are only for a Bank Loan."
        );
      }
    } else if (facility.source === "BANK" && !paymentPurpose) {
      throw new Error("Choose what this payment is for.");
    } else if (paymentPurpose === "INTEREST" && facility.kind !== "STANDBY") {
      throw new Error("Interest is for a Standby Loan.");
    } else if (paymentPurpose === "INSTALLMENT" && facility.kind !== "TERM") {
      throw new Error("Installment is for a Term Loan.");
    }

    await prisma.$transaction(async (tx) => {
      if (isLoanFeePurpose(paymentPurpose)) {
        await createLoanFeePayment({
          db: tx,
          companyId: session.user.companyId,
          userId: session.user.id,
          facilityId: facility.id,
          amount: invoiceAmount,
          feeKind: paymentPurpose,
          transferFeeIdr: decimalToNumber(transferFeeIdr),
          movementDate: invoiceDate,
          bankAccountId,
          invoiceRef,
          filePath,
          notes: notesRaw,
        });
      } else {
        await createLoanRepayment({
          db: tx,
          companyId: session.user.companyId,
          userId: session.user.id,
          facilityId: facility.id,
          amount: invoiceAmount,
          transferFeeIdr: decimalToNumber(transferFeeIdr),
          movementDate: invoiceDate,
          bankAccountId,
          invoiceRef,
          filePath,
          notes: notesRaw,
          standbyPayment: facility.kind === "STANDBY" ? "INTEREST" : null,
        });
      }
    });

    revalidatePath("/billing/purchase-invoices");
    revalidatePath("/billing/financial-report");
    revalidatePath("/billing/loans");
    revalidatePath(`/billing/loans/${facility.id}`);
    return;
  }

  if (purchaseCategoryRawEarly === "EMPLOYEE_PAYMENT") {
    if (session.user.vendorId) {
      throw new Error("Employee payments are recorded by Head Office only.");
    }
    const kindRaw = String(formData.get("employeePaymentKind") ?? "")
      .trim()
      .toUpperCase();
    const employeePaymentKind =
      kindRaw === "INTERNAL_PAYROLL" ||
      kindRaw === "THR" ||
      kindRaw === "CASH_ADVANCE"
        ? kindRaw
        : null;
    if (!employeePaymentKind) {
      throw new Error(
        translate(locale, "pages.billing.employeePaymentKindRequired")
      );
    }
    const amount = parseAmount(String(formData.get("amount") ?? "").trim());
    const invoiceAmount = decimalToNumber(amount);
    if (invoiceAmount == null || invoiceAmount <= 0) {
      throw new Error("Enter a valid amount.");
    }
    const invoiceDateRaw = String(formData.get("invoiceDate") ?? "").trim();
    const invoiceDate = /^\d{4}-\d{2}-\d{2}$/.test(invoiceDateRaw)
      ? taxInvoiceDateToUtcDate(invoiceDateRaw)
      : taxInvoiceDateToUtcDate(
          new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
        );
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const employeeId = String(formData.get("employeeId") ?? "").trim();
    const nextPayroll = await nextOpenWagePayrollPeriod(
      session.user.companyId
    );
    const year = nextPayroll.year;
    const month = nextPayroll.month;
    let employeeName = "Employee Payments";
    if (employeePaymentKind === "CASH_ADVANCE") {
      if (!employeeId) {
        throw new Error(
          translate(locale, "pages.billing.employeePaymentEmployeeRequired")
        );
      }
      const employee = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          companyId: session.user.companyId,
          archivedFromDirectory: false,
        },
        select: { id: true, firstName: true, lastName: true, employeeNo: true },
      });
      if (!employee) {
        throw new Error(
          translate(locale, "pages.billing.employeePaymentEmployeeRequired")
        );
      }
      employeeName = `${employee.firstName} ${employee.lastName}`.trim();
    }
    if (
      employeePaymentKind !== "THR" &&
      (!Number.isInteger(year) ||
        year < 2000 ||
        year > 2100 ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12)
    ) {
      throw new Error("Enter the payroll month and year.");
    }
    const file = requireImageOrPdfUpload(formData.get("document"), {
      requiredMessage: "Upload the payment proof.",
      sizeMessage: "File must be 10 MB or smaller.",
      typeMessage: "Upload an image or PDF.",
    });
    const supplierName =
      employeePaymentKind === "INTERNAL_PAYROLL"
        ? "Internal Payroll"
        : employeePaymentKind === "THR"
          ? "THR"
          : employeeName;
    const invoiceDateKey =
      /^\d{4}-\d{2}-\d{2}$/.test(invoiceDateRaw)
        ? invoiceDateRaw
        : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const invoiceRef =
      String(formData.get("invoiceRef") ?? "").trim() ||
      `${employeePaymentKind}-${invoiceDateKey}`;
    const filePath = await saveUpload(file, "uploads/purchase-invoices", {
      fileBaseName: buildBillingDocumentFileBase({
        prefix: "Employee-Payment",
        clientName: supplierName,
        invoiceNumber: invoiceRef,
      }),
    });
    const notes =
      notesRaw ||
      (employeePaymentKind === "CASH_ADVANCE"
        ? `Cash advance ${employeeName}`
        : supplierName);

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.create({
        data: {
          companyId: session.user.companyId,
          supplierName,
          vendorId: null,
          invoiceRef,
          invoiceDate,
          amount,
          filePath,
          notes,
          includesPpn: false,
          purchaseCategory: "EMPLOYEE_PAYMENT",
          employeePaymentKind,
          employeeId: employeePaymentKind === "CASH_ADVANCE" ? employeeId : null,
          purpose: "INTERNAL",
          origin: "LOCAL",
          paidAt: new Date(),
          bankAccountId,
          createdById: session.user.id,
          transferFeeIdr,
        },
      });
      if (employeePaymentKind === "CASH_ADVANCE") {
        await tx.payrollDeduction.create({
          data: {
            companyId: session.user.companyId,
            employeeId,
            year,
            month,
            type: "CASH_ADVANCE",
            amount,
            reason: notes,
            createdById: session.user.id,
            purchaseInvoiceId: invoice.id,
          },
        });
      }
    });

    revalidatePath("/billing/purchase-invoices");
    revalidatePath("/billing/payroll");
    revalidatePath("/payslips");
    revalidatePath("/billing/financial-report");
    return;
  }

  let supplierName = String(formData.get("supplierName") ?? "").trim();
  const vendorIdRaw = String(formData.get("vendorId") ?? "").trim();
  let invoiceRef = String(formData.get("invoiceRef") ?? "").trim();
  let invoiceDateRaw = String(formData.get("invoiceDate") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const linesRaw = String(formData.get("linesJson") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  let includesPpn =
    formData.get("includesPpn") === "on" ||
    formData.get("includesPpn") === "true";
  const purchaseCategory = parsePurchaseCategory(
    formData.get("purchaseCategory")
  );
  if (
    purchaseCategory === "PETTY_CASH" ||
    purchaseCategory === "GOVERNMENT" ||
    purchaseCategory === "BANK_LOAN" ||
    purchaseCategory === "EMPLOYEE_PAYMENT"
  ) {
    throw new Error("Use the dedicated form for this expense type.");
  }
  const originRaw = String(formData.get("purchaseOrigin") ?? "LOCAL")
    .trim()
    .toUpperCase();
  const freeOfCharge =
    (purchaseCategory === "PRODUCT" || purchaseCategory === "SERVICE") &&
    (formData.get("freeOfCharge") === "on" ||
      formData.get("freeOfCharge") === "true");
  const freeOfChargeReason = freeOfCharge
    ? capitalizeProper(
        String(formData.get("freeOfChargeReason") ?? "").trim()
      )
    : "";
  if (freeOfCharge && !freeOfChargeReason) {
    throw new Error("Enter the reason this purchase is free of charge.");
  }
  const hasInvoice = !freeOfCharge || formFlagTrue(formData, "hasInvoice");
  const focShipping = freeOfCharge
    ? parseFocShipping(
        formData,
        purchaseCategory === "SERVICE"
          ? "Enter the Bank Rate for this related cost."
          : "Enter the Bank Rate for this shipping cost."
      )
    : {
        currency: null,
        foreignAmount: null,
        rateToIdr: null,
        idr: null,
      };
  const focRelatedCostDescription =
    freeOfCharge &&
    purchaseCategory === "SERVICE" &&
    (focShipping.idr ?? 0) > 0
      ? titleCaseWords(String(formData.get("shippingDescription") ?? "").trim())
      : null;
  if (
    freeOfCharge &&
    purchaseCategory === "SERVICE" &&
    (focShipping.idr ?? 0) > 0 &&
    !focRelatedCostDescription
  ) {
    throw new Error("Enter what this related cost is.");
  }
  const requestedImport =
    purchaseCategory === "PRODUCT" && originRaw === "IMPORT";
  const hasCustomsFees =
    freeOfCharge &&
    purchaseCategory === "PRODUCT" &&
    requestedImport &&
    formFlagTrue(formData, "hasCustomsFees");
  if (!hasInvoice) {
    invoiceRef = "";
    invoiceDateRaw = /^\d{4}-\d{2}-\d{2}$/.test(invoiceDateRaw)
      ? invoiceDateRaw
      : todayDateInput();
  }
  const origin =
    hasCustomsFees ||
    (!freeOfCharge &&
      purchaseCategory === "PRODUCT" &&
      originRaw === "IMPORT")
      ? "IMPORT"
      : "LOCAL";
  const vehicleExpenseKindRaw = String(formData.get("vehicleExpenseKind") ?? "")
    .trim()
    .toUpperCase();
  const isVehiclePurchase =
    purchaseCategory === "VEHICLE" && vehicleExpenseKindRaw === "PURCHASE";
  const isVehicleOperatingCost =
    purchaseCategory === "VEHICLE" &&
    isVehicleOperatingExpenseKind(vehicleExpenseKindRaw);
  const vehicleLease = isVehiclePurchase
    ? parseVehicleLeaseFromForm(formData)
    : parseVehicleLeaseFromForm(new FormData());
  const leasedCashOut =
    isVehiclePurchase && vehicleLease.isVehicleLease
      ? calculateVehicleLease({
          otrAmount: vehicleLease.otrAmount ?? 0,
          downPayment: vehicleLease.downPayment ?? 0,
          tenorMonths: vehicleLease.tenorMonths ?? 0,
          interestPercentYear: vehicleLease.interestPercentYear ?? 0,
          adminFee: vehicleLease.adminFee ?? 0,
          insuranceAmount: vehicleLease.insuranceAmount ?? 0,
          fiduciaryFee: vehicleLease.fiduciaryFee ?? 0,
          provisionFee: vehicleLease.provisionFee ?? 0,
          otherFee: vehicleLease.otherFee ?? 0,
        })?.upfrontAmount ?? null
      : null;
  const purpose = resolvePurchasePurpose({
    category: purchaseCategory,
    requested: parsePurchasePurpose(formData.get("purchasePurpose")),
    vehicleExpenseKind: vehicleExpenseKindRaw,
  });
  const projectIdRaw =
    purchaseCategory === "SERVICE"
      ? String(formData.get("projectId") ?? "").trim()
      : "";
  const ppnRateRaw = String(formData.get("ppnRatePercent") ?? "").trim();

  const portalVendorId = session.user.vendorId ?? null;
  let lines = parsePurchaseLinesJson(linesRaw, {
    requireCatalogItem:
      purchaseCategory === "PRODUCT" || isVehiclePurchase,
  });
  if (isVehiclePurchase || purchaseCategory === "SERVICE") {
    lines = lines.map((line) => ({ ...line, quantity: 1 }));
  }
  if (freeOfCharge && !hasCustomsFees) {
    includesPpn = false;
    lines = lines.map((line) => ({ ...line, unitPrice: 0 }));
    if ((focShipping.idr ?? 0) > 0 && lines.length > 0) {
      const allocated = allocateImportStockCost({
        stockLandedCostIdr: focShipping.idr ?? 0,
        headerForeignAmount: 0,
        lines: lines.map((line) => ({ quantity: line.quantity })),
      });
      lines = lines.map((line, index) => ({
        ...line,
        unitPrice: allocated[index]?.unitCostIdr ?? 0,
      }));
    }
  }
  const paymentTermsDays =
    freeOfCharge || purchaseCategory === "VEHICLE"
      ? 0
      : parsePurchasePaymentTermsDays(formData);
  const invoicePaidNow =
    freeOfCharge || isCashPaymentTerms(paymentTermsDays);
  const importFulfillment =
    origin === "IMPORT"
      ? parseImportFulfillment(formData.get("importFulfillment"))
      : null;
  const rawHandlingVendorId =
    origin === "IMPORT"
      ? String(formData.get("handlingVendorId") ?? "").trim()
      : "";
  const importDutiesBillingId =
    (origin === "IMPORT" && importFulfillment === "INTERNAL") || hasCustomsFees
      ? String(formData.get("importDutiesBillingId") ?? "").trim()
      : "";
  const recordingImportArrivalNow =
    origin === "IMPORT" && Boolean(importDutiesBillingId);
  const importPaidItems =
    origin === "IMPORT"
      ? recordingImportArrivalNow
        ? invoicePaidNow
          ? "BOTH"
          : "DUTIES"
        : "INVOICE"
      : null;
  const handledByHeadOffice =
    origin === "IMPORT" &&
    importFulfillment === "INTERNAL" &&
    isHandlingByHeadOffice(rawHandlingVendorId);
  if (
    origin === "IMPORT" &&
    importFulfillment === "OUTSOURCED" &&
    isHandlingByHeadOffice(rawHandlingVendorId)
  ) {
    throw new Error("Select the Handling Vendor.");
  }
  const handling =
    origin === "IMPORT" && !handledByHeadOffice
      ? parseHandlingFee(
          formData,
          recordingImportArrivalNow && importFulfillment === "OUTSOURCED"
        )
      : {
          handlingFeeIdr: null,
          handlingFeeIncludesPpn: false,
          handlingFeePpnRatePercent: null,
          handlingFeeAmountPaidIdr: null,
        };
  const handlingHasTaxInvoice =
    origin === "IMPORT" ? parseHandlingHasTaxInvoice(formData) : null;
  const hasHandlingNow =
    handledByHeadOffice ||
    (handling.handlingFeeIdr != null && handling.handlingFeeIdr > 0) ||
    Boolean(rawHandlingVendorId);
  const handlingLaterWithDuties =
    origin === "IMPORT" &&
    importFulfillment === "INTERNAL" &&
    !recordingImportArrivalNow &&
    !hasHandlingNow;

  let importPayload: ImportFormPayload | null = null;
  let importResult: ImportLandedCostResult | null = null;
  let importStockLandedCostIdr: number | null = null;
  if (origin === "IMPORT") {
    const importJsonRaw = String(formData.get("importJson") ?? "").trim();
    if (!importJsonRaw) {
      if (!freeOfCharge) {
        throw new Error("Enter the overseas factory invoice amount.");
      }
    } else {
    importPayload = parseImportFormPayload(importJsonRaw, {
      requireCustomsRates: recordingImportArrivalNow,
      requireBankRate: !freeOfCharge && !hasCustomsFees,
    });
    if (!isCashPaymentTerms(paymentTermsDays)) {
      importPayload = {
        ...importPayload,
        bankFeeForeignAmount: 0,
        localBankFeeIdr: 0,
        bankFeeIdr: undefined,
      };
    }
    if (importFulfillment === "OUTSOURCED") {
      importPayload = outsourcedImportPayload(importPayload);
    }
    importResult = calculateImportLandedCost(importPayload);
    if (
      recordingImportArrivalNow &&
      hasCustomsFees &&
      (importPayload.declaredValue == null || importPayload.declaredValue <= 0)
    ) {
      throw new Error("Enter the declared value.");
    }
    includesPpn =
      importFulfillment === "INTERNAL" ? importResult.ppnApplied : false;
    importStockLandedCostIdr =
      (focShipping.idr ?? 0) +
      importResult.stockLandedCostIdr +
      (handling.handlingFeeIdr ?? 0);
    const allocated = allocateImportStockCost({
      stockLandedCostIdr: importStockLandedCostIdr,
      headerForeignAmount: importPayload.foreignAmount,
      lines: lines.map((line) => ({
        quantity: line.quantity,
        foreignAmount: line.foreignAmount,
      })),
    });
    lines = lines.map((line, index) => ({
      ...line,
      unitPrice: allocated[index]?.unitCostIdr ?? 0,
    }));
    }
  }

  let includedTaxKind: CommercialTaxKind | null = null;
  let pphRatePercentValue: number | null = null;
  let otherTaxName: string | null = null;
  if (origin !== "IMPORT") {
    const taxIncluded = includesPpn;
    if (taxIncluded) {
      includedTaxKind = parseCommercialTaxKind(formData.get("includedTaxKind"));
      includesPpn = commercialTaxIncludesVat(includedTaxKind);
      otherTaxName = parseOtherTaxName(
        formData.get("otherTaxName"),
        includedTaxKind
      );
      if (commercialTaxRequiresRatePercent(includedTaxKind)) {
        pphRatePercentValue = parseCommercialPphRatePercent(
          formData.get("pphRatePercent")
        );
      }
    } else {
      includesPpn = false;
    }
  }
  // HO purchases must specify catalog lines except vehicle operating costs
  // (servicing / modification / other), which use a single amount + inventory vehicle.
  if (!portalVendorId && lines.length === 0 && !isVehicleOperatingCost) {
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
      select: { id: true, name: true, vendorType: true },
    });
    if (!vendor) {
      throw new Error("Select a registered vendor.");
    }
    if (!vendorMatchesPurchaseOrigin(vendor.vendorType, origin)) {
      throw new Error(
        origin === "IMPORT"
          ? "Imported From Overseas only uses an Overseas vendor."
          : "Bought Locally only uses a Company or Individual vendor."
      );
    }
    vendorId = vendor.id;
    supplierName = vendor.name;
  }

  if (!vendorId || !supplierName) {
    throw new Error("Select a registered vendor.");
  }
  const vendorBankAccountIdRaw = String(
    formData.get("vendorBankAccountId") ?? ""
  ).trim();
  const vendorBanks = await prisma.vendorBankAccount.findMany({
    where: { vendorId },
    select: { id: true },
  });
  let vendorBankAccountId: string | null = null;
  if (vendorBanks.length === 0) {
    throw new Error(translate(locale, "pages.billing.payToAccountEmpty"));
  }
  if (
    !vendorBankAccountIdRaw ||
    !vendorBanks.some((account) => account.id === vendorBankAccountIdRaw)
  ) {
    throw new Error(
      translate(locale, "pages.billing.payToAccountRequired")
    );
  }
  vendorBankAccountId = vendorBankAccountIdRaw;
  if (hasInvoice && !invoiceRef) {
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
  if (hasInvoice && !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDateRaw)) {
    throw new Error("Invoice Date is required.");
  }
  if (!hasInvoice && !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDateRaw)) {
    invoiceDateRaw = todayDateInput();
  }

  const file = hasInvoice
    ? requireImageOrPdfUpload(formData.get("document"), {
        requiredMessage: "Upload the purchase invoice document.",
        sizeMessage: "File must be 10 MB or smaller.",
        typeMessage: "Upload an image or PDF.",
      })
    : optionalImageOrPdfUpload(formData.get("document"), {
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
  let taxInvoiceSerial: string | null = null;
  if (taxFile) {
    requireTaxInvoiceSerialVerified(formData.get("taxInvoiceSerialVerified"));
    taxInvoiceSerial = parseRequiredTaxInvoiceSerial(
      formData.get("taxInvoiceSerial")
    );
  }

  const invoiceDate = taxInvoiceDateToUtcDate(invoiceDateRaw);

  let lineTotal = 0;
  if (lines.length > 0) {
    const itemIds = [
      ...new Set(
        lines
          .map((line) => line.itemId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    if (purchaseCategory === "PRODUCT" || isVehiclePurchase) {
      const catalog = await prisma.inventoryItem.findMany({
        where: {
          companyId: session.user.companyId,
          id: { in: itemIds },
          active: true,
          deletedAt: null,
        },
        select: { id: true, tracksStock: true, itemType: true },
      });
      if (catalog.length !== itemIds.length) {
        throw new Error("One or more items are missing from the catalog.");
      }
      if (isVehiclePurchase) {
        if (lines.length !== 1) {
          throw new Error(
            "Record one vehicle per expense. Use a separate expense for each number plate."
          );
        }
        if (catalog.some((item) => !isVehicleItemType(item.itemType))) {
          throw new Error("Choose a Vehicle type from Goods Catalog.");
        }
      } else if (catalog.some((item) => isVehicleItemType(item.itemType))) {
        throw new Error("Record vehicles under the Vehicle expense type.");
      }
    }
    lineTotal = lines.reduce(
      (sum, line) => sum + line.quantity * line.unitPrice,
      0
    );
    if (lineTotal < 0 || !Number.isFinite(lineTotal)) {
      throw new Error("Enter a valid amount.");
    }
  }

  const amount = freeOfCharge
    ? new Prisma.Decimal(
        Math.round((hasCustomsFees ? 0 : focShipping.idr ?? 0) * 100) / 100
      )
    : origin === "IMPORT" && importResult
      ? new Prisma.Decimal(importResult.invoiceAmountIdr)
      : leasedCashOut != null && leasedCashOut > 0
        ? new Prisma.Decimal(Math.round(leasedCashOut * 100) / 100)
      : lines.length > 0
        ? new Prisma.Decimal(Math.round(lineTotal * 100) / 100)
        : parseAmount(amountRaw);
  const invoiceAmount = decimalToNumber(amount);
  if (invoiceAmount == null) {
    throw new Error("Enter a valid amount.");
  }

  let ppnRatePercent: number | null = null;
  if (includesPpn) {
    ppnRatePercent =
      origin === "IMPORT" && importResult
        ? importResult.ppnRatePercent
        : parsePpnRatePercent(ppnRateRaw);
    if (ppnRatePercent == null) {
      throw new Error("Enter the tax rate percent for this purchase.");
    }
    if (origin !== "IMPORT") {
      assertInclusiveCreditableTax(
        invoiceAmount,
        ppnRateFromPercent(ppnRatePercent)
      );
    }
  }

  const taxInvoiceManualReason = taxFile
    ? parseOptionalManualVerifyReason(formData.get("manualReason"))
    : null;

  const filePath = file
    ? await saveUpload(file, "uploads/purchase-invoices", {
        fileBaseName: buildBillingDocumentFileBase({
          prefix: "Purchase-Invoice",
          clientName: supplierName,
          invoiceNumber: invoiceRef || "No-Invoice",
        }),
      })
    : "";

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

  const handlingVendorId = handledByHeadOffice ? "" : rawHandlingVendorId;

  if (recordingImportArrivalNow && hasCustomsFees && !importDutiesBillingId) {
    throw new Error("Enter the Import Duties Billing ID.");
  }
  if (
    recordingImportArrivalNow &&
    origin === "IMPORT" &&
    importFulfillment === "INTERNAL"
  ) {
    if (!importDutiesBillingId) {
      throw new Error("Enter the Import Duties Billing ID.");
    }
    if (
      !handlingLaterWithDuties &&
      !handledByHeadOffice &&
      !handlingVendorId
    ) {
      throw new Error("Select the Handling Vendor or Handled By Head Office.");
    }
  }
  if (
    recordingImportArrivalNow &&
    origin === "IMPORT" &&
    importFulfillment === "OUTSOURCED"
  ) {
    if (!handlingLaterWithDuties && !handlingVendorId) {
      throw new Error("Select the Handling Vendor.");
    }
  }
  if (
    origin === "IMPORT" &&
    !handlingLaterWithDuties &&
    handling.handlingFeeIdr != null &&
    handling.handlingFeeIdr > 0 &&
    !handlingVendorId
  ) {
    throw new Error("Select the Handling Vendor.");
  }
  if (handlingVendorId) {
    const handlingVendor = await prisma.vendor.findFirst({
      where: {
        id: handlingVendorId,
        companyId: session.user.companyId,
        active: true,
      },
      select: { id: true, vendorType: true },
    });
    if (!handlingVendor) {
      throw new Error("Select the Handling Vendor.");
    }
    if (!vendorMatchesPurchaseOrigin(handlingVendor.vendorType, "LOCAL")) {
      throw new Error(
        "The Handling Vendor must be a Company or Individual."
      );
    }
  }

  let importDutiesFilePath: string | null = null;
  const dutiesFile =
    recordingImportArrivalNow &&
    origin === "IMPORT" &&
    importFulfillment === "INTERNAL"
      ? requireImageOrPdfUpload(formData.get("importDutiesDocument"), {
          requiredMessage: "Upload the Import Duties invoice.",
          sizeMessage: "Import duties file must be 10 MB or smaller.",
          typeMessage: "Upload an image or PDF for the Import Duties invoice.",
        })
      : recordingImportArrivalNow && hasCustomsFees
        ? requireImageOrPdfUpload(formData.get("importDutiesDocument"), {
            requiredMessage:
              "Upload the tax invoice or Billing ID document for these duties.",
            sizeMessage: "Import duties file must be 10 MB or smaller.",
            typeMessage:
              "Upload an image or PDF for the tax invoice or Billing ID document.",
          })
        : optionalImageOrPdfUpload(formData.get("importDutiesDocument"), {
            sizeMessage: "Import duties file must be 10 MB or smaller.",
            typeMessage: "Upload an image or PDF for the Import Duties invoice.",
          });
  if (dutiesFile) {
    importDutiesFilePath = await saveUpload(
      dutiesFile,
      "uploads/purchase-invoices",
      {
        fileBaseName: buildBillingDocumentFileBase({
          prefix: "Import-Duties",
          clientName: supplierName,
          invoiceNumber: invoiceRef,
        }),
      }
    );
  }

  let handlingFeeTaxInvoicePath: string | null = null;
  const requireHandlingInvoice =
    !handlingLaterWithDuties &&
    recordingImportArrivalNow &&
    origin === "IMPORT" &&
    (importFulfillment === "OUTSOURCED" ||
      (handling.handlingFeeIdr != null && handling.handlingFeeIdr > 0));
  const handlingFeeFile =
    requireHandlingInvoice
      ? requireImageOrPdfUpload(formData.get("handlingFeeDocument"), {
          requiredMessage: "Upload the Handling Fee invoice.",
          sizeMessage: "Handling Fee invoice must be 10 MB or smaller.",
          typeMessage: "Upload an image or PDF for the Handling Fee invoice.",
        })
      : origin === "IMPORT"
        ? optionalImageOrPdfUpload(formData.get("handlingFeeDocument"), {
            sizeMessage: "Handling Fee invoice must be 10 MB or smaller.",
            typeMessage: "Upload an image or PDF for the Handling Fee invoice.",
          })
        : null;
  if (handlingFeeFile) {
    handlingFeeTaxInvoicePath = await saveUpload(
      handlingFeeFile,
      "uploads/purchase-invoices",
      {
        fileBaseName: buildBillingDocumentFileBase({
          prefix: "Import-Handling",
          clientName: supplierName,
          invoiceNumber: invoiceRef,
        }),
      }
    );
  }

  if (origin === "IMPORT") {
    const handlingTaxFile = handling.handlingFeeIncludesPpn
      ? requireImageOrPdfUpload(formData.get("handlingFeeTaxDocument"), {
          requiredMessage: "Upload the tax invoice for the handling fee.",
          sizeMessage: "Handling tax invoice must be 10 MB or smaller.",
          typeMessage: "Upload an image or PDF for the handling tax invoice.",
        })
      : optionalImageOrPdfUpload(formData.get("handlingFeeTaxDocument"), {
          sizeMessage: "Handling tax invoice must be 10 MB or smaller.",
          typeMessage: "Upload an image or PDF for the handling tax invoice.",
        });
    if (handlingTaxFile) {
      taxInvoiceFilePath = await saveUpload(
        handlingTaxFile,
        "uploads/purchase-invoices",
        {
          fileBaseName: buildBillingDocumentFileBase({
            prefix: "Import-Handling-Tax",
            clientName: supplierName,
            invoiceNumber: invoiceRef,
          }),
        }
      );
    }
  }

  const vehicleCondition = isVehiclePurchase
    ? parseVehicleCondition(formData.get("vehicleCondition"))
    : null;
  let vehicleAssetId: string | null = null;
  let vehicleOtherCostDescription: string | null = null;
  let linkedVehiclePlate: string | null = null;
  let linkedVehicleYear: number | null = null;
  let linkedVehicleLease = false;
  let linkedLeaseTenorMonths: number | null = null;
  if (isVehicleOperatingCost) {
    const assetId = String(formData.get("vehicleAssetId") ?? "").trim();
    if (!assetId) {
      throw new Error("Choose which vehicle this expense is for.");
    }
    const asset = await prisma.equipmentAsset.findFirst({
      where: {
        id: assetId,
        companyId: session.user.companyId,
        status: { not: "RETIRED" },
      },
      select: {
        id: true,
        assetCode: true,
        vehicleYear: true,
        isVehicleLease: true,
        leaseTenorMonths: true,
        item: { select: { itemType: true } },
      },
    });
    if (!asset || !isVehicleItemType(asset.item.itemType)) {
      throw new Error("Choose which vehicle this expense is for.");
    }
    if (vehicleExpenseKindRaw === "LEASE_PAYMENT" && !asset.isVehicleLease) {
      throw new Error(
        translate(locale, "pages.billing.vehicleLeasePaymentNotLeased")
      );
    }
    vehicleAssetId = asset.id;
    linkedVehiclePlate = asset.assetCode;
    linkedVehicleYear = asset.vehicleYear;
    linkedVehicleLease = asset.isVehicleLease;
    linkedLeaseTenorMonths = asset.leaseTenorMonths;
    if (vehicleExpenseKindRaw === "OTHER") {
      vehicleOtherCostDescription = String(
        formData.get("vehicleOtherCostDescription") ?? ""
      ).trim();
      if (!vehicleOtherCostDescription) {
        throw new Error("Describe the other vehicle costs.");
      }
    }
  }

  try {
    const createdInvoiceId = await prisma.$transaction(async (tx) => {
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
          taxInvoiceSerial,
          taxInvoiceManualReason,
          notes: notesRaw || null,
          freeOfCharge,
          freeOfChargeReason: freeOfCharge ? freeOfChargeReason : null,
          hasInvoice,
          shippingCurrency: focShipping.currency,
          shippingForeignAmount: optionalDecimal(focShipping.foreignAmount),
          shippingRateToIdr: optionalDecimal(focShipping.rateToIdr),
          shippingIdr: optionalDecimal(focShipping.idr),
          hasCustomsFees,
          declaredValue: optionalDecimal(importPayload?.declaredValue),
          declaredCurrency: hasCustomsFees
            ? importPayload?.declaredCurrency ?? null
            : null,
          declaredCustomsRate: optionalDecimal(
            hasCustomsFees ? importPayload?.declaredCustomsRate : null
          ),
          includesPpn,
          includedTaxKind,
          pphRatePercent: pphRatePercentValue,
          otherTaxName: focRelatedCostDescription ?? otherTaxName,
          purchaseCategory,
          ppnRatePercent,
          purpose,
          projectId,
          paymentTermsDays,
          paidAt: invoicePaidNow ? new Date() : null,
          paidById: invoicePaidNow ? session.user.id : null,
          bankAccountId,
          vendorBankAccountId,
          transferFeeIdr,
          origin,
          invoiceCurrency: hasCustomsFees
            ? null
            : importPayload?.currency ?? null,
          invoiceForeignAmount: hasCustomsFees
            ? null
            : optionalDecimal(importPayload?.foreignAmount),
          exchangeRateToIdr: hasCustomsFees
            ? null
            : optionalDecimal(
                importPayload && importPayload.exchangeRateToIdr > 0
                  ? importPayload.exchangeRateToIdr
                  : null
              ),
          customsRateToIdr: optionalDecimal(
            hasCustomsFees
              ? importPayload?.declaredCustomsRate
              : importPayload?.customsRateToIdr
          ),
          customsRatesToIdr: importPayload?.customsRatesToIdr ?? undefined,
          invoiceAmountIdr: optionalDecimal(importResult?.invoiceAmountIdr),
          freightCurrency:
            (importPayload?.freightForeignAmount ?? 0) > 0 ||
            (importResult?.vendorFreightIdr ?? 0) > 0
              ? importPayload?.freightCurrency ?? null
              : null,
          freightForeignAmount:
            (importPayload?.freightForeignAmount ?? 0) > 0
              ? optionalDecimal(importPayload?.freightForeignAmount)
              : null,
          freightIdr: optionalDecimal(importResult?.freightIdr),
          freightIncludedInInvoice:
            importPayload?.freightIncludedInInvoice !== false,
          freightRateToIdr:
            importPayload?.freightIncludedInInvoice === false &&
            importPayload?.freightCurrency !== "IDR"
              ? optionalDecimal(importPayload?.freightRateToIdr)
              : null,
          freightCustomsRateToIdr:
            importPayload?.freightIncludedInInvoice === false &&
            importPayload?.freightCurrency !== "IDR"
              ? optionalDecimal(importPayload?.freightCustomsRateToIdr)
              : null,
          insuranceCurrency:
            (importPayload?.insuranceForeignAmount ?? 0) > 0 ||
            (importResult?.vendorInsuranceIdr ?? 0) > 0
              ? importPayload?.insuranceCurrency ?? null
              : null,
          insuranceForeignAmount:
            (importPayload?.insuranceForeignAmount ?? 0) > 0
              ? optionalDecimal(importPayload?.insuranceForeignAmount)
              : null,
          insuranceIdr: optionalDecimal(importResult?.insuranceIdr),
          insuranceIncludedInInvoice:
            importPayload?.insuranceIncludedInInvoice !== false,
          insuranceRateToIdr:
            importPayload?.insuranceIncludedInInvoice === false &&
            importPayload?.insuranceCurrency !== "IDR"
              ? optionalDecimal(importPayload?.insuranceRateToIdr)
              : null,
          insuranceCustomsRateToIdr:
            importPayload?.insuranceIncludedInInvoice === false &&
            importPayload?.insuranceCurrency !== "IDR"
              ? optionalDecimal(importPayload?.insuranceCustomsRateToIdr)
              : null,
          bankFeeCurrency: importResult?.bankChargeIdr
            ? importPayload?.bankFeeCurrency ?? null
            : null,
          bankFeeForeignAmount: importResult?.bankChargeIdr
            ? optionalDecimal(importPayload?.bankFeeForeignAmount)
            : null,
          bankFeeIdr: optionalDecimal(importResult?.bankChargeIdr),
          fullAmountFeeCurrency: importResult?.fullAmountFeeIdr
            ? importPayload?.fullAmountFeeCurrency ?? null
            : null,
          fullAmountFeeForeignAmount: importResult?.fullAmountFeeIdr
            ? optionalDecimal(importPayload?.fullAmountFeeForeignAmount)
            : null,
          fullAmountFeeIdr: optionalDecimal(importResult?.fullAmountFeeIdr),
          localBankFeeIdr: optionalDecimal(importResult?.localBankFeeIdr),
          clearanceCostIdr: optionalDecimal(importResult?.clearanceCostIdr),
          formEApplied: importResult?.formEApplied ?? false,
          beaMasukApplied: importResult?.beaMasukApplied ?? false,
          beaMasukRatePercent: optionalDecimal(importResult?.beaMasukRatePercent),
          beaMasukAmountIdr: optionalDecimal(importResult?.beaMasukAmountIdr),
          ppnbmApplied: importResult?.ppnbmApplied ?? false,
          ppnbmRatePercent: optionalDecimal(importResult?.ppnbmRatePercent),
          ppnbmAmountIdr: optionalDecimal(importResult?.ppnbmAmountIdr),
          importPpnAmountIdr: optionalDecimal(importResult?.ppnAmountIdr),
          pph22Applied: importResult?.pph22Applied ?? false,
          pph22Basis: importResult?.pph22Applied
            ? importResult.pph22Basis
            : null,
          pph22RatePercent: optionalDecimal(importResult?.pph22RatePercent),
          pph22AmountIdr: optionalDecimal(importResult?.pph22AmountIdr),
          customsValueIdr: optionalDecimal(importResult?.customsValueIdr),
          importValueIdr: optionalDecimal(importResult?.importValueIdr),
          stockLandedCostIdr: optionalDecimal(
            freeOfCharge && !hasCustomsFees
              ? purchaseCategory === "SERVICE"
                ? null
                : focShipping.idr
              : importStockLandedCostIdr
          ),
          importFulfillment,
          importPaidItems,
          importDutiesBillingId: importDutiesBillingId || null,
          importDutiesFilePath:
            origin === "IMPORT" || hasCustomsFees
              ? importDutiesFilePath
              : null,
          importDutiesPaidAt: recordingImportArrivalNow ? new Date() : null,
          importDutiesPaidById: recordingImportArrivalNow
            ? session.user.id
            : null,
          importPpnBillingId: null,
          importPph22BillingId: null,
          handlingDueWithDuties: origin === "IMPORT" && !recordingImportArrivalNow,
          handlingVendorId: handlingLaterWithDuties
            ? null
            : handlingVendorId || null,
          handlingFeeIdr: optionalDecimal(handling.handlingFeeIdr),
          handlingFeeIncludesPpn: handling.handlingFeeIncludesPpn,
          handlingFeePpnRatePercent: optionalDecimal(
            handling.handlingFeePpnRatePercent
          ),
          handlingFeeAmountPaidIdr: optionalDecimal(
            handling.handlingFeeAmountPaidIdr
          ),
          handlingFeeTaxInvoicePath,
          vehicleExpenseKind:
            purchaseCategory === "VEHICLE"
              ? parseVehicleExpenseKind(vehicleExpenseKindRaw)
              : null,
          vehicleAssetId,
          vehicleOtherCostDescription,
          vehiclePlate: isVehicleOperatingCost ? linkedVehiclePlate : undefined,
          vehicleYear: isVehicleOperatingCost ? linkedVehicleYear : undefined,
          vehicleCondition,
          isVehicleLease: vehicleLease.isVehicleLease || linkedVehicleLease,
          leaseOtrAmount: optionalDecimal(vehicleLease.otrAmount),
          leaseDownPayment: optionalDecimal(vehicleLease.downPayment),
          leaseTenorMonths: vehicleLease.tenorMonths ?? linkedLeaseTenorMonths,
          leaseInterestPercentYear: optionalDecimal(
            vehicleLease.interestPercentYear
          ),
          leaseAdminFee: optionalDecimal(vehicleLease.adminFee),
          leaseInsuranceAmount: optionalDecimal(vehicleLease.insuranceAmount),
          leaseFiduciaryFee: optionalDecimal(vehicleLease.fiduciaryFee),
          leaseProvisionFee: optionalDecimal(vehicleLease.provisionFee),
          leaseOtherFee: optionalDecimal(vehicleLease.otherFee),
          leaseMonthlyInstallment: optionalDecimal(
            vehicleLease.monthlyInstallment
          ),
          createdById: session.user.id,
        },
      });

      // Local commercial lines stay tax-inclusive when PPN applies.
      // Import lines are already warehouse (ex-tax) unit cost.
      const ppnRate =
        origin !== "IMPORT" && includesPpn && ppnRatePercent != null
          ? ppnRateFromPercent(ppnRatePercent)
          : 0;

      let mintedVehiclePlate: string | null = null;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const totalPrice =
          isVehiclePurchase && leasedCashOut != null && leasedCashOut > 0
            ? leasedCashOut
            : line.quantity * line.unitPrice;
        const purchaseUnitCost =
          isVehiclePurchase && leasedCashOut != null && leasedCashOut > 0
            ? leasedCashOut
            : origin === "IMPORT"
            ? line.unitPrice
            : ppnRate > 0
              ? exclusiveUnitCostFromInclusive(line.unitPrice, ppnRate)
              : line.unitPrice;
        const costTotalPrice = line.quantity * purchaseUnitCost;
        const stockQty = normalizeInventoryQty(
          stockQuantityFromPurchase({
            purchaseQty: line.quantity,
            packContents: line.itemId ? null : line.packContents,
          })
        );
        const costUnitPrice =
          stockQty > 0
            ? Math.round((costTotalPrice / stockQty) * 100) / 100
            : purchaseUnitCost;

        if (!line.itemId) {
          await tx.purchaseInvoiceLine.create({
            data: {
              purchaseInvoiceId: invoice.id,
              itemId: null,
              description: line.description ?? null,
              unit: line.unit ? normalizeInventoryUnit(line.unit) : null,
              packContents: optionalDecimal(line.packContents),
              quantity: toDecimal(line.quantity),
              unitPrice: toDecimal(line.unitPrice),
              totalPrice: toDecimal(totalPrice),
              sortOrder: i,
            },
          });
          continue;
        }

        const item = await tx.inventoryItem.findFirst({
          where: {
            id: line.itemId,
            companyId: session.user.companyId,
            active: true,
            deletedAt: null,
          },
          select: {
            id: true,
            tracksStock: true,
            itemType: true,
            unit: true,
            kmPerLitreMin: true,
            kmPerLitreMax: true,
          },
        });
        if (!item) {
          throw new Error("One or more items are missing from the catalog.");
        }

        const catalogUnit = normalizeInventoryUnit(item.unit);
        if (
          !allowsDecimalInventoryQty(catalogUnit) &&
          !isWholeInventoryQty(line.quantity)
        ) {
          throw new Error(`Quantity for line ${i + 1} must be a whole number.`);
        }

        if (
          isEquipmentItemType(item.itemType) &&
          !isWholeInventoryQty(stockQty)
        ) {
          throw new Error(
            `Equipment quantity for line ${i + 1} must be a whole number.`
          );
        }

        const createdLine = await tx.purchaseInvoiceLine.create({
          data: {
            purchaseInvoiceId: invoice.id,
            itemId: item.id,
            description: line.description ?? null,
            unit: catalogUnit,
            packContents: null,
            quantity: toDecimal(line.quantity),
            unitPrice: toDecimal(
              isVehiclePurchase && leasedCashOut != null && leasedCashOut > 0
                ? purchaseUnitCost
                : line.unitPrice
            ),
            totalPrice: toDecimal(totalPrice),
            sortOrder: i,
          },
        });

        if (isVehiclePurchase && isVehicleItemType(item.itemType)) {
          if (mintedVehiclePlate) {
            throw new Error(
              "Record one vehicle per expense. Use a separate expense for each number plate."
            );
          }
          if (!isWholeInventoryQty(stockQty) || Math.round(stockQty) !== 1) {
            throw new Error(
              "Vehicle quantity must be 1. Record each vehicle on its own expense."
            );
          }
          mintedVehiclePlate = parseRequiredVehiclePlate(
            formData.get("vehiclePlate")
          );
          const mintedVehicleYear = parseRequiredVehicleYear(
            formData.get("vehicleYear")
          );
          const minted = await mintVehicleAssetByPlate(
            tx,
            session.user.companyId,
            item.id,
            mintedVehiclePlate,
            {
              unitCost: costUnitPrice,
              vehicleYear: mintedVehicleYear,
              vehicleCondition,
              lease: vehicleLease,
            }
          );
          await tx.purchaseInvoice.update({
            where: { id: invoice.id },
            data: {
              vehiclePlate: minted.plate,
              vehicleYear: mintedVehicleYear,
              vehicleAssetId: minted.id,
              vehicleCondition,
            },
          });
        }

        if (
          !item.tracksStock ||
          !purchaseCreatesStock(purpose, purchaseCategory) ||
          (origin === "IMPORT" && !recordingImportArrivalNow)
        ) {
          continue;
        }
        if (!vendorId) {
          throw new Error("Select the vendor.");
        }

        await applyPurchaseLineStockIn(tx, {
          companyId: session.user.companyId,
          userId: session.user.id,
          invoiceDate,
          invoiceRef,
          filePath,
          notes: notesRaw || null,
          vendorId,
          itemId: item.id,
          purchaseInvoiceLineId: createdLine.id,
          stockQty,
          costUnitPrice,
          costTotalPrice,
        });
      }

      await writeRecordChange({
        db: tx,
        companyId: session.user.companyId,
        userId: session.user.id,
        action: "CREATE",
        entity: "PurchaseInvoice",
        entityId: invoice.id,
        description: "Recorded purchase",
        newValue: {
          supplierName,
          invoiceRef,
          amount: invoiceAmount,
          origin,
        },
      });
      return invoice.id;
    });
    if (origin === "IMPORT") {
      await setPurchaseHandlingHasTaxInvoice(
        createdInvoiceId,
        handlingHasTaxInvoice
      );
    }
  } catch (error) {
    await deleteLocalUpload(filePath);
    if (taxInvoiceFilePath) {
      await deleteLocalUpload(taxInvoiceFilePath);
    }
    throw error;
  }

  revalidatePath("/billing/purchase-invoices");
  revalidatePath("/billing/tax-invoices");
  revalidatePath("/billing/financial-report");
  revalidatePath("/inventory");
  revalidatePath("/inventory/vehicles");
  revalidatePath("/dashboard");
}

export async function uploadPurchaseTaxInvoice(formData: FormData) {
  const session = await requirePurchaseTaxDocumentAccess();

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

  const reason = parseOptionalManualVerifyReason(formData.get("manualReason"));
  requireTaxInvoiceSerialVerified(formData.get("taxInvoiceSerialVerified"));
  const taxInvoiceSerial = parseRequiredTaxInvoiceSerial(
    formData.get("taxInvoiceSerial")
  );

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
        taxInvoiceSerial,
        taxInvoiceManualReason: reason,
      },
    });
  } catch (error) {
    await deleteLocalUpload(taxInvoiceFilePath);
    throw error;
  }

  const withholdingFile = formData.get("withholdingSlip");
  if (withholdingFile instanceof File && withholdingFile.size > 0) {
    const slipPath = await saveUpload(
      withholdingFile,
      "uploads/purchase-invoices",
      {
        fileBaseName: `Withholding-Slip_${invoice.invoiceRef || invoice.id.slice(-8)}`,
      }
    );
    await prisma.$executeRaw`
      UPDATE "PurchaseInvoice"
      SET "withholdingSlipPath" = ${slipPath}
      WHERE id = ${invoice.id}
    `;
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

const PURCHASE_TAX_DOCUMENT_SLOTS = [
  "withholding",
  "government",
  "duties",
] as const;
type PurchaseTaxDocumentSlot = (typeof PURCHASE_TAX_DOCUMENT_SLOTS)[number];

function isPurchaseTaxDocumentSlot(
  value: string
): value is PurchaseTaxDocumentSlot {
  return (PURCHASE_TAX_DOCUMENT_SLOTS as readonly string[]).includes(value);
}

/** Archive a tax document from Tax. Does not mark payment or duties paid. */
export async function uploadPurchaseTaxDocument(formData: FormData) {
  const session = await requirePurchaseTaxDocumentAccess();
  if (session.user.vendorId) {
    throw new Error("Head Office uploads tax documents.");
  }

  const purchaseInvoiceId = String(formData.get("purchaseInvoiceId") ?? "").trim();
  const slotRaw = String(formData.get("slot") ?? "").trim();
  if (!purchaseInvoiceId) {
    throw new Error("Purchase invoice is required.");
  }
  if (!isPurchaseTaxDocumentSlot(slotRaw)) {
    throw new Error("Select the tax document to upload.");
  }

  const file = requireImageOrPdfUpload(formData.get("document"), {
    requiredMessage: "Upload the tax document.",
    sizeMessage: "File must be 10 MB or smaller.",
    typeMessage: "Upload an image or PDF.",
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
      filePath: true,
      importDutiesFilePath: true,
      withholdingSlipPath: true,
      purchaseCategory: true,
      origin: true,
      includedTaxKind: true,
    },
  });
  if (!invoice) {
    throw new Error("Purchase invoice not found.");
  }

  if (
    slotRaw === "withholding" &&
    !commercialTaxIncludesIncomeTax(invoice.includedTaxKind)
  ) {
    throw new Error("This expense does not include income tax.");
  }
  if (slotRaw === "government" && invoice.purchaseCategory !== "GOVERNMENT") {
    throw new Error("This expense is not a government tax document.");
  }
  if (slotRaw === "duties" && invoice.origin !== "IMPORT") {
    throw new Error("Import duties documents are only for import expenses.");
  }

  const alreadyUploaded =
    slotRaw === "withholding"
      ? invoice.withholdingSlipPath
      : slotRaw === "duties"
        ? invoice.importDutiesFilePath
        : invoice.filePath;
  if (alreadyUploaded) {
    throw new Error("Tax document already uploaded.");
  }

  const prefix =
    slotRaw === "withholding"
      ? "Withholding-Slip"
      : slotRaw === "duties"
        ? "Import-Duties"
        : "Government-Billing";
  const filePath = await saveUpload(file, "uploads/purchase-invoices", {
    fileBaseName: buildBillingDocumentFileBase({
      prefix,
      clientName: invoice.supplierName,
      invoiceNumber: invoice.invoiceRef,
    }),
  });

  try {
    await prisma.purchaseInvoice.update({
      where: { id: invoice.id },
      data:
        slotRaw === "withholding"
          ? { withholdingSlipPath: filePath }
          : slotRaw === "duties"
            ? { importDutiesFilePath: filePath }
            : { filePath },
    });
  } catch (error) {
    await deleteLocalUpload(filePath);
    throw error;
  }

  revalidatePath("/billing/purchase-invoices");
  revalidatePath(`/billing/purchase-invoices/${invoice.id}`);
  revalidatePath("/billing/tax-invoices");
  revalidatePath(`/billing/tax-invoices/purchase/${invoice.id}`);
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

  const proofs = requireImageOrPdfUploads(formData, "paymentProof", {
    requiredMessage: translate(locale, "pages.billing.choosePaymentProof"),
    sizeMessage: "Payment proof must be 10 MB or smaller.",
    typeMessage: translate(locale, "pages.billing.paymentProofImageOrPdf"),
  });

  const bankAccountId = await parseFormCompanyBankAccountId(
    formData,
    session.user.companyId,
    {
      requiredWhenAccountsExist: true,
      requiredMessage: translate(
        locale,
        "pages.billing.purchaseBankAccountRequired"
      ),
    }
  );

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
      reversedAt: true,
      paymentProofPath: true,
      origin: true,
      importDutiesPaidAt: true,
      importPaidItems: true,
      invoiceCurrency: true,
      invoiceForeignAmount: true,
      invoiceAmountIdr: true,
      exchangeRateToIdr: true,
      freightCurrency: true,
      freightForeignAmount: true,
      freightIdr: true,
      freightIncludedInInvoice: true,
      freightRateToIdr: true,
      insuranceCurrency: true,
      insuranceForeignAmount: true,
      insuranceIdr: true,
      insuranceIncludedInInvoice: true,
      insuranceRateToIdr: true,
      amount: true,
      purchaseCategory: true,
      loanFacilityId: true,
      loanInterestPeriod: true,
    },
  });

  if (!invoice) {
    throw new Error(
      translate(locale, "pages.billing.purchaseMarkPaidNotFound")
    );
  }
  if (invoice.reversedAt) {
    throw new Error("This purchase was reversed.");
  }
  if (invoice.paidAt) {
    throw new Error(
      translate(locale, "pages.billing.purchaseMarkPaidAlreadyPaid")
    );
  }

  const needsImportBankRate = purchaseNeedsImportBankRate(invoice);
  let importPaymentUpdate: Prisma.PurchaseInvoiceUncheckedUpdateInput = {};
  if (needsImportBankRate) {
    const bankRate = parseImportDecimal(
      String(formData.get("importBankRate") ?? "")
    );
    if (bankRate == null || bankRate <= 0) {
      throw new Error(
        translate(locale, "pages.billing.purchaseMarkPaidBankRateRequired")
      );
    }
    const bankChargeForeign = parseImportDecimal(
      String(formData.get("importBankCharge") ?? "")
    );
    const telexIdr = parseImportDecimal(
      String(formData.get("importTelexFee") ?? "")
    );
    const bookingRate = decimalToNumber(invoice.exchangeRateToIdr) ?? 0;
    const remittanceInput = {
      foreignAmount: decimalToNumber(invoice.invoiceForeignAmount) ?? 0,
      currency: invoice.invoiceCurrency,
      invoiceAmountIdr: decimalToNumber(invoice.invoiceAmountIdr),
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
      bankFeeCurrency: invoice.invoiceCurrency,
      bankFeeForeignAmount: bankChargeForeign,
      localBankFeeIdr: telexIdr,
    };
    const bookedRemittance =
      bookingRate > 0
        ? summarizeImportVendorRemittance({
            ...remittanceInput,
            exchangeRateToIdr: bookingRate,
            bankFeeForeignAmount: undefined,
            localBankFeeIdr: undefined,
          })
        : null;
    const remittance = summarizeImportVendorRemittance({
      ...remittanceInput,
      exchangeRateToIdr: bankRate,
    });
    const factoryIdr = remittance.factory.vendorIdr;
    const fxDifference =
      bookedRemittance != null
        ? importRateDifferenceIdr({
            factoryCurrencyFxSum: bookedRemittance.factoryCurrencyFxSum,
            bookingRate,
            bankRate,
          })
        : 0;
    importPaymentUpdate = {
      ...(bookedRemittance != null
        ? {
            paidExchangeRateToIdr: optionalDecimal(bankRate),
            importFxDifferenceIdr: optionalDecimal(fxDifference),
          }
        : {
            exchangeRateToIdr: optionalDecimal(bankRate),
            invoiceAmountIdr: optionalDecimal(factoryIdr),
            amount: new Prisma.Decimal(Math.round(factoryIdr * 100) / 100),
          }),
      bankFeeCurrency:
        bankChargeForeign != null && bankChargeForeign > 0
          ? invoice.invoiceCurrency
          : null,
      bankFeeForeignAmount: optionalDecimal(bankChargeForeign),
      bankFeeIdr: optionalDecimal(remittance.bankCharge.vendorIdr),
      localBankFeeIdr: optionalDecimal(telexIdr),
    };
  }

  const paidAt = new Date();
  const paymentProofPath = await saveAndAppendUploads(
    invoice.paymentProofPath,
    proofs,
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
        bankAccountId,
        paymentManualReason: parseOptionalManualVerifyReason(
          formData.get("manualReason")
        ),
        ...(invoice.origin === "IMPORT"
          ? {}
          : {
              transferFeeIdr: parseOptionalAmount(
                String(formData.get("transferFeeIdr") ?? "")
              ),
            }),
        importPaidItems:
          invoice.origin === "IMPORT"
            ? invoice.importDutiesPaidAt
              ? "BOTH"
              : "INVOICE"
            : invoice.importPaidItems,
        ...importPaymentUpdate,
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

  if (invoice.purchaseCategory === "BANK_LOAN" && invoice.loanFacilityId) {
    await recordLoanInterestBillPaid({
      db: prisma,
      invoiceId: invoice.id,
      userId: session.user.id,
      bankAccountId,
      filePath: paymentProofPath,
      paidAt,
    });
    revalidatePath("/billing/loans");
    revalidatePath(`/billing/loans/${invoice.loanFacilityId}`);
  }

  revalidatePath("/billing/purchase-invoices");
  revalidatePath("/billing/settlements");
  revalidatePath("/billing/financial-report");
  revalidatePath("/vendors");

  return { id: invoice.id, paidAt };
}

export async function markImportDutiesPaid(formData: FormData) {
  const session = await requirePurchaseManageAccess();
  const id = String(formData.get("purchaseInvoiceId") ?? "").trim();
  const billingId = String(formData.get("importDutiesBillingId") ?? "").trim();
  const importJsonRaw = String(formData.get("importJson") ?? "").trim();
  if (!id) throw new Error("Purchase is required.");
  if (!billingId) throw new Error("Enter the Import Duties Billing ID.");
  if (!importJsonRaw) throw new Error("Enter the Customs Rate.");

  const invoice = await prisma.purchaseInvoice.findFirst({
    where: {
      id,
      companyId: session.user.companyId,
      origin: "IMPORT",
      reversedAt: null,
    },
    select: {
      id: true,
      importDutiesPaidAt: true,
      importDutiesBillingId: true,
      importDutiesFilePath: true,
      supplierName: true,
      invoiceRef: true,
      invoiceDate: true,
      filePath: true,
      notes: true,
      vendorId: true,
      purpose: true,
      purchaseCategory: true,
      paidAt: true,
      paymentTermsDays: true,
      includesPpn: true,
      ppnRatePercent: true,
      importFulfillment: true,
      hasCustomsFees: true,
      invoiceCurrency: true,
      invoiceForeignAmount: true,
      exchangeRateToIdr: true,
      freightCurrency: true,
      freightForeignAmount: true,
      freightIncludedInInvoice: true,
      freightRateToIdr: true,
      insuranceCurrency: true,
      insuranceForeignAmount: true,
      insuranceIncludedInInvoice: true,
      insuranceRateToIdr: true,
      bankFeeCurrency: true,
      bankFeeForeignAmount: true,
      bankFeeIdr: true,
      fullAmountFeeCurrency: true,
      fullAmountFeeForeignAmount: true,
      fullAmountFeeIdr: true,
      localBankFeeIdr: true,
      declaredValue: true,
      declaredCurrency: true,
      handlingDueWithDuties: true,
      handlingVendorId: true,
      handlingFeeIdr: true,
      handlingFeeIncludesPpn: true,
      handlingFeePpnRatePercent: true,
      handlingFeeAmountPaidIdr: true,
      handlingFeeTaxInvoicePath: true,
      shippingIdr: true,
      lines: {
        select: {
          id: true,
          quantity: true,
          inventoryPurchase: { select: { id: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!invoice) throw new Error("Import purchase not found.");
  const dutiesAlreadyPaid = Boolean(invoice.importDutiesPaidAt);
  const handlingStillDue =
    invoice.handlingDueWithDuties &&
    !invoice.handlingVendorId &&
    (decimalToNumber(invoice.handlingFeeIdr) ?? 0) <= 0;
  if (dutiesAlreadyPaid && !handlingStillDue) {
    throw new Error("Import duties are already marked paid.");
  }

  const payload = parseImportFormPayload(importJsonRaw, {
    requireCustomsRates: true,
    requireBankRate: false,
  });
  const locked = lockImportArrivalPayload(invoice, payload);
  const importResult = calculateImportLandedCost(
    invoice.importFulfillment === "OUTSOURCED"
      ? outsourcedImportPayload(locked)
      : locked
  );
  const needsDeferredHandling =
    invoice.handlingDueWithDuties &&
    !invoice.handlingVendorId &&
    (decimalToNumber(invoice.handlingFeeIdr) ?? 0) <= 0;
  let handlingVendorId = invoice.handlingVendorId;
  let handling = {
    handlingFeeIdr: decimalToNumber(invoice.handlingFeeIdr),
    handlingFeeIncludesPpn: invoice.handlingFeeIncludesPpn,
    handlingFeePpnRatePercent: decimalToNumber(invoice.handlingFeePpnRatePercent),
    handlingFeeAmountPaidIdr: decimalToNumber(invoice.handlingFeeAmountPaidIdr),
  };
  let handlingFeeTaxInvoicePath = invoice.handlingFeeTaxInvoicePath;
  if (needsDeferredHandling) {
    const rawHandlingVendorId = String(
      formData.get("handlingVendorId") ?? ""
    ).trim();
    if (!rawHandlingVendorId || isHandlingByHeadOffice(rawHandlingVendorId)) {
      throw new Error("Select the Handling Vendor.");
    }
    const handlingVendor = await prisma.vendor.findFirst({
      where: {
        id: rawHandlingVendorId,
        companyId: session.user.companyId,
        active: true,
      },
      select: { id: true, vendorType: true },
    });
    if (!handlingVendor) {
      throw new Error("Select the Handling Vendor.");
    }
    if (!vendorMatchesPurchaseOrigin(handlingVendor.vendorType, "LOCAL")) {
      throw new Error("The Handling Vendor must be a Company or Individual.");
    }
    handling = parseHandlingFee(formData, true);
    if (handling.handlingFeeIdr == null || handling.handlingFeeIdr <= 0) {
      throw new Error("Enter the handling fee.");
    }
    const handlingFeeFile = requireImageOrPdfUpload(
      formData.get("handlingFeeDocument"),
      {
        requiredMessage: "Upload the Handling Fee invoice.",
        sizeMessage: "Handling Fee invoice must be 10 MB or smaller.",
        typeMessage: "Upload an image or PDF for the Handling Fee invoice.",
      }
    );
    handlingFeeTaxInvoicePath = await saveUpload(
      handlingFeeFile,
      "uploads/purchase-invoices",
      {
        fileBaseName: buildBillingDocumentFileBase({
          prefix: "Import-Handling",
          clientName: invoice.supplierName,
          invoiceNumber: invoice.invoiceRef,
        }),
      }
    );
    if (handling.handlingFeeIncludesPpn) {
      const handlingTaxFile = requireImageOrPdfUpload(
        formData.get("handlingFeeTaxDocument"),
        {
          requiredMessage: "Upload the tax invoice for the handling fee.",
          sizeMessage: "Handling tax invoice must be 10 MB or smaller.",
          typeMessage: "Upload an image or PDF for the handling tax invoice.",
        }
      );
      await saveUpload(handlingTaxFile, "uploads/purchase-invoices", {
        fileBaseName: buildBillingDocumentFileBase({
          prefix: "Import-Handling-Tax",
          clientName: invoice.supplierName,
          invoiceNumber: invoice.invoiceRef,
        }),
      });
    }
    handlingVendorId = handlingVendor.id;
  }
  const importStockLandedCostIdr =
    (decimalToNumber(invoice.shippingIdr) ?? 0) +
    importResult.stockLandedCostIdr +
    (handling.handlingFeeIdr ?? 0);
  const pricedLines = invoice.lines.filter(
    (line) => (decimalToNumber(line.quantity) ?? 0) > 0
  );
  const allocated = allocateImportStockCost({
    stockLandedCostIdr: importStockLandedCostIdr,
    headerForeignAmount: locked.foreignAmount || locked.declaredValue || 0,
    lines: pricedLines.map((line) => ({
      quantity: decimalToNumber(line.quantity) ?? 0,
    })),
  });

  const file = optionalImageOrPdfUpload(formData.get("importDutiesDocument"), {
    sizeMessage: "Import duties file must be 10 MB or smaller.",
    typeMessage: "Upload an image or PDF.",
  });
  if (!file && !invoice.importDutiesFilePath) {
    throw new Error("Upload the Import Duties invoice.");
  }
  const importDutiesFilePath = file
    ? await saveUpload(file, "uploads/purchase-invoices", {
        fileBaseName: buildBillingDocumentFileBase({
          prefix: "Import-Duties",
          clientName: invoice.supplierName,
          invoiceNumber: invoice.invoiceRef,
        }),
      })
    : invoice.importDutiesFilePath;

  const includesPpn =
    invoice.importFulfillment === "INTERNAL"
      ? importResult.ppnApplied
      : invoice.includesPpn;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.purchaseInvoice.update({
        where: { id: invoice.id },
        data: {
          importDutiesBillingId: billingId,
          importDutiesFilePath,
          importDutiesPaidAt: new Date(),
          importDutiesPaidById: session.user.id,
          importPaidItems: invoice.paidAt ? "BOTH" : "DUTIES",
          customsRateToIdr: optionalDecimal(
            invoice.hasCustomsFees
              ? locked.declaredCustomsRate
              : importResult.appliedCustomsRates[0]?.rate ??
                locked.customsRateToIdr
          ),
          customsRatesToIdr: locked.customsRatesToIdr ?? undefined,
          freightCustomsRateToIdr:
            invoice.freightIncludedInInvoice === false &&
            invoice.freightCurrency !== "IDR"
              ? optionalDecimal(locked.freightCustomsRateToIdr)
              : null,
          insuranceCustomsRateToIdr:
            invoice.insuranceIncludedInInvoice === false &&
            invoice.insuranceCurrency !== "IDR"
              ? optionalDecimal(locked.insuranceCustomsRateToIdr)
              : null,
          freightIdr: optionalDecimal(importResult.freightIdr),
          insuranceIdr: optionalDecimal(importResult.insuranceIdr),
          formEApplied: importResult.formEApplied,
          beaMasukApplied: importResult.beaMasukApplied,
          beaMasukRatePercent: optionalDecimal(importResult.beaMasukRatePercent),
          beaMasukAmountIdr: optionalDecimal(importResult.beaMasukAmountIdr),
          ppnbmApplied: importResult.ppnbmApplied,
          ppnbmRatePercent: optionalDecimal(importResult.ppnbmRatePercent),
          ppnbmAmountIdr: optionalDecimal(importResult.ppnbmAmountIdr),
          importPpnAmountIdr: optionalDecimal(importResult.ppnAmountIdr),
          pph22Applied: importResult.pph22Applied,
          pph22Basis: importResult.pph22Applied ? importResult.pph22Basis : null,
          pph22RatePercent: optionalDecimal(importResult.pph22RatePercent),
          pph22AmountIdr: optionalDecimal(importResult.pph22AmountIdr),
          customsValueIdr: optionalDecimal(importResult.customsValueIdr),
          importValueIdr: optionalDecimal(importResult.importValueIdr),
          stockLandedCostIdr: optionalDecimal(importStockLandedCostIdr),
          includesPpn,
          ppnRatePercent: includesPpn
            ? optionalDecimal(importResult.ppnRatePercent)
            : invoice.ppnRatePercent,
          ...(needsDeferredHandling
            ? {
                handlingVendorId,
                handlingFeeIdr: optionalDecimal(handling.handlingFeeIdr),
                handlingFeeIncludesPpn: handling.handlingFeeIncludesPpn,
                handlingFeePpnRatePercent: optionalDecimal(
                  handling.handlingFeePpnRatePercent
                ),
                handlingFeeAmountPaidIdr: optionalDecimal(
                  handling.handlingFeeAmountPaidIdr
                ),
                handlingFeeTaxInvoicePath,
                handlingDueWithDuties: false,
              }
            : {}),
        },
      });
      for (let i = 0; i < pricedLines.length; i++) {
        const line = pricedLines[i]!;
        if (line.inventoryPurchase) continue;
        const allocatedLine = allocated[i];
        await tx.purchaseInvoiceLine.update({
          where: { id: line.id },
          data: {
            unitPrice: toDecimal(allocatedLine?.unitCostIdr ?? 0),
            totalPrice: toDecimal(allocatedLine?.totalCostIdr ?? 0),
          },
        });
      }
      await stockInPendingPurchaseLines(tx, {
        companyId: session.user.companyId,
        userId: session.user.id,
        invoice: {
          id: invoice.id,
          invoiceDate: invoice.invoiceDate,
          invoiceRef: invoice.invoiceRef,
          filePath: invoice.filePath,
          notes: invoice.notes,
          vendorId: invoice.vendorId,
          purpose: invoice.purpose,
          purchaseCategory: invoice.purchaseCategory,
        },
      });
    });
  } catch (error) {
    if (file && importDutiesFilePath) {
      await deleteLocalUpload(importDutiesFilePath);
    }
    throw error;
  }

  await writeRecordChange({
    companyId: session.user.companyId,
    userId: session.user.id,
    action: "UPDATE",
    entity: "PurchaseInvoice",
    entityId: invoice.id,
    description: "Import duties paid",
    oldValue: { importDutiesPaidAt: null },
    newValue: {
      importDutiesPaidAt: true,
      importDutiesBillingId: billingId,
      customsValueIdr: importResult.customsValueIdr,
    },
  });
  revalidatePath("/billing/purchase-invoices");
  revalidatePath("/billing/settlements");
  revalidatePath("/inventory");
}

export async function reversePurchaseInvoice(formData: FormData) {
  const session = await requirePurchaseManageAccess();
  const id = String(formData.get("purchaseInvoiceId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id) throw new Error("Purchase is required.");
  if (!reason) throw new Error("Enter the reverse reason.");

  const reversed = await prisma.$transaction(async (tx) => {
    const result = await unwindAndReversePurchaseInvoice(tx, {
      companyId: session.user.companyId,
      userId: session.user.id,
      invoiceId: id,
      reason,
    });
    await writeRecordChange({
      db: tx,
      companyId: session.user.companyId,
      userId: session.user.id,
      action: "REVERSE",
      entity: "PurchaseInvoice",
      entityId: id,
      description: reason,
      oldValue: {
        amount: result.amount,
        paidAt: result.paidAt?.toISOString() ?? null,
        projectId: result.projectId,
      },
      newValue: { reversed: true, reason },
    });
    return result;
  });

  revalidatePath("/billing/purchase-invoices");
  revalidatePath("/billing/financial-report");
  revalidatePath("/billing/settlements");
  revalidatePath("/billing/tax-invoices");
  revalidatePath("/billing/petty-cash");
  revalidatePath("/billing/payroll");
  revalidatePath("/payslips");
  revalidatePath("/billing/loans");
  revalidatePath("/billing/bpjs");
  revalidatePath("/inventory");
  revalidatePath("/inventory/vehicles");
  if (reversed.projectId) {
    revalidatePath("/projects");
    revalidatePath(`/projects/${reversed.projectId}`);
  }
}
