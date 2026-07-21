"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Upload } from "lucide-react";
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
import { cn } from "@/lib/utils";

export type PurchaseInvoiceVendorOption = {
  id: string;
  name: string;
  paymentTermsDays: number;
};

const VENDOR_MANUAL = "__manual__";

type PurchaseInvoiceUploadDialogProps = {
  vendors: PurchaseInvoiceVendorOption[];
  /** Vendor portal: lock supplier to the signed-in vendor (no manual entry). */
  lockToVendor?: boolean;
};

export default function PurchaseInvoiceUploadDialog({
  vendors,
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
  const [includesPpn, setIncludesPpn] = useState<YesNoChoice>("No");
  const [invoiceDate, setInvoiceDate] = useState(todayDateInput);
  const [invoiceRef, setInvoiceRef] = useState("");
  const [amount, setAmount] = useState("");
  const [vendorChoice, setVendorChoice] = useState(
    lockedVendorId ?? VENDOR_MANUAL
  );
  const [manualVendorName, setManualVendorName] = useState("");
  const [extractFilled, setExtractFilled] = useState(false);

  const isManualVendor = !lockedVendorId && vendorChoice === VENDOR_MANUAL;
  const selectedVendor = isManualVendor
    ? null
    : vendors.find((vendor) => vendor.id === vendorChoice) ?? null;
  const withPpn = includesPpn === "Yes";
  const busy = pending || extracting;

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
      setIncludesPpn("No");
      setInvoiceDate(todayDateInput());
      setInvoiceRef("");
      setAmount("");
      setVendorChoice(lockedVendorId ?? VENDOR_MANUAL);
      setManualVendorName("");
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
    if (fields.amount != null) {
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
      setManualVendorName("");
      return;
    }

    if (lockedVendorId) {
      setVendorChoice(lockedVendorId);
      setManualVendorName("");
      return;
    }

    if (matchedVendorId && vendors.some((v) => v.id === matchedVendorId)) {
      setVendorChoice(matchedVendorId);
      setManualVendorName("");
    } else if (fields.supplierName) {
      setVendorChoice(VENDOR_MANUAL);
      setManualVendorName(fields.supplierName);
    }
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
    if (file && file.size > 0) {
      runInvoiceExtract(file);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("includesPpn", withPpn ? "true" : "false");
    formData.set("invoiceRef", invoiceRef.trim());
    formData.set("invoiceDate", invoiceDate);
    formData.set("amount", amount.trim());

    if (lockedVendorId) {
      const vendor = vendors.find((item) => item.id === lockedVendorId);
      if (!vendor) {
        setError(t("pages.billing.purchaseVendorRequired"));
        return;
      }
      formData.set("supplierName", vendor.name);
      formData.set("vendorId", vendor.id);
    } else if (isManualVendor) {
      const name = manualVendorName.trim();
      if (!name) {
        setError(t("pages.billing.purchaseVendorRequired"));
        return;
      }
      formData.set("supplierName", name);
      formData.delete("vendorId");
    } else {
      const vendor = vendors.find((item) => item.id === vendorChoice);
      if (!vendor) {
        setError(t("pages.billing.purchaseVendorRequired"));
        return;
      }
      formData.set("supplierName", vendor.name);
      formData.set("vendorId", vendor.id);
    }

    if (!documentFile || documentFile.size <= 0) {
      setError(t("pages.billing.purchaseChooseDocument"));
      return;
    }
    formData.set("document", documentFile);

    if (withPpn && taxFile && taxFile.size > 0) {
      formData.set("taxInvoiceDocument", taxFile);
    } else {
      formData.delete("taxInvoiceDocument");
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
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {t("pages.billing.purchaseUpload")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={Upload}
        title={t("pages.billing.purchaseUploadTitle")}
        description={t("pages.billing.purchaseUploadDesc")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="purchase-invoice-upload-form"
              disabled={busy || !documentFile}
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
            <div className="sm:col-span-2 space-y-2">
              <BillingDocumentFilePick
                id="purchase-document"
                label={t("pages.billing.purchaseDocument")}
                required
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
              ) : (
                <Select
                  value={vendorChoice}
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
                    <SelectValue>
                      {(value) => {
                        if (!value || value === VENDOR_MANUAL) {
                          return t("pages.billing.purchaseVendorEnterManually");
                        }
                        const vendor = vendors.find((item) => item.id === value);
                        return vendor?.name ?? null;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VENDOR_MANUAL}>
                      {t("pages.billing.purchaseVendorEnterManually")}
                    </SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {isManualVendor ? (
                <Input
                  id="purchase-vendor-manual"
                  name="supplierName"
                  required
                  disabled={busy}
                  value={manualVendorName}
                  onChange={(event) => setManualVendorName(event.target.value)}
                  placeholder={t("pages.billing.purchaseSupplierPlaceholder")}
                  autoComplete="organization"
                  className={cn(employeeInputClass, "mt-2")}
                />
              ) : null}
              {purchaseDueHint ? (
                <p className={cn(employeeDialogHintClass, "mt-2")}>
                  {purchaseDueHint}
                </p>
              ) : null}
            </div>

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

            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="purchase-date"
                className={employeeDialogLabelClass}
              >
                {t("pages.billing.purchaseInvoiceDate")}
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

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                id="purchase-includes-ppn-label"
                htmlFor="purchase-includes-ppn"
                className={employeeDialogLabelClass}
              >
                {t("pages.billing.purchaseIncludesPpn")}
              </label>
              <YesNoChoiceCards
                id="purchase-includes-ppn"
                labelledBy="purchase-includes-ppn-label"
                value={includesPpn}
                onChange={(value) => {
                  setIncludesPpn(value);
                  if (value === "No") {
                    setTaxFile(null);
                  }
                }}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.billing.purchaseIncludesPpnHint")}
              </p>
            </div>

            {withPpn ? (
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
              </div>
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
