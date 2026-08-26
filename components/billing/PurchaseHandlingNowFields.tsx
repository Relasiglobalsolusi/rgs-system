"use client";

import { BillingDocumentFilePick } from "@/components/billing/BillingDocumentVerifyDialog";
import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import YesNoChoiceCards, {
  type YesNoChoice,
} from "@/components/ui/YesNoChoiceCards";
import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HANDLING_BY_HEAD_OFFICE } from "@/lib/import-landed-cost";
import { useT } from "@/lib/i18n/use-t";
import { vendorMatchesPurchaseOrigin } from "@/lib/vendor-type";
import { cn } from "@/lib/utils";

type VendorOption = {
  id: string;
  name: string;
  vendorType?: string | null;
};

type Props = {
  fulfillment: "INTERNAL" | "OUTSOURCED";
  vendors: VendorOption[];
  vendorId: string;
  onVendorIdChange: (value: string) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  hasTaxInvoice: YesNoChoice | "";
  onHasTaxInvoiceChange: (value: YesNoChoice) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
};

export default function PurchaseHandlingNowFields({
  fulfillment,
  vendors,
  vendorId,
  onVendorIdChange,
  amount,
  onAmountChange,
  hasTaxInvoice,
  onHasTaxInvoiceChange,
  file,
  onFileChange,
  disabled = false,
}: Props) {
  const { t } = useT();
  const outsourced = fulfillment === "OUTSOURCED";
  const localVendors = vendors.filter((vendor) =>
    vendorMatchesPurchaseOrigin(vendor.vendorType, "LOCAL")
  );
  const showFile = hasTaxInvoice === "Yes";

  return (
    <div className="sm:col-span-2 space-y-3 rounded-xl border border-border bg-elevated/40 p-3">
      <div>
        <p className={employeeDialogLabelClass}>
          {outsourced
            ? t("pages.billing.handlingAllInCharge")
            : t("pages.billing.handlingDetailsNowTitle")}
        </p>
        <p className={employeeDialogHintClass}>
          {outsourced
            ? t("pages.billing.handlingAllInHint")
            : t("pages.billing.handlingDetailsNowHint")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={employeeDialogFieldClass}>
          <label className={employeeDialogLabelClass}>
            {t("pages.billing.handlingVendor")}
          </label>
          <Select
            value={vendorId || null}
            onValueChange={(value) => onVendorIdChange(value ?? "")}
            disabled={disabled}
          >
            <SelectTrigger className={cn(employeeSelectTriggerClass, "w-full")}>
              <SelectValue
                placeholder={
                  outsourced
                    ? t("pages.billing.handlingVendorPlaceholder")
                    : t("pages.billing.handlingVendorPlaceholderInternal")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {!outsourced ? (
                <SelectItem value={HANDLING_BY_HEAD_OFFICE}>
                  {t("pages.billing.handlingByHeadOffice")}
                </SelectItem>
              ) : null}
              {localVendors.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={employeeDialogFieldClass}>
          <label className={employeeDialogLabelClass}>
            {outsourced
              ? t("pages.billing.handlingAllInCharge")
              : t("pages.billing.handlingFee")}
          </label>
          <MoneyInput
            value={amount}
            onValueChange={onAmountChange}
            disabled={disabled}
            className={employeeInputClass}
          />
        </div>
      </div>

      <div className={employeeDialogFieldClass}>
        <p id="handling-has-tax-invoice" className={employeeDialogLabelClass}>
          {t("pages.billing.handlingHasTaxInvoice")}
        </p>
        <YesNoChoiceCards
          id="handling-has-tax-invoice-cards"
          labelledBy="handling-has-tax-invoice"
          value={hasTaxInvoice || "No"}
          onChange={onHasTaxInvoiceChange}
          disabled={disabled}
        />
      </div>

      {showFile ? (
        <BillingDocumentFilePick
          id="purchase-handling-tax-invoice"
          label={t("pages.billing.handlingFeeTaxInvoice")}
          fileName={file?.name ?? null}
          onPick={onFileChange}
          disabled={disabled}
        />
      ) : (
        <BillingDocumentFilePick
          id="purchase-handling-optional-file"
          label={t("pages.billing.handlingOptionalFile")}
          fileName={file?.name ?? null}
          onPick={onFileChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}
