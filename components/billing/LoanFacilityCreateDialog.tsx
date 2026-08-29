"use client";

import { useState, type FormEvent } from "react";
import { Landmark } from "lucide-react";
import { useRouter } from "next/navigation";

import { createLoanFacility } from "@/app/billing/loans/actions";
import LoanCalculationVariablesTable, {
  type LoanVariableDraft,
} from "@/components/billing/LoanCalculationVariablesTable";
import CompanyBankAccountField from "@/components/company-details/CompanyBankAccountField";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
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
import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { showMissingRequiredFields } from "@/components/ui/rejection-notice";
import YesNoChoiceCards, {
  type YesNoChoice,
} from "@/components/ui/YesNoChoiceCards";
import {
  standbyCommitmentFeeIdr,
  termMonthlyInstallment,
  type BankLoanKind,
} from "@/lib/bank-loan";
import type { LoanSource } from "@/lib/loan-facility";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { todayDateInput } from "@/lib/project-contract";
import { cn } from "@/lib/utils";
import { outlineChipTones } from "@/components/ui/StatusBadge";

type VendorOption = { id: string; name: string };

export default function LoanFacilityCreateDialog({
  vendors,
  bankAccounts,
}: {
  vendors: VendorOption[];
  bankAccounts: CompanyBankAccountOption[];
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<LoanSource | "">("");
  const [kind, setKind] = useState<BankLoanKind | "">("");
  const [name, setName] = useState("");
  const [lenderName, setLenderName] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [chargesInterest, setChargesInterest] = useState<YesNoChoice>("Yes");
  const [facilityLimit, setFacilityLimit] = useState("");
  const [principal, setPrincipal] = useState("");
  const [startDate, setStartDate] = useState(todayDateInput);
  const [notes, setNotes] = useState("");
  const [variables, setVariables] = useState<LoanVariableDraft>({
    dayCountYear: 360,
    interestRateBasis: "",
    annualRatePercent: "",
    commitmentFeeApplies: "No",
    commitmentFeeRatePercent: "",
    calculationMethod: "",
    tenorMonths: "12",
  });
  const [recordInitialDraw, setRecordInitialDraw] =
    useState<YesNoChoice>("No");
  const [initialDrawAmount, setInitialDrawAmount] = useState("");
  const [initialDrawDate, setInitialDrawDate] = useState("");
  const [bankAccountId, setBankAccountId] = useState(
    bankAccounts[0]?.id ?? ""
  );

  const isBank = source === "BANK";
  const isShareholder = source === "SHAREHOLDER";
  const effectiveKind = kind;
  const requiresRate =
    Boolean(effectiveKind) &&
    (isBank || (isShareholder && chargesInterest === "Yes"));
  const showRate = requiresRate;
  const principalNumber = Number(principal.replace(/[^\d]/g, "")) || 0;
  const facilityLimitNumber =
    Number(facilityLimit.replace(/[^\d]/g, "")) || 0;
  const tenorNumber = Number(variables.tenorMonths) || 0;
  const rateNumber = Number(variables.annualRatePercent.replace(",", ".")) || 0;
  const commitmentRateNumber =
    Number(variables.commitmentFeeRatePercent.replace(",", ".")) || 0;
  const interestRateBasis = variables.interestRateBasis;
  const annualRatePercent = variables.annualRatePercent;
  const calculationMethod = variables.calculationMethod;
  const commitmentFeeApplies = variables.commitmentFeeApplies;
  const commitmentFeeRatePercent = variables.commitmentFeeRatePercent;
  const initialDrawNumber =
    recordInitialDraw === "Yes"
      ? Number(initialDrawAmount.replace(/[^\d]/g, "")) || 0
      : 0;
  const previewUnused = Math.max(0, facilityLimitNumber - initialDrawNumber);
  const commitmentFeeQuarterPreview =
    effectiveKind === "STANDBY" &&
    commitmentFeeApplies === "Yes" &&
    previewUnused > 0 &&
    commitmentRateNumber > 0
      ? standbyCommitmentFeeIdr({
          unused: previewUnused,
          annualRatePercent: commitmentRateNumber,
          days: 90,
        })
      : 0;
  const installmentPreview =
    effectiveKind === "TERM" &&
    principalNumber > 0 &&
    tenorNumber > 0 &&
    (showRate ? Boolean(interestRateBasis) : true)
      ? termMonthlyInstallment(
          principalNumber,
          showRate ? rateNumber : 0,
          tenorNumber,
          interestRateBasis || "ANNUAL",
          calculationMethod || "ANNUITY"
        )
      : 0;

  function reset() {
    setError(null);
    setSource("");
    setKind("");
    setName("");
    setLenderName("");
    setVendorId("");
    setChargesInterest("Yes");
    setFacilityLimit("");
    setPrincipal("");
    setVariables({
      dayCountYear: 360,
      interestRateBasis: "",
      annualRatePercent: "",
      commitmentFeeApplies: "No",
      commitmentFeeRatePercent: "",
      calculationMethod: "",
      tenorMonths: "60",
    });
    setStartDate(todayDateInput());
    setNotes("");
    setRecordInitialDraw("No");
    setInitialDrawAmount("");
    setInitialDrawDate("");
    setBankAccountId(bankAccounts[0]?.id ?? "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const extraMissing: string[] = [];
    if (!source) extraMissing.push(t("pages.billing.loanSource"));
    if (!kind) extraMissing.push(t("pages.billing.bankLoanKind"));
    if (effectiveKind === "STANDBY" && !facilityLimit.trim()) {
      extraMissing.push(t("pages.billing.bankLoanFacilityLimit"));
    }
    if (effectiveKind === "TERM" && !calculationMethod) {
      extraMissing.push(t("pages.billing.loanCalculationMethod"));
    }
    if (
      effectiveKind === "STANDBY" &&
      commitmentFeeApplies === "Yes" &&
      !commitmentFeeRatePercent.trim()
    ) {
      extraMissing.push(t("pages.billing.loanCommitmentFeeRate"));
    }
    if (requiresRate && !interestRateBasis) {
      extraMissing.push(t("pages.billing.loanInterestBasis"));
    }
    if (requiresRate && !annualRatePercent.trim()) {
      extraMissing.push(
        interestRateBasis === "MONTHLY"
          ? t("pages.billing.loanMonthlyRate")
          : t("pages.billing.bankLoanAnnualRate")
      );
    }
    if (showMissingRequiredFields(event.currentTarget, extraMissing)) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    formData.set("loanSource", source);
    formData.set("bankLoanKind", effectiveKind);
    formData.set("chargesInterest", chargesInterest === "Yes" ? "true" : "false");
    formData.set("dayCountYear", String(variables.dayCountYear));
    if (interestRateBasis) formData.set("interestRateBasis", interestRateBasis);
    if (calculationMethod) formData.set("calculationMethod", calculationMethod);
    formData.set(
      "commitmentFeeApplies",
      commitmentFeeApplies === "Yes" ? "true" : "false"
    );
    formData.set("commitmentFeeRatePercent", commitmentFeeRatePercent);
    formData.set("annualRatePercent", annualRatePercent);
    formData.set("tenorMonths", variables.tenorMonths);
    if (effectiveKind === "TERM") {
      formData.set("recordInitialDraw", "true");
      formData.set("initialDrawAmount", principal);
      if (!formData.get("initialDrawDate")) {
        formData.set("initialDrawDate", startDate);
      }
    } else {
      formData.set(
        "recordInitialDraw",
        recordInitialDraw === "Yes" ? "true" : "false"
      );
    }
    formData.set("vendorId", vendorId);
    formData.set("bankAccountId", bankAccountId);
    setPending(true);
    try {
      await createLoanFacility(formData);
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.loans.failed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="permissionsBadge" size="badgeFlex">
          <Landmark className="h-3.5 w-3.5" aria-hidden />
          {t("pages.loans.register")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={Landmark}
        title={t("pages.loans.registerTitle")}
        description={t("pages.loans.registerDesc")}
        maxWidth="lg"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="loan-facility-create-form"
              disabled={
                pending ||
                !source ||
                !kind ||
                (requiresRate &&
                  (!interestRateBasis || !annualRatePercent.trim())) ||
                (effectiveKind === "TERM" && !calculationMethod) ||
                (effectiveKind === "STANDBY" && !facilityLimit.trim()) ||
                (effectiveKind === "STANDBY" &&
                  commitmentFeeApplies === "Yes" &&
                  !commitmentFeeRatePercent.trim()) ||
                (recordInitialDraw === "Yes" &&
                  (!initialDrawAmount.trim() ||
                    !initialDrawDate.trim() ||
                    !bankAccountId))
              }
            >
              {pending ? t("pages.loans.saving") : t("pages.loans.registerConfirm")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        }
      >
        <form
          id="loan-facility-create-form"
          className={employeeDialogFormClass}
          onSubmit={handleSubmit}
        >
          <div className={employeeDialogGridClass}>
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label id="loan-create-source" className={employeeDialogLabelClass}>
                {t("pages.loans.source")}
                <span className="text-red-400"> *</span>
              </label>
              <div
                role="radiogroup"
                aria-labelledby="loan-create-source"
                className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                {(
                  [
                    ["BANK", t("pages.billing.loanSourceBank")],
                    ["SHAREHOLDER", t("pages.billing.loanSourceShareholder")],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={source === value}
                    disabled={pending}
                    onClick={() => {
                      setSource(value);
                    }}
                    className={cn(
                      "inline-flex min-h-8 w-full items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                      source === value && outlineChipTones.emeraldInteractive,
                      source !== value &&
                        "border border-border bg-elevated text-muted hover:border-border-strong hover:bg-card-hover hover:text-text"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {source ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label id="loan-create-kind" className={employeeDialogLabelClass}>
                  {t("pages.billing.bankLoanKind")}
                  <span className="text-red-400"> *</span>
                </label>
                <div
                  role="radiogroup"
                  aria-labelledby="loan-create-kind"
                  className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  {(
                    [
                      ["STANDBY", t("pages.billing.bankLoanKindStandby")],
                      ["TERM", t("pages.billing.bankLoanKindTerm")],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={kind === value}
                      disabled={pending}
                      onClick={() => {
                        setKind(value);
                        if (value === "TERM") setRecordInitialDraw("Yes");
                        if (value === "STANDBY") setRecordInitialDraw("No");
                      }}
                      className={cn(
                        "inline-flex min-h-8 w-full items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                        kind === value && outlineChipTones.emeraldInteractive,
                        kind !== value &&
                          "border border-border bg-elevated text-muted hover:border-border-strong hover:bg-card-hover hover:text-text"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className={employeeDialogHintClass}>
                  {kind === "TERM"
                    ? t("pages.billing.bankLoanKindTermHint")
                    : t("pages.billing.bankLoanKindStandbyHint")}
                </p>
              </div>
            ) : null}

            {isBank ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label htmlFor="loan-vendor" className={employeeDialogLabelClass}>
                  {t("pages.billing.purchaseSupplier")}
                  <span className="text-red-400"> *</span>
                </label>
                <Select
                  value={vendorId || null}
                  onValueChange={(value) => {
                    if (!value) return;
                    setVendorId(value);
                  }}
                  disabled={pending}
                >
                  <SelectTrigger
                    id="loan-vendor"
                    className={cn(employeeSelectTriggerClass, "w-full")}
                  >
                    <SelectValue
                      placeholder={t("pages.billing.purchaseVendorSelect")}
                    >
                      {(value) =>
                        vendors.find((row) => row.id === value)?.name ??
                        t("pages.billing.purchaseVendorSelect")
                      }
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
              </div>
            ) : null}

            {isShareholder ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  htmlFor="loan-lender"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.loanShareholderName")}
                  <span className="text-red-400"> *</span>
                </label>
                <Input
                  id="loan-lender"
                  name="lenderName"
                  disabled={pending}
                  value={lenderName}
                  onChange={(event) => setLenderName(event.target.value)}
                  className={employeeInputClass}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.loans.lenderNameHint")}
                </p>
              </div>
            ) : null}

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label htmlFor="loan-name" className={employeeDialogLabelClass}>
                {t("pages.loans.name")}
              </label>
              <Input
                id="loan-name"
                name="name"
                disabled={pending}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("pages.loans.namePlaceholder")}
                className={employeeInputClass}
              />
            </div>

            {isShareholder ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  id="loan-charges-interest"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.loanChargesInterest")}
                  <span className="text-red-400"> *</span>
                </label>
                <YesNoChoiceCards
                  id="loan-charges-interest"
                  labelledBy="loan-charges-interest"
                  value={chargesInterest}
                  onChange={setChargesInterest}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.loanChargesInterestHint")}
                </p>
              </div>
            ) : null}

            {effectiveKind === "STANDBY" ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  htmlFor="loan-limit"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.bankLoanFacilityLimit")}
                  <span className="text-red-400"> *</span>
                </label>
                <MoneyInput
                  id="loan-limit"
                  name="facilityLimit"
                  disabled={pending}
                  value={facilityLimit}
                  onValueChange={setFacilityLimit}
                  className={employeeInputClass}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.bankLoanFacilityLimitHint")}
                </p>
              </div>
            ) : null}

            {effectiveKind === "TERM" ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  htmlFor="loan-principal"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.bankLoanPrincipal")}
                  <span className="text-red-400"> *</span>
                </label>
                <MoneyInput
                  id="loan-principal"
                  name="principal"
                  disabled={pending}
                  value={principal}
                  onValueChange={setPrincipal}
                  className={employeeInputClass}
                />
              </div>
            ) : null}

            {effectiveKind && (showRate || effectiveKind === "TERM") ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <p className={employeeDialogLabelClass}>
                  {t("pages.loans.variablesTitle")}
                </p>
                <p className={employeeDialogHintClass}>
                  {t("pages.loans.variablesDesc")}
                </p>
                <LoanCalculationVariablesTable
                  kind={effectiveKind}
                  showRate={showRate}
                  disabled={pending}
                  values={variables}
                  onChange={(patch) =>
                    setVariables((current) => ({ ...current, ...patch }))
                  }
                />
                {effectiveKind === "STANDBY" &&
                commitmentFeeApplies === "Yes" &&
                commitmentFeeQuarterPreview > 0 ? (
                  <p className={employeeDialogHintClass}>
                    {t("pages.billing.loanCommitmentFeePreview", {
                      unused: formatContractPrice(previewUnused),
                      days: 90,
                      amount: formatContractPrice(commitmentFeeQuarterPreview),
                    })}
                  </p>
                ) : null}
              </div>
            ) : null}

            {effectiveKind === "TERM" && installmentPreview > 0 ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <p className="text-sm text-text">
                  {t("pages.billing.loanPaymentThisMonthShouldBe")}:{" "}
                  <span className="font-semibold tabular-nums">
                    {formatContractPrice(installmentPreview)}
                  </span>
                </p>
                <p className={employeeDialogHintClass}>
                  {t("pages.billing.bankLoanAnuitasHint")}
                </p>
              </div>
            ) : null}

            <div className={employeeDialogFieldClass}>
              <label htmlFor="loan-start" className={employeeDialogLabelClass}>
                {t("pages.loans.startDate")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                id="loan-start"
                name="startDate"
                type="date"
                required
                disabled={pending}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className={employeeInputClass}
              />
            </div>

            {effectiveKind === "STANDBY" ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  id="loan-initial-draw"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.loans.hasMoneyBeenDrawn")}
                </label>
                <YesNoChoiceCards
                  id="loan-initial-draw"
                  labelledBy="loan-initial-draw"
                  value={recordInitialDraw}
                  onChange={(value) => {
                    setRecordInitialDraw(value);
                    if (value === "No") {
                      setInitialDrawAmount("");
                      setInitialDrawDate("");
                      setBankAccountId("");
                    }
                  }}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.loans.hasMoneyBeenDrawnHint")}
                </p>
              </div>
            ) : null}

            {effectiveKind === "TERM" || recordInitialDraw === "Yes" ? (
              <>
                {effectiveKind === "STANDBY" ? (
                  <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                    <label
                      htmlFor="loan-initial-amount"
                      className={employeeDialogLabelClass}
                    >
                      {t("pages.loans.moneyDrawn")}
                      <span className="text-red-400"> *</span>
                    </label>
                    <MoneyInput
                      id="loan-initial-amount"
                      name="initialDrawAmount"
                      disabled={pending}
                      value={initialDrawAmount}
                      onValueChange={setInitialDrawAmount}
                      className={employeeInputClass}
                    />
                  </div>
                ) : null}
                {effectiveKind === "STANDBY" ? (
                <div className={employeeDialogFieldClass}>
                  <label
                    htmlFor="loan-initial-draw-date"
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.loans.initialDrawDate")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <Input
                    id="loan-initial-draw-date"
                    name="initialDrawDate"
                    type="date"
                    required
                    disabled={pending}
                    value={initialDrawDate}
                    onChange={(event) => setInitialDrawDate(event.target.value)}
                    className={employeeInputClass}
                  />
                  <p className={employeeDialogHintClass}>
                    {t("pages.loans.initialDrawDateHint")}
                  </p>
                </div>
                ) : (
                  <input type="hidden" name="initialDrawDate" value={startDate} />
                )}
                <CompanyBankAccountField
                  className="sm:col-span-2"
                  accounts={bankAccounts}
                  value={bankAccountId}
                  onChange={setBankAccountId}
                  label={t("pages.loans.bankAccount")}
                  hint={t("pages.loans.bankAccountDrawnHint")}
                  disabled={pending}
                  required
                />
              </>
            ) : null}

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label htmlFor="loan-notes" className={employeeDialogLabelClass}>
                {t("pages.loans.notes")}
              </label>
              <Textarea
                id="loan-notes"
                name="notes"
                disabled={pending}
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t("pages.loans.notesPlaceholder")}
                className="min-h-[4.5rem] rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-text shadow-none placeholder:text-subtle"
              />
            </div>
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
