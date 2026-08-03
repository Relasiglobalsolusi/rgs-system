"use client";

import type { ReactNode } from "react";
import { CircleDollarSign, ExternalLink, FileText } from "lucide-react";

import type { InventorySoldOffRow } from "@/components/inventory/inventory-types";
import {
  EmployeeDialogShell,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import SectionCard from "@/components/ui/SectionCard";
import { formatDisplayDate } from "@/lib/format-date";
import { formatInventoryQtyWithUnit } from "@/lib/inventory";
import { INVENTORY_ITEM_TYPE_PRESETS } from "@/lib/inventory-sku";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { formatUserDisplayLabel } from "@/lib/user-display";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: InventorySoldOffRow | null;
};

const labelClass =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle";

function SoftPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-accent-cyan/30 bg-card-tint-cyan px-2.5 py-1 text-[11px] font-semibold tracking-wide text-accent-teal">
      {children}
    </span>
  );
}

function Meta({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className={labelClass}>{label}</dt>
      <dd className="mt-1 text-sm font-medium text-text">{value}</dd>
    </div>
  );
}

function MoneyStat({
  label,
  value,
  emphasize,
  tone,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  tone?: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3 sm:px-5">
      <p className={labelClass}>{label}</p>
      <p
        className={cn(
          "mt-1 tabular-nums tracking-tight",
          emphasize ? "text-lg font-bold sm:text-xl" : "text-sm font-semibold",
          tone ?? "text-text"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DocChip({
  label,
  url,
  viewLabel,
}: {
  label: string;
  url: string;
  viewLabel: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        buttonVariants({ variant: "infoBadge", size: "badgeFlex" }),
        "gap-1.5"
      )}
    >
      <FileText className="h-3.5 w-3.5" aria-hidden />
      {label}
      <span className="opacity-70">· {viewLabel}</span>
      <ExternalLink className="h-3 w-3 opacity-70" />
    </a>
  );
}

export default function InventorySoldOffDetailDialog({
  open,
  onOpenChange,
  row,
}: Props) {
  const { t } = useT();

  if (!row) {
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }

  const isCompany = row.buyerType === "COMPANY";
  const isIndividual = row.buyerType === "INDIVIDUAL";

  const buyerTypeLabel = isCompany
    ? t("pages.inventory.form.buyerTypeCompany")
    : isIndividual
      ? t("pages.inventory.form.buyerTypeIndividual")
      : null;

  const soldByLabel = formatUserDisplayLabel(row.createdBy);
  const notes = row.notes?.trim() || null;
  const buyerName = row.buyer?.trim() || null;
  const buyerPicName = row.buyerPicName?.trim() || null;
  const buyerPhone = row.buyerPhone?.trim() || null;
  const buyerTaxId = row.buyerTaxId?.trim() || null;
  const buyerIdNumber = row.buyerIdNumber?.trim() || null;
  const linkedClient =
    row.clientId && row.clientName?.trim() ? row.clientName.trim() : null;
  const invoiceUrl = row.invoiceUrl?.trim() || null;
  const taxInvoiceUrl = row.buyerIdentityDocUrl?.trim() || null;

  const hasBuyerFacts = Boolean(
    buyerTypeLabel ||
      buyerName ||
      buyerPicName ||
      buyerPhone ||
      buyerTaxId ||
      buyerIdNumber ||
      linkedClient
  );

  const docs: { label: string; url: string; viewLabel: string }[] = [];
  if (invoiceUrl) {
    docs.push({
      label: t("pages.inventory.columns.saleInvoice"),
      url: invoiceUrl,
      viewLabel: t("pages.inventory.viewSaleInvoice"),
    });
  }
  if (taxInvoiceUrl && (isCompany || !isIndividual)) {
    docs.push({
      label: t("pages.inventory.saleDetailsTaxInvoice"),
      url: taxInvoiceUrl,
      viewLabel: t("pages.inventory.viewBuyerIdentityDoc"),
    });
  }

  const itemTypeRaw = row.item?.itemType?.trim() || "";
  const itemTypeLabel = itemTypeRaw
    ? INVENTORY_ITEM_TYPE_PRESETS.includes(
        itemTypeRaw as (typeof INVENTORY_ITEM_TYPE_PRESETS)[number]
      )
      ? t(`pages.inventory.itemTypes.${itemTypeRaw}`)
      : itemTypeRaw
    : null;

  const assetCodes =
    row.assets.length > 0
      ? row.assets.map((a) => a.assetCode).join(", ")
      : null;

  const gainLossTone =
    row.gainLoss > 0
      ? "text-primary-dark"
      : row.gainLoss < 0
        ? "text-danger"
        : "text-text";
  const gainTint =
    row.gainLoss > 0
      ? "bg-card-tint-emerald/70"
      : row.gainLoss < 0
        ? "bg-card-tint-red/70"
        : "bg-elevated/50";

  const nameLabel = isCompany
    ? t("pages.inventory.form.companyName")
    : t("pages.inventory.form.buyer");
  const taxIdLabel = isIndividual
    ? t("pages.inventory.form.buyerTaxIdIndividual")
    : t("pages.inventory.form.buyerTaxId");

  // Only show fields that apply for the buyer type; omit empties to avoid
  // a wall of "Tidak tersedia" on legacy rows.
  const buyerFields: { label: string; value: ReactNode }[] = [];
  if (hasBuyerFacts) {
    // Buyer type is shown as a badge in the section header.
    if (buyerName) {
      buyerFields.push({ label: nameLabel, value: buyerName });
    }
    if (isCompany && buyerPicName) {
      buyerFields.push({
        label: t("pages.inventory.form.buyerPicName"),
        value: buyerPicName,
      });
    }
    if (buyerPhone) {
      buyerFields.push({
        label: t("pages.inventory.form.buyerPhone"),
        value: buyerPhone,
      });
    }
    if (buyerTaxId) {
      buyerFields.push({ label: taxIdLabel, value: buyerTaxId });
    }
    if (!isCompany && buyerIdNumber) {
      buyerFields.push({
        label: t("pages.inventory.form.buyerIdNumber"),
        value: buyerIdNumber,
      });
    }
    if (linkedClient) {
      buyerFields.push({
        label: t("pages.inventory.saleDetailsLinkedClient"),
        value: (
          <a
            href="/clients"
            className="text-primary underline-offset-2 hover:underline"
          >
            {linkedClient}
          </a>
        ),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={CircleDollarSign}
        title={t("pages.inventory.saleDetailsTitle")}
        description={t("pages.inventory.saleDetailsDesc")}
        maxWidth="lg"
        footer={
          <EmployeeSecondaryButton onClick={() => onOpenChange(false)}>
            {t("common.actions.close")}
          </EmployeeSecondaryButton>
        }
      >
        <div className="space-y-3">
          {/* Hero */}
          <SectionCard className="overflow-hidden p-0">
            <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold tracking-tight text-text">
                    {row.item?.name ?? "—"}
                  </h3>
                  {itemTypeLabel ? <SoftPill>{itemTypeLabel}</SoftPill> : null}
                </div>
                <p className="mt-1.5 text-sm text-subtle">
                  <span className="font-medium text-muted">
                    {row.item?.sku ?? "—"}
                  </span>
                  <span className="mx-1.5 text-border-strong">·</span>
                  {formatInventoryQtyWithUnit(
                    row.quantity,
                    row.item?.unit ?? "pcs"
                  )}
                  {assetCodes ? (
                    <>
                      <span className="mx-1.5 text-border-strong">·</span>
                      <span className="font-medium text-text">{assetCodes}</span>
                    </>
                  ) : null}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {formatDisplayDate(row.soldAt)}
                  {soldByLabel ? (
                    <>
                      <span className="mx-1.5 text-border-strong">·</span>
                      {soldByLabel}
                    </>
                  ) : null}
                </p>
              </div>
              <div
                className={cn(
                  "shrink-0 rounded-xl px-4 py-3 text-right ring-1 ring-border/60",
                  gainTint
                )}
              >
                <p className={labelClass}>
                  {t("pages.inventory.columns.gainLoss")}
                </p>
                <p
                  className={cn(
                    "mt-1 text-2xl font-bold tabular-nums tracking-tight",
                    gainLossTone
                  )}
                >
                  {formatContractPrice(row.gainLoss)}
                </p>
              </div>
            </div>

            {/* Financial strip — full width, balanced */}
            <div className="grid grid-cols-2 border-t border-border sm:grid-cols-3 lg:grid-cols-5">
              <div className="border-b border-border sm:border-b-0 sm:border-r lg:border-b-0">
                <MoneyStat
                  label={t("pages.inventory.columns.saleTotal")}
                  value={formatContractPrice(row.totalPrice)}
                  emphasize
                />
              </div>
              <div className="border-b border-l border-border sm:border-b-0 sm:border-r lg:border-b-0">
                <MoneyStat
                  label={t("pages.inventory.columns.saleSubtotal")}
                  value={formatContractPrice(row.subtotal)}
                />
              </div>
              <div className="border-b border-border sm:border-b-0 sm:border-r lg:border-b-0 lg:border-r">
                <MoneyStat
                  label={t("pages.inventory.columns.costBasis")}
                  value={formatContractPrice(row.costBasis)}
                />
              </div>
              <div className="border-l border-border sm:border-l-0 lg:border-r">
                <MoneyStat
                  label={t("pages.inventory.form.taxRate")}
                  value={
                    row.taxRatePercent != null
                      ? `${row.taxRatePercent}%`
                      : "—"
                  }
                />
              </div>
              <div className="col-span-2 border-t border-border sm:col-span-3 lg:col-span-1 lg:border-t-0">
                <MoneyStat
                  label={t("pages.inventory.form.saleTaxAmount")}
                  value={formatContractPrice(row.taxAmount)}
                />
              </div>
            </div>
            <p className="border-t border-border px-4 py-2 text-[11px] leading-4 text-muted sm:px-5">
              {t("pages.inventory.saleDetailsExTaxHint")}{" "}
              {t("pages.inventory.saleDetailsGainLossHint")}
            </p>
          </SectionCard>

          {/* Buyer + docs */}
          <SectionCard className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-text">
                {t("pages.inventory.columns.buyer")}
              </h4>
              {buyerTypeLabel ? <SoftPill>{buyerTypeLabel}</SoftPill> : null}
            </div>

            {buyerFields.length > 0 ? (
              <dl
                className={cn(
                  "grid gap-x-6 gap-y-3.5",
                  buyerFields.length === 1
                    ? "grid-cols-1"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                )}
              >
                {buyerFields.map((field) => (
                  <Meta
                    key={field.label}
                    label={field.label}
                    value={field.value}
                  />
                ))}
              </dl>
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-elevated/30 px-4 py-3 text-sm leading-relaxed text-muted">
                {t("pages.inventory.saleDetailsBuyerEmpty")}
              </p>
            )}

            <div className="space-y-2 border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-text">
                {t("pages.inventory.saleDetailsDocuments")}
              </h4>
              {docs.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {docs.map((doc) => (
                    <DocChip
                      key={doc.url}
                      label={doc.label}
                      url={doc.url}
                      viewLabel={doc.viewLabel}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {t("pages.inventory.saleDetailsDocsEmpty")}
                </p>
              )}
            </div>
          </SectionCard>

          {notes ? (
            <SectionCard className="px-4 py-3.5 sm:px-5">
              <p className={labelClass}>
                {t("pages.inventory.columns.notes")}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-text">
                {notes}
              </p>
            </SectionCard>
          ) : null}
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
