"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateProjectContractPrice } from "@/app/projects/invoice-actions";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { flexibleBadgeChipClassName } from "@/components/ui/trash-action-buttons";
import {
  exclusivePricePlusChargedTax,
  type CommercialTaxKind,
} from "@/lib/commercial-tax";
import { formatContractPrice, parseContractPrice } from "@/lib/project-billing";
import { useT } from "@/lib/i18n/use-t";
import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";

function priceToInput(value: number | null): string {
  if (value == null) return "";
  return String(Math.round(value));
}

export default function ContractPriceEditor({
  projectId,
  contractPrice,
  chargedTaxKind = null,
  requiresTaxInvoice = null,
  pphRatePercent = null,
  canManage,
  milestone = false,
}: {
  projectId: string;
  contractPrice: number | null;
  chargedTaxKind?: CommercialTaxKind | "" | null;
  requiresTaxInvoice?: boolean | null;
  pphRatePercent?: number | null;
  canManage: boolean;
  milestone?: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [priceInput, setPriceInput] = useState(priceToInput(contractPrice));

  useEffect(() => {
    setPriceInput(priceToInput(contractPrice));
  }, [contractPrice]);

  const typed = parseContractPrice(priceInput) ?? contractPrice;
  const billed =
    typed != null && typed > 0
      ? exclusivePricePlusChargedTax({
          exclusiveAmount: typed,
          chargedTaxKind,
          requiresTaxInvoice,
          pphRatePercent,
        })
      : null;

  function save() {
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("contractPrice", priceInput);
    startTransition(async () => {
      try {
        await updateProjectContractPrice(formData);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.billing.saveContractPriceFailed"));
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-elevated px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-subtle">
        {t("pages.billing.invoiceAndBilling")}
      </p>
      <p className="mt-1 text-sm font-semibold text-text">
        {t("pages.billing.contractPrice")}
      </p>
      <p className="text-xs font-medium text-subtle">
        {t("pages.billing.priceExcludeTax")}
      </p>
      {canManage ? (
        <div className="mt-2 space-y-2">
          <MoneyInput
            value={priceInput}
            onValueChange={setPriceInput}
            placeholder={t("pages.billing.amountExampleLarge")}
            className="h-9 border-border bg-elevated text-text"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="badge"
              variant="successBadge"
              className={flexibleBadgeChipClassName}
              disabled={pending || !priceInput.trim()}
              onClick={save}
            >
              {pending
                ? t("common.actions.saving")
                : contractPrice == null
                  ? t("common.actions.save")
                  : t("common.actions.update")}
            </Button>
            {contractPrice != null ? (
              <p className="text-xs text-subtle">
                {t("pages.billing.savedPrice", {
                  price: formatContractPrice(contractPrice),
                })}
              </p>
            ) : null}
          </div>
          {billed && billed.taxAmount > 0 ? (
            <p className="text-xs font-medium text-text">
              {t("pages.billing.invoiceTotalWithTax", {
                amount: formatContractPrice(billed.gross),
              })}
            </p>
          ) : null}
          <p className="text-xs text-subtle">
            {milestone
              ? t("pages.billing.contractPriceMilestoneHint")
              : t("pages.billing.contractPriceMonthlyHint")}
          </p>
        </div>
      ) : (
        <p className="mt-1 text-lg font-semibold text-text">
          {formatContractPrice(contractPrice)}
        </p>
      )}
    </div>
  );
}
