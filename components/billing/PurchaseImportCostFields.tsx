"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  calculateImportLandedCost,
  formatImportCifFormulaLabel,
  formatImportForeignAmount,
  type ImportLandedCostInput,
  IMPORT_CURRENCIES,
  IMPORT_FEE_CURRENCIES,
  IMPORT_PPH22_API_RATE_PERCENT,
  IMPORT_PPH22_NON_API_RATE_PERCENT,
  listImportCifFxCurrencies,
  parseImportDecimal,
  pph22RatePercentForBasis,
  type ImportLandedCostResult,
  type ImportPph22Basis,
  type ImportVendorLine,
} from "@/lib/import-landed-cost";
import ImportCifValueBlock from "@/components/billing/ImportCifValueBlock";
import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import { formatContractPrice } from "@/lib/project-billing";
import { DEFAULT_PRODUCT_PPN_RATE_PERCENT } from "@/lib/vat";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type PurchaseImportDraft = {
  currency: string;
  foreignAmount: string;
  exchangeRateToIdr: string;
  customsRatesToIdr: Record<string, string>;
  freightCurrency: string;
  freightAmount: string;
  freightIncludedInInvoice: boolean;
  freightRateToIdr: string;
  freightCustomsRateToIdr: string;
  insuranceCurrency: string;
  insuranceAmount: string;
  insuranceIncludedInInvoice: boolean;
  insuranceRateToIdr: string;
  insuranceCustomsRateToIdr: string;
  bankFeeCurrency: string;
  bankFeeAmount: string;
  fullAmountFeeCurrency: string;
  fullAmountFeeAmount: string;
  localBankFeeIdr: string;
  clearanceCostIdr: string;
  formEApplied: boolean;
  beaMasukApplied: boolean;
  beaMasukRatePercent: string;
  beaMasukAmountIdr: string;
  ppnbmApplied: boolean;
  ppnbmRatePercent: string;
  ppnbmAmountIdr: string;
  ppnApplied: boolean;
  ppnRatePercent: string;
  ppnAmountIdr: string;
  pph22Applied: boolean;
  pph22Basis: ImportPph22Basis;
  pph22RatePercent: string;
  pph22AmountIdr: string;
};

export function emptyPurchaseImportDraft(): PurchaseImportDraft {
  return {
    currency: "USD",
    foreignAmount: "",
    exchangeRateToIdr: "",
    customsRatesToIdr: {},
    freightCurrency: "USD",
    freightAmount: "",
    freightIncludedInInvoice: true,
    freightRateToIdr: "",
    freightCustomsRateToIdr: "",
    insuranceCurrency: "USD",
    insuranceAmount: "",
    insuranceIncludedInInvoice: true,
    insuranceRateToIdr: "",
    insuranceCustomsRateToIdr: "",
    bankFeeCurrency: "USD",
    bankFeeAmount: "",
    fullAmountFeeCurrency: "USD",
    fullAmountFeeAmount: "",
    localBankFeeIdr: "",
    clearanceCostIdr: "",
    formEApplied: false,
    beaMasukApplied: false,
    beaMasukRatePercent: "",
    beaMasukAmountIdr: "",
    ppnbmApplied: false,
    ppnbmRatePercent: "",
    ppnbmAmountIdr: "",
    ppnApplied: true,
    ppnRatePercent: String(DEFAULT_PRODUCT_PPN_RATE_PERCENT),
    ppnAmountIdr: "",
    pph22Applied: true,
    pph22Basis: "API",
    pph22RatePercent: String(IMPORT_PPH22_API_RATE_PERCENT),
    pph22AmountIdr: "",
  };
}

function optionalOverride(raw: string): number | null {
  const parsed = parseImportDecimal(raw);
  return parsed == null ? null : parsed;
}

function draftLineCurrency(
  included: boolean,
  factoryCurrency: string,
  lineCurrency: string
): string {
  return included ? factoryCurrency : lineCurrency;
}

export function draftImportCifFxCurrencies(
  draft: PurchaseImportDraft
): string[] {
  return listImportCifFxCurrencies({
    currency: draft.currency,
    foreignAmount: parseImportDecimal(draft.foreignAmount),
    freightCurrency: draftLineCurrency(
      draft.freightIncludedInInvoice,
      draft.currency,
      draft.freightCurrency
    ),
    freightForeignAmount: parseImportDecimal(draft.freightAmount),
    insuranceCurrency: draftLineCurrency(
      draft.insuranceIncludedInInvoice,
      draft.currency,
      draft.insuranceCurrency
    ),
    insuranceForeignAmount: parseImportDecimal(draft.insuranceAmount),
  });
}

function draftCustomsRatesToIdr(
  draft: PurchaseImportDraft,
  currencies: string[]
): Record<string, number> | null {
  const rates: Record<string, number> = {};
  for (const code of currencies) {
    const parsed = parseImportDecimal(draft.customsRatesToIdr[code] ?? "");
    if (parsed == null || parsed <= 0) return null;
    rates[code] = parsed;
  }
  return rates;
}

function separateFxLineNeedsRates(
  included: boolean,
  currency: string,
  amountRaw: string
): boolean {
  if (included || currency === "IDR") return false;
  const amount = parseImportDecimal(amountRaw);
  return amount != null && amount > 0;
}

function parseRequiredLineRate(raw: string): number | null {
  const parsed = parseImportDecimal(raw);
  if (parsed == null || parsed <= 0) return null;
  return parsed;
}

export function importDraftToInput(
  draft: PurchaseImportDraft,
  options?: { requireCustomsRates?: boolean }
) {
  const requireCustomsRates = options?.requireCustomsRates !== false;
  const foreignAmount = parseImportDecimal(draft.foreignAmount);
  const exchangeRateToIdr = parseImportDecimal(draft.exchangeRateToIdr);
  const factoryCustomsRates = draftCustomsRatesToIdr(draft, [draft.currency]);
  if (foreignAmount == null || exchangeRateToIdr == null) {
    return null;
  }
  if (requireCustomsRates && factoryCustomsRates == null) {
    return null;
  }
  const customsRatesToIdr = { ...(factoryCustomsRates ?? {}) };
  const freightNeedsRates = separateFxLineNeedsRates(
    draft.freightIncludedInInvoice,
    draft.freightCurrency,
    draft.freightAmount
  );
  const insuranceNeedsRates = separateFxLineNeedsRates(
    draft.insuranceIncludedInInvoice,
    draft.insuranceCurrency,
    draft.insuranceAmount
  );
  const freightRateToIdr = freightNeedsRates
    ? parseRequiredLineRate(draft.freightRateToIdr)
    : undefined;
  const freightCustomsRateToIdr = freightNeedsRates
    ? parseRequiredLineRate(draft.freightCustomsRateToIdr)
    : undefined;
  const insuranceRateToIdr = insuranceNeedsRates
    ? parseRequiredLineRate(draft.insuranceRateToIdr)
    : undefined;
  const insuranceCustomsRateToIdr = insuranceNeedsRates
    ? parseRequiredLineRate(draft.insuranceCustomsRateToIdr)
    : undefined;
  if (freightNeedsRates && freightRateToIdr == null) {
    return null;
  }
  if (requireCustomsRates && freightNeedsRates && freightCustomsRateToIdr == null) {
    return null;
  }
  if (insuranceNeedsRates && insuranceRateToIdr == null) {
    return null;
  }
  if (
    requireCustomsRates &&
    insuranceNeedsRates &&
    insuranceCustomsRateToIdr == null
  ) {
    return null;
  }
  if (
    freightCustomsRateToIdr != null &&
    (draft.freightCurrency !== draft.currency ||
      customsRatesToIdr[draft.freightCurrency] == null)
  ) {
    customsRatesToIdr[draft.freightCurrency] = freightCustomsRateToIdr;
  }
  if (
    insuranceCustomsRateToIdr != null &&
    (draft.insuranceCurrency !== draft.currency ||
      customsRatesToIdr[draft.insuranceCurrency] == null)
  ) {
    customsRatesToIdr[draft.insuranceCurrency] = insuranceCustomsRateToIdr;
  }
  const customsRateToIdr = customsRatesToIdr[draft.currency] ?? 0;
  if (requireCustomsRates && customsRateToIdr <= 0) {
    return null;
  }
  return {
    currency: draft.currency,
    foreignAmount,
    exchangeRateToIdr,
    customsRateToIdr,
    customsRatesToIdr,
    freightIncludedInInvoice: draft.freightIncludedInInvoice,
    freightCurrency: draftLineCurrency(
      draft.freightIncludedInInvoice,
      draft.currency,
      draft.freightCurrency
    ),
    freightForeignAmount: parseImportDecimal(draft.freightAmount) ?? 0,
    freightRateToIdr: draft.freightIncludedInInvoice
      ? undefined
      : freightRateToIdr,
    freightCustomsRateToIdr: draft.freightIncludedInInvoice
      ? undefined
      : freightCustomsRateToIdr,
    insuranceIncludedInInvoice: draft.insuranceIncludedInInvoice,
    insuranceCurrency: draftLineCurrency(
      draft.insuranceIncludedInInvoice,
      draft.currency,
      draft.insuranceCurrency
    ),
    insuranceForeignAmount: parseImportDecimal(draft.insuranceAmount) ?? 0,
    insuranceRateToIdr: draft.insuranceIncludedInInvoice
      ? undefined
      : insuranceRateToIdr,
    insuranceCustomsRateToIdr: draft.insuranceIncludedInInvoice
      ? undefined
      : insuranceCustomsRateToIdr,
    bankFeeCurrency: draft.currency,
    bankFeeForeignAmount: parseImportDecimal(draft.bankFeeAmount) ?? 0,
    fullAmountFeeCurrency: draft.fullAmountFeeCurrency,
    fullAmountFeeForeignAmount:
      parseImportDecimal(draft.fullAmountFeeAmount) ?? 0,
    localBankFeeIdr: parseImportDecimal(draft.localBankFeeIdr) ?? 0,
    clearanceCostIdr: 0,
    formEApplied: draft.formEApplied,
    beaMasukApplied: draft.beaMasukApplied,
    beaMasukRatePercent: parseImportDecimal(draft.beaMasukRatePercent) ?? 0,
    beaMasukAmountIdr: optionalOverride(draft.beaMasukAmountIdr),
    ppnbmApplied: draft.ppnbmApplied,
    ppnbmRatePercent: parseImportDecimal(draft.ppnbmRatePercent) ?? 0,
    ppnbmAmountIdr: optionalOverride(draft.ppnbmAmountIdr),
    ppnApplied: draft.ppnApplied,
    ppnRatePercent:
      parseImportDecimal(draft.ppnRatePercent) ??
      DEFAULT_PRODUCT_PPN_RATE_PERCENT,
    ppnAmountIdr: optionalOverride(draft.ppnAmountIdr),
    pph22Applied: draft.pph22Applied,
    pph22Basis: draft.pph22Basis,
    pph22RatePercent: parseImportDecimal(draft.pph22RatePercent) ?? undefined,
    pph22AmountIdr: optionalOverride(draft.pph22AmountIdr),
  };
}

export function focChargesDraftToInput(
  draft: PurchaseImportDraft,
  declared: {
    value: number;
    currency: string;
    customsRate: number | null;
  }
) {
  if (declared.value <= 0) return null;
  const currency = declared.currency.trim().toUpperCase() || "IDR";
  if (currency !== "IDR" && (declared.customsRate == null || declared.customsRate <= 0)) {
    return null;
  }
  return {
    currency: currency === "IDR" ? "USD" : currency,
    foreignAmount: 0,
    exchangeRateToIdr: 0,
    declaredValue: declared.value,
    declaredCurrency: currency,
    declaredCustomsRate: currency === "IDR" ? undefined : declared.customsRate ?? undefined,
    customsRateToIdr: currency === "IDR" ? undefined : declared.customsRate ?? undefined,
    customsRatesToIdr:
      currency === "IDR" || declared.customsRate == null
        ? {}
        : { [currency]: declared.customsRate },
    freightIncludedInInvoice: true,
    freightForeignAmount: 0,
    insuranceIncludedInInvoice: true,
    insuranceForeignAmount: 0,
    bankFeeForeignAmount: 0,
    fullAmountFeeForeignAmount: 0,
    localBankFeeIdr: 0,
    clearanceCostIdr: 0,
    formEApplied: draft.formEApplied,
    beaMasukApplied: draft.beaMasukApplied,
    beaMasukRatePercent: parseImportDecimal(draft.beaMasukRatePercent) ?? 0,
    beaMasukAmountIdr: optionalOverride(draft.beaMasukAmountIdr),
    ppnbmApplied: draft.ppnbmApplied,
    ppnbmRatePercent: parseImportDecimal(draft.ppnbmRatePercent) ?? 0,
    ppnbmAmountIdr: optionalOverride(draft.ppnbmAmountIdr),
    ppnApplied: draft.ppnApplied,
    ppnRatePercent:
      parseImportDecimal(draft.ppnRatePercent) ??
      DEFAULT_PRODUCT_PPN_RATE_PERCENT,
    ppnAmountIdr: optionalOverride(draft.ppnAmountIdr),
    pph22Applied: draft.pph22Applied,
    pph22Basis: draft.pph22Basis,
    pph22RatePercent: parseImportDecimal(draft.pph22RatePercent) ?? undefined,
    pph22AmountIdr: optionalOverride(draft.pph22AmountIdr),
  };
}

function ChargeCheckbox({
  id,
  checked,
  label,
  hint,
  disabled,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  label: string;
  hint?: string;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-elevated/40 p-3 space-y-2">
      <label
        htmlFor={id}
        className="inline-flex cursor-pointer items-start gap-2 text-sm text-text"
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 size-4 rounded border-border"
        />
        <span>
          <span className="font-semibold">{label}</span>
          {hint ? (
            <span className="mt-0.5 block text-xs leading-5 text-muted">
              {hint}
            </span>
          ) : null}
        </span>
      </label>
      {checked && children ? (
        <div className="grid gap-2 sm:grid-cols-2">{children}</div>
      ) : null}
    </div>
  );
}

function MoneyField({
  id,
  label,
  hint,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className={employeeDialogFieldClass}>
      <label htmlFor={id} className={employeeDialogLabelClass}>
        {label}
      </label>
      <Input
        id={id}
        inputMode="decimal"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={employeeInputClass}
      />
      {hint ? <p className={employeeDialogHintClass}>{hint}</p> : null}
    </div>
  );
}

function FactoryCurrencyAmountField({
  id,
  label,
  hint,
  currency,
  amount,
  disabled,
  onAmountChange,
  convertedLabel,
}: {
  id: string;
  label: string;
  hint?: string;
  currency: string;
  amount: string;
  disabled?: boolean;
  onAmountChange: (amount: string) => void;
  convertedLabel?: string;
}) {
  return (
    <div className={employeeDialogFieldClass}>
      <label htmlFor={id} className={employeeDialogLabelClass}>
        {label}
      </label>
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
        <div
          className={cn(
            employeeSelectTriggerClass,
            "flex items-center justify-center text-sm font-semibold tabular-nums text-muted"
          )}
          aria-hidden
        >
          {currency}
        </div>
        <Input
          id={id}
          inputMode="decimal"
          disabled={disabled}
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          placeholder="0"
          className={employeeInputClass}
        />
      </div>
      {hint ? <p className={employeeDialogHintClass}>{hint}</p> : null}
      {convertedLabel ? (
        <p className={employeeDialogHintClass}>{convertedLabel}</p>
      ) : null}
    </div>
  );
}

function OptionalInvoiceFeeField({
  id,
  label,
  includedHint,
  separateHint,
  idrHint,
  notIncludedLabel,
  lineRateLabel,
  lineCustomsRateLabel,
  factoryCurrency,
  bankRate,
  factoryCustomsRate,
  included,
  currency,
  amount,
  rate,
  customsRate,
  disabled,
  convertedLabel,
  onChange,
}: {
  id: string;
  label: string;
  includedHint: string;
  separateHint: string;
  idrHint: string;
  notIncludedLabel: string;
  lineRateLabel: string;
  lineCustomsRateLabel: string;
  factoryCurrency: string;
  bankRate: string;
  factoryCustomsRate: string;
  included: boolean;
  currency: string;
  amount: string;
  rate: string;
  customsRate: string;
  disabled?: boolean;
  convertedLabel?: string;
  onChange: (next: {
    included?: boolean;
    currency?: string;
    amount?: string;
    rate?: string;
    customsRate?: string;
  }) => void;
}) {
  const separate = !included;
  const isIdr = currency === "IDR";

  function setSeparate(nextSeparate: boolean) {
    if (nextSeparate) {
      const nextCurrency = currency || factoryCurrency;
      onChange({
        included: false,
        currency: nextCurrency,
        rate: nextCurrency !== "IDR" && !rate ? bankRate : rate,
        customsRate:
          nextCurrency !== "IDR" && !customsRate
            ? factoryCustomsRate
            : customsRate,
      });
      return;
    }
    onChange({
      included: true,
      currency: factoryCurrency,
      rate: "",
      customsRate: "",
    });
  }

  return (
    <div className={employeeDialogFieldClass}>
      <label htmlFor={id} className={employeeDialogLabelClass}>
        {label}
      </label>
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
        {separate ? (
          <Select
            value={currency}
            onValueChange={(value) => {
              if (!value) return;
              onChange({
                currency: value,
                rate: value === "IDR" ? "" : rate || bankRate,
                customsRate:
                  value === "IDR" ? "" : customsRate || factoryCustomsRate,
              });
            }}
            disabled={disabled}
          >
            <SelectTrigger
              id={`${id}-currency`}
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
        ) : (
          <div
            className={cn(
              employeeSelectTriggerClass,
              "flex items-center justify-center text-sm font-semibold tabular-nums text-muted"
            )}
            aria-hidden
          >
            {factoryCurrency}
          </div>
        )}
        <Input
          id={id}
          inputMode="decimal"
          disabled={disabled}
          value={amount}
          onChange={(event) => onChange({ amount: event.target.value })}
          placeholder="0"
          className={employeeInputClass}
        />
      </div>
      {separate && !isIdr ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className={employeeDialogFieldClass}>
            <label htmlFor={`${id}-rate`} className={employeeDialogLabelClass}>
              {lineRateLabel}
            </label>
            <Input
              id={`${id}-rate`}
              inputMode="decimal"
              disabled={disabled}
              value={rate}
              onChange={(event) => onChange({ rate: event.target.value })}
              placeholder={bankRate || "0"}
              className={employeeInputClass}
            />
          </div>
          <div className={employeeDialogFieldClass}>
            <label
              htmlFor={`${id}-customs-rate`}
              className={employeeDialogLabelClass}
            >
              {lineCustomsRateLabel}
            </label>
            <Input
              id={`${id}-customs-rate`}
              inputMode="decimal"
              disabled={disabled}
              value={customsRate}
              onChange={(event) =>
                onChange({ customsRate: event.target.value })
              }
              placeholder={factoryCustomsRate || "0"}
              className={employeeInputClass}
            />
          </div>
        </div>
      ) : null}
      <label
        htmlFor={`${id}-not-included`}
        className="mt-2 inline-flex cursor-pointer items-start gap-2 text-sm text-text"
      >
        <input
          id={`${id}-not-included`}
          type="checkbox"
          checked={separate}
          disabled={disabled}
          onChange={(event) => setSeparate(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-border"
        />
        <span className="font-semibold">{notIncludedLabel}</span>
      </label>
      <p className={employeeDialogHintClass}>
        {separate ? (isIdr ? idrHint : separateHint) : includedHint}
      </p>
      {convertedLabel ? (
        <p className={employeeDialogHintClass}>{convertedLabel}</p>
      ) : null}
    </div>
  );
}

function remittanceLineDisplay(line: ImportVendorLine): string {
  if (
    !line.storedAsIdr &&
    line.foreignAmount != null &&
    line.foreignAmount > 0
  ) {
    return formatImportForeignAmount(line.currency, line.foreignAmount);
  }
  return formatContractPrice(line.vendorIdr);
}

function BreakdownValueRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={emphasize ? "font-semibold text-text" : "text-muted"}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          emphasize ? "font-semibold text-text" : "text-text"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function BreakdownRow({
  label,
  amount,
  emphasize = false,
}: {
  label: string;
  amount: number;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={emphasize ? "font-semibold text-text" : "text-muted"}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          emphasize ? "font-semibold text-text" : "text-text"
        )}
      >
        {formatContractPrice(amount)}
      </span>
    </div>
  );
}

type Props = {
  draft: PurchaseImportDraft;
  onChange: Dispatch<SetStateAction<PurchaseImportDraft>>;
  disabled?: boolean;
  totalQuantity: number;
  /** Hide customs duty / import tax fields when a handler pays them. */
  showCustomsCharges?: boolean;
  /** Billing ID and handling fields after the charges, before the summary. */
  afterCharges?: ReactNode;
  /** Handling fee paid in Rupiah, including Value Added Tax when charged. */
  handlingFeePaidIdr?: number;
  /** Handling fee without Value Added Tax — this is what goes into warehouse cost. */
  handlingFeeCostIdr?: number;
  showHandlingFee?: boolean;
  /** FOC customs: hide factory remittance fields; CIF comes from declared value. */
  chargesOnly?: boolean;
  declaredCif?: {
    value: number;
    currency: string;
    customsRate: number | null;
  } | null;
  /** FOC shipping cash added to warehouse cost. Not part of CIF. */
  extraStockCostIdr?: number;
};

export default function PurchaseImportCostFields({
  draft,
  onChange,
  disabled = false,
  totalQuantity,
  showCustomsCharges = true,
  afterCharges,
  handlingFeePaidIdr = 0,
  handlingFeeCostIdr,
  showHandlingFee = false,
  chargesOnly = false,
  declaredCif = null,
  extraStockCostIdr = 0,
}: Props) {
  const { t } = useT();

  function patch(partial: Partial<PurchaseImportDraft>) {
    onChange((prev) => ({ ...prev, ...partial }));
  }

  const inputRaw = chargesOnly
    ? declaredCif
      ? focChargesDraftToInput(draft, declaredCif)
      : null
    : importDraftToInput(draft);
  const input =
    inputRaw && !showCustomsCharges
      ? {
          ...inputRaw,
          formEApplied: false,
          beaMasukApplied: false,
          ppnbmApplied: false,
          ppnApplied: false,
          pph22Applied: false,
          clearanceCostIdr: 0,
        }
      : inputRaw;
  const result: ImportLandedCostResult | null = input
    ? calculateImportLandedCost(input as ImportLandedCostInput)
    : null;
  const handlingPaidShown = showHandlingFee
    ? Math.max(0, handlingFeePaidIdr)
    : 0;
  const handlingCostShown = showHandlingFee
    ? Math.max(0, handlingFeeCostIdr ?? handlingFeePaidIdr)
    : 0;
  const handlingPpnShown = Math.max(0, handlingPaidShown - handlingCostShown);
  const vendorPaymentIdr = result?.paidToVendorIdr ?? 0;
  const vatCreditShown =
    (result && showCustomsCharges ? result.ppnAmountIdr : 0) +
    handlingPpnShown;
  const pph22CreditShown =
    result && showCustomsCharges ? result.pph22AmountIdr : 0;
  const taxCreditShown = vatCreditShown + pph22CreditShown;
  const shippingStockIdr = Math.max(0, extraStockCostIdr);
  const totalExpenseIdr = result
    ? vendorPaymentIdr +
      (showCustomsCharges ? result.dutiesTotalIdr : 0) +
      handlingPaidShown +
      shippingStockIdr
    : shippingStockIdr;
  const warehouseCostIdr = Math.max(0, totalExpenseIdr - taxCreditShown);
  const unitCost =
    result && totalQuantity > 0
      ? Math.round((warehouseCostIdr / totalQuantity) * 100) / 100
      : null;
  const bankRateIdr = parseImportDecimal(draft.exchangeRateToIdr);
  const cifFxCurrencies = draftImportCifFxCurrencies(draft);
  const lineCustomsCurrencies = new Set<string>();
  if (
    !draft.freightIncludedInInvoice &&
    draft.freightCurrency !== "IDR" &&
    parseImportDecimal(draft.freightAmount)
  ) {
    lineCustomsCurrencies.add(draft.freightCurrency);
  }
  if (
    !draft.insuranceIncludedInInvoice &&
    draft.insuranceCurrency !== "IDR" &&
    parseImportDecimal(draft.insuranceAmount)
  ) {
    lineCustomsCurrencies.add(draft.insuranceCurrency);
  }
  const factoryCustomsCurrencies = cifFxCurrencies.filter(
    (code) => code === draft.currency || !lineCustomsCurrencies.has(code)
  );

  function patchCustomsRate(currency: string, value: string) {
    patch({
      customsRatesToIdr: {
        ...draft.customsRatesToIdr,
        [currency]: value,
      },
    });
  }

  function cifFormulaLabel(): string {
    if (!result) return "";
    return formatImportCifFormulaLabel(
      result.cifForeignLines,
      result.cifIdrExtra,
      result.customsValueIdr,
      formatContractPrice
    );
  }

  return (
    <div className="sm:col-span-2 space-y-3">
      {chargesOnly ? null : (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={employeeDialogFieldClass}>
          <label
            htmlFor="purchase-import-foreign"
            className={employeeDialogLabelClass}
          >
            {t("pages.billing.purchaseFactoryInvoice")}
            <span className="text-red-400"> *</span>
          </label>
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
            <Select
              value={draft.currency}
              onValueChange={(value) => {
                if (!value) return;
                patch({
                  currency: value,
                  freightCurrency: draft.freightIncludedInInvoice
                    ? value
                    : draft.freightCurrency,
                  insuranceCurrency: draft.insuranceIncludedInInvoice
                    ? value
                    : draft.insuranceCurrency,
                  bankFeeCurrency: value,
                  customsRatesToIdr: {
                    ...draft.customsRatesToIdr,
                    [value]:
                      draft.customsRatesToIdr[value] ||
                      draft.customsRatesToIdr[draft.currency] ||
                      "",
                  },
                });
              }}
              disabled={disabled}
            >
              <SelectTrigger
                id="purchase-import-currency"
                className={cn(employeeSelectTriggerClass, "w-full")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              id="purchase-import-foreign"
              inputMode="decimal"
              disabled={disabled}
              value={draft.foreignAmount}
              onChange={(event) =>
                patch({ foreignAmount: event.target.value })
              }
              placeholder={t("pages.billing.purchaseImportForeignPlaceholder")}
              className={employeeInputClass}
            />
          </div>
          <p className={employeeDialogHintClass}>
            {t("pages.billing.purchaseImportFactoryCurrencyHint")}
          </p>
        </div>
        <OptionalInvoiceFeeField
          id="purchase-import-freight"
          label={t("pages.billing.purchaseImportFreight")}
          includedHint={t("pages.billing.purchaseImportFreightHint")}
          separateHint={t("pages.billing.purchaseImportSeparateFeeHint")}
          idrHint={t("pages.billing.purchaseImportSeparateIdrHint")}
          notIncludedLabel={t(
            "pages.billing.purchaseImportNotIncludedInFactoryInvoice"
          )}
          lineRateLabel={t("pages.billing.purchaseImportRate")}
          lineCustomsRateLabel={t("pages.billing.purchaseImportCustomsRate")}
          factoryCurrency={draft.currency}
          bankRate={draft.exchangeRateToIdr}
          factoryCustomsRate={draft.customsRatesToIdr[draft.currency] ?? ""}
          included={draft.freightIncludedInInvoice}
          currency={draft.freightCurrency}
          amount={draft.freightAmount}
          rate={draft.freightRateToIdr}
          customsRate={draft.freightCustomsRateToIdr}
          disabled={disabled}
          onChange={(next) =>
            patch({
              ...(next.included !== undefined
                ? { freightIncludedInInvoice: next.included }
                : {}),
              ...(next.currency !== undefined
                ? { freightCurrency: next.currency }
                : {}),
              ...(next.amount !== undefined
                ? { freightAmount: next.amount }
                : {}),
              ...(next.rate !== undefined
                ? { freightRateToIdr: next.rate }
                : {}),
              ...(next.customsRate !== undefined
                ? { freightCustomsRateToIdr: next.customsRate }
                : {}),
            })
          }
          convertedLabel={
            result && result.vendorFreightIdr > 0
              ? t("pages.billing.purchaseImportConvertedIdr", {
                  amount: formatContractPrice(result.vendorFreightIdr),
                })
              : undefined
          }
        />
        <OptionalInvoiceFeeField
          id="purchase-import-insurance"
          label={t("pages.billing.purchaseImportInsurance")}
          includedHint={t("pages.billing.purchaseImportInsuranceHint")}
          separateHint={t("pages.billing.purchaseImportSeparateFeeHint")}
          idrHint={t("pages.billing.purchaseImportSeparateIdrHint")}
          notIncludedLabel={t(
            "pages.billing.purchaseImportNotIncludedInFactoryInvoice"
          )}
          lineRateLabel={t("pages.billing.purchaseImportRate")}
          lineCustomsRateLabel={t("pages.billing.purchaseImportCustomsRate")}
          factoryCurrency={draft.currency}
          bankRate={draft.exchangeRateToIdr}
          factoryCustomsRate={draft.customsRatesToIdr[draft.currency] ?? ""}
          included={draft.insuranceIncludedInInvoice}
          currency={draft.insuranceCurrency}
          amount={draft.insuranceAmount}
          rate={draft.insuranceRateToIdr}
          customsRate={draft.insuranceCustomsRateToIdr}
          disabled={disabled}
          onChange={(next) =>
            patch({
              ...(next.included !== undefined
                ? { insuranceIncludedInInvoice: next.included }
                : {}),
              ...(next.currency !== undefined
                ? { insuranceCurrency: next.currency }
                : {}),
              ...(next.amount !== undefined
                ? { insuranceAmount: next.amount }
                : {}),
              ...(next.rate !== undefined
                ? { insuranceRateToIdr: next.rate }
                : {}),
              ...(next.customsRate !== undefined
                ? { insuranceCustomsRateToIdr: next.customsRate }
                : {}),
            })
          }
          convertedLabel={
            result && result.vendorInsuranceIdr > 0
              ? t("pages.billing.purchaseImportConvertedIdr", {
                  amount: formatContractPrice(result.vendorInsuranceIdr),
                })
              : undefined
          }
        />
        <FactoryCurrencyAmountField
          id="purchase-import-bank"
          label={t("pages.billing.purchaseImportBankCharge")}
          hint={t("pages.billing.purchaseImportBankChargeHint")}
          currency={draft.currency}
          amount={draft.bankFeeAmount}
          disabled={disabled}
          onAmountChange={(bankFeeAmount) => patch({ bankFeeAmount })}
          convertedLabel={
            result && result.bankChargeIdr > 0
              ? t("pages.billing.purchaseImportConvertedIdr", {
                  amount: formatContractPrice(result.bankChargeIdr),
                })
              : undefined
          }
        />
        <MoneyField
          id="purchase-import-local-bank"
          label={t("pages.billing.purchaseImportLocalBankFee")}
          hint={t("pages.billing.purchaseImportLocalBankFeeHint")}
          value={draft.localBankFeeIdr}
          placeholder="0"
          disabled={disabled}
          onChange={(localBankFeeIdr) => patch({ localBankFeeIdr })}
        />
        <MoneyField
          id="purchase-import-rate"
          label={`${t("pages.billing.purchaseImportRate")} *`}
          hint={
            bankRateIdr != null && bankRateIdr > 0
              ? formatContractPrice(bankRateIdr)
              : t("pages.billing.purchaseImportRateHint")
          }
          value={draft.exchangeRateToIdr}
          placeholder={t("pages.billing.purchaseImportRatePlaceholder")}
          disabled={disabled}
          onChange={(exchangeRateToIdr) => patch({ exchangeRateToIdr })}
        />
        {factoryCustomsCurrencies.map((code) => {
          const rateValue = draft.customsRatesToIdr[code] ?? "";
          const parsedRate = parseImportDecimal(rateValue);
          return (
            <MoneyField
              key={code}
              id={`purchase-import-customs-rate-${code}`}
              label={`${t("pages.billing.purchaseImportCustomsRateFor", {
                currency: code,
              })} *`}
              hint={
                parsedRate != null && parsedRate > 0
                  ? formatContractPrice(parsedRate)
                  : t("pages.billing.purchaseImportCustomsRateHint")
              }
              value={rateValue}
              placeholder={t(
                "pages.billing.purchaseImportCustomsRatePlaceholder"
              )}
              disabled={disabled}
              onChange={(next) => patchCustomsRate(code, next)}
            />
          );
        })}
      </div>
      )}

      {showCustomsCharges ? (
      <div className="space-y-2">
        <p className={employeeDialogLabelClass}>
          {t("pages.billing.purchaseImportCharges")}
        </p>
        <p className={employeeDialogHintClass}>
          {t("pages.billing.purchaseImportChargesHint")}
        </p>

        <ChargeCheckbox
          id="purchase-import-form-e"
          checked={draft.formEApplied}
          disabled={disabled}
          label={t("pages.billing.purchaseImportFormE")}
          hint={t("pages.billing.purchaseImportFormEHint")}
          onChange={(formEApplied) =>
            patch({
              formEApplied,
              ...(formEApplied
                ? {
                    beaMasukApplied: false,
                    beaMasukRatePercent: "0",
                    beaMasukAmountIdr: "",
                  }
                : {}),
            })
          }
        />

        <ChargeCheckbox
          id="purchase-import-bm"
          checked={draft.beaMasukApplied}
          disabled={disabled}
          label={t("pages.billing.purchaseImportBeaMasuk")}
          hint={t("pages.billing.purchaseImportBeaMasukHint")}
          onChange={(beaMasukApplied) => patch({ beaMasukApplied })}
        >
          <MoneyField
            id="purchase-import-bm-rate"
            label={t("pages.billing.purchaseImportRatePercent")}
            value={draft.beaMasukRatePercent}
            placeholder="0"
            disabled={disabled}
            onChange={(beaMasukRatePercent) =>
              patch({ beaMasukRatePercent, beaMasukAmountIdr: "" })
            }
          />
          <MoneyField
            id="purchase-import-bm-amount"
            label={t("pages.billing.purchaseImportPaidAmount")}
            value={draft.beaMasukAmountIdr}
            placeholder={
              result
                ? formatContractPrice(result.beaMasukAmountIdr)
                : t("pages.billing.purchaseImportAutoAmount")
            }
            disabled={disabled}
            onChange={(beaMasukAmountIdr) => patch({ beaMasukAmountIdr })}
          />
        </ChargeCheckbox>

        <ChargeCheckbox
          id="purchase-import-ppnbm"
          checked={draft.ppnbmApplied}
          disabled={disabled}
          label={t("pages.billing.purchaseImportPpnbm")}
          hint={t("pages.billing.purchaseImportPpnbmHint")}
          onChange={(ppnbmApplied) => patch({ ppnbmApplied })}
        >
          <MoneyField
            id="purchase-import-ppnbm-rate"
            label={t("pages.billing.purchaseImportRatePercent")}
            value={draft.ppnbmRatePercent}
            placeholder="0"
            disabled={disabled}
            onChange={(ppnbmRatePercent) =>
              patch({ ppnbmRatePercent, ppnbmAmountIdr: "" })
            }
          />
          <MoneyField
            id="purchase-import-ppnbm-amount"
            label={t("pages.billing.purchaseImportPaidAmount")}
            value={draft.ppnbmAmountIdr}
            placeholder={
              result
                ? formatContractPrice(result.ppnbmAmountIdr)
                : t("pages.billing.purchaseImportAutoAmount")
            }
            disabled={disabled}
            onChange={(ppnbmAmountIdr) => patch({ ppnbmAmountIdr })}
          />
        </ChargeCheckbox>

        <ChargeCheckbox
          id="purchase-import-ppn"
          checked={draft.ppnApplied}
          disabled={disabled}
          label={t("pages.billing.purchaseImportPpn")}
          hint={t("pages.billing.purchaseImportPpnHint")}
          onChange={(ppnApplied) => patch({ ppnApplied })}
        >
          <MoneyField
            id="purchase-import-ppn-rate"
            label={t("pages.billing.purchaseImportRatePercent")}
            value={draft.ppnRatePercent}
            placeholder={String(DEFAULT_PRODUCT_PPN_RATE_PERCENT)}
            disabled={disabled}
            onChange={(ppnRatePercent) =>
              patch({ ppnRatePercent, ppnAmountIdr: "" })
            }
          />
          <MoneyField
            id="purchase-import-ppn-amount"
            label={t("pages.billing.purchaseImportPaidAmount")}
            value={draft.ppnAmountIdr}
            placeholder={
              result
                ? formatContractPrice(result.ppnAmountIdr)
                : t("pages.billing.purchaseImportAutoAmount")
            }
            disabled={disabled}
            onChange={(ppnAmountIdr) => patch({ ppnAmountIdr })}
          />
        </ChargeCheckbox>

        <ChargeCheckbox
          id="purchase-import-pph22"
          checked={draft.pph22Applied}
          disabled={disabled}
          label={t("pages.billing.purchaseImportPph22")}
          hint={t("pages.billing.purchaseImportPph22Hint")}
          onChange={(pph22Applied) => patch({ pph22Applied })}
        >
          <div className="sm:col-span-2 space-y-2">
            <p className={employeeDialogLabelClass}>
              {t("pages.billing.purchaseImportPph22Basis")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["API", t("pages.billing.purchaseImportPph22Api")],
                  [
                    "WITHOUT_API",
                    t("pages.billing.purchaseImportPph22WithoutApi"),
                  ],
                  ["CUSTOM", t("pages.billing.purchaseImportPph22Custom")],
                ] as const
              ).map(([value, label]) => {
                const active = draft.pph22Basis === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      patch({
                        pph22Basis: value,
                        pph22RatePercent: String(
                          pph22RatePercentForBasis(
                            value,
                            parseImportDecimal(draft.pph22RatePercent) ??
                              IMPORT_PPH22_API_RATE_PERCENT
                          )
                        ),
                        pph22AmountIdr: "",
                      })
                    }
                    className={cn(
                      "inline-flex min-h-8 w-full items-center justify-center rounded-xl px-2 py-1.5 text-center text-[0.7rem] font-semibold tracking-wide transition",
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
          </div>
          {draft.pph22Basis === "CUSTOM" ? (
            <MoneyField
              id="purchase-import-pph-rate"
              label={t("pages.billing.purchaseImportRatePercent")}
              value={draft.pph22RatePercent}
              placeholder={String(IMPORT_PPH22_NON_API_RATE_PERCENT)}
              disabled={disabled}
              onChange={(pph22RatePercent) =>
                patch({ pph22RatePercent, pph22AmountIdr: "" })
              }
            />
          ) : (
            <div className={employeeDialogFieldClass}>
              <p className={employeeDialogLabelClass}>
                {t("pages.billing.purchaseImportRatePercent")}
              </p>
              <p className="text-sm tabular-nums text-text">
                {draft.pph22Basis === "WITHOUT_API"
                  ? IMPORT_PPH22_NON_API_RATE_PERCENT
                  : IMPORT_PPH22_API_RATE_PERCENT}
                %
              </p>
            </div>
          )}
          <MoneyField
            id="purchase-import-pph-amount"
            label={t("pages.billing.purchaseImportPaidAmount")}
            value={draft.pph22AmountIdr}
            placeholder={
              result
                ? formatContractPrice(result.pph22AmountIdr)
                : t("pages.billing.purchaseImportAutoAmount")
            }
            disabled={disabled}
            onChange={(pph22AmountIdr) => patch({ pph22AmountIdr })}
          />
        </ChargeCheckbox>
      </div>
      ) : null}

      {afterCharges}

      {result ? (
        <div className="space-y-3 rounded-xl border border-border bg-card-tint-emerald/30 p-3">
          {chargesOnly ? null : (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-text">
              {t("pages.billing.purchaseImportPaidToVendor")}
            </p>
            <BreakdownValueRow
              label={t("pages.billing.purchaseFactoryInvoice")}
              value={remittanceLineDisplay(result.remittance.factory)}
            />
            {result.remittance.freight.includedInInvoice &&
            result.vendorFreightIdr > 0 ? (
              <BreakdownValueRow
                label={t("pages.billing.purchaseImportFreight")}
                value={remittanceLineDisplay(result.remittance.freight)}
              />
            ) : null}
            {result.remittance.insurance.includedInInvoice &&
            result.vendorInsuranceIdr > 0 ? (
              <BreakdownValueRow
                label={t("pages.billing.purchaseImportInsurance")}
                value={remittanceLineDisplay(result.remittance.insurance)}
              />
            ) : null}
            {result.bankChargeIdr > 0 ? (
              <BreakdownValueRow
                label={t("pages.billing.purchaseImportBankCharge")}
                value={remittanceLineDisplay(result.remittance.bankCharge)}
              />
            ) : null}
            <BreakdownRow
              label={t("pages.billing.purchaseImportRate")}
              amount={bankRateIdr ?? 0}
            />
            <BreakdownRow
              label={t("pages.billing.purchaseImportAmountSent")}
              amount={result.amountSentIdr}
            />
            {result.localBankFeeIdr > 0 ? (
              <BreakdownRow
                label={t("pages.billing.purchaseImportLocalBankFee")}
                amount={result.localBankFeeIdr}
              />
            ) : null}
            {result.remittance.separateFreightIdr > 0 ? (
              <BreakdownValueRow
                label={t("pages.billing.purchaseImportFreightSeparate")}
                value={remittanceLineDisplay(result.remittance.freight)}
              />
            ) : null}
            {result.remittance.separateInsuranceIdr > 0 ? (
              <BreakdownValueRow
                label={t("pages.billing.purchaseImportInsuranceSeparate")}
                value={remittanceLineDisplay(result.remittance.insurance)}
              />
            ) : null}
            <BreakdownRow
              label={t("pages.billing.purchaseImportPaidToVendorTotal")}
              amount={vendorPaymentIdr}
              emphasize
            />
            <p className={employeeDialogHintClass}>
              {t("pages.billing.purchaseImportPaidToVendorHint")}
            </p>
          </div>
          )}

          <div className="space-y-1 pt-1">
            <ImportCifValueBlock
              title={t("pages.billing.purchaseImportCustomsValue")}
              titleClassName="text-sm"
              formulaClassName="text-sm"
              chips={result.appliedCustomsRates.map((row) => ({
                currency: row.currency,
                customsRateLabel: t("pages.billing.purchaseImportCustomsRate"),
                rateLabel: formatContractPrice(row.rate),
              }))}
              formula={
                cifFormulaLabel() ||
                formatContractPrice(result.customsValueIdr)
              }
            />
          </div>
          {showCustomsCharges ? (
            <div className="space-y-1.5 pt-1">
              <p className="text-sm font-semibold text-text">
                {t("pages.billing.purchaseImportDutiesTotal")}
              </p>
              {result.beaMasukAmountIdr > 0 ? (
                <BreakdownRow
                  label={t("pages.billing.purchaseImportBeaMasuk")}
                  amount={result.beaMasukAmountIdr}
                />
              ) : null}
              {result.ppnbmAmountIdr > 0 ? (
                <BreakdownRow
                  label={t("pages.billing.purchaseImportPpnbm")}
                  amount={result.ppnbmAmountIdr}
                />
              ) : null}
              {result.ppnAmountIdr > 0 ? (
                <BreakdownRow
                  label={t("pages.billing.purchaseImportPpn")}
                  amount={result.ppnAmountIdr}
                />
              ) : null}
              {result.pph22AmountIdr > 0 ? (
                <BreakdownRow
                  label={t("pages.billing.purchaseImportPph22")}
                  amount={result.pph22AmountIdr}
                />
              ) : null}
              <BreakdownRow
                label={t("pages.billing.purchaseImportDutiesTotal")}
                amount={result.dutiesTotalIdr}
                emphasize
              />
              <p className={employeeDialogHintClass}>
                {t("pages.billing.purchaseImportCustomsRateDutiesHint")}
              </p>
            </div>
          ) : null}
          {shippingStockIdr > 0 ? (
            <BreakdownRow
              label={t("pages.billing.purchaseShippingCost")}
              amount={shippingStockIdr}
            />
          ) : null}
          {showHandlingFee ? (
            <BreakdownRow
              label={t("pages.billing.handlingFee")}
              amount={handlingPaidShown}
            />
          ) : null}

          <div className="space-y-2 rounded-lg border border-border bg-card/70 p-3">
            <p className="text-sm font-semibold tracking-tight text-text">
              {t("pages.billing.purchaseImportCredits")}
            </p>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-text">
                {t("pages.billing.purchaseImportVatCredit")}
              </span>
              <span className="text-lg font-semibold tabular-nums text-text">
                {formatContractPrice(vatCreditShown)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-text">
                {t("pages.billing.purchaseImportPph22Credit")}
              </span>
              <span className="text-lg font-semibold tabular-nums text-text">
                {formatContractPrice(pph22CreditShown)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <BreakdownRow
              label={t("pages.billing.purchaseImportGrandTotalSpend")}
              amount={totalExpenseIdr}
              emphasize
            />
            <BreakdownRow
              label={t("pages.billing.purchaseImportStockCost")}
              amount={warehouseCostIdr}
              emphasize
            />
            <p className={employeeDialogHintClass}>
              {t("pages.billing.purchaseImportWarehouseSpendHint")}
            </p>
          </div>
          {unitCost != null ? (
            <p className="pt-1 text-sm font-semibold tabular-nums text-text">
              {t("pages.billing.purchaseImportUnitCost", {
                qty: totalQuantity,
                amount: formatContractPrice(unitCost),
              })}
            </p>
          ) : (
            <p className={employeeDialogHintClass}>
              {t("pages.billing.purchaseImportUnitCostNeedQty")}
            </p>
          )}
          <p className={employeeDialogHintClass}>
            {t("pages.billing.purchaseImportStockCostHint")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
