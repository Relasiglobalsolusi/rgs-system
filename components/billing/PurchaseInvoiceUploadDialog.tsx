"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import {
  createPurchaseInvoice,
  listPurchasePayoutBankAccounts,
} from "@/app/billing/purchase-invoices/actions";
import CompanyBankAccountField from "@/components/company-details/CompanyBankAccountField";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import PurchaseCatalogItemPicker from "@/components/billing/PurchaseCatalogItemPicker";
import PurchaseBankLoanFields, {
  bankLoanSuggestedPayment,
  emptyBankLoanDraft,
  type PurchaseBankLoanDraft,
} from "@/components/billing/PurchaseBankLoanFields";
import PurchaseVehicleLeaseFields, {
  emptyVehicleLeaseDraft,
  type PurchaseVehicleLeaseDraft,
} from "@/components/billing/PurchaseVehicleLeaseFields";
import { BillingDocumentFilePick } from "@/components/billing/BillingDocumentVerifyDialog";
import CommercialTaxKindField from "@/components/billing/CommercialTaxKindField";
import PaymentTermsField from "@/components/billing/PaymentTermsField";
import PurchaseImportCostFields, {
  emptyPurchaseImportDraft,
  focChargesDraftToInput,
  importDraftToInput,
  type PurchaseImportDraft,
} from "@/components/billing/PurchaseImportCostFields";
import {
  allocateImportStockCost,
  calculateImportLandedCost,
  HANDLING_BY_HEAD_OFFICE,
  type ImportLandedCostInput,
  IMPORT_FEE_CURRENCIES,
  isHandlingByHeadOffice,
  parseImportDecimal,
} from "@/lib/import-landed-cost";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogGridClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { isWholeInventoryQty } from "@/lib/inventory";
import { isVehicleItemType } from "@/lib/inventory-sku";
import { inventoryUnitLabel } from "@/components/inventory/InventoryUnitSelect";
import {
  allowsDecimalInventoryQty,
  normalizeInventoryUnit,
} from "@/lib/inventory-units";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import SearchableProjectSelect from "@/components/ui/SearchableProjectSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import YesNoChoiceCards, {
  type YesNoChoice,
} from "@/components/ui/YesNoChoiceCards";
import { formatDisplayDate } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";
import {
  CASH_PAYMENT_TERMS_DAYS,
  dueAtFromPaymentTerms,
  isCashPaymentTerms,
} from "@/lib/invoice-period";
import {
  applyExclusiveVat,
  DEFAULT_PRODUCT_PPN_RATE_PERCENT,
  parsePpnRatePercent,
  ppnRateFromPercent,
  splitInclusiveVat,
} from "@/lib/vat";
import { todayDateInput } from "@/lib/project-contract";
import { vendorMatchesPurchaseOrigin } from "@/lib/vendor-type";
import { formatContractPrice, parseContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import {
  commercialTaxIncludesVat,
  commercialTaxRequiresOtherName,
  commercialTaxRequiresRatePercent,
  defaultCommercialNonVatRatePercent,
  type CommercialTaxKind,
} from "@/lib/commercial-tax";
import {
  governmentTaxKindLabelKey,
  governmentTaxKindPickerOptions,
  type GovernmentTaxKind,
} from "@/lib/government-tax";

type PurchaseCategoryChoice =
  | "PRODUCT"
  | "SERVICE"
  | "PETTY_CASH"
  | "GOVERNMENT"
  | "VEHICLE"
  | "BANK_LOAN";
type PurchaseOriginChoice = "LOCAL" | "IMPORT";
type GovernmentTaxKindChoice = GovernmentTaxKind;

export type PurchaseInvoiceVendorOption = {
  id: string;
  name: string;
  vendorType?: string | null;
};

export type PurchaseCatalogItemOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  itemType: string;
  lastUnitCost: number | null;
};

export type PurchaseProjectOption = {
  id: string;
  name: string;
  clientName: string | null;
};

type PurchaseLineDraft = {
  key: string;
  itemId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  foreignAmount: string;
  unit: string;
  packContents: string;
};

function newPurchaseLine(unit = "pcs"): PurchaseLineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemId: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    foreignAmount: "",
    unit,
    packContents: "",
  };
}

type PurchaseInvoiceUploadDialogProps = {
  vendors: PurchaseInvoiceVendorOption[];
  catalogItems?: PurchaseCatalogItemOption[];
  projects?: PurchaseProjectOption[];
};

export default function PurchaseInvoiceUploadDialog({
  vendors: vendorsProp,
  catalogItems: catalogItemsProp = [],
  projects = [],
}: PurchaseInvoiceUploadDialogProps) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [taxFile, setTaxFile] = useState<File | null>(null);
  const [taxReason, setTaxReason] = useState("");
  const [includesPpn, setIncludesPpn] = useState<YesNoChoice>("No");
  const [includedTaxKind, setIncludedTaxKind] = useState<
    CommercialTaxKind | ""
  >("");
  const [pphRatePercent, setPphRatePercent] = useState("");
  const [otherTaxName, setOtherTaxName] = useState("");
  const [purchasePurpose, setPurchasePurpose] = useState<
    "STOCK" | "PROJECT" | "INTERNAL"
  >("STOCK");
  const [projectId, setProjectId] = useState("");
  const [purchaseCategory, setPurchaseCategory] =
    useState<PurchaseCategoryChoice>("PRODUCT");
  const [pickingLineKey, setPickingLineKey] = useState<string | null>(null);
  const [freeOfCharge, setFreeOfCharge] = useState<YesNoChoice>("No");
  const [freeOfChargeReason, setFreeOfChargeReason] = useState("");
  const [hasInvoice, setHasInvoice] = useState<YesNoChoice>("Yes");
  const [addShippingCost, setAddShippingCost] = useState<YesNoChoice>("No");
  const [shippingCurrency, setShippingCurrency] = useState("IDR");
  const [shippingAmount, setShippingAmount] = useState("");
  const [shippingRate, setShippingRate] = useState("");
  const [shippingDescription, setShippingDescription] = useState("");
  const [hasCustomsFees, setHasCustomsFees] = useState<YesNoChoice>("No");
  const [declaredValue, setDeclaredValue] = useState("");
  const [declaredCurrency, setDeclaredCurrency] = useState("IDR");
  const [declaredCustomsRate, setDeclaredCustomsRate] = useState("");
  const [purchaseOrigin, setPurchaseOrigin] =
    useState<PurchaseOriginChoice>("LOCAL");
  const [importDraft, setImportDraft] = useState<PurchaseImportDraft>(
    emptyPurchaseImportDraft
  );
  const [ppnRatePercent, setPpnRatePercent] = useState(
    String(DEFAULT_PRODUCT_PPN_RATE_PERCENT)
  );
  const [invoiceDate, setInvoiceDate] = useState(todayDateInput);
  const [invoiceRef, setInvoiceRef] = useState("");
  const [amount, setAmount] = useState("");
  const [lines, setLines] = useState<PurchaseLineDraft[]>([newPurchaseLine()]);
  const catalogItems = catalogItemsProp;
  const vendors = vendorsProp;
  const [vehicleLease, setVehicleLease] = useState<PurchaseVehicleLeaseDraft>(
    emptyVehicleLeaseDraft
  );
  const [bankLoan, setBankLoan] = useState<PurchaseBankLoanDraft>(
    emptyBankLoanDraft
  );
  const [transferFee, setTransferFee] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccountOption[]>(
    []
  );
  const [bankAccountId, setBankAccountId] = useState("");
  const [vendorChoice, setVendorChoice] = useState("");
  const [governmentTaxKind, setGovernmentTaxKind] =
    useState<GovernmentTaxKindChoice>("PPN");
  const [paymentTermsDays, setPaymentTermsDays] = useState(14);
  const [importFulfillment, setImportFulfillment] = useState<
    "INTERNAL" | "OUTSOURCED"
  >("INTERNAL");
  const [importDutiesBillingId, setImportDutiesBillingId] = useState("");
  const [importDutiesFile, setImportDutiesFile] = useState<File | null>(null);
  const [handlingVendorId, setHandlingVendorId] = useState("");
  const [handlingFeeIdr, setHandlingFeeIdr] = useState("");
  const [handlingFeeIncludesPpn, setHandlingFeeIncludesPpn] = useState(false);
  const [handlingFeePpnRatePercent, setHandlingFeePpnRatePercent] =
    useState("11");
  const [handlingFeeFile, setHandlingFeeFile] = useState<File | null>(null);
  const [handlingFeeTaxFile, setHandlingFeeTaxFile] = useState<File | null>(
    null
  );

  const isPettyCash = purchaseCategory === "PETTY_CASH";
  const isGovernment = purchaseCategory === "GOVERNMENT";
  const isService = purchaseCategory === "SERVICE";
  const isVehicle = purchaseCategory === "VEHICLE";
  const isBankLoan = purchaseCategory === "BANK_LOAN";
  const isFreeOfCharge =
    freeOfCharge === "Yes" &&
    !isPettyCash &&
    !isGovernment &&
    !isVehicle &&
    !isBankLoan;
  const showInvoiceFields = !isFreeOfCharge || hasInvoice === "Yes";
  const showShippingCost = isFreeOfCharge && addShippingCost === "Yes";
  const allowCustomsFees =
    isFreeOfCharge &&
    purchaseCategory === "PRODUCT" &&
    purchaseOrigin === "IMPORT";
  const showCustomsFees = allowCustomsFees && hasCustomsFees === "Yes";
  const isFocImport = showCustomsFees;
  const shippingAmountNumber = parseImportDecimal(shippingAmount);
  const shippingRateNumber = parseImportDecimal(shippingRate);
  const shippingIdrPreview =
    showShippingCost && shippingAmountNumber != null && shippingAmountNumber > 0
      ? shippingCurrency === "IDR"
        ? shippingAmountNumber
        : shippingRateNumber != null && shippingRateNumber > 0
          ? shippingAmountNumber * shippingRateNumber
          : null
      : null;
  const isImport =
    purchaseCategory === "PRODUCT" &&
    purchaseOrigin === "IMPORT" &&
    !isFreeOfCharge;
  const usesImportFlow = isImport || isFocImport;
  const supplierVendors = vendors.filter((vendor) =>
    vendorMatchesPurchaseOrigin(
      vendor.vendorType,
      usesImportFlow ? "IMPORT" : "LOCAL"
    )
  );
  const handlingVendors = vendors.filter((vendor) =>
    vendorMatchesPurchaseOrigin(vendor.vendorType, "LOCAL")
  );
  const requireCatalogLines =
    purchaseCategory === "PRODUCT" || purchaseCategory === "VEHICLE";
  const pickerCatalogItems = catalogItems.filter((item) =>
    isVehicle
      ? isVehicleItemType(item.itemType)
      : !isVehicleItemType(item.itemType)
  );
  const requireServiceLines = isService;
  const requireItemLines = requireCatalogLines || requireServiceLines;
  const taxIncluded = includesPpn === "Yes";
  const kindHasVat =
    includedTaxKind !== "" && commercialTaxIncludesVat(includedTaxKind);
  const kindNeedsRate =
    includedTaxKind !== "" && commercialTaxRequiresRatePercent(includedTaxKind);
  const kindNeedsOtherName =
    includedTaxKind !== "" && commercialTaxRequiresOtherName(includedTaxKind);
  const withPpn = usesImportFlow
    ? importFulfillment === "INTERNAL" && importDraft.ppnApplied
    : taxIncluded && kindHasVat;
  const busy = pending;
  const parsedRate = parsePpnRatePercent(ppnRatePercent);
  const declaredAmountNumber = parseImportDecimal(declaredValue);
  const declaredRateNumber = parseImportDecimal(declaredCustomsRate);
  const declaredCif =
    isFocImport &&
    declaredAmountNumber != null &&
    declaredAmountNumber > 0 &&
    (declaredCurrency === "IDR" ||
      (declaredRateNumber != null && declaredRateNumber > 0))
      ? {
          value: declaredAmountNumber,
          currency: declaredCurrency,
          customsRate:
            declaredCurrency === "IDR" ? null : declaredRateNumber,
        }
      : null;
  const importCashPaidNow =
    isImport && isCashPaymentTerms(paymentTermsDays);
  const importInputRaw = isImport
    ? importDraftToInput(importDraft, {
        requireCustomsRates: false,
        requireBankRate: true,
      })
    : isFocImport && declaredCif
      ? focChargesDraftToInput(importDraft, declaredCif)
      : null;
  const importInput =
    importInputRaw && importFulfillment === "OUTSOURCED"
      ? {
          ...importInputRaw,
          formEApplied: false,
          beaMasukApplied: false,
          ppnbmApplied: false,
          ppnApplied: false,
          pph22Applied: false,
          clearanceCostIdr: 0,
        }
      : importInputRaw;
  const importResult = importInput
    ? calculateImportLandedCost(importInput as ImportLandedCostInput)
    : null;
  const handledByHeadOffice =
    usesImportFlow &&
    importFulfillment === "INTERNAL" &&
    isHandlingByHeadOffice(handlingVendorId);
  const handlingFeeNumber = parseContractPrice(handlingFeeIdr) ?? Number.NaN;
  const handlingRate = parsePpnRatePercent(handlingFeePpnRatePercent);
  const handlingPaid =
    Number.isFinite(handlingFeeNumber) && handlingFeeNumber >= 0
      ? handlingFeeIncludesPpn && handlingRate != null
        ? applyExclusiveVat(
            handlingFeeNumber,
            ppnRateFromPercent(handlingRate)
          ).gross
        : handlingFeeNumber
      : 0;
  const handlingCost =
    Number.isFinite(handlingFeeNumber) && handlingFeeNumber >= 0
      ? handlingFeeNumber
      : 0;
  const recordingArrivalNow = Boolean(importDutiesBillingId.trim());
  const importStockLandedCostIdr = importResult
    ? (isFocImport ? shippingIdrPreview ?? 0 : 0) +
      importResult.stockLandedCostIdr +
      handlingCost
    : 0;
  const localLinesTotal = lines.reduce((sum, line) => {
    const qty = isVehicle || isService ? 1 : Number(line.quantity);
    const price = parseContractPrice(line.unitPrice) ?? Number.NaN;
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum;
    return sum + qty * price;
  }, 0);
  const importQtyTotal = lines.reduce((sum, line) => {
    const qty = Number(line.quantity);
    return Number.isFinite(qty) && qty > 0 ? sum + qty : sum;
  }, 0);
  const importAllocated =
    importResult && usesImportFlow
      ? allocateImportStockCost({
          stockLandedCostIdr: importStockLandedCostIdr,
          headerForeignAmount: importInput!.foreignAmount,
          lines: lines.map((line) => ({
            quantity: Number(line.quantity) || 0,
            foreignAmount: parseImportDecimal(line.foreignAmount) ?? undefined,
          })),
        })
      : [];
  const linesTotal = isImport
    ? (importResult?.invoiceAmountIdr ?? 0)
    : localLinesTotal;
  const amountNumber = requireItemLines
    ? linesTotal
    : Number(String(amount).replace(/,/g, "").trim());
  const vatPreview =
    withPpn &&
    parsedRate != null &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0
      ? splitInclusiveVat(amountNumber, ppnRateFromPercent(parsedRate))
      : null;

  const purchaseDueHint = (() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) {
      return null;
    }
    const dueAt = dueAtFromPaymentTerms(
      new Date(`${invoiceDate}T00:00:00.000Z`),
      paymentTermsDays
    );
    const dueDate = formatDisplayDate(dueAt, { timeZone: "UTC" });
    if (isImport && !isCashPaymentTerms(paymentTermsDays)) {
      return t("pages.billing.purchasePaymentTermsImportNetHint", {
        days: paymentTermsDays,
      });
    }
    if (isCashPaymentTerms(paymentTermsDays)) {
      return t("pages.billing.purchasePaymentTermsCashHint", { dueDate });
    }
    return t("pages.billing.purchasePaymentTermsHint", {
      terms: t("common.paymentTerms.netShort", {
        days: paymentTermsDays,
      }),
      dueDate,
    });
  })();

  useEffect(() => {
    if (!vendorChoice) return;
    const vendor = vendors.find((item) => item.id === vendorChoice);
    if (
      !vendor ||
      !vendorMatchesPurchaseOrigin(
        vendor.vendorType,
        usesImportFlow ? "IMPORT" : "LOCAL"
      )
    ) {
      setVendorChoice("");
    }
  }, [vendorChoice, vendors, usesImportFlow]);

  useEffect(() => {
    if (!handlingVendorId || isHandlingByHeadOffice(handlingVendorId)) return;
    const vendor = vendors.find((item) => item.id === handlingVendorId);
    if (
      !vendor ||
      !vendorMatchesPurchaseOrigin(vendor.vendorType, "LOCAL")
    ) {
      setHandlingVendorId("");
    }
  }, [handlingVendorId, vendors]);

  useEffect(() => {
    if (!open) {
      return;
    }
    listPurchasePayoutBankAccounts()
      .then((accounts) => {
        setBankAccounts(accounts);
        setBankAccountId((current) => current || accounts[0]?.id || "");
      })
      .catch(() => setBankAccounts([]));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPending(false);
      setError(null);
      setDocumentFile(null);
      setTaxFile(null);
      setTaxReason("");
      setIncludesPpn("No");
      setIncludedTaxKind("");
      setPphRatePercent("");
      setOtherTaxName("");
      setPurchasePurpose("STOCK");
      setProjectId("");
      setPurchaseCategory("PRODUCT");
      setPickingLineKey(null);
      setPurchaseOrigin("LOCAL");
      setImportDraft(emptyPurchaseImportDraft());
      setPpnRatePercent(String(DEFAULT_PRODUCT_PPN_RATE_PERCENT));
      setFreeOfCharge("No");
      setFreeOfChargeReason("");
      setHasInvoice("Yes");
      setAddShippingCost("No");
      setShippingCurrency("IDR");
      setShippingAmount("");
      setShippingRate("");
      setShippingDescription("");
      setHasCustomsFees("No");
      setDeclaredValue("");
      setDeclaredCurrency("IDR");
      setDeclaredCustomsRate("");
      setInvoiceDate(todayDateInput());
      setInvoiceRef("");
      setAmount("");
      setLines([newPurchaseLine()]);
      setVehicleLease(emptyVehicleLeaseDraft());
      setBankLoan(emptyBankLoanDraft());
      setTransferFee("");
      setAmountTouched(false);
      setVendorChoice("");
      setBankAccountId("");
      setGovernmentTaxKind("PPN");
      setPaymentTermsDays(14);
      setImportFulfillment("INTERNAL");
      setImportDutiesBillingId("");
      setImportDutiesFile(null);
      setHandlingVendorId("");
      setHandlingFeeIdr("");
      setHandlingFeeIncludesPpn(false);
      setHandlingFeePpnRatePercent("11");
      setHandlingFeeFile(null);
      setHandlingFeeTaxFile(null);
    }
  }, [open]);

  useEffect(() => {
    if (!isBankLoan || amountTouched) return;
    const suggested = bankLoanSuggestedPayment(bankLoan);
    setAmount(suggested != null ? String(suggested) : "");
  }, [isBankLoan, amountTouched, bankLoan]);

  function handleDocumentPick(file: File | null) {
    setDocumentFile(file);
  }

  function applyPurchaseCategory(value: PurchaseCategoryChoice) {
    setPurchaseCategory(value);
    setPickingLineKey(null);
    if (value !== "PRODUCT") {
      setPurchaseOrigin("LOCAL");
      setImportDraft(emptyPurchaseImportDraft());
      setHasCustomsFees("No");
      setDeclaredValue("");
      setDeclaredCurrency("IDR");
      setDeclaredCustomsRate("");
      setImportDutiesBillingId("");
      setImportDutiesFile(null);
      setImportFulfillment("INTERNAL");
      setHandlingVendorId("");
      setHandlingFeeIdr("");
      setHandlingFeeIncludesPpn(false);
      setHandlingFeeFile(null);
      setHandlingFeeTaxFile(null);
    }
    if (value === "SERVICE") {
      setPurchasePurpose("INTERNAL");
      setProjectId("");
      setLines([newPurchaseLine()]);
      setHasCustomsFees("No");
    }
    if (value !== "SERVICE") {
      setShippingDescription("");
    }
    if (value === "PRODUCT") {
      setPurchasePurpose("STOCK");
      setLines([newPurchaseLine()]);
      setVehicleLease(emptyVehicleLeaseDraft());
    }
    if (value === "VEHICLE") {
      setPurchasePurpose("STOCK");
      setPurchaseOrigin("LOCAL");
      setFreeOfCharge("No");
      setFreeOfChargeReason("");
      setPaymentTermsDays(CASH_PAYMENT_TERMS_DAYS);
      setLines([newPurchaseLine()]);
      setVehicleLease(emptyVehicleLeaseDraft());
    }
    if (value === "PETTY_CASH") {
      setPurchasePurpose("STOCK");
      setProjectId("");
      setIncludesPpn("No");
      setIncludedTaxKind("");
      setTaxFile(null);
      setFreeOfCharge("No");
      setFreeOfChargeReason("");
    }
    if (value === "GOVERNMENT") {
      setPurchasePurpose("INTERNAL");
      setProjectId("");
      setIncludesPpn("No");
      setFreeOfCharge("No");
      setFreeOfChargeReason("");
      setIncludedTaxKind("");
      setTaxFile(null);
      setVendorChoice("");
    }
    if (value === "BANK_LOAN") {
      setPurchasePurpose("INTERNAL");
      setProjectId("");
      setPurchaseOrigin("LOCAL");
      setIncludesPpn("No");
      setFreeOfCharge("No");
      setFreeOfChargeReason("");
      setIncludedTaxKind("");
      setTaxFile(null);
      setPaymentTermsDays(CASH_PAYMENT_TERMS_DAYS);
      setBankLoan(emptyBankLoanDraft());
      setAmountTouched(false);
    }
    if (value !== "BANK_LOAN") {
      setBankLoan(emptyBankLoanDraft());
      setAmountTouched(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const localTaxIncluded = !usesImportFlow && taxIncluded;
    formData.set(
      "includesPpn",
      (usesImportFlow ? withPpn : localTaxIncluded) ? "true" : "false"
    );
    if (localTaxIncluded) {
      if (!includedTaxKind) {
        setError(t("pages.billing.purchaseIncludedTaxKindRequired"));
        return;
      }
      formData.set("includedTaxKind", includedTaxKind);
      if (commercialTaxRequiresOtherName(includedTaxKind)) {
        if (!otherTaxName.trim()) {
          setError(t("pages.billing.otherTaxNameRequired"));
          return;
        }
        formData.set("otherTaxName", otherTaxName.trim());
      } else {
        formData.delete("otherTaxName");
      }
      if (commercialTaxRequiresRatePercent(includedTaxKind)) {
        const parsedPphRate = parsePpnRatePercent(pphRatePercent);
        if (parsedPphRate == null) {
          setError(
            includedTaxKind === "OTHER"
              ? t("pages.billing.otherTaxRateRequired")
              : t("pages.billing.purchasePphRateRequired")
          );
          return;
        }
        formData.set("pphRatePercent", String(parsedPphRate));
      } else {
        formData.delete("pphRatePercent");
      }
    } else {
      formData.delete("includedTaxKind");
      formData.delete("otherTaxName");
      formData.delete("pphRatePercent");
    }
    formData.set(
      "purchasePurpose",
      isService
        ? purchasePurpose
        : isGovernment || isBankLoan
          ? "INTERNAL"
          : "STOCK"
    );
    formData.set(
      "projectId",
      isService && purchasePurpose === "PROJECT" ? projectId : ""
    );
    formData.set("purchaseCategory", purchaseCategory);
    formData.set(
      "purchaseOrigin",
      purchaseCategory === "PRODUCT" ? purchaseOrigin : "LOCAL"
    );
    formData.set("invoiceRef", showInvoiceFields ? invoiceRef.trim() : "");
    formData.set(
      "invoiceDate",
      showInvoiceFields
        ? invoiceDate
        : /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)
          ? invoiceDate
          : todayDateInput()
    );
    formData.set(
      "paymentTermsDays",
      String(
        isFreeOfCharge || isVehicle || isBankLoan
          ? CASH_PAYMENT_TERMS_DAYS
          : paymentTermsDays
      )
    );
    formData.set("transferFeeIdr", transferFee.trim());
    formData.set("freeOfCharge", isFreeOfCharge ? "true" : "false");
    formData.set("hasInvoice", showInvoiceFields ? "true" : "false");
    formData.set(
      "hasCustomsFees",
      allowCustomsFees && hasCustomsFees === "Yes" ? "true" : "false"
    );
    if (isFreeOfCharge) {
      const reason = freeOfChargeReason.trim();
      if (!reason) {
        setError(t("pages.billing.purchaseFreeOfChargeReasonRequired"));
        return;
      }
      formData.set("freeOfChargeReason", reason);
      if (!allowCustomsFees || hasCustomsFees !== "Yes") {
        formData.set("purchaseOrigin", "LOCAL");
        formData.set("includesPpn", "false");
      }
      if (addShippingCost === "Yes") {
        const shippingValue = parseImportDecimal(shippingAmount);
        if (shippingValue == null || shippingValue <= 0) {
          setError(
            t(
              isService
                ? "pages.billing.purchaseRelatedCostAmountRequired"
                : "pages.billing.purchaseShippingRequired"
            )
          );
          return;
        }
        if (shippingCurrency !== "IDR") {
          const rateValue = parseImportDecimal(shippingRate);
          if (rateValue == null || rateValue <= 0) {
            setError(
              t(
                isService
                  ? "pages.billing.purchaseRelatedCostRateRequired"
                  : "pages.billing.purchaseShippingRateRequired"
              )
            );
            return;
          }
        }
        if (isService) {
          const relatedWhat = shippingDescription.trim();
          if (!relatedWhat) {
            setError(t("pages.billing.purchaseRelatedCostRequired"));
            return;
          }
          formData.set("shippingDescription", relatedWhat);
        } else {
          formData.delete("shippingDescription");
        }
        formData.set("shippingCurrency", shippingCurrency);
        formData.set("shippingForeignAmount", shippingAmount.trim());
        formData.set(
          "shippingRateToIdr",
          shippingCurrency === "IDR" ? "" : shippingRate.trim()
        );
      } else {
        formData.delete("shippingCurrency");
        formData.delete("shippingForeignAmount");
        formData.delete("shippingRateToIdr");
        formData.delete("shippingDescription");
      }
      if (allowCustomsFees && hasCustomsFees === "Yes") {
        if (
          declaredValue.trim() &&
          (declaredAmountNumber == null || declaredAmountNumber <= 0)
        ) {
          setError(t("pages.billing.purchaseDeclaredValueRequired"));
          return;
        }
        if (
          declaredValue.trim() &&
          declaredCurrency !== "IDR" &&
          (declaredRateNumber == null || declaredRateNumber <= 0)
        ) {
          setError(t("pages.billing.purchaseDeclaredCustomsRateRequired"));
          return;
        }
        formData.set("purchaseOrigin", "IMPORT");
        formData.set("declaredValue", declaredValue.trim());
        formData.set("declaredCurrency", declaredCurrency);
        formData.set(
          "declaredCustomsRate",
          declaredCurrency === "IDR" ? "" : declaredCustomsRate.trim()
        );
      } else {
        formData.delete("declaredValue");
        formData.delete("declaredCurrency");
        formData.delete("declaredCustomsRate");
      }
    }

    if (isPettyCash || isGovernment) {
      formData.set("amount", amount.trim());
      if (isGovernment) {
        formData.set("governmentTaxKind", governmentTaxKind);
        formData.set("notes", String(formData.get("notes") ?? "").trim());
        if (!documentFile || documentFile.size === 0) {
          setError(t("pages.billing.governmentDocumentRequired"));
          return;
        }
      }
      if (documentFile && documentFile.size > 0) {
        formData.set("document", documentFile);
      }
      setPending(true);
      try {
        await createPurchaseInvoice(formData);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("pages.billing.purchaseUploadFailed")
        );
      } finally {
        setPending(false);
      }
      return;
    }

    if (isBankLoan) {
      if (!bankLoan.kind) {
        setError(t("pages.billing.bankLoanKindRequired"));
        return;
      }
      const vendorId = vendorChoice;
      const vendor = supplierVendors.find((item) => item.id === vendorId);
      if (!vendor) {
        setError(t("pages.billing.purchaseVendorRequired"));
        return;
      }
      if (!amount.trim()) {
        setError(t("pages.billing.bankLoanPaymentAmountHint"));
        return;
      }
      if (!documentFile || documentFile.size === 0) {
        setError(t("pages.billing.governmentDocumentRequired"));
        return;
      }
      formData.set("supplierName", vendor.name);
      formData.set("vendorId", vendor.id);
      formData.set("amount", amount.trim());
      formData.set("bankLoanKind", bankLoan.kind);
      formData.set("bankLoanFacilityLimit", bankLoan.facilityLimit);
      formData.set("bankLoanDrawnAmount", bankLoan.drawnAmount);
      formData.set("bankLoanPrincipal", bankLoan.principal);
      formData.set("bankLoanAnnualRatePercent", bankLoan.annualRatePercent);
      formData.set("bankLoanTenorMonths", bankLoan.tenorMonths);
      formData.set("document", documentFile);
      setPending(true);
      try {
        await createPurchaseInvoice(formData);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("pages.billing.purchaseUploadFailed")
        );
      } finally {
        setPending(false);
      }
      return;
    }

    if (isService && purchasePurpose === "PROJECT" && !projectId) {
      setError(t("pages.billing.purchaseProjectRequired"));
      return;
    }

    const vendorId = vendorChoice;
    const vendor = supplierVendors.find((item) => item.id === vendorId);
    if (!vendor) {
      setError(
        usesImportFlow
          ? t("pages.billing.purchaseVendorOverseasRequired")
          : t("pages.billing.purchaseVendorRequired")
      );
      return;
    }
    formData.set("supplierName", vendor.name);
    formData.set("vendorId", vendor.id);

    if (usesImportFlow) {
      if (
        !isFocImport &&
        !importDraftToInput(importDraft, { requireBankRate: true })
      ) {
        setError(
          importCashPaidNow
            ? t("pages.billing.purchaseMarkPaidBankRateRequired")
            : t("pages.billing.purchaseImportBookingRateRequired")
        );
        return;
      }
      if (!importInput || !importResult) {
        if (!isFocImport) {
          setError(t("pages.billing.purchaseImportRequired"));
          return;
        }
        formData.delete("importJson");
        formData.set("importFulfillment", importFulfillment);
      } else {
      formData.set("importJson", JSON.stringify(importInput));
      formData.set("importFulfillment", importFulfillment);
      formData.set(
        "handlingVendorId",
        handledByHeadOffice ? HANDLING_BY_HEAD_OFFICE : handlingVendorId
      );
      formData.set(
        "handlingFeeIdr",
        handledByHeadOffice ? "" : handlingFeeIdr.trim()
      );
      formData.set(
        "handlingFeeIncludesPpn",
        !handledByHeadOffice && handlingFeeIncludesPpn ? "true" : "false"
      );
      formData.set("handlingFeePpnRatePercent", handlingFeePpnRatePercent);
      formData.set("importDutiesBillingId", "");
      const startedHandling =
        Boolean(handlingVendorId) ||
        (Number.isFinite(handlingFeeNumber) && handlingFeeNumber > 0) ||
        Boolean(handlingFeeFile && handlingFeeFile.size > 0);
      if (importFulfillment === "OUTSOURCED" && startedHandling) {
        if (!handlingVendorId || isHandlingByHeadOffice(handlingVendorId)) {
          setError(t("pages.billing.handlingVendorRequired"));
          return;
        }
        if (!handlingVendors.some((vendor) => vendor.id === handlingVendorId)) {
          setError(t("pages.billing.handlingVendorMustBeLocal"));
          return;
        }
        if (!Number.isFinite(handlingFeeNumber) || handlingFeeNumber <= 0) {
          setError(t("pages.billing.handlingFeeRequired"));
          return;
        }
      }
      const needHandlingInvoice =
        startedHandling &&
        !handledByHeadOffice &&
        (importFulfillment === "OUTSOURCED" ||
          (Number.isFinite(handlingFeeNumber) && handlingFeeNumber > 0));
      if (needHandlingInvoice && (!handlingFeeFile || handlingFeeFile.size === 0)) {
        setError(t("pages.billing.handlingFeeInvoiceRequired"));
        return;
      }
      if (
        !handledByHeadOffice &&
        handlingFeeIncludesPpn &&
        (!handlingFeeTaxFile || handlingFeeTaxFile.size === 0)
      ) {
        setError(t("pages.billing.handlingFeeTaxInvoiceRequired"));
        return;
      }
      if (
        !handledByHeadOffice &&
        handlingFeeFile &&
        handlingFeeFile.size > 0
      ) {
        formData.set("handlingFeeDocument", handlingFeeFile);
      }
      if (
        !handledByHeadOffice &&
        handlingFeeTaxFile &&
        handlingFeeTaxFile.size > 0
      ) {
        formData.set("handlingFeeTaxDocument", handlingFeeTaxFile);
      }
      }
    } else {
      formData.delete("importJson");
    }

    if (requireItemLines) {
      if (requireCatalogLines && pickerCatalogItems.length === 0) {
        setError(
          isVehicle
            ? t("pages.billing.purchaseVehicleCatalogEmpty")
            : t("pages.billing.purchaseCatalogEmpty")
        );
        return;
      }
      const parsedLines: {
        itemId?: string;
        description?: string;
        quantity: number;
        unitPrice: number;
        foreignAmount?: number;
        unit?: string;
        packContents?: number;
      }[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (requireCatalogLines && !line.itemId) {
          setError(t("pages.billing.purchaseLineItemRequired", { n: i + 1 }));
          return;
        }
        if (requireServiceLines && !line.description.trim()) {
          setError(t("pages.billing.purchaseServiceLineRequired", { n: i + 1 }));
          return;
        }
        const quantity = isVehicle || isService ? 1 : Number(line.quantity);
        if (!isService && (!Number.isFinite(quantity) || quantity <= 0)) {
          setError(t("pages.billing.purchaseLineQtyRequired", { n: i + 1 }));
          return;
        }
        const catalogItem = catalogItems.find((entry) => entry.id === line.itemId);
        const unit = catalogItem
          ? normalizeInventoryUnit(catalogItem.unit)
          : normalizeInventoryUnit(line.unit || "pcs");
        if (
          !isService &&
          !allowsDecimalInventoryQty(unit) &&
          !isWholeInventoryQty(quantity)
        ) {
          setError(
            t("pages.inventory.quantityMustBeWhole", {
              field: t("pages.billing.purchaseQty"),
            })
          );
          return;
        }
        if (usesImportFlow) {
          const allocated = importAllocated[i];
          const foreignAmount = parseImportDecimal(line.foreignAmount);
          parsedLines.push({
            itemId: line.itemId || undefined,
            description: line.description.trim() || undefined,
            quantity,
            unitPrice: allocated?.unitCostIdr ?? 0,
            foreignAmount: foreignAmount ?? undefined,
            unit,
          });
        } else {
          const unitPrice = isFreeOfCharge
            ? 0
            : parseContractPrice(line.unitPrice) ?? Number.NaN;
          if (!isFreeOfCharge && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
            setError(
              t(
                isService
                  ? "pages.billing.purchaseServiceAmountRequired"
                  : "pages.billing.purchaseLineCostRequired",
                { n: i + 1 }
              )
            );
            return;
          }
          parsedLines.push({
            itemId: line.itemId || undefined,
            description: line.description.trim() || undefined,
            quantity,
            unitPrice,
            unit,
          });
        }
      }
      if (parsedLines.length === 0) {
        setError(
          requireServiceLines
            ? t("pages.billing.purchaseServiceLinesRequired")
            : t("pages.billing.purchaseLinesRequired")
        );
        return;
      }
      formData.set("linesJson", JSON.stringify(parsedLines));
      formData.set(
        "amount",
        String(
          Math.round(
            (isImport
              ? importResult!.cashOutIdr
              : isFocImport
                ? 0
                : localLinesTotal) * 100
          ) / 100
        )
      );
    } else {
      formData.set("amount", amount.trim());
      formData.delete("linesJson");
    }

    if (usesImportFlow) {
      if (importDraft.ppnApplied) {
        const importPpnRate =
          parsePpnRatePercent(importDraft.ppnRatePercent) ??
          DEFAULT_PRODUCT_PPN_RATE_PERCENT;
        formData.set("ppnRatePercent", String(importPpnRate));
      } else {
        formData.delete("ppnRatePercent");
      }
    } else if (withPpn) {
      if (parsedRate == null) {
        setError(t("pages.billing.purchasePpnRateRequired"));
        return;
      }
      formData.set("ppnRatePercent", String(parsedRate));
    } else {
      formData.delete("ppnRatePercent");
    }

    if (showInvoiceFields && (!documentFile || documentFile.size <= 0)) {
      setError(t("pages.billing.purchaseChooseDocument"));
      return;
    }
    if (documentFile && documentFile.size > 0) {
      formData.set("document", documentFile);
    } else {
      formData.delete("document");
    }

    if (!usesImportFlow && withPpn && taxFile && taxFile.size > 0) {
      if (!taxReason.trim()) {
        setError(t("pages.billing.inHouseReasonRequired"));
        return;
      }
      formData.set("taxInvoiceDocument", taxFile);
      formData.set("manualReason", taxReason);
    } else {
      formData.delete("taxInvoiceDocument");
      formData.delete("manualReason");
    }

    if (bankAccounts.length > 0 && !bankAccountId) {
      setError(t("pages.billing.purchaseBankAccountRequired"));
      return;
    }
    formData.set("bankAccountId", bankAccountId);

    if (isVehicle) {
      if (!vehicleLease.plateNumber.trim()) {
        setError(t("pages.billing.purchaseVehiclePlateRequired"));
        return;
      }
      if (!vehicleLease.vehicleYear.trim()) {
        setError(t("pages.billing.purchaseVehicleYearRequired"));
        return;
      }
      formData.set("vehiclePlate", vehicleLease.plateNumber);
      formData.set("vehicleYear", vehicleLease.vehicleYear);
      formData.set("isVehicleLease", vehicleLease.enabled ? "true" : "false");
      if (vehicleLease.enabled) {
        formData.set("leaseOtrAmount", vehicleLease.otrAmount);
        formData.set("leaseDownPayment", vehicleLease.downPayment);
        formData.set("leaseTenorMonths", vehicleLease.tenorMonths);
        formData.set("leaseInterestPercentYear", vehicleLease.interestPercentYear);
        formData.set("leaseAdminFee", vehicleLease.adminFee);
        formData.set("leaseInsuranceAmount", vehicleLease.insuranceAmount);
        formData.set("leaseFiduciaryFee", vehicleLease.fiduciaryFee);
        formData.set("leaseProvisionFee", vehicleLease.provisionFee);
        formData.set("leaseOtherFee", vehicleLease.otherFee);
      }
    }

    if (withPpn && vatPreview) {
      if (vatPreview.dpp + vatPreview.ppn !== vatPreview.gross) {
        setError(t("pages.billing.purchaseVatSplitMismatch"));
        return;
      }
    }

    setPending(true);
    try {
      await createPurchaseInvoice(formData);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("pages.billing.purchaseUploadFailed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="permissionsBadge" size="badgeFlex">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t("pages.billing.purchaseUpload")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={Plus}
        title={t("pages.billing.purchaseUploadTitle")}
        description={t("pages.billing.purchaseUploadDesc")}
        maxWidth="lg"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="purchase-invoice-upload-form"
              disabled={
                busy ||
                (isPettyCash
                  ? !amount.trim()
                  : isGovernment
                    ? !amount.trim() || !documentFile
                    : isBankLoan
                      ? !amount.trim() ||
                        !documentFile ||
                        !bankLoan.kind ||
                        !vendorChoice
                      : (showInvoiceFields && !documentFile) ||
                        vendors.length === 0 ||
                        !vendorChoice ||
                        (requireCatalogLines && pickerCatalogItems.length === 0))
              }
            >
              {pending
                ? t("pages.billing.purchaseUploading")
                : t("pages.billing.purchaseUploadConfirm")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        <form
          id="purchase-invoice-upload-form"
          onSubmit={handleSubmit}
          className={employeeDialogFormClass}
        >
          <div className={employeeDialogGridClass}>
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                id="purchase-category-label"
                className={employeeDialogLabelClass}
              >
                {t("pages.billing.purchaseCategory")}
                <span className="text-red-400"> *</span>
              </label>
              <div
                id="purchase-category"
                role="radiogroup"
                aria-labelledby="purchase-category-label"
                className="grid grid-cols-2 gap-2"
              >
                {(
                  [
                    ["PRODUCT", t("pages.billing.purchaseCategoryProduct")],
                    ["SERVICE", t("pages.billing.purchaseCategoryService")],
                    [
                      "GOVERNMENT",
                      t("pages.billing.purchaseCategoryGovernment"),
                    ],
                    [
                      "PETTY_CASH",
                      t("pages.billing.purchaseCategoryPettyCash"),
                    ],
                  ] as Array<[PurchaseCategoryChoice, string]>
                ).map(([value, label]) => {
                  const active = purchaseCategory === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={busy}
                      onClick={() => applyPurchaseCategory(value)}
                      className={cn(
                        "inline-flex min-h-8 w-full items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                        active && outlineChipTones.emeraldInteractive,
                        !active &&
                          "border border-border bg-elevated text-muted hover:border-border-strong hover:bg-card-hover hover:text-text"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
                {(
                  [
                    ["VEHICLE", t("pages.billing.purchaseCategoryVehicle")],
                    ["BANK_LOAN", t("pages.billing.purchaseCategoryBankLoan")],
                  ] as Array<[PurchaseCategoryChoice, string]>
                ).map(([value, label]) => {
                  const active = purchaseCategory === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={busy}
                      onClick={() => applyPurchaseCategory(value)}
                      className={cn(
                        "inline-flex min-h-8 w-full items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                        active && outlineChipTones.emeraldInteractive,
                        !active &&
                          "border border-border bg-elevated text-muted hover:border-border-strong hover:bg-card-hover hover:text-text"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className={employeeDialogHintClass}>
                {t("pages.billing.purchaseCategoryHint")}
              </p>
            </div>

            {purchaseCategory === "PRODUCT" ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  id="purchase-origin-label"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.purchaseOrigin")}
                  <span className="text-red-400"> *</span>
                </label>
                <div
                  id="purchase-origin"
                  role="radiogroup"
                  aria-labelledby="purchase-origin-label"
                  className="grid grid-cols-2 gap-2"
                >
                  {(
                    [
                      ["LOCAL", t("pages.billing.purchaseOriginLocal")],
                      ["IMPORT", t("pages.billing.purchaseOriginImport")],
                    ] as const
                  ).map(([value, label]) => {
                    const active = purchaseOrigin === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={busy}
                        onClick={() => {
                          setPurchaseOrigin(value);
                          if (value === "LOCAL") {
                            setImportDraft(emptyPurchaseImportDraft());
                            setHasCustomsFees("No");
                            setDeclaredValue("");
                            setDeclaredCurrency("IDR");
                            setDeclaredCustomsRate("");
                            setImportDutiesBillingId("");
                            setImportDutiesFile(null);
                            setImportFulfillment("INTERNAL");
                            setHandlingVendorId("");
                            setHandlingFeeIdr("");
                            setHandlingFeeIncludesPpn(false);
                            setHandlingFeeFile(null);
                            setHandlingFeeTaxFile(null);
                          } else {
                            setIncludesPpn("No");
                            setIncludedTaxKind("");
                            setTaxFile(null);
                          }
                        }}
                        className={cn(
                          "inline-flex min-h-8 w-full items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                          active && outlineChipTones.emeraldInteractive,
                          !active &&
                            "border border-border bg-elevated text-muted hover:border-border-strong hover:bg-card-hover hover:text-text"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.purchaseOriginHint")}
                </p>
                {isFreeOfCharge && purchaseOrigin === "LOCAL" ? (
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.purchaseCustomsFeesImportOnlyHint")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {isPettyCash || isGovernment || isVehicle || isBankLoan ? null : (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  id="purchase-free-of-charge-label"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.purchaseFreeOfCharge")}
                  <span className="text-red-400"> *</span>
                </label>
                <YesNoChoiceCards
                  id="purchase-free-of-charge"
                  labelledBy="purchase-free-of-charge-label"
                  value={freeOfCharge}
                  onChange={(value) => {
                    setFreeOfCharge(value);
                    if (value === "Yes") {
                      setIncludesPpn("No");
                      setIncludedTaxKind("");
                      setOtherTaxName("");
                      setTaxFile(null);
                      setImportDraft(emptyPurchaseImportDraft());
                      if (purchaseOrigin !== "IMPORT") {
                        setHasCustomsFees("No");
                        setDeclaredValue("");
                        setDeclaredCurrency("IDR");
                        setDeclaredCustomsRate("");
                        setImportDutiesBillingId("");
                        setImportDutiesFile(null);
                        setImportFulfillment("INTERNAL");
                        setHandlingVendorId("");
                        setHandlingFeeIdr("");
                        setHandlingFeeIncludesPpn(false);
                        setHandlingFeeFile(null);
                        setHandlingFeeTaxFile(null);
                      }
                      setLines((current) =>
                        current.map((row) => ({ ...row, unitPrice: "0" }))
                      );
                      const alreadyTyped =
                        Boolean(invoiceRef.trim()) || Boolean(documentFile);
                      setHasInvoice(alreadyTyped ? "Yes" : "No");
                      if (!alreadyTyped) {
                        setInvoiceRef("");
                        setInvoiceDate(todayDateInput());
                        setDocumentFile(null);
                      }
                    } else {
                      setHasInvoice("Yes");
                      setAddShippingCost("No");
                      setShippingCurrency("IDR");
                      setShippingAmount("");
                      setShippingRate("");
                      setShippingDescription("");
                      setHasCustomsFees("No");
                      setDeclaredValue("");
                      setDeclaredCurrency("IDR");
                      setDeclaredCustomsRate("");
                    }
                  }}
                />
                <p className={employeeDialogHintClass}>
                  {t(
                    isService
                      ? "pages.billing.purchaseFreeOfChargeServiceHint"
                      : "pages.billing.purchaseFreeOfChargeHint"
                  )}
                </p>
              </div>
            )}

            {isFreeOfCharge ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  htmlFor="purchase-free-of-charge-reason"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.purchaseFreeOfChargeReason")}
                  <span className="text-red-400"> *</span>
                </label>
                <Textarea
                  id="purchase-free-of-charge-reason"
                  name="freeOfChargeReason"
                  required
                  disabled={busy}
                  rows={2}
                  value={freeOfChargeReason}
                  onChange={(event) =>
                    setFreeOfChargeReason(event.target.value)
                  }
                  placeholder={t(
                    "pages.billing.purchaseFreeOfChargeReasonPlaceholder"
                  )}
                  className="min-h-[4.5rem] rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-text shadow-none placeholder:text-subtle focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/10"
                />
              </div>
            ) : null}

            {isFreeOfCharge ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  id="purchase-has-invoice-label"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.purchaseHasInvoice")}
                  <span className="text-red-400"> *</span>
                </label>
                <YesNoChoiceCards
                  id="purchase-has-invoice"
                  labelledBy="purchase-has-invoice-label"
                  value={hasInvoice}
                  onChange={(value) => {
                    setHasInvoice(value);
                    if (value === "No") {
                      setInvoiceRef("");
                      setInvoiceDate(todayDateInput());
                      setDocumentFile(null);
                    }
                  }}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.purchaseHasInvoiceHint")}
                </p>
              </div>
            ) : null}

            {isPettyCash ||
            isGovernment ||
            isVehicle ||
            isBankLoan ||
            isFreeOfCharge ||
            isImport ? null : (
              <PaymentTermsField
                className="sm:col-span-2"
                value={paymentTermsDays}
                onChange={setPaymentTermsDays}
                labelKey="pages.billing.purchasePaymentTerms"
                hintKey="pages.billing.purchasePaymentTermsHintField"
              />
            )}

            <CompanyBankAccountField
              className="sm:col-span-2"
              accounts={bankAccounts}
              value={bankAccountId}
              onChange={setBankAccountId}
              label={t("pages.billing.purchaseBankAccount")}
              hint={t("pages.billing.purchaseBankAccountHint")}
              disabled={busy}
            />

            {usesImportFlow ? null : (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  htmlFor="purchase-transfer-fee"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.purchaseTransferFee")}
                </label>
                <MoneyInput
                  id="purchase-transfer-fee"
                  name="transferFeeIdr"
                  disabled={busy}
                  value={transferFee}
                  onValueChange={setTransferFee}
                  placeholder={t("pages.billing.purchaseTransferFeePlaceholder")}
                  className={employeeInputClass}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.purchaseTransferFeeHint")}
                </p>
              </div>
            )}

            {isImport ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.billing.importFulfillment")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["INTERNAL", t("pages.billing.importHandledInternally")],
                      ["OUTSOURCED", t("pages.billing.importOutsourced")],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setImportFulfillment(value);
                        if (
                          value === "OUTSOURCED" &&
                          isHandlingByHeadOffice(handlingVendorId)
                        ) {
                          setHandlingVendorId("");
                        }
                      }}
                      className={cn(
                        "inline-flex min-h-8 w-full items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                        importFulfillment === value &&
                          outlineChipTones.emeraldInteractive,
                        importFulfillment !== value &&
                          "border border-border bg-elevated text-muted hover:border-border-strong hover:bg-card-hover hover:text-text"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className={employeeDialogHintClass}>
                  {importFulfillment === "OUTSOURCED"
                    ? t("pages.billing.importOutsourcedHint")
                    : t("pages.billing.importHandledInternallyHint")}
                </p>
                {!isCashPaymentTerms(paymentTermsDays) ? (
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.importDutiesNoTermsHint")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {isBankLoan ? (
              <PurchaseBankLoanFields
                draft={bankLoan}
                onChange={(next) => {
                  setBankLoan(next);
                  setAmountTouched(false);
                }}
                disabled={busy}
              />
            ) : null}

            {isGovernment ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  htmlFor="government-tax-kind"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.governmentTaxType")}
                  <span className="text-red-400"> *</span>
                </label>
                <Select
                  value={governmentTaxKind || null}
                  onValueChange={(value) => {
                    if (!value) return;
                    setGovernmentTaxKind(value as GovernmentTaxKindChoice);
                  }}
                  disabled={busy}
                >
                  <SelectTrigger
                    id="government-tax-kind"
                    className={cn(employeeSelectTriggerClass, "w-full")}
                  >
                    <SelectValue>
                      {(value) =>
                        value
                          ? t(
                              governmentTaxKindLabelKey(
                                value as GovernmentTaxKindChoice
                              )
                            )
                          : t("pages.billing.governmentTaxType")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {governmentTaxKindPickerOptions(governmentTaxKind).map(
                      (value) => (
                        <SelectItem key={value} value={value}>
                          {t(governmentTaxKindLabelKey(value))}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.governmentTaxTypeHint")}
                </p>
              </div>
            ) : null}

            {isPettyCash || !showInvoiceFields ? null : (
            <div className="sm:col-span-2 space-y-2">
              <BillingDocumentFilePick
                id="purchase-document"
                label={
                  isGovernment
                    ? t("pages.billing.governmentDocument")
                    : isBankLoan
                      ? t("pages.billing.bankLoanDocument")
                      : isImport
                        ? t("pages.billing.purchaseFactoryInvoice")
                        : t("pages.billing.purchaseDocument")
                }
                required
                fileName={documentFile?.name ?? null}
                onPick={handleDocumentPick}
                disabled={busy}
              />
            </div>
            )}

            {isPettyCash || isGovernment ? null : (
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                htmlFor="purchase-vendor"
                className={employeeDialogLabelClass}
              >
                {t("pages.billing.purchaseSupplier")}
                <span className="text-red-400"> *</span>
              </label>
              {supplierVendors.length === 0 ? (
                <p className={employeeDialogHintClass} role="status">
                  {usesImportFlow
                    ? t("pages.billing.purchaseVendorRegisterOverseasFirst")
                    : t("pages.billing.purchaseVendorRegisterLocalFirst")}
                </p>
              ) : (
                <Select
                  value={vendorChoice || null}
                  onValueChange={(value) => {
                    if (value == null) return;
                    setVendorChoice(value);
                  }}
                  disabled={busy}
                >
                  <SelectTrigger
                    id="purchase-vendor"
                    className={cn(employeeSelectTriggerClass, "w-full")}
                  >
                    <SelectValue
                      placeholder={t("pages.billing.purchaseVendorSelect")}
                    >
                      {(value) => {
                        if (!value) {
                          return t("pages.billing.purchaseVendorSelect");
                        }
                        const vendor = supplierVendors.find(
                          (item) => item.id === value
                        );
                        return vendor?.name ?? null;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {supplierVendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {purchaseDueHint && !isFreeOfCharge ? (
                <p className={cn(employeeDialogHintClass, "mt-2")}>
                  {purchaseDueHint}
                </p>
              ) : supplierVendors.length > 0 ? (
                <p className={cn(employeeDialogHintClass, "mt-2")}>
                  {usesImportFlow
                    ? t("pages.billing.purchaseVendorMustBeOverseas")
                    : t("pages.billing.purchaseVendorMustBeRegistered")}
                </p>
              ) : null}
            </div>
            )}

            {isPettyCash || (!isGovernment && !showInvoiceFields) ? null : (
            <div className={employeeDialogFieldClass}>
              <label htmlFor="purchase-ref" className={employeeDialogLabelClass}>
                {isGovernment
                  ? t("pages.billing.governmentBillingId")
                  : isBankLoan
                    ? t("pages.billing.bankLoanRef")
                    : t("pages.billing.purchaseInvoiceRef")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                id="purchase-ref"
                name="invoiceRef"
                required
                disabled={busy}
                value={invoiceRef}
                onChange={(event) => setInvoiceRef(event.target.value)}
                placeholder={
                  isGovernment
                    ? t("pages.billing.governmentBillingIdPlaceholder")
                    : isBankLoan
                      ? t("pages.billing.bankLoanRefPlaceholder")
                      : t("pages.billing.purchaseInvoiceRefPlaceholder")
                }
                className={employeeInputClass}
              />
              {isGovernment ? (
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.governmentBillingIdHint")}
                </p>
              ) : isBankLoan ? (
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.bankLoanRefHint")}
                </p>
              ) : null}
            </div>
            )}

            {isPettyCash || showInvoiceFields ? (
            <div
              className={cn(
                employeeDialogFieldClass,
                (isPettyCash || isGovernment || !showInvoiceFields) &&
                  "sm:col-span-2"
              )}
            >
              <label
                htmlFor="purchase-date"
                className={employeeDialogLabelClass}
              >
                {isPettyCash
                  ? t("pages.billing.purchaseDate")
                  : t("pages.billing.purchaseInvoiceDate")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                id="purchase-date"
                name="invoiceDate"
                type="date"
                required
                disabled={busy}
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
                className={employeeInputClass}
              />
            </div>
            ) : null}

            {isImport ? (
              <PurchaseImportCostFields
                draft={importDraft}
                onChange={setImportDraft}
                disabled={busy}
                totalQuantity={importQtyTotal}
                requireBankRate
                remittanceRateKind={importCashPaidNow ? "bank" : "booking"}
                showPayLaterHint={false}
                showWarehouseCost={false}
                showCustomsCharges={false}
                handlingFeePaidIdr={handledByHeadOffice ? 0 : handlingPaid}
                handlingFeeCostIdr={handledByHeadOffice ? 0 : handlingCost}
                showHandlingFee={isImport && !handledByHeadOffice}
                nowExtras={
                  <PaymentTermsField
                    className="sm:col-span-2"
                    value={paymentTermsDays}
                    onChange={(days) => {
                      setPaymentTermsDays(days);
                      if (!isCashPaymentTerms(days)) {
                        setImportDraft((current) => ({
                          ...current,
                          bankFeeAmount: "",
                          localBankFeeIdr: "",
                        }));
                      }
                    }}
                    labelKey="pages.billing.purchasePaymentTerms"
                    hintKey="pages.billing.purchasePaymentTermsHintField"
                  />
                }
                afterCharges={
                  <>
                    <div
                      className={cn(employeeDialogFieldClass, "sm:col-span-2")}
                    >
                      <label className={employeeDialogLabelClass}>
                        {t("pages.billing.handlingVendor")}
                        <span className="text-red-400"> *</span>
                      </label>
                      <Select
                        value={handlingVendorId || null}
                        onValueChange={(value) => {
                          const next = value ?? "";
                          setHandlingVendorId(next);
                          if (isHandlingByHeadOffice(next)) {
                            setHandlingFeeIdr("");
                            setHandlingFeeIncludesPpn(false);
                            setHandlingFeePpnRatePercent("11");
                            setHandlingFeeFile(null);
                            setHandlingFeeTaxFile(null);
                          }
                        }}
                        disabled={busy}
                      >
                        <SelectTrigger className={employeeSelectTriggerClass}>
                          <SelectValue
                            placeholder={t(
                              importFulfillment === "INTERNAL"
                                ? "pages.billing.handlingVendorPlaceholderInternal"
                                : "pages.billing.handlingVendorPlaceholder"
                            )}
                          >
                            {(value) => {
                              if (!value) {
                                return t(
                                  importFulfillment === "INTERNAL"
                                    ? "pages.billing.handlingVendorPlaceholderInternal"
                                    : "pages.billing.handlingVendorPlaceholder"
                                );
                              }
                              if (isHandlingByHeadOffice(String(value))) {
                                return t("pages.billing.handlingByHeadOffice");
                              }
                              return (
                                handlingVendors.find(
                                  (vendor) => vendor.id === value
                                )?.name ?? null
                              );
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {importFulfillment === "INTERNAL" ? (
                            <SelectItem value={HANDLING_BY_HEAD_OFFICE}>
                              {t("pages.billing.handlingByHeadOffice")}
                            </SelectItem>
                          ) : null}
                          {handlingVendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {handledByHeadOffice ? (
                        <p className={employeeDialogHintClass}>
                          {t("pages.billing.handlingByHeadOfficeHint")}
                        </p>
                      ) : handlingVendors.length === 0 ? (
                        <p className={employeeDialogHintClass}>
                          {t("pages.billing.handlingVendorRegisterLocalFirst")}
                        </p>
                      ) : (
                        <p className={employeeDialogHintClass}>
                          {t("pages.billing.handlingVendorMustBeLocal")}
                        </p>
                      )}
                    </div>
                    {handledByHeadOffice ? null : (
                      <>
                        <div className={employeeDialogFieldClass}>
                          <label className={employeeDialogLabelClass}>
                            {t("pages.billing.handlingFee")}
                            {importFulfillment === "OUTSOURCED" ? (
                              <span className="text-red-400"> *</span>
                            ) : null}
                          </label>
                          <MoneyInput
                            value={handlingFeeIdr}
                            onValueChange={setHandlingFeeIdr}
                            disabled={busy}
                            className={employeeInputClass}
                          />
                          <p className={employeeDialogHintClass}>
                            {importFulfillment === "OUTSOURCED"
                              ? t("pages.billing.handlingFeeHintOutsourced")
                              : t("pages.billing.handlingFeeHintInternal")}
                          </p>
                        </div>
                        {importFulfillment === "OUTSOURCED" ? (
                          <>
                            <div
                              className={cn(
                                employeeDialogFieldClass,
                                "sm:col-span-2"
                              )}
                            >
                              <label
                                id="handling-fee-ppn-label"
                                className={employeeDialogLabelClass}
                              >
                                {t("pages.billing.handlingFeeIncludesPpn")}
                              </label>
                              <YesNoChoiceCards
                                id="handling-fee-ppn"
                                labelledBy="handling-fee-ppn-label"
                                value={handlingFeeIncludesPpn ? "Yes" : "No"}
                                onChange={(value) =>
                                  setHandlingFeeIncludesPpn(value === "Yes")
                                }
                              />
                            </div>
                            {handlingFeeIncludesPpn ? (
                              <div className={employeeDialogFieldClass}>
                                <label className={employeeDialogLabelClass}>
                                  {t("pages.billing.handlingFeePpnRate")}
                                </label>
                                <Input
                                  value={handlingFeePpnRatePercent}
                                  onChange={(event) =>
                                    setHandlingFeePpnRatePercent(
                                      event.target.value
                                    )
                                  }
                                  disabled={busy}
                                  className={employeeInputClass}
                                />
                              </div>
                            ) : null}
                            {Number.isFinite(handlingFeeNumber) &&
                            handlingFeeNumber > 0 ? (
                              <p
                                className={cn(
                                  employeeDialogHintClass,
                                  "sm:col-span-2"
                                )}
                              >
                                {t("pages.billing.handlingFeeTotalPaid", {
                                  amount: formatContractPrice(handlingPaid),
                                })}
                              </p>
                            ) : null}
                          </>
                        ) : null}
                        <div
                          className={cn(
                            employeeDialogFieldClass,
                            "sm:col-span-2"
                          )}
                        >
                          <BillingDocumentFilePick
                            id="purchase-handling-fee-invoice"
                            label={t("pages.billing.handlingFeeInvoice")}
                            required={
                              importFulfillment === "OUTSOURCED" ||
                              (Number.isFinite(handlingFeeNumber) &&
                                handlingFeeNumber > 0)
                            }
                            fileName={handlingFeeFile?.name ?? null}
                            onPick={setHandlingFeeFile}
                            disabled={busy}
                          />
                          <p className={employeeDialogHintClass}>
                            {t("pages.billing.handlingFeeInvoiceHint")}
                          </p>
                        </div>
                        {handlingFeeIncludesPpn ? (
                          <div
                            className={cn(
                              employeeDialogFieldClass,
                              "sm:col-span-2"
                            )}
                          >
                            <BillingDocumentFilePick
                              id="purchase-handling-fee-tax"
                              label={t("pages.billing.handlingFeeTaxInvoice")}
                              required
                              fileName={handlingFeeTaxFile?.name ?? null}
                              onPick={setHandlingFeeTaxFile}
                              disabled={busy}
                            />
                            <p className={employeeDialogHintClass}>
                              {t("pages.billing.handlingFeeTaxInvoiceHint")}
                            </p>
                          </div>
                        ) : null}
                      </>
                    )}
                  </>
                }
              />
            ) : null}

            {requireServiceLines ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className={employeeDialogLabelClass}>
                    {t("pages.billing.purchaseServiceFor")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className="gap-1.5"
                    onClick={() =>
                      setLines((current) => [...current, newPurchaseLine("unit")])
                    }
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    {t("pages.billing.purchaseAddService")}
                  </Button>
                </div>
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.purchaseServiceForHint")}
                </p>
                <div className="mt-2 space-y-3">
                  {lines.map((line, index) => {
                    return (
                      <div
                        key={line.key}
                        className="rounded-xl border border-border bg-elevated/40 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-subtle">
                            {t("pages.billing.purchaseServiceLineLabel", {
                              n: index + 1,
                            })}
                          </p>
                          {lines.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              className="h-8 px-2 text-danger"
                              onClick={() =>
                                setLines((current) =>
                                  current.filter((row) => row.key !== line.key)
                                )
                              }
                              aria-label={t("pages.billing.purchaseRemoveItem")}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                        <div className={employeeDialogFieldClass}>
                          <label
                            htmlFor={`purchase-service-desc-${line.key}`}
                            className={employeeDialogLabelClass}
                          >
                            {t("pages.billing.purchaseServiceDescription")}
                            <span className="text-red-400"> *</span>
                          </label>
                          <Input
                            id={`purchase-service-desc-${line.key}`}
                            disabled={busy}
                            value={line.description}
                            onChange={(event) => {
                              const value = event.target.value;
                              setLines((current) =>
                                current.map((row) =>
                                  row.key === line.key
                                    ? { ...row, description: value }
                                    : row
                                )
                              );
                            }}
                            placeholder={t(
                              "pages.billing.purchaseServiceDescriptionPlaceholder"
                            )}
                            className={employeeInputClass}
                          />
                        </div>
                        {isFreeOfCharge ? null : (
                          <div className={employeeDialogFieldClass}>
                            <label
                              htmlFor={`purchase-service-amount-${line.key}`}
                              className={employeeDialogLabelClass}
                            >
                              {t("pages.billing.purchaseAmount")}
                              <span className="text-red-400"> *</span>
                            </label>
                            <MoneyInput
                              id={`purchase-service-amount-${line.key}`}
                              disabled={busy}
                              value={line.unitPrice}
                              onValueChange={(value) => {
                                setLines((current) =>
                                  current.map((row) =>
                                    row.key === line.key
                                      ? { ...row, unitPrice: value }
                                      : row
                                  )
                                );
                              }}
                              placeholder={t(
                                "pages.billing.purchaseAmountPlaceholder"
                              )}
                              className={employeeInputClass}
                              aria-label={t("pages.billing.purchaseAmount")}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isFreeOfCharge || lines.length < 2 ? null : (
                    <p className="text-sm font-semibold tabular-nums text-text">
                      {t("pages.billing.purchaseAmountTotal", {
                        amount: formatContractPrice(linesTotal),
                      })}
                    </p>
                  )}
                </div>
              </div>
            ) : requireCatalogLines ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className={employeeDialogLabelClass}>
                    {isVehicle
                      ? t("pages.billing.purchaseVehicleBought")
                      : t("pages.billing.purchaseItemsBought")}
                    <span className="text-red-400"> *</span>
                  </label>
                  {isVehicle ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className="gap-1.5"
                    onClick={() =>
                      setLines((current) => [...current, newPurchaseLine()])
                    }
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    {t("pages.billing.purchaseAddItem")}
                  </Button>
                  )}
                </div>
                {pickerCatalogItems.length === 0 ? (
                  <p className={employeeDialogHintClass}>
                    {isVehicle
                      ? t("pages.billing.purchaseVehicleCatalogEmpty")
                      : t("pages.billing.purchaseCatalogEmpty")}
                  </p>
                ) : null}
                  <div className="mt-2 space-y-3">
                    {lines.map((line, index) => {
                      const item = catalogItems.find(
                        (entry) => entry.id === line.itemId
                      );
                      const qty = isVehicle ? 1 : Number(line.quantity);
                      const allocated = importAllocated[index];
                      const price = isImport
                        ? recordingArrivalNow
                          ? (allocated?.unitCostIdr ?? Number.NaN)
                          : Number.NaN
                        : parseContractPrice(line.unitPrice) ?? Number.NaN;
                      const lineTotal =
                        Number.isFinite(qty) && Number.isFinite(price)
                          ? isImport
                            ? (allocated?.totalCostIdr ?? qty * price)
                            : qty * price
                          : null;
                      return (
                        <div
                          key={line.key}
                          className="rounded-xl border border-border bg-elevated/40 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-subtle">
                              {t("pages.billing.purchaseLineLabel", {
                                n: index + 1,
                              })}
                            </p>
                            {lines.length > 1 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                className="h-8 px-2 text-danger"
                                onClick={() =>
                                  setLines((current) =>
                                    current.filter((row) => row.key !== line.key)
                                  )
                                }
                                aria-label={t("pages.billing.purchaseRemoveItem")}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </Button>
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setPickingLineKey(line.key)}
                                className={cn(
                                  employeeSelectTriggerClass,
                                  "min-h-8 w-full flex-1 justify-between text-left"
                                )}
                              >
                                <span className="min-w-0 truncate">
                                  {item
                                    ? `${item.name} (${item.sku})`
                                    : t("pages.billing.purchaseSelectItem")}
                                </span>
                                {item ? (
                                  <span className="shrink-0 text-xs font-semibold text-muted">
                                    {t("pages.billing.purchaseChangeItem")}
                                  </span>
                                ) : null}
                              </button>
                            </div>
                            {item ? (
                              <div
                                className={cn(
                                  "grid gap-2",
                                  isVehicle
                                    ? "sm:grid-cols-1"
                                    : isImport
                                      ? lines.length > 1
                                        ? "sm:grid-cols-[minmax(0,10rem)_8rem]"
                                        : "sm:grid-cols-[minmax(0,10rem)]"
                                      : "sm:grid-cols-[minmax(0,10rem)_8rem]"
                                )}
                              >
                                {isVehicle ? null : (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min={
                                        allowsDecimalInventoryQty(item.unit)
                                          ? 0.001
                                          : 1
                                      }
                                      step={
                                        allowsDecimalInventoryQty(item.unit)
                                          ? 0.001
                                          : 1
                                      }
                                      disabled={busy}
                                      value={line.quantity}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setLines((current) =>
                                          current.map((row) =>
                                            row.key === line.key
                                              ? { ...row, quantity: value }
                                              : row
                                          )
                                        );
                                      }}
                                      placeholder={t("pages.billing.purchaseQty")}
                                      className={employeeInputClass}
                                      aria-label={t("pages.billing.purchaseQty")}
                                    />
                                    <span className="shrink-0 text-sm font-semibold text-muted">
                                      {inventoryUnitLabel(t, item.unit)}
                                    </span>
                                  </div>
                                )}
                                {isImport && lines.length > 1 ? (
                                  <Input
                                    inputMode="decimal"
                                    disabled={busy}
                                    value={line.foreignAmount}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      setLines((current) =>
                                        current.map((row) =>
                                          row.key === line.key
                                            ? { ...row, foreignAmount: value }
                                            : row
                                        )
                                      );
                                    }}
                                    placeholder={t(
                                      "pages.billing.purchaseImportForeignLine"
                                    )}
                                    className={employeeInputClass}
                                    aria-label={t(
                                      "pages.billing.purchaseImportForeignLine"
                                    )}
                                  />
                                ) : null}
                                {isImport ? null : (
                                  <MoneyInput
                                    disabled={busy || isFreeOfCharge}
                                    value={isFreeOfCharge ? "0" : line.unitPrice}
                                    onValueChange={(value) => {
                                      setLines((current) =>
                                        current.map((row) =>
                                          row.key === line.key
                                            ? { ...row, unitPrice: value }
                                            : row
                                        )
                                      );
                                    }}
                                    placeholder={t(
                                      "pages.billing.purchaseUnitCost"
                                    )}
                                    className={employeeInputClass}
                                    aria-label={t(
                                      "pages.billing.purchaseUnitCost"
                                    )}
                                  />
                                )}
                              </div>
                            ) : null}
                          </div>
                          <p className={employeeDialogHintClass}>
                            {item
                              ? t("pages.billing.purchaseLineUnitHint", {
                                  unit: inventoryUnitLabel(t, item.unit),
                                })
                              : t("pages.billing.purchaseSelectItem")}
                            {lineTotal != null
                              ? ` · ${t("pages.billing.purchaseLineTotal", {
                                  amount: formatContractPrice(lineTotal),
                                })}`
                              : null}
                          </p>
                        </div>
                      );
                    })}
                    {isImport && !recordingArrivalNow ? null : (
                    <p className="text-sm font-semibold tabular-nums text-text">
                      {t("pages.billing.purchaseAmountTotal", {
                        amount: formatContractPrice(linesTotal),
                      })}
                    </p>
                    )}
                    {isVehicle && lines.some((line) => line.itemId) ? (
                      <PurchaseVehicleLeaseFields
                        draft={vehicleLease}
                        onChange={setVehicleLease}
                        disabled={busy}
                      />
                    ) : null}
                  </div>
                <PurchaseCatalogItemPicker
                  open={pickingLineKey != null}
                  onOpenChange={(next) => {
                    if (!next) setPickingLineKey(null);
                  }}
                  items={pickerCatalogItems}
                  selectedItemId={
                    lines.find((line) => line.key === pickingLineKey)?.itemId
                  }
                  vehicleOnly={isVehicle}
                  onSelect={(selected) => {
                    if (!pickingLineKey) return;
                    setLines((current) =>
                      current.map((row) =>
                        row.key === pickingLineKey
                          ? {
                              ...row,
                              itemId: selected.id,
                              unit: normalizeInventoryUnit(selected.unit),
                              packContents: "",
                              quantity: isVehicle ? "1" : row.quantity,
                              unitPrice: isImport
                                ? row.unitPrice
                                : selected.lastUnitCost != null
                                  ? String(selected.lastUnitCost)
                                  : row.unitPrice,
                            }
                          : row
                      )
                    );
                    setPickingLineKey(null);
                  }}
                />
              </div>
            ) : (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  htmlFor="purchase-amount"
                  className={employeeDialogLabelClass}
                >
                  {isGovernment
                    ? t("pages.billing.governmentAmount")
                    : isBankLoan
                      ? t("pages.billing.bankLoanPaymentAmount")
                      : t("pages.billing.purchaseAmount")}
                  <span className="text-red-400"> *</span>
                </label>
                {isGovernment ? (
                  <p className={cn(employeeDialogHintClass, "mb-2")}>
                    {t("pages.billing.governmentCurrency")}:{" "}
                    {t("pages.billing.governmentCurrencyIdr")}
                  </p>
                ) : null}
                <Input
                  id="purchase-amount"
                  name="amount"
                  required
                  disabled={busy}
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => {
                    setAmountTouched(true);
                    setAmount(event.target.value);
                  }}
                  placeholder={t("pages.billing.purchaseAmountPlaceholder")}
                  className={employeeInputClass}
                />
                {isGovernment ? (
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.governmentAmountHint")}
                  </p>
                ) : isBankLoan ? (
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.bankLoanPaymentAmountHint")}
                  </p>
                ) : null}
              </div>
            )}

            {isFreeOfCharge ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  id="purchase-add-shipping-label"
                  className={employeeDialogLabelClass}
                >
                  {t(
                    isService
                      ? "pages.billing.purchaseAddRelatedCosts"
                      : "pages.billing.purchaseAddShippingCost"
                  )}
                </label>
                <YesNoChoiceCards
                  id="purchase-add-shipping"
                  labelledBy="purchase-add-shipping-label"
                  value={addShippingCost}
                  onChange={(value) => {
                    setAddShippingCost(value);
                    if (value === "No") {
                      setShippingCurrency("IDR");
                      setShippingAmount("");
                      setShippingRate("");
                      setShippingDescription("");
                    }
                  }}
                />
                <p className={employeeDialogHintClass}>
                  {t(
                    isService
                      ? "pages.billing.purchaseAddRelatedCostsHint"
                      : "pages.billing.purchaseAddShippingCostHint"
                  )}
                </p>
              </div>
            ) : null}

            {showShippingCost ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                {isService ? (
                  <div className={employeeDialogFieldClass}>
                    <label
                      htmlFor="purchase-related-cost-what"
                      className={employeeDialogLabelClass}
                    >
                      {t("pages.billing.purchaseRelatedCost")}
                      <span className="text-red-400"> *</span>
                    </label>
                    <Input
                      id="purchase-related-cost-what"
                      disabled={busy}
                      value={shippingDescription}
                      onChange={(event) =>
                        setShippingDescription(event.target.value)
                      }
                      placeholder={t(
                        "pages.billing.purchaseRelatedCostPlaceholder"
                      )}
                      className={employeeInputClass}
                    />
                  </div>
                ) : (
                  <label
                    htmlFor="purchase-shipping-amount"
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.billing.purchaseShippingCost")}
                    <span className="text-red-400"> *</span>
                  </label>
                )}
                {isService ? (
                  <label
                    htmlFor="purchase-shipping-amount"
                    className={cn(employeeDialogLabelClass, "mt-3")}
                  >
                    {t("pages.billing.purchaseShippingAmount")}
                    <span className="text-red-400"> *</span>
                  </label>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)]">
                  <Select
                    value={shippingCurrency || null}
                    onValueChange={(value) => {
                      if (!value) return;
                      setShippingCurrency(value);
                      if (value === "IDR") setShippingRate("");
                    }}
                    disabled={busy}
                  >
                    <SelectTrigger
                      id="purchase-shipping-currency"
                      className={cn(employeeSelectTriggerClass, "w-full")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPORT_FEE_CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="purchase-shipping-amount"
                    inputMode="decimal"
                    disabled={busy}
                    value={shippingAmount}
                    onChange={(event) => setShippingAmount(event.target.value)}
                    placeholder={t("pages.billing.purchaseShippingAmount")}
                    className={employeeInputClass}
                  />
                </div>
                {shippingCurrency === "IDR" ? (
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.purchaseShippingIdrHint")}
                  </p>
                ) : (
                  <>
                    <div className={cn(employeeDialogFieldClass, "mt-3")}>
                      <label
                        htmlFor="purchase-shipping-rate"
                        className={employeeDialogLabelClass}
                      >
                        {t("pages.billing.purchaseImportRate")}
                        <span className="text-red-400"> *</span>
                      </label>
                      <Input
                        id="purchase-shipping-rate"
                        inputMode="decimal"
                        disabled={busy}
                        value={shippingRate}
                        onChange={(event) =>
                          setShippingRate(event.target.value)
                        }
                        placeholder={t(
                          "pages.billing.purchaseImportRatePlaceholder"
                        )}
                        className={employeeInputClass}
                      />
                      <p className={employeeDialogHintClass}>
                        {t("pages.billing.purchaseShippingFxHint")}
                      </p>
                    </div>
                    {shippingIdrPreview != null ? (
                      <p className={employeeDialogHintClass}>
                        {t("pages.billing.purchaseImportConvertedIdr", {
                          amount: formatContractPrice(shippingIdrPreview),
                        })}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {allowCustomsFees ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  id="purchase-has-customs-fees-label"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.purchaseHasCustomsFees")}
                </label>
                <YesNoChoiceCards
                  id="purchase-has-customs-fees"
                  labelledBy="purchase-has-customs-fees-label"
                  value={hasCustomsFees}
                  onChange={(value) => {
                    setHasCustomsFees(value);
                    if (value === "No") {
                      setDeclaredValue("");
                      setDeclaredCurrency("IDR");
                      setDeclaredCustomsRate("");
                      setImportDutiesBillingId("");
                      setImportDutiesFile(null);
                      setImportDraft(emptyPurchaseImportDraft());
                      setImportFulfillment("INTERNAL");
                      setHandlingVendorId("");
                      setHandlingFeeIdr("");
                      setHandlingFeeIncludesPpn(false);
                      setHandlingFeeFile(null);
                      setHandlingFeeTaxFile(null);
                    }
                  }}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.purchaseHasCustomsFeesHint")}
                </p>
              </div>
            ) : null}

            {showCustomsFees ? (
              <div className="sm:col-span-2 space-y-3">
                <div className={employeeDialogFieldClass}>
                  <label
                    htmlFor="purchase-declared-value"
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.billing.purchaseDeclaredValue")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <div className="grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)]">
                    <Select
                      value={declaredCurrency || null}
                      onValueChange={(value) => {
                        if (!value) return;
                        setDeclaredCurrency(value);
                        if (value === "IDR") setDeclaredCustomsRate("");
                      }}
                      disabled={busy}
                    >
                      <SelectTrigger
                        id="purchase-declared-currency"
                        className={cn(employeeSelectTriggerClass, "w-full")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMPORT_FEE_CURRENCIES.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="purchase-declared-value"
                      inputMode="decimal"
                      disabled={busy}
                      value={declaredValue}
                      onChange={(event) => setDeclaredValue(event.target.value)}
                      placeholder={t("pages.billing.purchaseShippingAmount")}
                      className={employeeInputClass}
                    />
                  </div>
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.purchaseDeclaredValueHint")}
                  </p>
                  {declaredCurrency === "IDR" ? (
                    <p className={employeeDialogHintClass}>
                      {t("pages.billing.purchaseDeclaredIdrHint")}
                    </p>
                  ) : (
                    <>
                      <div className={cn(employeeDialogFieldClass, "mt-3")}>
                        <label
                          htmlFor="purchase-declared-customs-rate"
                          className={employeeDialogLabelClass}
                        >
                          {t("pages.billing.purchaseImportCustomsRate")}
                          <span className="text-red-400"> *</span>
                        </label>
                        <Input
                          id="purchase-declared-customs-rate"
                          inputMode="decimal"
                          disabled={busy}
                          value={declaredCustomsRate}
                          onChange={(event) =>
                            setDeclaredCustomsRate(event.target.value)
                          }
                          placeholder={t(
                            "pages.billing.purchaseImportCustomsRatePlaceholder"
                          )}
                          className={employeeInputClass}
                        />
                        <p className={employeeDialogHintClass}>
                          {t("pages.billing.purchaseDeclaredFxHint")}
                        </p>
                      </div>
                      {declaredCif ? (
                        <p className={employeeDialogHintClass}>
                          {t("pages.billing.purchaseImportCustomsInvoiceIdr", {
                            amount: formatContractPrice(
                              declaredAmountNumber! *
                                (declaredRateNumber ?? 0)
                            ),
                          })}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>

                <div className={employeeDialogFieldClass}>
                  <label className={employeeDialogLabelClass}>
                    {t("pages.billing.importFulfillment")}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["INTERNAL", t("pages.billing.importHandledInternally")],
                        ["OUTSOURCED", t("pages.billing.importOutsourced")],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setImportFulfillment(value);
                          if (
                            value === "OUTSOURCED" &&
                            isHandlingByHeadOffice(handlingVendorId)
                          ) {
                            setHandlingVendorId("");
                          }
                        }}
                        className={cn(
                          "inline-flex min-h-8 w-full items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                          importFulfillment === value &&
                            outlineChipTones.emeraldInteractive,
                          importFulfillment !== value &&
                            "border border-border bg-elevated text-muted hover:border-border-strong hover:bg-card-hover hover:text-text"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className={employeeDialogHintClass}>
                    {importFulfillment === "OUTSOURCED"
                      ? t("pages.billing.importOutsourcedHint")
                      : t("pages.billing.importHandledInternallyHint")}
                  </p>
                </div>

                <PurchaseImportCostFields
                  draft={importDraft}
                  onChange={setImportDraft}
                  disabled={busy}
                  totalQuantity={importQtyTotal}
                  requireBankRate={false}
                  showWarehouseCost={recordingArrivalNow}
                  showCustomsCharges={importFulfillment === "INTERNAL"}
                  handlingFeePaidIdr={handledByHeadOffice ? 0 : handlingPaid}
                  handlingFeeCostIdr={handledByHeadOffice ? 0 : handlingCost}
                  showHandlingFee={!handledByHeadOffice}
                  chargesOnly
                  declaredCif={declaredCif}
                  extraStockCostIdr={shippingIdrPreview ?? 0}
                  afterCharges={
                    <>
                      {importFulfillment === "INTERNAL" ? (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className={employeeDialogFieldClass}>
                              <label className={employeeDialogLabelClass}>
                                {t("pages.billing.importDutiesBillingId")}
                              </label>
                              <Input
                                value={importDutiesBillingId}
                                onChange={(event) =>
                                  setImportDutiesBillingId(event.target.value)
                                }
                                disabled={busy}
                                className={employeeInputClass}
                              />
                              <p className={employeeDialogHintClass}>
                                {t("pages.billing.purchaseImportDutiesOptionalHint")}
                              </p>
                            </div>
                            <div className={employeeDialogFieldClass}>
                              <BillingDocumentFilePick
                                id="foc-import-duties-document"
                                label={t("pages.billing.importDutiesDocument")}
                                fileName={importDutiesFile?.name ?? null}
                                onPick={setImportDutiesFile}
                                disabled={busy}
                              />
                              <p className={employeeDialogHintClass}>
                                {t("pages.billing.importDutiesDocumentHint")}
                              </p>
                            </div>
                          </div>
                        </>
                      ) : null}
                      <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                        <label className={employeeDialogLabelClass}>
                          {t("pages.billing.handlingVendor")}
                          <span className="text-red-400"> *</span>
                        </label>
                        <Select
                          value={handlingVendorId || null}
                          onValueChange={(value) => {
                            const next = value ?? "";
                            setHandlingVendorId(next);
                            if (isHandlingByHeadOffice(next)) {
                              setHandlingFeeIdr("");
                              setHandlingFeeIncludesPpn(false);
                              setHandlingFeePpnRatePercent("11");
                              setHandlingFeeFile(null);
                              setHandlingFeeTaxFile(null);
                            }
                          }}
                          disabled={busy}
                        >
                          <SelectTrigger className={employeeSelectTriggerClass}>
                            <SelectValue
                              placeholder={t(
                                importFulfillment === "INTERNAL"
                                  ? "pages.billing.handlingVendorPlaceholderInternal"
                                  : "pages.billing.handlingVendorPlaceholder"
                              )}
                            >
                              {(value) => {
                                if (!value) {
                                  return t(
                                    importFulfillment === "INTERNAL"
                                      ? "pages.billing.handlingVendorPlaceholderInternal"
                                      : "pages.billing.handlingVendorPlaceholder"
                                  );
                                }
                                if (isHandlingByHeadOffice(String(value))) {
                                  return t("pages.billing.handlingByHeadOffice");
                                }
                                return (
                                  handlingVendors.find(
                                    (vendor) => vendor.id === value
                                  )?.name ?? null
                                );
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {importFulfillment === "INTERNAL" ? (
                              <SelectItem value={HANDLING_BY_HEAD_OFFICE}>
                                {t("pages.billing.handlingByHeadOffice")}
                              </SelectItem>
                            ) : null}
                            {handlingVendors.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {handledByHeadOffice ? (
                          <p className={employeeDialogHintClass}>
                            {t("pages.billing.handlingByHeadOfficeHint")}
                          </p>
                        ) : handlingVendors.length === 0 ? (
                          <p className={employeeDialogHintClass}>
                            {t("pages.billing.handlingVendorRegisterLocalFirst")}
                          </p>
                        ) : (
                          <p className={employeeDialogHintClass}>
                            {t("pages.billing.handlingVendorMustBeLocal")}
                          </p>
                        )}
                      </div>
                      {handledByHeadOffice ? null : (
                        <>
                          <div className={employeeDialogFieldClass}>
                            <label className={employeeDialogLabelClass}>
                              {t("pages.billing.handlingFee")}
                              {importFulfillment === "OUTSOURCED" ? (
                                <span className="text-red-400"> *</span>
                              ) : null}
                            </label>
                            <MoneyInput
                              value={handlingFeeIdr}
                              onValueChange={setHandlingFeeIdr}
                              disabled={busy}
                              className={employeeInputClass}
                            />
                            <p className={employeeDialogHintClass}>
                              {importFulfillment === "OUTSOURCED"
                                ? t("pages.billing.handlingFeeHintOutsourced")
                                : t("pages.billing.handlingFeeHintInternal")}
                            </p>
                          </div>
                          {importFulfillment === "OUTSOURCED" ? (
                            <>
                              <div
                                className={cn(
                                  employeeDialogFieldClass,
                                  "sm:col-span-2"
                                )}
                              >
                                <label
                                  id="foc-handling-fee-ppn-label"
                                  className={employeeDialogLabelClass}
                                >
                                  {t("pages.billing.handlingFeeIncludesPpn")}
                                </label>
                                <YesNoChoiceCards
                                  id="foc-handling-fee-ppn"
                                  labelledBy="foc-handling-fee-ppn-label"
                                  value={handlingFeeIncludesPpn ? "Yes" : "No"}
                                  onChange={(value) =>
                                    setHandlingFeeIncludesPpn(value === "Yes")
                                  }
                                />
                              </div>
                              {handlingFeeIncludesPpn ? (
                                <div className={employeeDialogFieldClass}>
                                  <label className={employeeDialogLabelClass}>
                                    {t("pages.billing.handlingFeePpnRate")}
                                  </label>
                                  <Input
                                    value={handlingFeePpnRatePercent}
                                    onChange={(event) =>
                                      setHandlingFeePpnRatePercent(
                                        event.target.value
                                      )
                                    }
                                    disabled={busy}
                                    className={employeeInputClass}
                                  />
                                </div>
                              ) : null}
                            </>
                          ) : null}
                          <div
                            className={cn(
                              employeeDialogFieldClass,
                              "sm:col-span-2"
                            )}
                          >
                            <BillingDocumentFilePick
                              id="foc-handling-fee-invoice"
                              label={t("pages.billing.handlingFeeInvoice")}
                              required={
                                importFulfillment === "OUTSOURCED" ||
                                (Number.isFinite(handlingFeeNumber) &&
                                  handlingFeeNumber > 0)
                              }
                              fileName={handlingFeeFile?.name ?? null}
                              onPick={setHandlingFeeFile}
                              disabled={busy}
                            />
                          </div>
                          {handlingFeeIncludesPpn ? (
                            <div
                              className={cn(
                                employeeDialogFieldClass,
                                "sm:col-span-2"
                              )}
                            >
                              <BillingDocumentFilePick
                                id="foc-handling-fee-tax"
                                label={t("pages.billing.handlingFeeTaxInvoice")}
                                required
                                fileName={handlingFeeTaxFile?.name ?? null}
                                onPick={setHandlingFeeTaxFile}
                                disabled={busy}
                              />
                            </div>
                          ) : null}
                        </>
                      )}
                    </>
                  }
                />
              </div>
            ) : null}

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                htmlFor="purchase-notes"
                className={employeeDialogLabelClass}
              >
                {isGovernment
                  ? t("pages.billing.governmentDescription")
                  : t("pages.billing.purchaseNotes")}
                {isGovernment ? <span className="text-red-400"> *</span> : null}
              </label>
              <Textarea
                id="purchase-notes"
                name="notes"
                required={isGovernment}
                disabled={busy}
                rows={2}
                placeholder={
                  isGovernment
                    ? t("pages.billing.governmentDescriptionPlaceholder")
                    : t("pages.billing.purchaseNotesPlaceholder")
                }
                className="min-h-[4.5rem] rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-text shadow-none placeholder:text-subtle focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/10"
              />
            </div>

            {isService ? (
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label className={employeeDialogLabelClass}>
                {t("pages.billing.purchasePurpose")}
                <span className="text-red-400"> *</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["PROJECT", t("pages.billing.purchasePurposeProject")],
                    ["INTERNAL", t("pages.billing.purchasePurposeInternal")],
                  ] as Array<["PROJECT" | "INTERNAL", string]>
                ).map(([value, label]) => {
                  const active = purchasePurpose === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setPurchasePurpose(value);
                        if (value !== "PROJECT") setProjectId("");
                      }}
                      className={cn(
                        "inline-flex min-h-8 w-full items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                        active && outlineChipTones.emeraldInteractive,
                        !active &&
                          "border border-border bg-elevated text-muted hover:border-border-strong hover:bg-card-hover hover:text-text"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className={employeeDialogHintClass}>
                {t("pages.billing.purchasePurposeHint")}
              </p>
            </div>
            ) : null}

            {isService && purchasePurpose === "PROJECT" ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.billing.purchaseProject")}
                  <span className="text-red-400"> *</span>
                </label>
                <SearchableProjectSelect
                  value={projectId}
                  onValueChange={setProjectId}
                  projects={projects}
                  placeholder={t("pages.billing.purchaseProjectPlaceholder")}
                  disabled={busy}
                  required
                />
              </div>
            ) : null}

            {isImport ||
            isPettyCash ||
            isGovernment ||
            isBankLoan ||
            isFreeOfCharge ? null : (
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                id="purchase-includes-ppn-label"
                htmlFor="purchase-includes-ppn"
                className={employeeDialogLabelClass}
              >
                {t("pages.billing.purchaseIncludesPpn")}
                <span className="text-red-400"> *</span>
              </label>
              <YesNoChoiceCards
                id="purchase-includes-ppn"
                labelledBy="purchase-includes-ppn-label"
                value={includesPpn}
                onChange={(value) => {
                  setIncludesPpn(value);
                  if (value === "No") {
                    setIncludedTaxKind("");
                    setOtherTaxName("");
                    setPphRatePercent("");
                    setTaxFile(null);
                  }
                }}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.billing.purchaseIncludesPpnHint")}
              </p>
            </div>
            )}

            {taxIncluded &&
            !isPettyCash &&
            !isImport &&
            !isGovernment &&
            !isBankLoan ? (
              <CommercialTaxKindField
                id="purchase-included-tax-kind"
                name="includedTaxKind"
                className="sm:col-span-2"
                value={includedTaxKind}
                onChange={(next) => {
                  setIncludedTaxKind(next);
                  if (next && commercialTaxIncludesVat(next) && !ppnRatePercent.trim()) {
                    setPpnRatePercent(String(DEFAULT_PRODUCT_PPN_RATE_PERCENT));
                  }
                  const nextRate = defaultCommercialNonVatRatePercent(next || null);
                  setPphRatePercent(nextRate != null ? String(nextRate) : "");
                  if (next !== "OTHER") setOtherTaxName("");
                  if (!next || !commercialTaxIncludesVat(next)) {
                    setTaxFile(null);
                  }
                }}
                label={t("pages.billing.purchaseIncludedTaxKind")}
                hint={t("pages.billing.purchaseIncludedTaxKindHint")}
                placeholder={t("pages.billing.purchaseIncludedTaxKindPlaceholder")}
                disabled={busy}
              />
            ) : null}

            {taxIncluded && kindNeedsOtherName && !isPettyCash && !isImport ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  htmlFor="purchase-other-tax-name"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.otherTaxName")}
                  <span className="text-red-400"> *</span>
                </label>
                <Input
                  id="purchase-other-tax-name"
                  name="otherTaxName"
                  required
                  disabled={busy}
                  value={otherTaxName}
                  onChange={(event) => setOtherTaxName(event.target.value)}
                  placeholder={t("pages.billing.otherTaxNamePlaceholder")}
                  className={employeeInputClass}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.otherTaxNameHint")}
                </p>
              </div>
            ) : null}

            {taxIncluded && kindNeedsRate && !isPettyCash && !isImport ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  htmlFor="purchase-pph-rate"
                  className={employeeDialogLabelClass}
                >
                  {includedTaxKind === "OTHER"
                    ? t("pages.billing.otherTaxRate")
                    : t("pages.billing.purchasePphRate")}
                  <span className="text-red-400"> *</span>
                </label>
                <Input
                  id="purchase-pph-rate"
                  name="pphRatePercent"
                  required
                  disabled={busy}
                  inputMode="decimal"
                  value={pphRatePercent}
                  onChange={(event) => setPphRatePercent(event.target.value)}
                  placeholder={
                    includedTaxKind === "OTHER"
                      ? t("pages.billing.otherTaxRatePlaceholder")
                      : t("pages.billing.purchasePphRatePlaceholder")
                  }
                  className={employeeInputClass}
                />
                <p className={employeeDialogHintClass}>
                  {includedTaxKind === "OTHER"
                    ? t("pages.billing.otherTaxRateHint")
                    : t("pages.billing.purchasePphRateHint")}
                </p>
              </div>
            ) : null}

            {withPpn && !isPettyCash && !isImport ? (
              <>
                <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                  <label
                    htmlFor="purchase-ppn-rate"
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.billing.purchasePpnRate")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <Input
                    id="purchase-ppn-rate"
                    name="ppnRatePercent"
                    required
                    disabled={busy}
                    inputMode="decimal"
                    value={ppnRatePercent}
                    onChange={(event) => setPpnRatePercent(event.target.value)}
                    placeholder={t("pages.billing.purchasePpnRatePlaceholder")}
                    className={employeeInputClass}
                  />
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.purchasePpnRateHint")}
                  </p>
                  {vatPreview ? (
                    <p className={cn(employeeDialogHintClass, "mt-1")}>
                      {t("pages.billing.purchaseVatPreview", {
                        dpp: formatContractPrice(vatPreview.dpp),
                        tax: formatContractPrice(vatPreview.ppn),
                        gross: formatContractPrice(vatPreview.gross),
                      })}
                    </p>
                  ) : null}
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <BillingDocumentFilePick
                    id="purchase-tax-document"
                    label={t("pages.billing.purchaseTaxInvoiceOptional")}
                    fileName={taxFile?.name ?? null}
                    onPick={setTaxFile}
                    disabled={busy}
                  />
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.purchaseTaxInvoiceHint")}
                  </p>
                  {taxFile ? (
                    <div className="space-y-2">
                      <label className={employeeDialogLabelClass}>
                        {t("pages.billing.inHouseVerifyReason")}
                        <span className="text-red-400"> *</span>
                      </label>
                      <Textarea
                        value={taxReason}
                        onChange={(event) => setTaxReason(event.target.value)}
                        disabled={busy}
                        placeholder={t(
                          "pages.billing.inHouseVerifyReasonPlaceholder"
                        )}
                      />
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
