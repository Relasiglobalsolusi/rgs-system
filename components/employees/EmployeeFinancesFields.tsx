"use client";

import { useEffect, useMemo, useState } from "react";

import {
  employeeDialogFieldClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  BPJS_JKK_PERCENT_MAX,
  BPJS_JKK_PERCENT_MIN,
  calculateBpjsBreakdown,
  isDailyPaidPartTime,
  type EmployeeBpjsInput,
} from "@/lib/employee-bpjs";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";

export type EmployeeFinanceDefaults = {
  basePay?: number | null;
  bpjsKesehatanEnabled?: boolean;
  bpjsKetenagakerjaanEnabled?: boolean;
  jhtEnabled?: boolean;
  jpEnabled?: boolean;
  jkkEnabled?: boolean;
  jkmEnabled?: boolean;
  jkkPercent?: number | null;
  depositStatus?: "NONE" | "HELD" | "RETURNED" | "KEPT_BY_COMPANY" | null;
  depositHeldAmount?: number | null;
  securityDepositRequired?: boolean;
  cicoExempt?: boolean;
  progressExempt?: boolean;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
};

type Props = {
  defaults?: EmployeeFinanceDefaults;
  /** Part Time (per-day pay): no security deposit, no BPJS enrollment. */
  employmentType?: "FULL_TIME" | "PART_TIME";
  /** Position-based default when creating, or when the saved value is unset. */
  positionSuggestsDeposit?: boolean;
  onFormValuesChange?: () => void;
  /** Bulk add keeps bank details on each person line. */
  includeBankFields?: boolean;
  namePrefix?: string;
  idPrefix?: string;
};

function FinanceCheckbox({
  id,
  name,
  checked,
  label,
  onChange,
}: {
  id: string;
  name: string;
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="inline-flex cursor-pointer items-center gap-2 text-sm text-text"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-border"
      />
      <input type="hidden" name={name} value={checked ? "true" : "false"} />
      <span>{label}</span>
    </label>
  );
}

export default function EmployeeFinancesFields({
  defaults,
  employmentType = "FULL_TIME",
  positionSuggestsDeposit = false,
  onFormValuesChange,
  includeBankFields = true,
  namePrefix = "",
  idPrefix = "",
}: Props) {
  const { t } = useT();
  const nameOf = (field: string) =>
    namePrefix ? `${namePrefix}${field}` : field;
  const idOf = (id: string) => (idPrefix ? `${idPrefix}${id}` : id);
  const partTimeDailyPay = isDailyPaidPartTime(employmentType);
  const [basePayDigits, setBasePayDigits] = useState(() =>
    defaults?.basePay != null && defaults.basePay > 0
      ? String(Math.round(defaults.basePay))
      : ""
  );
  const [bpjsKesehatanEnabled, setBpjsKesehatanEnabled] = useState(
    Boolean(defaults?.bpjsKesehatanEnabled) && !isDailyPaidPartTime(employmentType)
  );
  const [bpjsKetenagakerjaanEnabled, setBpjsKetenagakerjaanEnabled] = useState(
    Boolean(defaults?.bpjsKetenagakerjaanEnabled) &&
      !isDailyPaidPartTime(employmentType)
  );
  const [jhtEnabled, setJhtEnabled] = useState(Boolean(defaults?.jhtEnabled));
  const [jpEnabled, setJpEnabled] = useState(Boolean(defaults?.jpEnabled));
  const [jkkEnabled, setJkkEnabled] = useState(Boolean(defaults?.jkkEnabled));
  const [jkmEnabled, setJkmEnabled] = useState(Boolean(defaults?.jkmEnabled));
  const [jkkPercent, setJkkPercent] = useState(() =>
    defaults?.jkkPercent != null ? String(defaults.jkkPercent) : ""
  );
  const [securityDepositRequired, setSecurityDepositRequired] = useState(() =>
    isDailyPaidPartTime(employmentType)
      ? false
      : (defaults?.securityDepositRequired ?? positionSuggestsDeposit)
  );
  const [cicoExempt, setCicoExempt] = useState(() =>
    Boolean(defaults?.cicoExempt)
  );
  const [progressExempt, setProgressExempt] = useState(() =>
    Boolean(defaults?.progressExempt)
  );

  useEffect(() => {
    if (partTimeDailyPay) {
      setSecurityDepositRequired(false);
      setBpjsKesehatanEnabled(false);
      setBpjsKetenagakerjaanEnabled(false);
      setJhtEnabled(false);
      setJpEnabled(false);
      setJkkEnabled(false);
      setJkmEnabled(false);
      setJkkPercent("");
      return;
    }
    if (defaults?.securityDepositRequired !== undefined) return;
    setSecurityDepositRequired(positionSuggestsDeposit);
  }, [
    defaults?.securityDepositRequired,
    partTimeDailyPay,
    positionSuggestsDeposit,
  ]);

  const input: EmployeeBpjsInput = useMemo(() => {
    const basePay = Number(basePayDigits || "0");
    const jkkNum = Number(String(jkkPercent).replace(",", "."));
    return {
      basePay: Number.isFinite(basePay) ? basePay : 0,
      bpjsKesehatanEnabled: partTimeDailyPay ? false : bpjsKesehatanEnabled,
      bpjsKetenagakerjaanEnabled: partTimeDailyPay
        ? false
        : bpjsKetenagakerjaanEnabled,
      jhtEnabled:
        !partTimeDailyPay && bpjsKetenagakerjaanEnabled && jhtEnabled,
      jpEnabled: !partTimeDailyPay && bpjsKetenagakerjaanEnabled && jpEnabled,
      jkkEnabled: !partTimeDailyPay && bpjsKetenagakerjaanEnabled && jkkEnabled,
      jkmEnabled: !partTimeDailyPay && bpjsKetenagakerjaanEnabled && jkmEnabled,
      jkkPercent: Number.isFinite(jkkNum) ? jkkNum : null,
    };
  }, [
    basePayDigits,
    bpjsKesehatanEnabled,
    bpjsKetenagakerjaanEnabled,
    jhtEnabled,
    jpEnabled,
    jkkEnabled,
    jkmEnabled,
    jkkPercent,
    partTimeDailyPay,
  ]);

  const breakdown = useMemo(() => calculateBpjsBreakdown(input), [input]);

  function bump() {
    onFormValuesChange?.();
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-inset p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">
          {t("pages.employees.form.finances")}
        </h3>
        <p className="mt-1 text-xs text-muted">
          {partTimeDailyPay
            ? t("pages.employees.form.financesHintPartTime")
            : t("pages.employees.form.financesHint")}
        </p>
      </div>

      {partTimeDailyPay ? (
        <>
          <p className="text-xs text-muted">
            {t("pages.employees.form.partTimeExemptNote")}
          </p>
          <input type="hidden" name={nameOf("securityDepositRequired")} value="false" />
          <input type="hidden" name={nameOf("bpjsKesehatanEnabled")} value="false" />
          <input
            type="hidden"
            name={nameOf("bpjsKetenagakerjaanEnabled")}
            value="false"
          />
          <input type="hidden" name={nameOf("jhtEnabled")} value="false" />
          <input type="hidden" name={nameOf("jpEnabled")} value="false" />
          <input type="hidden" name={nameOf("jkkEnabled")} value="false" />
          <input type="hidden" name={nameOf("jkmEnabled")} value="false" />
          <input type="hidden" name={nameOf("jkkPercent")} value="" />
        </>
      ) : (
        <>
          <FinanceCheckbox
            id={idOf("security-deposit-required")}
            name={nameOf("securityDepositRequired")}
            checked={securityDepositRequired}
            label={t("pages.employees.form.securityDepositRequired")}
            onChange={(next) => {
              setSecurityDepositRequired(next);
              bump();
            }}
          />
          <p className="text-xs text-muted">
            {t("pages.employees.form.securityDepositRequiredHint")}
          </p>
        </>
      )}

      <FinanceCheckbox
        id={idOf("cico-exempt")}
        name={nameOf("cicoExempt")}
        checked={cicoExempt}
        label={t("pages.employees.form.cicoExempt")}
        onChange={(next) => {
          setCicoExempt(next);
          bump();
        }}
      />
      <p className="text-xs text-muted">
        {t("pages.employees.form.cicoExemptHint")}
      </p>

      <FinanceCheckbox
        id={idOf("progress-exempt")}
        name={nameOf("progressExempt")}
        checked={progressExempt}
        label={t("pages.employees.form.progressExempt")}
        onChange={(next) => {
          setProgressExempt(next);
          bump();
        }}
      />
      <p className="text-xs text-muted">
        {t("pages.employees.form.progressExemptHint")}
      </p>

      {defaults?.depositStatus && defaults.depositStatus !== "NONE" ? (
        <div className="rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("pages.employees.columns.securityDeposit")}
          </p>
          <p className="mt-1 font-medium">
            {defaults.depositStatus === "HELD"
              ? t("pages.employees.depositStatusHeld")
              : defaults.depositStatus === "RETURNED"
                ? t("pages.employees.depositStatusReturned")
                : t("pages.employees.depositStatusKept")}
            {defaults.depositHeldAmount
              ? ` · ${formatContractPrice(defaults.depositHeldAmount)}`
              : ""}
          </p>
        </div>
      ) : null}

      {includeBankFields ? (
        <>
      <div className={employeeDialogFieldClass}>
        <label htmlFor={idOf("employee-bank-name")} className="text-sm font-medium text-text">
          {t("pages.employees.form.bankName")}
        </label>
        <Input
          id={idOf("employee-bank-name")}
          name={nameOf("bankName")}
          defaultValue={defaults?.bankName ?? ""}
          placeholder="Mandiri"
          className={employeeInputClass}
          onChange={bump}
        />
      </div>
      <div className={employeeDialogFieldClass}>
        <label
          htmlFor={idOf("employee-bank-account-name")}
          className="text-sm font-medium text-text"
        >
          {t("pages.employees.form.bankAccountName")}
        </label>
        <Input
          id={idOf("employee-bank-account-name")}
          name={nameOf("bankAccountName")}
          defaultValue={defaults?.bankAccountName ?? ""}
          placeholder="Nama sesuai buku tabungan"
          className={employeeInputClass}
          onChange={bump}
        />
      </div>
      <div className={employeeDialogFieldClass}>
        <label
          htmlFor={idOf("employee-bank-account")}
          className="text-sm font-medium text-text"
        >
          {t("pages.employees.form.bankAccountNumber")}
        </label>
        <Input
          id={idOf("employee-bank-account")}
          name={nameOf("bankAccountNumber")}
          defaultValue={defaults?.bankAccountNumber ?? ""}
          placeholder="1234567890"
          className={employeeInputClass}
          onChange={bump}
        />
        <p className="text-xs text-muted">
          {t("pages.employees.form.bankHint")}
        </p>
      </div>
        </>
      ) : null}

      <div className={employeeDialogFieldClass}>
        <label htmlFor={idOf("employee-base-pay")} className="text-sm font-medium text-text">
          {t("pages.employees.form.basePay")}
        </label>
        <p className="text-xs text-muted">
          {partTimeDailyPay
            ? t("pages.employees.form.basePayHintPartTime")
            : t("pages.employees.form.basePayHint")}
        </p>
        <MoneyInput
          id={idOf("employee-base-pay")}
          name={nameOf("basePay")}
          required
          value={basePayDigits}
          onValueChange={(next) => {
            setBasePayDigits(next);
            bump();
          }}
          className={employeeInputClass}
        />
      </div>

      {partTimeDailyPay ? null : (
        <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <FinanceCheckbox
          id={idOf("bpjs-kesehatan")}
          name={nameOf("bpjsKesehatanEnabled")}
          checked={bpjsKesehatanEnabled}
          label={t("pages.employees.form.bpjsKesehatan")}
          onChange={(next) => {
            setBpjsKesehatanEnabled(next);
            bump();
          }}
        />
        <FinanceCheckbox
          id={idOf("bpjs-ketenagakerjaan")}
          name={nameOf("bpjsKetenagakerjaanEnabled")}
          checked={bpjsKetenagakerjaanEnabled}
          label={t("pages.employees.form.bpjsKetenagakerjaan")}
          onChange={(next) => {
            setBpjsKetenagakerjaanEnabled(next);
            bump();
          }}
        />
      </div>

      {bpjsKesehatanEnabled ? (
        <p className="text-xs text-muted">
          {t("pages.employees.form.bpjsKesehatanHelp")}
        </p>
      ) : null}

      {bpjsKetenagakerjaanEnabled ? (
        <div className="space-y-3 rounded-lg border border-border bg-elevated p-3">
          <p className="text-xs font-medium text-text">
            {t("pages.employees.form.bpjsTkComponents")}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <FinanceCheckbox
              id={idOf("jht-enabled")}
              name={nameOf("jhtEnabled")}
              checked={jhtEnabled}
              label={t("pages.employees.form.jht")}
              onChange={(next) => {
                setJhtEnabled(next);
                bump();
              }}
            />
            <FinanceCheckbox
              id={idOf("jp-enabled")}
              name={nameOf("jpEnabled")}
              checked={jpEnabled}
              label={t("pages.employees.form.jp")}
              onChange={(next) => {
                setJpEnabled(next);
                bump();
              }}
            />
            <FinanceCheckbox
              id={idOf("jkk-enabled")}
              name={nameOf("jkkEnabled")}
              checked={jkkEnabled}
              label={t("pages.employees.form.jkk")}
              onChange={(next) => {
                setJkkEnabled(next);
                bump();
              }}
            />
            <FinanceCheckbox
              id={idOf("jkm-enabled")}
              name={nameOf("jkmEnabled")}
              checked={jkmEnabled}
              label={t("pages.employees.form.jkm")}
              onChange={(next) => {
                setJkmEnabled(next);
                bump();
              }}
            />
          </div>
          {jkkEnabled ? (
            <div className={employeeDialogFieldClass}>
              <label htmlFor={idOf("jkk-percent")} className="text-sm font-medium text-text">
                {t("pages.employees.form.jkkPercent")}
              </label>
              <p className="text-xs text-muted">
                {t("pages.employees.form.jkkPercentHint", {
                  min: BPJS_JKK_PERCENT_MIN.toFixed(2),
                  max: BPJS_JKK_PERCENT_MAX.toFixed(2),
                })}
              </p>
              <Input
                id={idOf("jkk-percent")}
                name={nameOf("jkkPercent")}
                type="number"
                step="0.01"
                min={BPJS_JKK_PERCENT_MIN}
                max={BPJS_JKK_PERCENT_MAX}
                required
                value={jkkPercent}
                onChange={(event) => {
                  setJkkPercent(event.target.value);
                  bump();
                }}
                className={cn(employeeInputClass, "max-w-[10rem]")}
              />
            </div>
          ) : (
            <input type="hidden" name={nameOf("jkkPercent")} value="" />
          )}
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
            <li>{t("pages.employees.form.bpjsTkHelpJht")}</li>
            <li>{t("pages.employees.form.bpjsTkHelpJp")}</li>
            <li>{t("pages.employees.form.bpjsTkHelpJkk")}</li>
            <li>{t("pages.employees.form.bpjsTkHelpJkm")}</li>
          </ul>
        </div>
      ) : (
        <>
          <input type="hidden" name={nameOf("jhtEnabled")} value="false" />
          <input type="hidden" name={nameOf("jpEnabled")} value="false" />
          <input type="hidden" name={nameOf("jkkEnabled")} value="false" />
          <input type="hidden" name={nameOf("jkmEnabled")} value="false" />
          <input type="hidden" name={nameOf("jkkPercent")} value="" />
        </>
      )}

      <div className="grid gap-2 rounded-lg border border-border bg-elevated p-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted">
            {t("pages.employees.form.employeeDeduction")}
          </p>
          <p className="font-medium text-text">
            {formatContractPrice(breakdown.employeeDeduction)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">
            {t("pages.employees.form.companyContribution")}
          </p>
          <p className="font-medium text-text">
            {formatContractPrice(breakdown.companyContribution)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">
            {t("pages.employees.form.takeHomeFromBase")}
          </p>
          <p className="font-medium text-text">
            {formatContractPrice(breakdown.takeHomeFromBase)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">
            {t("pages.employees.form.totalEmployerCost")}
          </p>
          <p className="font-medium text-text">
            {formatContractPrice(breakdown.totalEmployerCost)}
          </p>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
