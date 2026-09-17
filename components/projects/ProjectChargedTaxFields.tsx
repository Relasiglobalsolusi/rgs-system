"use client";

import { useEffect, useMemo, useState } from "react";

import { getTaxRatesForPicker } from "@/app/billing/tax-invoices/rates/actions";
import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
} from "@/components/employees/employee-dialog-ui";
import ProjectOptionPills from "@/components/projects/ProjectOptionPills";
import YesNoChoiceCards, {
  type YesNoChoice,
} from "@/components/ui/YesNoChoiceCards";
import {
  chargedTaxKindFromVatPph,
  isProjectPphKind,
  vatPphFromChargedTaxKind,
  type CommercialTaxKind,
  type ProjectPphKind,
} from "@/lib/commercial-tax";
import { useT } from "@/lib/i18n/use-t";
import {
  TAX_RATE_CODE,
  formatTaxRatePercent,
  isCustomTaxRateType,
  type TaxRatePickerRow,
} from "@/lib/tax-rate-codes";

type Props = {
  id: string;
  name?: string;
  taxRateCodeName?: string;
  value: CommercialTaxKind | "";
  taxRateCode?: string;
  asOf?: string;
  onChange: (value: CommercialTaxKind | "") => void;
  onTaxRateCodeChange?: (code: string) => void;
  onOtherTaxName?: (name: string) => void;
  onRatePrefill?: (rate: string) => void;
};

export default function ProjectChargedTaxFields({
  id,
  name,
  taxRateCodeName = "taxRateCode",
  value,
  taxRateCode = "",
  asOf,
  onChange,
  onTaxRateCodeChange,
  onOtherTaxName,
  onRatePrefill,
}: Props) {
  const { t } = useT();
  const [rates, setRates] = useState<TaxRatePickerRow[]>([]);
  const choices = vatPphFromChargedTaxKind(value || null);
  const chargeVat: YesNoChoice = choices.chargeVat ? "Yes" : "No";
  const chargePph: YesNoChoice = choices.chargePph ? "Yes" : "No";
  const selectedPph = taxRateCode || String(choices.pphKind);

  useEffect(() => {
    let cancelled = false;
    void getTaxRatesForPicker(asOf)
      .then((rows) => {
        if (!cancelled) setRates(rows);
      })
      .catch(() => {
        if (!cancelled) setRates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [asOf]);

  const chargeRates = useMemo(
    () =>
      rates.filter(
        (row) =>
          row.appliesTo === "CLIENT_CHARGE" && row.code !== TAX_RATE_CODE.PPN
      ),
    [rates]
  );
  const customRates = useMemo(
    () => chargeRates.filter((row) => isCustomTaxRateType(row)),
    [chargeRates]
  );
  const systemByCode = useMemo(() => {
    const map = new Map<string, TaxRatePickerRow>();
    for (const row of chargeRates) {
      if (!isCustomTaxRateType(row)) map.set(row.code, row);
    }
    return map;
  }, [chargeRates]);

  const pphOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const vatCombos: ProjectPphKind[] = ["PPH_23", "PPH_4_2"];
    const noVatKinds: ProjectPphKind[] = [
      "PPH_23",
      "PPH_4_2",
      "PPH_21",
      "PPH_22",
      "PPH_26",
    ];
    const kinds = chargeVat === "Yes" ? vatCombos : noVatKinds;
    for (const kind of kinds) {
      if (!systemByCode.has(kind)) continue;
      options.push({
        value: kind,
        label: t(
          kind === "PPH_4_2"
            ? "pages.billing.commercialTaxKindPph42"
            : kind === "PPH_23"
              ? "pages.billing.commercialTaxKindPph23"
              : kind === "PPH_21"
                ? "pages.billing.commercialTaxKindPph21"
                : kind === "PPH_22"
                  ? "pages.billing.commercialTaxKindPph22"
                  : "pages.billing.commercialTaxKindPph26"
        ),
      });
    }
    for (const row of customRates) {
      options.push({
        value: row.code,
        label: `${row.name} (${formatTaxRatePercent(row.ratePercent)})`,
      });
    }
    return options;
  }, [chargeVat, customRates, systemByCode, t]);

  const selectedRate = useMemo(() => {
    if (taxRateCode) {
      return chargeRates.find((row) => row.code === taxRateCode) ?? null;
    }
    if (isProjectPphKind(selectedPph)) {
      return systemByCode.get(selectedPph) ?? null;
    }
    return chargeRates.find((row) => row.code === selectedPph) ?? null;
  }, [chargeRates, selectedPph, systemByCode, taxRateCode]);

  function emit(
    nextVat: boolean,
    nextPph: boolean,
    nextKind: string
  ) {
    const custom = Boolean(
      nextKind && !isProjectPphKind(nextKind) && nextKind !== "OTHER"
    );
    const kind = chargedTaxKindFromVatPph({
      chargeVat: nextVat,
      chargePph: nextPph,
      pphKind: custom ? nextKind : nextKind,
    });
    onChange(kind);
    if (custom && nextPph) {
      const row = chargeRates.find((item) => item.code === nextKind);
      onTaxRateCodeChange?.(nextKind);
      onOtherTaxName?.(row?.name ?? "");
      onRatePrefill?.(row != null ? String(row.ratePercent) : "");
      return;
    }
    onTaxRateCodeChange?.("");
    if (kind !== "OTHER") onOtherTaxName?.("");
    const row = isProjectPphKind(nextKind)
      ? systemByCode.get(nextKind)
      : null;
    onRatePrefill?.(row != null ? String(row.ratePercent) : "");
  }

  return (
    <div className="space-y-4">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <input type="hidden" name={taxRateCodeName} value={taxRateCode} />
      <div className={employeeDialogFieldClass}>
        <p id={`${id}-vat`} className={employeeDialogLabelClass}>
          {t("pages.projects.chargeVat")}
          <span className="text-red-400"> *</span>
        </p>
        <YesNoChoiceCards
          id={`${id}-vat-choice`}
          labelledBy={`${id}-vat`}
          value={chargeVat}
          onChange={(next) =>
            emit(next === "Yes", chargePph === "Yes", selectedPph)
          }
        />
        <p className={employeeDialogHintClass}>
          {t("pages.projects.chargeVatHint")}
        </p>
      </div>
      <div className={employeeDialogFieldClass}>
        <p id={`${id}-pph`} className={employeeDialogLabelClass}>
          {t("pages.projects.chargePph")}
          <span className="text-red-400"> *</span>
        </p>
        <YesNoChoiceCards
          id={`${id}-pph-choice`}
          labelledBy={`${id}-pph`}
          value={chargePph}
          onChange={(next) =>
            emit(chargeVat === "Yes", next === "Yes", selectedPph)
          }
        />
        <p className={employeeDialogHintClass}>
          {t("pages.projects.chargePphHint")}
        </p>
      </div>
      {chargePph === "Yes" ? (
        <>
          <ProjectOptionPills
            label={t("pages.projects.pphKind")}
            value={selectedPph}
            options={
              pphOptions.length > 0
                ? pphOptions
                : [
                    {
                      value: "PPH_23",
                      label: t("pages.billing.commercialTaxKindPph23"),
                    },
                  ]
            }
            onChange={(next) => emit(chargeVat === "Yes", true, next)}
          />
          {selectedRate ? (
            <p className={employeeDialogHintClass}>
              {t("pages.taxRates.currentRate", {
                percent: formatTaxRatePercent(selectedRate.ratePercent),
              })}
            </p>
          ) : (
            <p className={employeeDialogHintClass}>
              {t("pages.taxRates.missing")}
            </p>
          )}
        </>
      ) : value === "PPN" ? (
        <p className={employeeDialogHintClass}>
          {t("pages.taxRates.followsTable")}
        </p>
      ) : null}
    </div>
  );
}
