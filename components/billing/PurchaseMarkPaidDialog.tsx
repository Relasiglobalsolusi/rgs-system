"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";

import {
  listPurchasePayoutBankAccounts,
  markPurchaseInvoicePaid,
} from "@/app/billing/purchase-invoices/actions";
import BillingDocumentVerifyDialog from "@/components/billing/BillingDocumentVerifyDialog";
import CompanyBankAccountField from "@/components/company-details/CompanyBankAccountField";
import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import { formatImportForeignAmount, parseImportDecimal } from "@/lib/import-landed-cost";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseInvoiceId: string;
  supplierName: string;
  invoiceRef: string;
  needsImportBankRate?: boolean;
  invoiceCurrency?: string | null;
  invoiceForeignAmount?: number | null;
  bookingRate?: number | null;
  onSuccess?: () => void;
};

export default function PurchaseMarkPaidDialog({
  open,
  onOpenChange,
  purchaseInvoiceId,
  supplierName,
  invoiceRef,
  needsImportBankRate = false,
  invoiceCurrency,
  invoiceForeignAmount,
  bookingRate = null,
  onSuccess,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccountOption[]>(
    []
  );
  const [bankAccountId, setBankAccountId] = useState("");
  const [importBankRate, setImportBankRate] = useState("");
  const [importBankCharge, setImportBankCharge] = useState("");
  const [importTelexFee, setImportTelexFee] = useState("");
  const [transferFee, setTransferFee] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setProofFile(null);
      setReason("");
      setBankAccountId("");
      setImportBankRate("");
      setImportBankCharge("");
      setImportTelexFee("");
      setTransferFee("");
      setPending(false);
      setError(null);
      return;
    }
    let cancelled = false;
    listPurchasePayoutBankAccounts()
      .then((accounts) => {
        if (cancelled) return;
        setBankAccounts(accounts);
        setBankAccountId(accounts[0]?.id ?? "");
      })
      .catch(() => {
        if (!cancelled) setBankAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const bankRateNumber = parseImportDecimal(importBankRate);
  const canSubmit = Boolean(
    proofFile &&
      proofFile.size > 0 &&
      reason.trim() &&
      (bankAccounts.length === 0 || bankAccountId) &&
      (!needsImportBankRate || (bankRateNumber != null && bankRateNumber > 0))
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!proofFile || proofFile.size <= 0) {
      setError(t("pages.billing.choosePaymentProof"));
      return;
    }
    if (bankAccounts.length > 0 && !bankAccountId) {
      setError(t("pages.billing.purchaseBankAccountRequired"));
      return;
    }
    if (needsImportBankRate && (bankRateNumber == null || bankRateNumber <= 0)) {
      setError(t("pages.billing.purchaseMarkPaidBankRateRequired"));
      return;
    }

    const formData = new FormData();
    formData.set("purchaseInvoiceId", purchaseInvoiceId);
    formData.set("paymentProof", proofFile);
    formData.set("manualReason", reason);
    formData.set("bankAccountId", bankAccountId);
    if (needsImportBankRate) {
      formData.set("importBankRate", importBankRate.trim());
      formData.set("importBankCharge", importBankCharge.trim());
      formData.set("importTelexFee", importTelexFee.trim());
    } else {
      formData.set("transferFeeIdr", transferFee.trim());
    }

    setPending(true);
    try {
      await markPurchaseInvoicePaid(formData);
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("pages.billing.purchaseMarkPaidFailed")
      );
    } finally {
      setPending(false);
    }
  }

  const factoryAmountLabel =
    invoiceForeignAmount != null && invoiceForeignAmount > 0
      ? formatImportForeignAmount(invoiceCurrency ?? "USD", invoiceForeignAmount)
      : null;

  return (
    <BillingDocumentVerifyDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Banknote}
      title={
        needsImportBankRate
          ? t("pages.billing.purchaseImportPayLaterTitle")
          : t("pages.billing.purchaseMarkPaidTitle")
      }
      description={
        needsImportBankRate
          ? t("pages.billing.purchaseMarkPaidImportDesc")
          : t("pages.billing.purchaseMarkPaidDesc")
      }
      contextLabel={t("pages.billing.documentVerifyContext")}
      contextValue={`${supplierName} · ${invoiceRef}`}
      fileInputId={`purchase-paid-${purchaseInvoiceId}`}
      fileLabel={t("pages.billing.proofOfPayment")}
      fileName={proofFile?.name ?? null}
      onFilePick={setProofFile}
      requireReason
      reasonValue={reason}
      onReasonChange={setReason}
      callout={
        needsImportBankRate
          ? t("pages.billing.purchaseMarkPaidBankRateHint")
          : t("pages.billing.purchaseMarkPaidHint")
      }
      error={error}
      pending={pending}
      canSubmit={canSubmit}
      confirmLabel={t("pages.billing.purchaseMarkPaidConfirm")}
      pendingLabel={t("pages.billing.purchaseMarkPaidPending")}
      onSubmit={handleSubmit}
    >
      <CompanyBankAccountField
        accounts={bankAccounts}
        value={bankAccountId}
        onChange={setBankAccountId}
        label={t("pages.billing.purchaseBankAccount")}
        hint={t("pages.billing.purchaseBankAccountHint")}
        disabled={pending}
      />
      {needsImportBankRate ? (
        <div className="space-y-3">
          {factoryAmountLabel ? (
            <p className={employeeDialogHintClass}>
              {t("pages.billing.purchaseMarkPaidImportHint", {
                amount: factoryAmountLabel,
              })}
            </p>
          ) : (
            <p className={employeeDialogHintClass}>
              {t("pages.billing.purchaseMarkPaidBankRateHint")}
            </p>
          )}
          {bookingRate != null && bookingRate > 0 ? (
            <p className={employeeDialogHintClass}>
              {t("pages.billing.purchaseMarkPaidBookingRateShown", {
                rate: formatContractPrice(bookingRate),
              })}
            </p>
          ) : null}
          <div className={employeeDialogFieldClass}>
            <label
              htmlFor={`purchase-paid-bank-rate-${purchaseInvoiceId}`}
              className={employeeDialogLabelClass}
            >
              {t("pages.billing.purchaseMarkPaidBankRate")}
              <span className="text-red-400"> *</span>
            </label>
            <Input
              id={`purchase-paid-bank-rate-${purchaseInvoiceId}`}
              inputMode="decimal"
              disabled={pending}
              value={importBankRate}
              onChange={(event) => setImportBankRate(event.target.value)}
              placeholder={t("pages.billing.purchaseImportRatePlaceholder")}
              className={employeeInputClass}
            />
          </div>
          <div className={employeeDialogFieldClass}>
            <label
              htmlFor={`purchase-paid-bank-charge-${purchaseInvoiceId}`}
              className={employeeDialogLabelClass}
            >
              {t("pages.billing.purchaseMarkPaidBankCharge")}
              {invoiceCurrency ? ` (${invoiceCurrency})` : ""}
            </label>
            <Input
              id={`purchase-paid-bank-charge-${purchaseInvoiceId}`}
              inputMode="decimal"
              disabled={pending}
              value={importBankCharge}
              onChange={(event) => setImportBankCharge(event.target.value)}
              placeholder="0"
              className={employeeInputClass}
            />
            <p className={employeeDialogHintClass}>
              {t("pages.billing.purchaseMarkPaidBankChargeHint")}
            </p>
          </div>
          <div className={employeeDialogFieldClass}>
            <label
              htmlFor={`purchase-paid-telex-${purchaseInvoiceId}`}
              className={employeeDialogLabelClass}
            >
              {t("pages.billing.purchaseMarkPaidTelexFee")}
            </label>
            <Input
              id={`purchase-paid-telex-${purchaseInvoiceId}`}
              inputMode="decimal"
              disabled={pending}
              value={importTelexFee}
              onChange={(event) => setImportTelexFee(event.target.value)}
              placeholder="0"
              className={employeeInputClass}
            />
            <p className={employeeDialogHintClass}>
              {t("pages.billing.purchaseMarkPaidTelexFeeHint")}
            </p>
          </div>
        </div>
      ) : (
        <div className={employeeDialogFieldClass}>
          <label
            htmlFor={`purchase-paid-transfer-fee-${purchaseInvoiceId}`}
            className={employeeDialogLabelClass}
          >
            {t("pages.billing.purchaseTransferFee")}
          </label>
          <MoneyInput
            id={`purchase-paid-transfer-fee-${purchaseInvoiceId}`}
            disabled={pending}
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
    </BillingDocumentVerifyDialog>
  );
}
