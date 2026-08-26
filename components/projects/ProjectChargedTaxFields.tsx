"use client";

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
  defaultCommercialNonVatRatePercent,
  vatPphFromChargedTaxKind,
  type CommercialTaxKind,
  type ProjectPphKind,
} from "@/lib/commercial-tax";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  id: string;
  name?: string;
  value: CommercialTaxKind | "";
  onChange: (value: CommercialTaxKind | "") => void;
  onRatePrefill?: (rate: string) => void;
};

export default function ProjectChargedTaxFields({
  id,
  name,
  value,
  onChange,
  onRatePrefill,
}: Props) {
  const { t } = useT();
  const choices = vatPphFromChargedTaxKind(value || null);
  const chargeVat: YesNoChoice = choices.chargeVat ? "Yes" : "No";
  const chargePph: YesNoChoice = choices.chargePph ? "Yes" : "No";
  const pphOptions: { value: ProjectPphKind; label: string }[] =
    chargeVat === "Yes"
      ? [
          {
            value: "PPH_23",
            label: t("pages.billing.commercialTaxKindPph23"),
          },
          {
            value: "PPH_4_2",
            label: t("pages.billing.commercialTaxKindPph42"),
          },
        ]
      : [
          {
            value: "PPH_23",
            label: t("pages.billing.commercialTaxKindPph23"),
          },
          {
            value: "PPH_4_2",
            label: t("pages.billing.commercialTaxKindPph42"),
          },
          {
            value: "PPH_21",
            label: t("pages.billing.commercialTaxKindPph21"),
          },
          {
            value: "PPH_22",
            label: t("pages.billing.commercialTaxKindPph22"),
          },
        ];

  function emit(nextVat: boolean, nextPph: boolean, nextKind: ProjectPphKind) {
    const kind = chargedTaxKindFromVatPph({
      chargeVat: nextVat,
      chargePph: nextPph,
      pphKind: nextKind,
    });
    onChange(kind);
    if (kind) {
      const rate = defaultCommercialNonVatRatePercent(kind);
      onRatePrefill?.(rate != null ? String(rate) : "");
    } else {
      onRatePrefill?.("");
    }
  }

  return (
    <div className="space-y-4">
      {name ? <input type="hidden" name={name} value={value} /> : null}
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
            emit(next === "Yes", chargePph === "Yes", choices.pphKind)
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
            emit(chargeVat === "Yes", next === "Yes", choices.pphKind)
          }
        />
        <p className={employeeDialogHintClass}>
          {t("pages.projects.chargePphHint")}
        </p>
      </div>
      {chargePph === "Yes" ? (
        <ProjectOptionPills
          label={t("pages.projects.pphKind")}
          value={choices.pphKind}
          options={pphOptions}
          onChange={(next) =>
            emit(chargeVat === "Yes", true, next as ProjectPphKind)
          }
          columns={2}
        />
      ) : null}
    </div>
  );
}
