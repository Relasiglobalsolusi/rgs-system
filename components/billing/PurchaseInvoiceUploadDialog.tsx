"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, ScanLine, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createPurchaseInvoice,
  extractPurchaseInvoiceFromUpload,
} from "@/app/billing/purchase-invoices/actions";
import { BillingDocumentFilePick } from "@/components/billing/BillingDocumentVerifyDialog";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  dueAtFromPaymentTerms,
  isCashPaymentTerms,
} from "@/lib/invoice-period";
import { todayDateInput } from "@/lib/project-contract";
import {
  formatExtractedAmountForInput,
  type ExtractPurchaseInvoiceResult,
} from "@/lib/purchase-invoice-extract-client";
import { formatContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PRODUCT_PPN_RATE_PERCENT,
  parsePpnRatePercent,
  ppnRateFromPercent,
  splitInclusiveVat,
} from "@/lib/vat";
import { outlineChipTones } from "@/components/ui/StatusBadge";

type PurchaseCategoryChoice = "PRODUCT" | "SERVICE" | "PETTY_CASH";

export type PurchaseInvoiceVendorOption = {
  id: string;
  name: string;
  paymentTermsDays: number;
};

export type PurchaseCatalogItemOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
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
  quantity: string;
  unitPrice: string;
};

function newPurchaseLine(): PurchaseLineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemId: "",
    quantity: "1",
    unitPrice: "",
  };
}

type PurchaseInvoiceUploadDialogProps = {
  vendors: PurchaseInvoiceVendorOption[];
  /** Active catalog items for line selection (HO). Empty = vendor portal header-only. */
  catalogItems?: PurchaseCatalogItemOption[];
  projects?: PurchaseProjectOption[];
  /** Vendor portal: lock supplier to the signed-in vendor. */
  lockToVendor?: boolean;
};

export default function PurchaseInvoiceUploadDialog({
  vendors,
  catalogItems = [],
  projects = [],
  lockToVendor = false,
}: PurchaseInvoiceUploadDialogProps) {
  const { t } = useT();
  const router = useRouter();
  const lockedVendorId =
    lockToVendor && vendors.length === 1 ? vendors[0]!.id : null;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [extracting, startExtractTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [taxFile, setTaxFile] = useState<File | null>(null);
  const [taxReason, setTaxReason] = useState("");
  const [includesPpn, setIncludesPpn] = useState<YesNoChoice>("No");
  const [purchasePurpose, setPurchasePurpose] = useState<
    "STOCK" | "PROJECT" | "INTERNAL"
  >("STOCK");
  const [projectId, setProjectId] = useState("");
  const [purchaseCategory, setPurchaseCategory] =
    useState<PurchaseCategoryChoice>("PRODUCT");
  const [ppnRatePercent, setPpnRatePercent] = useState(
    String(DEFAULT_PRODUCT_PPN_RATE_PERCENT)
  );
  const [invoiceDate, setInvoiceDate] = useState(todayDateInput);
  const [invoiceRef, setInvoiceRef] = useState("");
  const [amount, setAmount] = useState("");
  const [lines, setLines] = useState<PurchaseLineDraft[]>([newPurchaseLine()]);
  const [vendorChoice, setVendorChoice] = useState(lockedVendorId ?? "");
  const [extractFilled, setExtractFilled] = useState(false);

  const isPettyCash = purchaseCategory === "PETTY_CASH";
  const requireItemLines = !lockToVendor && !isPettyCash;
  const selectedVendor =
    vendors.find((vendor) => vendor.id === vendorChoice) ?? null;
  const withPpn = includesPpn === "Yes";
  const busy = pending || extracting;
  const parsedRate = parsePpnRatePercent(ppnRatePercent);
  const linesTotal = lines.reduce((sum, line) => {
    const qty = Number(line.quantity);
    const price = Number(line.unitPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum;
    return sum + qty * price;
  }, 0);
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
    if (!selectedVendor || !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) {
      return null;
    }
    const dueAt = dueAtFromPaymentTerms(
      new Date(`${invoiceDate}T00:00:00.000Z`),
      selectedVendor.paymentTermsDays
    );
    const dueDate = formatDisplayDate(dueAt, { timeZone: "UTC" });
    if (isCashPaymentTerms(selectedVendor.paymentTermsDays)) {
      return t("pages.billing.purchasePaymentTermsCashHint", { dueDate });
    }
    return t("pages.billing.purchasePaymentTermsHint", {
      terms: t("common.paymentTerms.netShort", {
        days: selectedVendor.paymentTermsDays,
      }),
      dueDate,
    });
  })();

  useEffect(() => {
    if (!open) {
      setPending(false);
      setError(null);
      setDocumentFile(null);
      setTaxFile(null);
      setTaxReason("");
      setIncludesPpn("No");
      setPurchasePurpose("STOCK");
      setProjectId("");
      setPurchaseCategory("PRODUCT");
      setPpnRatePercent(String(DEFAULT_PRODUCT_PPN_RATE_PERCENT));
      setInvoiceDate(todayDateInput());
      setInvoiceRef("");
      setAmount("");
      setLines([newPurchaseLine()]);
      setVendorChoice(lockedVendorId ?? "");
      setExtractFilled(false);
    }
  }, [open, lockedVendorId]);

  function applyExtractedResult(
    result: Extract<ExtractPurchaseInvoiceResult, { ok: true }>
  ) {
    const { fields, matchedVendorId } = result;

    if (fields.invoiceRef) {
      setInvoiceRef(fields.invoiceRef);
    }
    if (fields.invoiceDate) {
      setInvoiceDate(fields.invoiceDate);
    }
    if (fields.amount != null && !requireItemLines) {
      setAmount(formatExtractedAmountForInput(fields.amount));
    }
    if (fields.includesPpn != null) {
      setIncludesPpn(fields.includesPpn ? "Yes" : "No");
      if (!fields.includesPpn) {
        setTaxFile(null);
      }
    }

    if (lockedVendorId) {
      setVendorChoice(lockedVendorId);
      return;
    }

    if (matchedVendorId && vendors.some((v) => v.id === matchedVendorId)) {
      setVendorChoice(matchedVendorId);
    }
    // Unmatched OCR names are ignored — vendor must be chosen from the directory.
  }

  function runInvoiceExtract(file: File) {
    const formData = new FormData();
    formData.set("document", file);

    startExtractTransition(async () => {
      try {
        const result = await extractPurchaseInvoiceFromUpload(formData);
        if (!result.ok) {
          setExtractFilled(false);
          toast.message(t("pages.billing.purchaseExtractFailed"));
          return;
        }
        applyExtractedResult(result);
        setExtractFilled(true);
        toast.success(t("pages.billing.purchaseExtractSuccess"));
      } catch {
        setExtractFilled(false);
        toast.message(t("pages.billing.purchaseExtractFailed"));
      }
    });
  }

  function handleDocumentPick(file: File | null) {
    setDocumentFile(file);
    setExtractFilled(false);
    if (file && file.size > 0 && purchaseCategory !== "PETTY_CASH") {
      runInvoiceExtract(file);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("includesPpn", withPpn ? "true" : "false");
    formData.set("purchasePurpose", purchasePurpose);
    formData.set("projectId", purchasePurpose === "PROJECT" ? projectId : "");
    formData.set("purchaseCategory", purchaseCategory);
    formData.set("invoiceRef", invoiceRef.trim());
    formData.set("invoiceDate", invoiceDate);

    if (isPettyCash) {
      formData.set("amount", amount.trim());
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

    if (purchasePurpose === "PROJECT" && !projectId) {
      setError(t("pages.billing.purchaseProjectRequired"));
      return;
    }

    const vendorId = lockedVendorId ?? vendorChoice;
    const vendor = vendors.find((item) => item.id === vendorId);
    if (!vendor) {
      setError(t("pages.billing.purchaseVendorRequired"));
      return;
    }
    formData.set("supplierName", vendor.name);
    formData.set("vendorId", vendor.id);

    if (requireItemLines) {
      if (catalogItems.length === 0) {
        setError(t("pages.billing.purchaseCatalogEmpty"));
        return;
      }
      const parsedLines: {
        itemId: string;
        quantity: number;
        unitPrice: number;
      }[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!line.itemId) {
          setError(t("pages.billing.purchaseLineItemRequired", { n: i + 1 }));
          return;
        }
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          setError(t("pages.billing.purchaseLineQtyRequired", { n: i + 1 }));
          return;
        }
        if (!isWholeInventoryQty(quantity)) {
          setError(
            t("pages.inventory.quantityMustBeWhole", {
              field: t("pages.billing.purchaseQty"),
            })
          );
          return;
        }
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          setError(t("pages.billing.purchaseLineCostRequired", { n: i + 1 }));
          return;
        }
        parsedLines.push({ itemId: line.itemId, quantity, unitPrice });
      }
      if (parsedLines.length === 0) {
        setError(t("pages.billing.purchaseLinesRequired"));
        return;
      }
      formData.set("linesJson", JSON.stringify(parsedLines));
      formData.set("amount", String(Math.round(linesTotal * 100) / 100));
    } else {
      formData.set("amount", amount.trim());
      formData.delete("linesJson");
    }

    if (withPpn) {
      if (parsedRate == null) {
        setError(t("pages.billing.purchasePpnRateRequired"));
        return;
      }
      formData.set("ppnRatePercent", String(parsedRate));
    } else {
      formData.delete("ppnRatePercent");
    }

    if (!documentFile || documentFile.size <= 0) {
      setError(t("pages.billing.purchaseChooseDocument"));
      return;
    }
    formData.set("document", documentFile);

    if (withPpn && taxFile && taxFile.size > 0) {
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
                  : !documentFile ||
                    (!lockedVendorId &&
                      (vendors.length === 0 || !vendorChoice)) ||
                    (requireItemLines && catalogItems.length === 0))
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
                className={cn("grid gap-2", lockToVendor ? "grid-cols-2" : "grid-cols-3")}
              >
                {(
                  [
                    ["PRODUCT", t("pages.billing.purchaseCategoryProduct")],
                    ["SERVICE", t("pages.billing.purchaseCategoryService")],
                    ...(lockToVendor
                      ? []
                      : [
                          [
                            "PETTY_CASH",
                            t("pages.billing.purchaseCategoryPettyCash"),
                          ] as [PurchaseCategoryChoice, string],
                        ]),
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
                      onClick={() => {
                        setPurchaseCategory(value);
                        if (value === "PETTY_CASH") {
                          setPurchasePurpose("STOCK");
                          setProjectId("");
                          setIncludesPpn("No");
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
                {t("pages.billing.purchaseCategoryHint")}
              </p>
            </div>

            {isPettyCash ? null : (
            <div className="sm:col-span-2 space-y-2">
              <BillingDocumentFilePick
                id="purchase-document"
                label={t("pages.billing.purchaseDocument")}
                required={!isPettyCash}
                fileName={documentFile?.name ?? null}
                onPick={handleDocumentPick}
                disabled={busy}
              />
              {extracting ? (
                <p className={employeeDialogHintClass} aria-live="polite">
                  {t("pages.billing.purchaseReadingInvoice")}
                </p>
              ) : documentFile ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {extractFilled ? (
                    <p className={employeeDialogHintClass}>
                      {t("pages.billing.purchaseExtractSuccess")}
                    </p>
                  ) : (
                    <span className={employeeDialogHintClass} />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    className="shrink-0 gap-1.5 text-xs"
                    onClick={() => runInvoiceExtract(documentFile)}
                  >
                    <ScanLine className="h-3.5 w-3.5" aria-hidden />
                    {t("pages.billing.purchaseScanInvoice")}
                  </Button>
                </div>
              ) : null}
            </div>
            )}

            {isPettyCash ? null : (
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                htmlFor="purchase-vendor"
                className={employeeDialogLabelClass}
              >
                {t("pages.billing.purchaseSupplier")}
                <span className="text-red-400"> *</span>
              </label>
              {lockedVendorId ? (
                <>
                  <Input
                    id="purchase-vendor"
                    readOnly
                    disabled={busy}
                    value={
                      vendors.find((item) => item.id === lockedVendorId)
                        ?.name ?? ""
                    }
                    className={employeeInputClass}
                  />
                  <input type="hidden" name="vendorId" value={lockedVendorId} />
                </>
              ) : vendors.length === 0 ? (
                <p className={employeeDialogHintClass} role="status">
                  {t("pages.billing.purchaseVendorRegisterFirst")}
                </p>
              ) : (
                <Select
                  value={vendorChoice || undefined}
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
                        const vendor = vendors.find((item) => item.id === value);
                        return vendor?.name ?? null;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {purchaseDueHint ? (
                <p className={cn(employeeDialogHintClass, "mt-2")}>
                  {purchaseDueHint}
                </p>
              ) : !lockedVendorId && vendors.length > 0 ? (
                <p className={cn(employeeDialogHintClass, "mt-2")}>
                  {t("pages.billing.purchaseVendorMustBeRegistered")}
                </p>
              ) : null}
            </div>
            )}

            {isPettyCash ? null : (
            <div className={employeeDialogFieldClass}>
              <label htmlFor="purchase-ref" className={employeeDialogLabelClass}>
                {t("pages.billing.purchaseInvoiceRef")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                id="purchase-ref"
                name="invoiceRef"
                required
                disabled={busy}
                value={invoiceRef}
                onChange={(event) => setInvoiceRef(event.target.value)}
                placeholder={t("pages.billing.purchaseInvoiceRefPlaceholder")}
                className={employeeInputClass}
              />
            </div>
            )}

            <div
              className={cn(
                employeeDialogFieldClass,
                isPettyCash && "sm:col-span-2"
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

            {requireItemLines ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className={employeeDialogLabelClass}>
                    {t("pages.billing.purchaseItemsBought")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || catalogItems.length === 0}
                    className="gap-1.5"
                    onClick={() =>
                      setLines((current) => [...current, newPurchaseLine()])
                    }
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    {t("pages.billing.purchaseAddItem")}
                  </Button>
                </div>
                {catalogItems.length === 0 ? (
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.purchaseCatalogEmpty")}
                  </p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {lines.map((line, index) => {
                      const item = catalogItems.find(
                        (entry) => entry.id === line.itemId
                      );
                      const qty = Number(line.quantity);
                      const price = Number(line.unitPrice);
                      const lineTotal =
                        Number.isFinite(qty) && Number.isFinite(price)
                          ? qty * price
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
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_6rem_8rem]">
                            <Select
                              value={line.itemId || undefined}
                              onValueChange={(value) => {
                                if (value == null) return;
                                const selected = catalogItems.find(
                                  (entry) => entry.id === value
                                );
                                setLines((current) =>
                                  current.map((row) =>
                                    row.key === line.key
                                      ? {
                                          ...row,
                                          itemId: value,
                                          unitPrice:
                                            selected?.lastUnitCost != null
                                              ? String(selected.lastUnitCost)
                                              : row.unitPrice,
                                        }
                                      : row
                                  )
                                );
                              }}
                              disabled={busy}
                            >
                              <SelectTrigger
                                className={cn(
                                  employeeSelectTriggerClass,
                                  "w-full"
                                )}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "pages.billing.purchaseSelectItem"
                                  )}
                                >
                                  {(value) => {
                                    if (!value) {
                                      return t("pages.billing.purchaseSelectItem");
                                    }
                                    const selected = catalogItems.find(
                                      (entry) => entry.id === value
                                    );
                                    return selected
                                      ? `${selected.name} (${selected.sku})`
                                      : null;
                                  }}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {catalogItems.map((entry) => (
                                  <SelectItem key={entry.id} value={entry.id}>
                                    {entry.name} ({entry.sku})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min={1}
                              step={1}
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
                            <Input
                              inputMode="decimal"
                              disabled={busy}
                              value={line.unitPrice}
                              onChange={(event) => {
                                const value = event.target.value;
                                setLines((current) =>
                                  current.map((row) =>
                                    row.key === line.key
                                      ? { ...row, unitPrice: value }
                                      : row
                                  )
                                );
                              }}
                              placeholder={t("pages.billing.purchaseUnitCost")}
                              className={employeeInputClass}
                              aria-label={t("pages.billing.purchaseUnitCost")}
                            />
                          </div>
                          <p className={employeeDialogHintClass}>
                            {item
                              ? t("pages.billing.purchaseLineUnitHint", {
                                  unit: item.unit,
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
                    <p className="text-sm font-semibold tabular-nums text-text">
                      {t("pages.billing.purchaseAmountTotal", {
                        amount: formatContractPrice(linesTotal),
                      })}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  htmlFor="purchase-amount"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.purchaseAmount")}
                  <span className="text-red-400"> *</span>
                </label>
                <Input
                  id="purchase-amount"
                  name="amount"
                  required
                  disabled={busy}
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={t("pages.billing.purchaseAmountPlaceholder")}
                  className={employeeInputClass}
                />
              </div>
            )}

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                htmlFor="purchase-notes"
                className={employeeDialogLabelClass}
              >
                {t("pages.billing.purchaseNotes")}
              </label>
              <Textarea
                id="purchase-notes"
                name="notes"
                disabled={busy}
                rows={2}
                placeholder={t("pages.billing.purchaseNotesPlaceholder")}
                className="min-h-[4.5rem] rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-text shadow-none placeholder:text-subtle focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/10"
              />
            </div>

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2", isPettyCash && "hidden")}>
              <label className={employeeDialogLabelClass}>
                {t("pages.billing.purchasePurpose")}
                <span className="text-red-400"> *</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["STOCK", t("pages.billing.purchasePurposeStock")],
                    ["PROJECT", t("pages.billing.purchasePurposeProject")],
                    ["INTERNAL", t("pages.billing.purchasePurposeInternal")],
                  ] as const
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

            {purchasePurpose === "PROJECT" && !isPettyCash ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.billing.purchaseProject")}
                  <span className="text-red-400"> *</span>
                </label>
                <Select
                  value={projectId}
                  onValueChange={(value) => setProjectId(value ?? "")}
                  disabled={busy}
                >
                  <SelectTrigger className={employeeSelectTriggerClass}>
                    <SelectValue
                      placeholder={t("pages.billing.purchaseProjectPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.clientName
                          ? `${project.name} · ${project.clientName}`
                          : project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2", isPettyCash && "hidden")}>
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
                    setTaxFile(null);
                  } else if (!ppnRatePercent.trim()) {
                    setPpnRatePercent(
                      String(DEFAULT_PRODUCT_PPN_RATE_PERCENT)
                    );
                  }
                }}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.billing.purchaseIncludesPpnHint")}
              </p>
            </div>

            {withPpn && !isPettyCash ? (
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
