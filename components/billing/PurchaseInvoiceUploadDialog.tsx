"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import {
  createPurchaseInvoice,
  listCompanyBpjsVirtualAccounts,
  listEmployeesForExpense,
  listPrepaidCardsForExpense,
  listPurchasePayoutBankAccounts,
  listVehiclesForExpense,
  listVendorBankAccountsForExpense,
} from "@/app/billing/purchase-invoices/actions";
import CompanyBankAccountField from "@/components/company-details/CompanyBankAccountField";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import PurchaseCatalogItemPicker from "@/components/billing/PurchaseCatalogItemPicker";
import PurchaseLoanFields, {
  type PurchaseLoanFacilityOption,
} from "@/components/billing/PurchaseLoanFields";
import type { BankLoanKind } from "@/lib/bank-loan";
import type { LoanPaymentPurpose, LoanSource } from "@/lib/loan-facility";
import PurchaseVehicleLeaseFields, {
  applyVehicleLeaseDraftToFormData,
  emptyVehicleLeaseDraft,
  type PurchaseVehicleLeaseDraft,
} from "@/components/billing/PurchaseVehicleLeaseFields";
import { BillingDocumentFilePick } from "@/components/billing/BillingDocumentVerifyDialog";
import TaxInvoiceNumberFields, {
  useTaxInvoiceSerialAssist,
} from "@/components/billing/TaxInvoiceNumberFields";
import CommercialTaxKindField from "@/components/billing/CommercialTaxKindField";
import PaymentTermsField from "@/components/billing/PaymentTermsField";
import PurchaseImportCostFields, {
  emptyPurchaseImportDraft,
  focChargesDraftToInput,
  importDraftToInput,
  type PurchaseImportDraft,
} from "@/components/billing/PurchaseImportCostFields";
import PurchaseHandlingNowFields from "@/components/billing/PurchaseHandlingNowFields";
import {
  allocateImportStockCost,
  calculateImportLandedCost,
  type ImportLandedCostInput,
  IMPORT_FEE_CURRENCIES,
  parseImportDecimal,
} from "@/lib/import-landed-cost";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  choiceGridClassForCount,
  choiceGridSpanLastClass,
  employeeDialogChoiceChipClass,
  employeeDialogChoiceGridClass,
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
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import {
  showMissingRequiredFields,
  showRejection,
} from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import { formatVendorBankAccountLabel } from "@/lib/vendor-bank-accounts";
import {
  CASH_PAYMENT_TERMS_DAYS,
  dueAtFromPaymentTerms,
  isCashPaymentTerms,
} from "@/lib/invoice-period";
import {
  DEFAULT_PRODUCT_PPN_RATE_PERCENT,
  parsePpnRatePercent,
  ppnRateFromPercent,
  splitInclusiveVat,
} from "@/lib/vat";
import { todayDateInput } from "@/lib/project-contract";
import { vendorMatchesPurchaseOrigin } from "@/lib/vendor-type";
import { formatContractPrice, parseContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";
import { formatPrepaidCardNumber } from "@/lib/prepaid-card";
import { formatVehicleIdentityLabel } from "@/lib/vehicle-plate";
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
  isBpjsGovernmentKind,
  type GovernmentTaxKind,
} from "@/lib/government-tax";

type PurchaseCategoryChoice =
  | "PRODUCT"
  | "SERVICE"
  | "PETTY_CASH"
  | "GOVERNMENT"
  | "VEHICLE"
  | "BANK_LOAN"
  | "EMPLOYEE_PAYMENT"
  | "OPEN_CARD";
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
  loanFacilities?: PurchaseLoanFacilityOption[];
};

export default function PurchaseInvoiceUploadDialog(
  props: PurchaseInvoiceUploadDialogProps
) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <PurchaseInvoiceUploadDialogInner
      key={formKey}
      {...props}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFormKey((current) => current + 1);
      }}
    />
  );
}

function PurchaseInvoiceUploadDialogInner({
  vendors: vendorsProp,
  catalogItems: catalogItemsProp = [],
  projects = [],
  loanFacilities = [],
  open,
  onOpenChange: setOpen,
}: PurchaseInvoiceUploadDialogProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [taxFile, setTaxFile] = useState<File | null>(null);
  const taxSerialAssist = useTaxInvoiceSerialAssist(taxFile);
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
  const [bpjsYear, setBpjsYear] = useState(() =>
    Number(todayDateInput().slice(0, 4))
  );
  const [bpjsMonth, setBpjsMonth] = useState(() =>
    Number(todayDateInput().slice(5, 7))
  );
  const [amount, setAmount] = useState("");
  const [lines, setLines] = useState<PurchaseLineDraft[]>([newPurchaseLine()]);
  const catalogItems = catalogItemsProp;
  const vendors = vendorsProp;
  const [vehicleLease, setVehicleLease] = useState<PurchaseVehicleLeaseDraft>(
    emptyVehicleLeaseDraft
  );
  const [loanSource, setLoanSource] = useState<LoanSource | "">("");
  const [loanKind, setLoanKind] = useState<BankLoanKind | "">("");
  const [loanPaymentPurpose, setLoanPaymentPurpose] =
    useState<LoanPaymentPurpose | "">("");
  const [loanFacilityId, setLoanFacilityId] = useState("");
  const [transferFee, setTransferFee] = useState("");
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
  const [handlingHasTaxInvoice, setHandlingHasTaxInvoice] = useState<
    YesNoChoice | ""
  >("");
  const [handlingFeeFile, setHandlingFeeFile] = useState<File | null>(null);
  const [vehicleExpenseKind, setVehicleExpenseKind] = useState("");
  const [vehicleAssetId, setVehicleAssetId] = useState("");
  const [vehicleOtherCostDescription, setVehicleOtherCostDescription] =
    useState("");
  const [inventoryVehicles, setInventoryVehicles] = useState<
    Array<{
      id: string;
      plate: string;
      name: string;
      sku: string;
      year: number | null;
      isVehicleLease?: boolean;
      label: string;
    }>
  >([]);
  const [employeePaymentKind, setEmployeePaymentKind] = useState<
    "INTERNAL_PAYROLL" | "THR" | "CASH_ADVANCE" | ""
  >("");
  const [employeeDepartmentId, setEmployeeDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [expenseEmployees, setExpenseEmployees] = useState<
    Array<{
      id: string;
      employeeNo: string;
      firstName: string;
      lastName: string;
      department: { id: string; name: string; slug?: string | null } | null;
    }>
  >([]);
  const [expenseDepartments, setExpenseDepartments] = useState<
    Array<{ id: string; name: string; slug?: string | null }>
  >([]);
  const [vendorBankAccounts, setVendorBankAccounts] = useState<
    Array<{
      id: string;
      bankName: string;
      accountNumber: string;
      accountHolder: string;
      label: string | null;
    }>
  >([]);
  const [vendorBankAccountId, setVendorBankAccountId] = useState("");
  const [bpjsVirtualAccounts, setBpjsVirtualAccounts] = useState({
    kesehatan: "",
    ketenagakerjaan: "",
  });
  const [prepaidCards, setPrepaidCards] = useState<
    Array<{
      id: string;
      cardNumber: string;
      kind: "VEHICLE" | "OPEN";
      status: string;
      currentBalance: number;
      custodianName: string | null;
      vehicleName: string | null;
      vehicleSku: string | null;
      vehiclePlate?: string | null;
    }>
  >([]);
  const [prepaidCardId, setPrepaidCardId] = useState("");
  const isPettyCash = purchaseCategory === "PETTY_CASH";
  const isGovernment = purchaseCategory === "GOVERNMENT";
  const isService = purchaseCategory === "SERVICE";
  const isVehicle = purchaseCategory === "VEHICLE";
  const isVehiclePurchase = isVehicle && vehicleExpenseKind === "PURCHASE";
  const isVehicleOperatingCost =
    isVehicle &&
    (vehicleExpenseKind === "SERVICING" ||
      vehicleExpenseKind === "MODIFICATION" ||
      vehicleExpenseKind === "OTHER" ||
      vehicleExpenseKind === "LEASE_PAYMENT");
  const isVehicleLeasePayment =
    isVehicle && vehicleExpenseKind === "LEASE_PAYMENT";
  const selectableVehicles = isVehicleLeasePayment
    ? inventoryVehicles.filter((vehicle) => vehicle.isVehicleLease)
    : inventoryVehicles;
  const isVehicleOtherCost = isVehicle && vehicleExpenseKind === "OTHER";
  const isOpenCardPrepaid = purchaseCategory === "OPEN_CARD";
  const isVehiclePrepaid = isVehicle && vehicleExpenseKind === "PREPAID_CARD";
  const isPrepaidTopUp = isVehiclePrepaid || isOpenCardPrepaid;
  const isBankLoan = purchaseCategory === "BANK_LOAN";
  const isEmployeePayment = purchaseCategory === "EMPLOYEE_PAYMENT";
  const isShareholderLoan = isBankLoan && loanSource === "SHAREHOLDER";
  const isBpjsGovernment =
    isGovernment && isBpjsGovernmentKind(governmentTaxKind);
  const isFreeOfCharge =
    freeOfCharge === "Yes" &&
    !isPettyCash &&
    !isGovernment &&
    !isVehicle &&
    !isOpenCardPrepaid &&
    !isBankLoan &&
    !isEmployeePayment;
  const showInvoiceFields =
    !isEmployeePayment &&
    !isPrepaidTopUp &&
    (!isFreeOfCharge || hasInvoice === "Yes");
  const showShippingCost = isFreeOfCharge && addShippingCost === "Yes";
  const requiresVendorBank =
    !isPettyCash &&
    !isGovernment &&
    !isVehicle &&
    !isOpenCardPrepaid &&
    !isBankLoan &&
    !isEmployeePayment;
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
  const requireCatalogLines =
    (purchaseCategory === "PRODUCT" || isVehiclePurchase) &&
    !isVehiclePrepaid;
  const pickerCatalogItems = catalogItems.filter((item) =>
    isVehiclePurchase
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
  const recordingArrivalNow = Boolean(importDutiesBillingId.trim());
  const importStockLandedCostIdr = importResult
    ? (isFocImport ? shippingIdrPreview ?? 0 : 0) +
      importResult.stockLandedCostIdr
    : 0;
  const localLinesTotal = lines.reduce((sum, line) => {
    const qty = isVehiclePurchase || isService ? 1 : Number(line.quantity);
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
    if (!open || !vendorChoice) {
      setVendorBankAccounts([]);
      setVendorBankAccountId("");
      return;
    }
    listVendorBankAccountsForExpense(vendorChoice)
      .then((accounts) => {
        setVendorBankAccounts(accounts);
        setVendorBankAccountId((current) =>
          accounts.some((account) => account.id === current)
            ? current
            : accounts[0]?.id ?? ""
        );
      })
      .catch(() => {
        setVendorBankAccounts([]);
        setVendorBankAccountId("");
      });
  }, [open, vendorChoice]);

  useEffect(() => {
    if (!isBpjsGovernment) return;
    const saved =
      governmentTaxKind === "BPJS_KESEHATAN"
        ? bpjsVirtualAccounts.kesehatan
        : bpjsVirtualAccounts.ketenagakerjaan;
    if (saved && !invoiceRef.trim()) {
      setInvoiceRef(saved);
    }
  }, [bpjsVirtualAccounts, governmentTaxKind, invoiceRef, isBpjsGovernment]);

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
    listEmployeesForExpense()
      .then((payload) => {
        setExpenseEmployees(payload.employees);
        setExpenseDepartments(payload.departments);
      })
      .catch(() => {
        setExpenseEmployees([]);
        setExpenseDepartments([]);
      });
    listCompanyBpjsVirtualAccounts()
      .then(setBpjsVirtualAccounts)
      .catch(() =>
        setBpjsVirtualAccounts({ kesehatan: "", ketenagakerjaan: "" })
      );
    listPrepaidCardsForExpense()
      .then((cards) => {
        setPrepaidCards(cards);
        setPrepaidCardId((current) => current || cards[0]?.id || "");
      })
      .catch(() => setPrepaidCards([]));
    listVehiclesForExpense()
      .then(setInventoryVehicles)
      .catch(() => setInventoryVehicles([]));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPending(false);
      setError(null);
      setDocumentFile(null);
      setTaxFile(null);
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
      setLoanSource("");
      setLoanKind("");
      setLoanPaymentPurpose("");
      setLoanFacilityId("");
      setTransferFee("");
      setVendorChoice("");
      setBankAccountId("");
      setGovernmentTaxKind("PPN");
      setBpjsYear(Number(todayDateInput().slice(0, 4)));
      setBpjsMonth(Number(todayDateInput().slice(5, 7)));
      setPaymentTermsDays(14);
      setImportFulfillment("INTERNAL");
      setImportDutiesBillingId("");
      setImportDutiesFile(null);
      setHandlingVendorId("");
      setHandlingFeeIdr("");
      setHandlingHasTaxInvoice("");
      setHandlingFeeFile(null);
      setVehicleExpenseKind("");
      setVehicleAssetId("");
      setVehicleOtherCostDescription("");
      setEmployeePaymentKind("");
      setEmployeeDepartmentId("");
      setEmployeeId("");
      setEmployeeSearch("");
      setVendorBankAccounts([]);
      setVendorBankAccountId("");
      setPrepaidCardId("");
    }
  }, [open]);

  const selectedLoan =
    loanFacilities.find((row) => row.id === loanFacilityId) ?? null;

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
      setHandlingHasTaxInvoice("");
      setHandlingFeeFile(null);
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
      setIncludesPpn("No");
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
      setEmployeeId("");
      setEmployeeSearch("");
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
    if (value === "OPEN_CARD") {
      setPurchasePurpose("INTERNAL");
      setProjectId("");
      setIncludesPpn("No");
      setFreeOfCharge("No");
      setFreeOfChargeReason("");
      setIncludedTaxKind("");
      setTaxFile(null);
      setVendorChoice("");
      setPrepaidCardId("");
    }
    if (value === "EMPLOYEE_PAYMENT") {
      setPurchasePurpose("INTERNAL");
      setProjectId("");
      setIncludesPpn("No");
      setFreeOfCharge("No");
      setFreeOfChargeReason("");
      setIncludedTaxKind("");
      setTaxFile(null);
      setVendorChoice("");
      setEmployeePaymentKind("");
      setEmployeeId("");
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
      setLoanSource("");
      setLoanKind("");
      setLoanPaymentPurpose("");
      setLoanFacilityId("");
      setVendorChoice("");
    }
    if (value !== "BANK_LOAN") {
      setLoanSource("");
      setLoanKind("");
      setLoanPaymentPurpose("");
      setLoanFacilityId("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const extraMissing: string[] = [];
    if (isPrepaidTopUp && !prepaidCardId) {
      extraMissing.push(t("pages.billing.prepaidCard"));
    }
    if (isVehicle && !vehicleExpenseKind) {
      extraMissing.push(t("pages.billing.vehicleExpenseKind"));
    }
    if (requiresVendorBank && !vendorChoice) {
      extraMissing.push(t("pages.billing.purchaseSupplier"));
    }
    if (requiresVendorBank && vendorChoice && vendorBankAccounts.length === 0) {
      showRejection({ reasons: t("pages.billing.payToAccountEmpty") });
      return;
    }
    if (requiresVendorBank && vendorChoice && !vendorBankAccountId) {
      extraMissing.push(t("pages.billing.payToAccount"));
    }
    if (!isPettyCash && showInvoiceFields && !documentFile) {
      extraMissing.push(t("pages.billing.purchaseDocument"));
    }
    if ((isPettyCash || isPrepaidTopUp || isVehicleOperatingCost) && !amount.trim()) {
      extraMissing.push(t("pages.billing.purchaseAmount"));
    }
    if (isVehicleOperatingCost && !vehicleAssetId) {
      extraMissing.push(t("pages.billing.vehicleFor"));
    }
    if (isVehicleOtherCost && !vehicleOtherCostDescription.trim()) {
      extraMissing.push(t("pages.billing.vehicleOtherCostDescription"));
    }
    if (isPrepaidTopUp && (!documentFile || documentFile.size === 0)) {
      extraMissing.push(t("pages.billing.purchaseDocument"));
    }
    if (!usesImportFlow && withPpn && taxFile && taxFile.size > 0) {
      if (!taxSerialAssist.serial.trim()) {
        extraMissing.push(t("pages.vat.columns.taxInvoiceNumber"));
      }
      if (!taxSerialAssist.verified) {
        extraMissing.push(t("pages.vat.taxInvoiceNumberVerify"));
      }
    }
    if (showMissingRequiredFields(form, extraMissing)) {
      return;
    }
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
        : isGovernment || isBankLoan || isVehicleOperatingCost
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
        isFreeOfCharge || isVehicle || isBankLoan || isEmployeePayment
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

    formData.set("vendorBankAccountId", vendorBankAccountId);
    if (isEmployeePayment) {
      formData.set("employeePaymentKind", employeePaymentKind);
      formData.set("employeeId", employeeId);
      formData.set("amount", amount.trim());
      if (!employeePaymentKind) {
        setError(t("pages.billing.employeePaymentKindRequired"));
        return;
      }
      if (employeePaymentKind === "CASH_ADVANCE" && !employeeId) {
        setError(t("pages.billing.employeePaymentEmployeeRequired"));
        return;
      }
      if (!documentFile || documentFile.size === 0) {
        setError(t("pages.loans.proofRequired"));
        return;
      }
    }
    if (isPettyCash || isGovernment || isPrepaidTopUp) {
      formData.set("amount", amount.trim());
      formData.set("bankAccountId", bankAccountId);
      if (isPettyCash) {
        if (!employeeId) {
          showRejection({
            reasons: t("pages.billing.pettyCashRecipientRequired"),
          });
          return;
        }
        formData.set("employeeId", employeeId);
      }
      if (isPrepaidTopUp) {
        if (!prepaidCardId) {
          showRejection({ reasons: t("pages.billing.vehiclePrepaidCardRequired") });
          return;
        }
        formData.set("prepaidCardId", prepaidCardId);
        if (isOpenCardPrepaid) {
          formData.set("openCardTopUp", "1");
          formData.set("purchaseCategory", "SERVICE");
          formData.set("purchasePurpose", "INTERNAL");
        } else {
          formData.set("vehicleExpenseKind", "PREPAID_CARD");
          formData.set("purchaseCategory", "VEHICLE");
        }
        if (!documentFile || documentFile.size === 0) {
          setError(t("pages.loans.proofRequired"));
          return;
        }
      }
      if (isGovernment) {
        formData.set("governmentTaxKind", governmentTaxKind);
        formData.set("notes", String(formData.get("notes") ?? "").trim());
        if (isBpjsGovernment) {
          formData.set("bpjsYear", String(bpjsYear));
          formData.set("bpjsMonth", String(bpjsMonth));
        }
        if (!documentFile || documentFile.size === 0) {
          setError(
            isBpjsGovernment
              ? t("pages.loans.proofRequired")
              : t("pages.billing.governmentDocumentRequired")
          );
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
      if (!loanSource) {
        setError(t("pages.billing.loanSourceRequired"));
        return;
      }
      if (loanSource === "BANK" && !loanPaymentPurpose) {
        setError(t("pages.billing.loanPaymentForRequired"));
        return;
      }
      if (!loanKind) {
        setError(t("pages.billing.bankLoanKindRequired"));
        return;
      }
      if (
        !loanFacilityId ||
        !selectedLoan ||
        selectedLoan.source !== loanSource ||
        selectedLoan.kind !== loanKind
      ) {
        setError(t("pages.billing.loanFacilityRequired"));
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
      formData.set("supplierName", selectedLoan.lenderName);
      formData.set("loanFacilityId", selectedLoan.id);
      formData.set("loanSource", selectedLoan.source);
      if (loanPaymentPurpose) {
        formData.set("loanPaymentPurpose", loanPaymentPurpose);
      }
    formData.set("amount", amount.trim());
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
      }
      formData.set("importDutiesBillingId", "");
      const hasHandlingNow =
        Boolean(handlingVendorId.trim()) || Boolean(handlingFeeIdr.trim());
      if (hasHandlingNow) {
        formData.set("handlingVendorId", handlingVendorId);
        formData.set("handlingFeeIdr", handlingFeeIdr);
        formData.set(
          "handlingHasTaxInvoice",
          handlingHasTaxInvoice === "Yes" ? "true" : "false"
        );
        if (handlingFeeFile && handlingFeeFile.size > 0) {
          formData.set("handlingFeeDocument", handlingFeeFile);
        }
      } else {
        formData.delete("handlingVendorId");
        formData.delete("handlingFeeIdr");
        formData.set("handlingFeeIncludesPpn", "false");
      }
      formData.set(
        "handlingDueWithDuties",
        importFulfillment === "OUTSOURCED" || hasHandlingNow
          ? "false"
          : "true"
      );
    } else {
      formData.delete("importJson");
    }

    if (requireItemLines) {
      if (requireCatalogLines && pickerCatalogItems.length === 0) {
        setError(
          isVehiclePurchase
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
        const quantity = isVehiclePurchase || isService ? 1 : Number(line.quantity);
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
      formData.set("taxInvoiceDocument", taxFile);
      formData.set("taxInvoiceSerial", taxSerialAssist.serial);
      formData.set(
        "taxInvoiceSerialVerified",
        taxSerialAssist.verified ? "true" : ""
      );
    } else {
      formData.delete("taxInvoiceDocument");
      formData.delete("manualReason");
      formData.delete("taxInvoiceSerial");
      formData.delete("taxInvoiceSerialVerified");
    }

    if (bankAccounts.length > 0 && !bankAccountId) {
      setError(t("pages.billing.purchaseBankAccountRequired"));
      return;
    }
    formData.set("bankAccountId", bankAccountId);

    if (isVehicle && !isVehiclePrepaid) {
      if (!vehicleExpenseKind) {
        setError(t("pages.billing.vehicleExpenseKindRequired"));
        return;
      }
      formData.set("vehicleExpenseKind", vehicleExpenseKind);
      if (isVehiclePurchase) {
        if (!vehicleLease.plateNumber.trim()) {
          setError(t("pages.billing.purchaseVehiclePlateRequired"));
          return;
        }
        if (!vehicleLease.vehicleYear.trim()) {
          setError(t("pages.billing.purchaseVehicleYearRequired"));
          return;
        }
        if (!vehicleLease.condition) {
          setError(t("pages.billing.purchaseVehicleConditionRequired"));
          return;
        }
        applyVehicleLeaseDraftToFormData(formData, vehicleLease);
      } else if (isVehicleOperatingCost) {
        if (!vehicleAssetId) {
          setError(t("pages.billing.vehicleForRequired"));
          return;
        }
        formData.set("vehicleAssetId", vehicleAssetId);
        if (isVehicleOtherCost) {
          if (!vehicleOtherCostDescription.trim()) {
            setError(t("pages.billing.vehicleOtherCostRequired"));
            return;
          }
          formData.set(
            "vehicleOtherCostDescription",
            vehicleOtherCostDescription.trim()
          );
        }
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

  const handlingPaidNow = parseImportDecimal(handlingFeeIdr) ?? 0;
  const handlingNowFields = (
    <PurchaseHandlingNowFields
      fulfillment={importFulfillment}
      vendors={vendors}
      vendorId={handlingVendorId}
      onVendorIdChange={setHandlingVendorId}
      amount={handlingFeeIdr}
      onAmountChange={setHandlingFeeIdr}
      hasTaxInvoice={handlingHasTaxInvoice}
      onHasTaxInvoiceChange={setHandlingHasTaxInvoice}
      file={handlingFeeFile}
      onFileChange={setHandlingFeeFile}
      disabled={busy}
    />
  );

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
        compactHeader
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="purchase-invoice-upload-form"
              disabled={busy}
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
          noValidate
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
                className={choiceGridClassForCount(8)}
              >
                {(
                  [
                    ["PRODUCT", t("pages.billing.purchaseCategoryProduct")],
                    ["SERVICE", t("pages.billing.purchaseCategoryService")],
                    [
                      "GOVERNMENT",
                      t("pages.billing.purchaseCategoryGovernment"),
                    ],
                    ["BANK_LOAN", t("pages.billing.purchaseCategoryBankLoan")],
                    [
                      "PETTY_CASH",
                      t("pages.billing.purchaseCategoryPettyCash"),
                    ],
                    ["VEHICLE", t("pages.billing.purchaseCategoryVehicle")],
                    ["OPEN_CARD", t("pages.billing.purchaseCategoryOpenCard")],
                    [
                      "EMPLOYEE_PAYMENT",
                      t("pages.billing.purchaseCategoryEmployee"),
                    ],
                  ] as Array<[PurchaseCategoryChoice, string]>
                ).map(([value, label], index, options) => {
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
                        employeeDialogChoiceChipClass,
                        choiceGridSpanLastClass(index, options.length),
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
              {isPettyCash ? (
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.advanceCashPettyHint")}
                </p>
              ) : null}
              {isPettyCash ? (
                <div className="mt-4 space-y-2">
                  <label className={employeeDialogLabelClass}>
                    {t("pages.billing.pettyCashRecipient")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <Input
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder={t("pages.billing.employeePaymentEmployeeSearch")}
                    className={employeeInputClass}
                  />
                  <Select
                    value={employeeId || null}
                    onValueChange={(value) => setEmployeeId(value ?? "")}
                    disabled={busy}
                  >
                    <SelectTrigger className={cn(employeeSelectTriggerClass, "mt-2")}>
                      <SelectValue
                        placeholder={t("pages.billing.pettyCashRecipientPlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseEmployees
                        .filter((employee) => {
                          const query = employeeSearch.trim().toLowerCase();
                          if (!query) return true;
                          const name =
                            `${employee.firstName} ${employee.lastName}`.toLowerCase();
                          return (
                            name.includes(query) ||
                            employee.employeeNo.toLowerCase().includes(query)
                          );
                        })
                        .map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.firstName} {employee.lastName} ·{" "}
                            {employee.employeeNo}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            {isVehicle ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  id="vehicle-expense-kind-label"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.vehicleExpenseKind")}
                  <span className="text-red-400"> *</span>
                </label>
                <div
                  role="radiogroup"
                  aria-labelledby="vehicle-expense-kind-label"
                  className={cn("mt-2", choiceGridClassForCount(6))}
                >
                  {(
                    [
                      ["PURCHASE", t("pages.billing.vehicleExpenseKindPurchase")],
                      [
                        "PREPAID_CARD",
                        t("pages.billing.vehicleExpenseKindPrepaid"),
                      ],
                      ["SERVICING", t("pages.billing.vehicleExpenseKindServicing")],
                      [
                        "MODIFICATION",
                        t("pages.billing.vehicleExpenseKindModification"),
                      ],
                      [
                        "LEASE_PAYMENT",
                        t("pages.billing.vehicleExpenseKindLeasePayment"),
                      ],
                      ["OTHER", t("pages.billing.vehicleExpenseKindOther")],
                    ] as const
                  ).map(([value, label], index, options) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={vehicleExpenseKind === value}
                      disabled={busy}
                      onClick={() => {
                        setVehicleExpenseKind(value);
                        setVehicleAssetId("");
                        setVehicleOtherCostDescription("");
                        if (value !== "PURCHASE") {
                          setVehicleLease(emptyVehicleLeaseDraft());
                          setLines([newPurchaseLine()]);
                        }
                      }}
                      className={cn(
                        "inline-flex min-h-8 w-full items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                        choiceGridSpanLastClass(index, options.length),
                        vehicleExpenseKind === value &&
                          outlineChipTones.emeraldInteractive,
                        vehicleExpenseKind !== value &&
                          "border border-border bg-elevated text-muted hover:border-border-strong hover:bg-card-hover hover:text-text"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="hidden"
                  name="vehicleExpenseKind"
                  value={vehicleExpenseKind}
                  required
                  data-required-label={t("pages.billing.vehicleExpenseKind")}
                />
              </div>
            ) : null}

            {isPrepaidTopUp ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.billing.prepaidCard")}
                  <span className="text-red-400"> *</span>
                </label>
                {prepaidCards.filter((card) =>
                  isOpenCardPrepaid ? card.kind === "OPEN" : card.kind === "VEHICLE"
                ).length === 0 ? (
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.prepaidCardEmpty")}
                  </p>
                ) : (
                  <Select
                    value={prepaidCardId || null}
                    onValueChange={(value) => setPrepaidCardId(value ?? "")}
                    disabled={busy}
                  >
                    <SelectTrigger className={employeeSelectTriggerClass}>
                      <SelectValue>
                        {(value) => {
                          const card = prepaidCards.find((row) => row.id === value);
                          if (!card) return t("pages.billing.prepaidCard");
                          const number = formatPrepaidCardNumber(card.cardNumber);
                          return card.kind === "OPEN"
                            ? card.custodianName
                              ? `${number} · ${card.custodianName}`
                              : number
                            : formatVehicleIdentityLabel({
                                plate: card.vehiclePlate,
                                name: card.vehicleName,
                                cardNumber: number,
                                sku: card.vehicleSku,
                              });
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {prepaidCards
                        .filter((card) =>
                          isOpenCardPrepaid
                            ? card.kind === "OPEN"
                            : card.kind === "VEHICLE"
                        )
                        .map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.kind === "OPEN"
                            ? `${formatPrepaidCardNumber(card.cardNumber)}${
                                card.custodianName ? ` · ${card.custodianName}` : ""
                              }`
                            : formatVehicleIdentityLabel({
                                plate: card.vehiclePlate,
                                name: card.vehicleName,
                                cardNumber: formatPrepaidCardNumber(card.cardNumber),
                                sku: card.vehicleSku,
                              })}{" "}
                          · {formatContractPrice(card.currentBalance)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <input
                  type="hidden"
                  name="prepaidCardId"
                  value={prepaidCardId}
                  required
                  data-required-label={t("pages.billing.prepaidCard")}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.vehiclePrepaidSpendHint")}
                </p>
              </div>
            ) : null}

            {isEmployeePayment ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.billing.employeePaymentKind")}
                  <span className="text-red-400"> *</span>
                </label>
                <div className={choiceGridClassForCount(3)}>
                  {(
                    [
                      [
                        "INTERNAL_PAYROLL",
                        t("pages.billing.employeePaymentInternalPayroll"),
                      ],
                      [
                        "CASH_ADVANCE",
                        t("pages.billing.employeePaymentCashAdvance"),
                      ],
                      ["THR", t("pages.billing.employeePaymentThr")],
                    ] as const
                  ).map(([value, label], index, options) => {
                    const active = employeePaymentKind === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={busy}
                        onClick={() => setEmployeePaymentKind(value)}
                        className={cn(
                          employeeDialogChoiceChipClass,
                          choiceGridSpanLastClass(index, options.length),
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
                  {t("pages.billing.employeePaymentKindHint")}
                </p>
                <input
                  type="hidden"
                  name="employeePaymentKind"
                  value={employeePaymentKind}
                  required
                  data-required-label={t("pages.billing.employeePaymentKind")}
                />
              </div>
            ) : null}

            {isEmployeePayment && employeePaymentKind === "CASH_ADVANCE" ? (
              <>
                <div className={employeeDialogFieldClass}>
                  <label className={employeeDialogLabelClass}>
                    {t("pages.billing.employeePaymentDepartment")}
                  </label>
                  <Select
                    value={employeeDepartmentId || "all"}
                    onValueChange={(value) =>
                      setEmployeeDepartmentId(value === "all" ? "" : value ?? "")
                    }
                    disabled={busy}
                  >
                    <SelectTrigger className={employeeSelectTriggerClass}>
                      <SelectValue>
                        {(value) => {
                          if (!value || value === "all") {
                            return t(
                              "pages.billing.employeePaymentDepartmentAll"
                            );
                          }
                          const department = expenseDepartments.find(
                            (row) => row.id === value
                          );
                          return department
                            ? localizeDepartmentLabel(
                                department.slug,
                                department.name
                              )
                            : t("pages.billing.employeePaymentDepartmentAll");
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("pages.billing.employeePaymentDepartmentAll")}
                      </SelectItem>
                      {expenseDepartments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {localizeDepartmentLabel(
                            department.slug,
                            department.name
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={employeeDialogFieldClass}>
                  <label className={employeeDialogLabelClass}>
                    {t("pages.billing.employeePaymentEmployee")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <Input
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder={t("pages.billing.employeePaymentEmployeeSearch")}
                    className={employeeInputClass}
                  />
                  <Select
                    value={employeeId || null}
                    onValueChange={(value) => setEmployeeId(value ?? "")}
                    disabled={busy}
                  >
                    <SelectTrigger className={cn(employeeSelectTriggerClass, "mt-2")}>
                      <SelectValue
                        placeholder={t("pages.billing.employeePaymentEmployee")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseEmployees
                        .filter((employee) => {
                          if (
                            employeeDepartmentId &&
                            employee.department?.id !== employeeDepartmentId
                          ) {
                            return false;
                          }
                          const query = employeeSearch.trim().toLowerCase();
                          if (!query) return true;
                          const name =
                            `${employee.firstName} ${employee.lastName}`.toLowerCase();
                          return (
                            name.includes(query) ||
                            employee.employeeNo.toLowerCase().includes(query)
                          );
                        })
                        .map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.firstName} {employee.lastName} ·{" "}
                            {employee.employeeNo}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            {isEmployeePayment && employeePaymentKind && employeePaymentKind !== "THR" ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.employeePaymentAutoPeriod")}
                </p>
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.employeePaymentAutoPeriodHint")}
                </p>
              </div>
            ) : null}

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
                  className={employeeDialogChoiceGridClass}
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
                          } else {
                            setIncludesPpn("No");
                            setIncludedTaxKind("");
                            setTaxFile(null);
                          }
                        }}
                        className={cn(
                          employeeDialogChoiceChipClass,
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

            {isPettyCash ||
            isGovernment ||
            isVehicle ||
            isOpenCardPrepaid ||
            isBankLoan ||
            isEmployeePayment ? null : (
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
            isPrepaidTopUp ||
            isBankLoan ||
            isEmployeePayment ||
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

            {isBankLoan ? (
              <PurchaseLoanFields
                source={loanSource}
                kind={loanKind}
                paymentPurpose={loanPaymentPurpose}
                facilityId={loanFacilityId}
                facilities={loanFacilities}
                onSourceChange={(value) => {
                  setLoanSource(value);
                  setLoanPaymentPurpose("");
                  setLoanKind("");
                  setLoanFacilityId("");
                }}
                onPaymentPurposeChange={(value) => {
                  setLoanPaymentPurpose(value);
                  if (value === "INTEREST") {
                    if (loanKind !== "STANDBY") setLoanFacilityId("");
                    setLoanKind("STANDBY");
                  } else if (value === "INSTALLMENT") {
                    if (loanKind !== "TERM") setLoanFacilityId("");
                    setLoanKind("TERM");
                  }
                }}
                onKindChange={(value) => {
                  setLoanKind(value);
                  setLoanFacilityId("");
                }}
                onFacilityChange={(id) => {
                  setLoanFacilityId(id);
                  const row = loanFacilities.find((item) => item.id === id);
                  if (row) setLoanKind(row.kind);
                }}
                disabled={busy}
              />
            ) : null}

            {isVehicleOtherCost ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  htmlFor="vehicle-other-cost-description"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.vehicleOtherCostDescription")}
                  <span className="text-red-400"> *</span>
                </label>
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.vehicleOtherCostDescriptionHint")}
                </p>
                <div className="mt-2 overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-elevated/60 text-xs uppercase tracking-wide text-muted">
                        <th className="px-3 py-2.5 font-semibold">
                          {t("pages.billing.vehicleOtherCostDescription")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-card">
                        <td className="p-3">
                          <Textarea
                            id="vehicle-other-cost-description"
                            name="vehicleOtherCostDescription"
                            disabled={busy}
                            required
                            data-required-label={t(
                              "pages.billing.vehicleOtherCostDescription"
                            )}
                            value={vehicleOtherCostDescription}
                            onChange={(event) =>
                              setVehicleOtherCostDescription(event.target.value)
                            }
                            placeholder={t(
                              "pages.billing.vehicleOtherCostDescriptionPlaceholder"
                            )}
                            className={cn(employeeInputClass, "min-h-24")}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {isVehicleOperatingCost ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.billing.vehicleFor")}
                  <span className="text-red-400"> *</span>
                </label>
                {selectableVehicles.length === 0 ? (
                  <p className={employeeDialogHintClass}>
                    {isVehicleLeasePayment
                      ? t("pages.billing.vehicleForLeaseEmpty")
                      : t("pages.billing.vehicleForEmpty")}
                  </p>
                ) : (
                  <Select
                    value={vehicleAssetId || null}
                    onValueChange={(value) => setVehicleAssetId(value ?? "")}
                    disabled={busy}
                  >
                    <SelectTrigger className={employeeSelectTriggerClass}>
                      <SelectValue placeholder={t("pages.billing.vehicleFor")}>
                        {(value) => {
                          if (!value) {
                            return t("pages.billing.vehicleFor");
                          }
                          const row = selectableVehicles.find(
                            (vehicle) => vehicle.id === value
                          );
                          return row?.label ?? t("pages.billing.vehicleFor");
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {selectableVehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <input
                  type="hidden"
                  name="vehicleAssetId"
                  value={vehicleAssetId}
                  required
                  data-required-label={t("pages.billing.vehicleFor")}
                />
                <p className={employeeDialogHintClass}>
                  {isVehicleLeasePayment
                    ? t("pages.billing.vehicleForLeaseHint")
                    : t("pages.billing.vehicleForHint")}
                </p>
              </div>
            ) : null}

            <CompanyBankAccountField
              className="sm:col-span-2"
              accounts={bankAccounts}
              value={bankAccountId}
              onChange={setBankAccountId}
              label={t("pages.billing.purchaseBankAccount")}
              hint={t("pages.billing.purchaseBankAccountHint")}
              disabled={busy}
            />

            {usesImportFlow || isBpjsGovernment ? null : (
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
                <div className={employeeDialogChoiceGridClass}>
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
                      }}
                      className={cn(
                        employeeDialogChoiceChipClass,
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
                  {isBpjsGovernment
                    ? t("pages.billing.governmentBpjsPaymentHint")
                    : t("pages.billing.governmentTaxTypeHint")}
                </p>
              </div>
            ) : null}

            {isBpjsGovernment ? (
              <>
                <div className={employeeDialogFieldClass}>
                  <label
                    htmlFor="bpjs-expense-month"
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.billing.governmentBpjsMonth")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <Select
                    value={String(bpjsMonth) || null}
                    onValueChange={(value) => {
                      const next = Number(value);
                      if (next >= 1 && next <= 12) setBpjsMonth(next);
                    }}
                    disabled={busy}
                  >
                    <SelectTrigger
                      id="bpjs-expense-month"
                      className={cn(employeeSelectTriggerClass, "w-full")}
                    >
                      <SelectValue>
                        {(value) =>
                          value
                            ? t(
                                `pages.reports.months.${value as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12"}`
                              )
                            : t("pages.billing.governmentBpjsPeriod")
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="z-[60]">
                      {([
                        "1",
                        "2",
                        "3",
                        "4",
                        "5",
                        "6",
                        "7",
                        "8",
                        "9",
                        "10",
                        "11",
                        "12",
                      ] as const).map((month) => (
                        <SelectItem key={month} value={month}>
                          {t(`pages.reports.months.${month}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={employeeDialogFieldClass}>
                  <label
                    htmlFor="bpjs-expense-year"
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.billing.governmentBpjsYear")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <Select
                    value={String(bpjsYear)}
                    onValueChange={(value) => {
                      const next = Number(value);
                      if (Number.isInteger(next)) setBpjsYear(next);
                    }}
                    disabled={busy}
                  >
                    <SelectTrigger
                      id="bpjs-expense-year"
                      className={cn(employeeSelectTriggerClass, "w-full")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[60]">
                      {Array.from({ length: 8 }, (_, index) => {
                        const year = Number(todayDateInput().slice(0, 4)) - 5 + index;
                        return (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.governmentBpjsPeriodHint")}
                  </p>
                </div>
                <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                  <label htmlFor="purchase-ref" className={employeeDialogLabelClass}>
                    {t("pages.billing.governmentVirtualAccount")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <Input
                    id="purchase-ref"
                    name="invoiceRef"
                    required
                    disabled={busy}
                    value={invoiceRef}
                    onChange={(event) => setInvoiceRef(event.target.value)}
                    placeholder={t(
                      "pages.billing.governmentVirtualAccountPlaceholder"
                    )}
                    className={employeeInputClass}
                  />
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.governmentVirtualAccountHint")}
                  </p>
                </div>
                <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                  <label
                    htmlFor="purchase-amount"
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.billing.governmentBpjsAmount")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <MoneyInput
                    id="purchase-amount"
                    name="amount"
                    required
                    disabled={busy}
                    value={amount}
                    onValueChange={setAmount}
                    placeholder={t("pages.billing.purchaseAmountPlaceholder")}
                    className={employeeInputClass}
                  />
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.governmentBpjsAmountHint")}
                  </p>
                </div>
                <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                  <label
                    htmlFor="purchase-date"
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.billing.loanPaidDate")}
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
                <div className="sm:col-span-2 space-y-2">
                  <BillingDocumentFilePick
                    id="purchase-document"
                    label={t("pages.billing.governmentBpjsDocument")}
                    required
                    fileName={documentFile?.name ?? null}
                    onPick={handleDocumentPick}
                    disabled={busy}
                  />
                </div>
              </>
            ) : null}

            {isPettyCash || isBpjsGovernment ? null : showInvoiceFields ||
            isEmployeePayment ||
            isPrepaidTopUp ? (
            <div className="sm:col-span-2 space-y-2">
              <BillingDocumentFilePick
                id="purchase-document"
                label={
                  isBpjsGovernment
                    ? t("pages.billing.governmentBpjsDocument")
                    : isGovernment
                    ? t("pages.billing.governmentDocument")
                    : isBankLoan || isEmployeePayment || isPrepaidTopUp
                      ? t("pages.billing.purchasePaymentProof")
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
            ) : null}

            {isPettyCash || isPrepaidTopUp || isGovernment || isBankLoan || isEmployeePayment ? null : (
            <>
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
              <input
                type="hidden"
                name="vendorId"
                value={vendorChoice}
                required={requiresVendorBank}
                data-required-label={t("pages.billing.purchaseSupplier")}
              />
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
            {vendorChoice && vendorBankAccounts.length > 0 ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.billing.payToAccount")}
                  <span className="text-red-400"> *</span>
                </label>
                <Select
                  value={vendorBankAccountId || null}
                  onValueChange={(value) => setVendorBankAccountId(value ?? "")}
                  disabled={busy}
                >
                  <SelectTrigger className={employeeSelectTriggerClass}>
                    <SelectValue>
                      {(value) => {
                        const account = vendorBankAccounts.find(
                          (item) => item.id === value
                        );
                        return account
                          ? formatVendorBankAccountLabel(account)
                          : t("pages.billing.payToAccount");
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {vendorBankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {formatVendorBankAccountLabel(account)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="hidden"
                  name="vendorBankAccountId"
                  value={vendorBankAccountId}
                  required
                  data-required-label={t("pages.billing.payToAccount")}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.payToAccountHint")}
                </p>
              </div>
            ) : vendorChoice ? (
              <p className={cn(employeeDialogHintClass, "sm:col-span-2")}>
                {t("pages.billing.payToAccountEmpty")}
              </p>
            ) : null}
            </>
            )}

            {isPettyCash ||
            isShareholderLoan ||
            isBpjsGovernment ||
            (!isGovernment && !showInvoiceFields) ? null : (
            <div className={employeeDialogFieldClass}>
              <label htmlFor="purchase-ref" className={employeeDialogLabelClass}>
                {isBpjsGovernment
                  ? t("pages.billing.governmentVirtualAccount")
                  : isGovernment
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
                  isBpjsGovernment
                    ? t("pages.billing.governmentVirtualAccountPlaceholder")
                    : isGovernment
                    ? t("pages.billing.governmentBillingIdPlaceholder")
                    : isBankLoan
                      ? t("pages.billing.bankLoanRefPlaceholder")
                      : t("pages.billing.purchaseInvoiceRefPlaceholder")
                }
                className={employeeInputClass}
              />
              {isBpjsGovernment ? (
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.governmentVirtualAccountHint")}
                </p>
              ) : isGovernment ? (
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

            {isBpjsGovernment ? null : isPettyCash || isPrepaidTopUp || showInvoiceFields ? (
            <div
              className={cn(
                employeeDialogFieldClass,
                (isPettyCash ||
                  isPrepaidTopUp ||
                  isGovernment ||
                  !showInvoiceFields) &&
                  "sm:col-span-2"
              )}
            >
              <label
                htmlFor="purchase-date"
                className={employeeDialogLabelClass}
              >
                {isShareholderLoan || isBpjsGovernment
                  ? t("pages.billing.loanPaidDate")
                  : isPettyCash || isPrepaidTopUp
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
                showDutiesLaterHint={importFulfillment === "INTERNAL"}
                handlingFeePaidIdr={handlingPaidNow}
                handlingFeeCostIdr={handlingPaidNow}
                showHandlingFee={handlingPaidNow > 0}
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
                afterCharges={handlingNowFields}
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
                    {isVehiclePurchase
                      ? t("pages.billing.purchaseVehicleBought")
                      : t("pages.billing.purchaseItemsBought")}
                    <span className="text-red-400"> *</span>
                  </label>
                  {isVehiclePurchase ? null : (
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
                    {isVehiclePurchase
                      ? t("pages.billing.purchaseVehicleCatalogEmpty")
                      : t("pages.billing.purchaseCatalogEmpty")}
                  </p>
                ) : null}
                  <div className="mt-2 space-y-3">
                    {lines.map((line, index) => {
                      const item = catalogItems.find(
                        (entry) => entry.id === line.itemId
                      );
                      const qty = isVehiclePurchase ? 1 : Number(line.quantity);
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
                                {isVehiclePurchase ? null : (
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
                    {isVehiclePurchase && lines.some((line) => line.itemId) ? (
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
                  vehicleOnly={isVehiclePurchase}
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
                              quantity: isVehiclePurchase ? "1" : row.quantity,
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
            ) : isBpjsGovernment ? null : (
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
              <MoneyInput
                id="purchase-amount"
                name="amount"
                required
                disabled={busy}
                value={amount}
                onValueChange={setAmount}
                placeholder={t("pages.billing.purchaseAmountPlaceholder")}
                className={employeeInputClass}
              />
                {isGovernment ? (
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.governmentAmountHint")}
                  </p>
                ) : isBankLoan ? (
                  <p className={employeeDialogHintClass}>
                    {loanPaymentPurpose === "PROVISION"
                      ? t("pages.billing.loanExpenseProvisionHint")
                      : loanPaymentPurpose === "ADMIN_FEE"
                        ? t("pages.billing.loanExpenseAdminFeeHint")
                        : loanKind === "STANDBY"
                          ? t("pages.billing.loanExpenseStandbyHint")
                          : loanKind === "TERM"
                            ? t("pages.billing.loanExpenseTermHint")
                            : t("pages.billing.bankLoanPaymentAmountHint")}
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
                  <div className={employeeDialogChoiceGridClass}>
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
                        }}
                        className={cn(
                          employeeDialogChoiceChipClass,
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
                  showDutiesLaterHint={importFulfillment === "INTERNAL"}
                  handlingFeePaidIdr={handlingPaidNow}
                  handlingFeeCostIdr={handlingPaidNow}
                  showHandlingFee={handlingPaidNow > 0}
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
                      {handlingNowFields}
                    </>
                  }
                />
              </div>
            ) : null}

            {isBpjsGovernment ? null : (
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                htmlFor="purchase-notes"
                className={employeeDialogLabelClass}
              >
                {isGovernment
                  ? t("pages.billing.governmentDescription")
                  : t("pages.billing.purchaseNotes")}
                {isGovernment ? (
                  <span className="text-red-400"> *</span>
                ) : null}
              </label>
              <Textarea
                id="purchase-notes"
                name="notes"
                required={isGovernment && !isBpjsGovernment}
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
            )}

            {isService ? (
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label className={employeeDialogLabelClass}>
                {t("pages.billing.purchasePurpose")}
                <span className="text-red-400"> *</span>
              </label>
              <div className={employeeDialogChoiceGridClass}>
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
                        employeeDialogChoiceChipClass,
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
            isPrepaidTopUp ||
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
            !isPrepaidTopUp &&
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

            {taxIncluded &&
            kindNeedsOtherName &&
            !isPettyCash &&
            !isPrepaidTopUp &&
            !isImport ? (
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

            {taxIncluded &&
            kindNeedsRate &&
            !isPettyCash &&
            !isPrepaidTopUp &&
            !isImport ? (
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

            {withPpn && !isPettyCash && !isPrepaidTopUp && !isImport ? (
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
                  <TaxInvoiceNumberFields
                    id="purchase-tax-serial"
                    serial={taxSerialAssist.serial}
                    onSerialChange={taxSerialAssist.setSerial}
                    verified={taxSerialAssist.verified}
                    onVerifiedChange={taxSerialAssist.setVerified}
                    detected={taxSerialAssist.detected}
                    reading={taxSerialAssist.reading}
                    disabled={busy}
                  />
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
