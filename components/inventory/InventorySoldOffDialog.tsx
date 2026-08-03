"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CircleDollarSign } from "lucide-react";
import { toast } from "sonner";

import {
  createInventorySoldOff,
  searchInventorySaleClients,
} from "@/app/inventory/actions";
import type {
  InventoryCatalogItem,
  InventoryOverviewAssetRow,
  InventorySaleClientOption,
} from "@/components/inventory/inventory-types";
import {
  formatCatalogItemLabel,
  formatCatalogItemStockLabel,
} from "@/components/inventory/inventory-select-labels";
import { matchInventoryItemType } from "@/components/inventory/inventory-category";
import {
  captureHtmlFormBaseline,
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  EmployeeUnsavedExitDialog,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogGridClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
  handleEmployeeDialogOpenChange,
  useHtmlFormDirty,
  type HtmlFormDirtyBaseline,
} from "@/components/employees/employee-dialog-ui";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import { formatDateForInput } from "@/lib/format-tenure";
import { formatContractPrice } from "@/lib/project-billing";
import {
  formatInventoryQty,
  isWholeInventoryQty,
} from "@/lib/inventory";
import { isValidNpwp } from "@/lib/npwp";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SOLD_OFF_PPN_RATE_PERCENT,
  applyExclusiveVat,
  parsePpnRatePercent,
  ppnRateFromPercent,
} from "@/lib/vat";

const FORM_ID = "create-inventory-sold-off-form";

type BuyerType = "INDIVIDUAL" | "COMPANY";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryCatalogItem[];
  equipmentAssets: InventoryOverviewAssetRow[];
};

export default function InventorySoldOffDialog({
  open,
  onOpenChange,
  items,
  equipmentAssets,
}: Props) {
  const { t } = useT();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [buyerType, setBuyerType] = useState<BuyerType | "">("");
  const [buyer, setBuyer] = useState("");
  const [buyerPicName, setBuyerPicName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerTaxId, setBuyerTaxId] = useState("");
  const [buyerIdNumber, setBuyerIdNumber] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState(
    String(DEFAULT_SOLD_OFF_PPN_RATE_PERCENT)
  );
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientOptions, setClientOptions] = useState<
    InventorySaleClientOption[]
  >([]);
  const [clientsPending, startClientsTransition] = useTransition();
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const stockedItems = useMemo(
    () => items.filter((item) => item.active && item.currentStock > 0),
    [items]
  );

  const filteredItems = useMemo(() => {
    const typeLabel = (itemType: string) => {
      switch (itemType.trim().toLowerCase()) {
        case "equipment":
          return t("pages.inventory.itemTypes.Equipment");
        case "chemical":
          return t("pages.inventory.itemTypes.Chemical");
        case "consumable":
          return t("pages.inventory.itemTypes.Consumable");
        case "other":
          return t("pages.inventory.itemTypes.Other");
        default:
          return itemType;
      }
    };
    return stockedItems.filter((item) =>
      matchesDirectorySearch(
        itemSearch,
        item.name,
        item.sku,
        item.itemType,
        typeLabel(item.itemType)
      )
    );
  }, [stockedItems, itemSearch, t]);

  const selected = stockedItems.find((item) => item.id === itemId);
  const isEquipmentSelected = Boolean(
    selected && matchInventoryItemType(selected.itemType, "equipment")
  );

  const availableAssets = useMemo(
    () =>
      equipmentAssets.filter(
        (asset) =>
          asset.item?.id === itemId && asset.status === "AVAILABLE"
      ),
    [equipmentAssets, itemId]
  );

  const qtyNumber = Number(String(quantity).replace(/,/g, "").trim());
  const priceNumber = Number(String(unitPrice).replace(/,/g, "").trim());
  const parsedTaxRate = parsePpnRatePercent(taxRatePercent);
  const saleSubtotal =
    Number.isFinite(qtyNumber) &&
    qtyNumber > 0 &&
    Number.isFinite(priceNumber) &&
    priceNumber >= 0
      ? qtyNumber * priceNumber
      : null;
  const vatPreview =
    saleSubtotal != null && parsedTaxRate != null && parsedTaxRate > 0
      ? applyExclusiveVat(saleSubtotal, ppnRateFromPercent(parsedTaxRate))
      : null;

  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    FORM_ID,
    "",
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function resetFormState() {
    setItemId("");
    setItemSearch("");
    setQuantity("");
    setUnitPrice("");
    setBuyerType("");
    setBuyer("");
    setBuyerPicName("");
    setBuyerPhone("");
    setBuyerTaxId("");
    setBuyerIdNumber("");
    setTaxRatePercent(String(DEFAULT_SOLD_OFF_PPN_RATE_PERCENT));
    setClientId("");
    setClientSearch("");
    setClientOptions([]);
    setSelectedAssetIds([]);
  }

  function closeDialog() {
    onOpenChange(false);
    resetDirtyTracking();
    setBaseline(null);
    resetFormState();
  }

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails?: { cancel: () => void }
  ) {
    handleEmployeeDialogOpenChange(nextOpen, eventDetails, {
      isDirty: isDirtyRef.current,
      onOpen: () => {
        onOpenChange(true);
        resetDirtyTracking();
        resetFormState();
      },
      onClose: closeDialog,
      onRequestExitConfirm: () => setExitConfirmOpen(true),
    });
  }

  useEffect(() => {
    if (!open) {
      setBaseline(null);
      return;
    }
    const frame = requestAnimationFrame(() => {
      setBaseline(captureHtmlFormBaseline(FORM_ID, ""));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setSelectedAssetIds([]);
    setQuantity("");
  }, [itemId]);

  useEffect(() => {
    if (!open || (buyerType !== "INDIVIDUAL" && buyerType !== "COMPANY")) {
      setClientOptions([]);
      return;
    }
    const trimmed = clientSearch.trim();
    const handle = window.setTimeout(() => {
      startClientsTransition(async () => {
        try {
          const rows = await searchInventorySaleClients(trimmed, buyerType);
          setClientOptions(rows);
        } catch {
          setClientOptions([]);
        }
      });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [clientSearch, open, buyerType]);

  function handleBuyerTypeChange(next: BuyerType) {
    if (next === buyerType) return;
    const hadLinkedClient = Boolean(clientId);
    setBuyerType(next);
    setClientId("");
    setClientSearch("");
    setClientOptions([]);
    setBuyerTaxId("");
    setBuyerIdNumber("");
    setBuyerPicName("");
    if (hadLinkedClient) {
      setBuyer("");
      setBuyerPhone("");
    }
  }

  function applyClient(client: InventorySaleClientOption | null) {
    if (!client) {
      setClientId("");
      return;
    }
    if (
      buyerType !== "INDIVIDUAL" &&
      buyerType !== "COMPANY"
    ) {
      return;
    }
    if (client.clientType !== buyerType) {
      return;
    }
    setClientId(client.id);
    setBuyer(client.name);
    setBuyerPicName(client.contactPersonName ?? "");
    setBuyerPhone(
      client.contactPersonPhone?.trim() || client.phone?.trim() || ""
    );
    setBuyerTaxId(client.npwp ?? "");
    setBuyerIdNumber("");
  }

  function toggleAsset(assetId: string, checked: boolean) {
    setSelectedAssetIds((prev) => {
      const next = checked
        ? prev.includes(assetId)
          ? prev
          : [...prev, assetId]
        : prev.filter((id) => id !== assetId);
      setQuantity(next.length > 0 ? String(next.length) : "");
      return next;
    });
  }

  async function submit(formData: FormData) {
    if (!itemId) {
      showRejection({ reasons: t("pages.inventory.itemRequired") });
      return;
    }
    if (stockedItems.length === 0) {
      showRejection({ reasons: t("pages.inventory.noStockToIssue") });
      return;
    }
    if (buyerType !== "INDIVIDUAL" && buyerType !== "COMPANY") {
      showRejection({ reasons: t("pages.inventory.buyerTypeRequired") });
      return;
    }
    if (!buyer.trim()) {
      showRejection({
        reasons:
          buyerType === "COMPANY"
            ? t("pages.inventory.companyNameRequired")
            : t("pages.inventory.buyerNameRequired"),
      });
      return;
    }
    if (buyerType === "COMPANY" && !buyerPicName.trim()) {
      showRejection({ reasons: t("pages.inventory.buyerPicNameRequired") });
      return;
    }
    if (!buyerPhone.trim()) {
      showRejection({ reasons: t("pages.inventory.buyerPhoneRequired") });
      return;
    }
    if (buyerType === "COMPANY") {
      if (!buyerTaxId.trim()) {
        showRejection({ reasons: t("pages.inventory.buyerTaxIdRequired") });
        return;
      }
      if (!isValidNpwp(buyerTaxId)) {
        showRejection({ reasons: t("validation.npwpInvalid") });
        return;
      }
      // Tax invoice (Faktur Pajak) is only required for company buyers —
      // individuals cannot legally be issued one.
      const taxDoc = formData.get("buyerIdentityDoc");
      if (!(taxDoc instanceof File) || taxDoc.size === 0) {
        showRejection({
          reasons: t("pages.inventory.buyerIdentityDocRequired"),
        });
        return;
      }
    } else {
      // INDIVIDUAL — at least one of Tax ID (NPWP) or National ID (KTP) is required.
      if (!buyerTaxId.trim() && !buyerIdNumber.trim()) {
        showRejection({ reasons: t("validation.npwpOrNikRequired") });
        return;
      }
      if (buyerTaxId.trim() && !isValidNpwp(buyerTaxId)) {
        showRejection({ reasons: t("validation.npwpOrNikInvalid") });
        return;
      }
      if (buyerIdNumber.trim() && !isValidNpwp(buyerIdNumber)) {
        showRejection({ reasons: t("validation.npwpOrNikInvalid") });
        return;
      }
    }
    if (parsedTaxRate == null || parsedTaxRate <= 0) {
      showRejection({ reasons: t("pages.inventory.taxRateRequired") });
      return;
    }
    const qty = Number(
      String(formData.get("quantity") ?? "").replace(/,/g, "").trim()
    );
    if (!Number.isFinite(qty) || qty <= 0) {
      showRejection({
        reasons: t("pages.inventory.quantityMustBePositive", {
          field: t("pages.inventory.form.quantity"),
        }),
      });
      return;
    }
    if (!isWholeInventoryQty(qty)) {
      showRejection({
        reasons: t("pages.inventory.quantityMustBeWhole", {
          field: t("pages.inventory.form.quantity"),
        }),
      });
      return;
    }
    if (selected && qty > selected.currentStock) {
      showRejection({
        reasons: t("pages.inventory.quantityExceedsStock", {
          available: formatInventoryQty(selected.currentStock),
          unit: selected.unit,
        }),
      });
      return;
    }
    const price = Number(
      String(formData.get("unitPrice") ?? "").replace(/,/g, "").trim()
    );
    if (!Number.isFinite(price) || price < 0) {
      showRejection({
        reasons: t("pages.inventory.quantityMustBeNonNegative", {
          field: t("pages.inventory.form.saleUnitPrice"),
        }),
      });
      return;
    }
    const invoice = formData.get("invoice");
    if (!(invoice instanceof File) || invoice.size === 0) {
      showRejection({ reasons: t("pages.inventory.saleInvoiceRequired") });
      return;
    }
    if (isEquipmentSelected && selectedAssetIds.length > 0) {
      if (selectedAssetIds.length !== qty) {
        showRejection({
          reasons: t("pages.inventory.soldOffAssetQtyMismatch"),
        });
        return;
      }
    }

    formData.set("itemId", itemId);
    formData.set("buyerType", buyerType);
    formData.set("buyer", buyer.trim());
    formData.set(
      "buyerPicName",
      buyerType === "COMPANY" ? buyerPicName.trim() : ""
    );
    formData.set("buyerPhone", buyerPhone.trim());
    formData.set("buyerTaxId", buyerTaxId.trim());
    formData.set("buyerIdNumber", buyerIdNumber.trim());
    formData.set("taxRatePercent", taxRatePercent.trim());
    formData.set("clientId", clientId);
    formData.delete("assetIds");
    for (const assetId of selectedAssetIds) {
      formData.append("assetIds", assetId);
    }

    startTransition(async () => {
      try {
        await createInventorySoldOff(formData);
        toast.success(t("pages.inventory.soldOffCreated"));
        closeDialog();
      } catch (error) {
        showRejectionFromError(error, t("pages.inventory.createSoldOffFailed"));
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <EmployeeDialogShell
          icon={CircleDollarSign}
          title={t("pages.inventory.addSoldOff")}
          description={t("pages.inventory.addSoldOffDesc")}
          maxWidth="lg"
          footer={
            <>
              <EmployeeSecondaryButton
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                {t("common.actions.cancel")}
              </EmployeeSecondaryButton>
              <EmployeePrimaryButton
                type="submit"
                form={FORM_ID}
                disabled={pending || stockedItems.length === 0}
              >
                {pending
                  ? t("common.actions.saving")
                  : t("pages.inventory.saveSoldOff")}
              </EmployeePrimaryButton>
            </>
          }
        >
          <form
            id={FORM_ID}
            className={employeeDialogFormClass}
            action={submit}
            onInput={handleFormInput}
          >
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.inventory.form.catalogItem")}
              </label>
              <DirectorySearchInput
                value={itemSearch}
                onChange={setItemSearch}
                placeholder={t(
                  "pages.inventory.form.catalogItemSearchPlaceholder"
                )}
                className="max-w-none"
              />
              <Select
                value={itemId || undefined}
                onValueChange={(value) => setItemId(value ?? "")}
                items={filteredItems.map((item) => ({
                  value: item.id,
                  label: formatCatalogItemLabel(item),
                }))}
              >
                <SelectTrigger className={employeeSelectTriggerClass}>
                  <SelectValue
                    placeholder={t("pages.inventory.form.catalogItemPlaceholder")}
                  >
                    {(value) => {
                      if (!value) return null;
                      const item = stockedItems.find((entry) => entry.id === value);
                      return item ? formatCatalogItemLabel(item) : null;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {filteredItems.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-subtle">
                      {itemSearch.trim()
                        ? t("pages.inventory.form.catalogItemNoSearchMatch")
                        : t("pages.inventory.noStockToIssue")}
                    </div>
                  ) : (
                    filteredItems.map((item) => (
                      <SelectItem
                        key={item.id}
                        value={item.id}
                        label={formatCatalogItemLabel(item)}
                      >
                        {formatCatalogItemStockLabel(item)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selected ? (
                <p className={employeeDialogHintClass}>
                  {t("pages.inventory.form.soldOffItemHint", {
                    available: formatInventoryQty(selected.currentStock),
                    unit: selected.unit,
                  })}
                </p>
              ) : (
                <p className={employeeDialogHintClass}>
                  {t("pages.inventory.form.issueItemHint")}
                </p>
              )}
            </div>

            {isEquipmentSelected ? (
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.inventory.form.soldOffAssets")}
                </label>
                {availableAssets.length === 0 ? (
                  <p className={employeeDialogHintClass}>
                    {t("pages.inventory.form.soldOffNoAssets")}
                  </p>
                ) : (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-elevated p-2">
                    {availableAssets.map((asset) => {
                      const checked = selectedAssetIds.includes(asset.id);
                      return (
                        <label
                          key={asset.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text hover:bg-panel"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) =>
                              toggleAsset(asset.id, next)
                            }
                            aria-label={asset.assetCode}
                          />
                          <span className="font-medium">{asset.assetCode}</span>
                          {asset.serialNo ? (
                            <span className="text-xs text-subtle">
                              {asset.serialNo}
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className={employeeDialogHintClass}>
                  {t("pages.inventory.form.soldOffAssetsHint")}
                </p>
              </div>
            ) : null}

            <div className={employeeDialogGridClass}>
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass} htmlFor="soldoff-qty">
                  {t("pages.inventory.form.quantity")}
                </label>
                <input
                  id="soldoff-qty"
                  name="quantity"
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={quantity}
                  onChange={(event) => {
                    setQuantity(event.target.value);
                    if (isEquipmentSelected && selectedAssetIds.length > 0) {
                      setSelectedAssetIds([]);
                    }
                  }}
                  max={selected?.currentStock}
                  className={employeeInputClass}
                />
              </div>
              <div className={employeeDialogFieldClass}>
                <label
                  className={employeeDialogLabelClass}
                  htmlFor="soldoff-date"
                >
                  {t("pages.inventory.form.saleDate")}
                </label>
                <input
                  id="soldoff-date"
                  name="soldAt"
                  type="date"
                  required
                  defaultValue={formatDateForInput(new Date())}
                  className={employeeInputClass}
                />
              </div>
            </div>

            <div className={employeeDialogGridClass}>
              <div className={employeeDialogFieldClass}>
                <label
                  className={employeeDialogLabelClass}
                  htmlFor="soldoff-unit-price"
                >
                  {t("pages.inventory.form.saleUnitPrice")}
                  <span className="text-danger"> *</span>
                </label>
                <input
                  id="soldoff-unit-price"
                  name="unitPrice"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                  className={employeeInputClass}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.inventory.form.saleUnitPriceExTaxHint")}
                </p>
              </div>
              <div className={employeeDialogFieldClass}>
                <label
                  className={employeeDialogLabelClass}
                  htmlFor="soldoff-tax-rate"
                >
                  {t("pages.inventory.form.taxRate")}
                  <span className="text-danger"> *</span>
                </label>
                <input
                  id="soldoff-tax-rate"
                  name="taxRatePercent"
                  type="number"
                  min={0.01}
                  max={100}
                  step="0.01"
                  required
                  value={taxRatePercent}
                  onChange={(event) => setTaxRatePercent(event.target.value)}
                  placeholder={t("pages.inventory.form.taxRatePlaceholder")}
                  className={employeeInputClass}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.inventory.form.taxRateHint")}
                </p>
              </div>
            </div>

            <div className={employeeDialogGridClass}>
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.inventory.form.saleSubtotal")}
                </label>
                <p className="rounded-xl border border-border bg-elevated px-3 py-2.5 text-sm font-medium text-text">
                  {saleSubtotal != null
                    ? formatContractPrice(saleSubtotal)
                    : "—"}
                </p>
              </div>
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.inventory.form.saleTaxAmount")}
                </label>
                <p className="rounded-xl border border-border bg-elevated px-3 py-2.5 text-sm font-medium text-text">
                  {vatPreview ? formatContractPrice(vatPreview.ppn) : "—"}
                </p>
              </div>
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.inventory.form.saleTotal")}
                </label>
                <p className="rounded-xl border border-border bg-elevated px-3 py-2.5 text-sm font-medium text-text">
                  {vatPreview ? formatContractPrice(vatPreview.gross) : "—"}
                </p>
                {vatPreview ? (
                  <p className={employeeDialogHintClass}>
                    {t("pages.inventory.form.saleVatExclusivePreview", {
                      dpp: formatContractPrice(vatPreview.dpp),
                      tax: formatContractPrice(vatPreview.ppn),
                      total: formatContractPrice(vatPreview.gross),
                      rate: String(parsedTaxRate),
                    })}
                  </p>
                ) : null}
              </div>
            </div>

            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.inventory.form.buyerType")}
                <span className="text-danger"> *</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["INDIVIDUAL", t("pages.inventory.form.buyerTypeIndividual")],
                    ["COMPANY", t("pages.inventory.form.buyerTypeCompany")],
                  ] as const
                ).map(([value, label]) => {
                  const active = buyerType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={pending}
                      onClick={() => handleBuyerTypeChange(value)}
                      className={cn(
                        "inline-flex min-h-9 items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold tracking-wide transition",
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
              <p className={employeeDialogHintClass}>
                {t("pages.inventory.form.buyerTypeHint")}
              </p>
              <input type="hidden" name="buyerType" value={buyerType} />
            </div>

            {buyerType !== "INDIVIDUAL" && buyerType !== "COMPANY" ? (
              <p className="rounded-xl border border-dashed border-border bg-elevated/40 px-4 py-3 text-sm text-muted">
                {t("pages.inventory.form.buyerTypeHint")}
              </p>
            ) : null}

            {buyerType === "INDIVIDUAL" || buyerType === "COMPANY" ? (
              <>
                <div className={employeeDialogFieldClass}>
                  <label className={employeeDialogLabelClass}>
                    {t("pages.inventory.form.linkClient")}
                  </label>
                  <DirectorySearchInput
                    value={clientSearch}
                    onChange={setClientSearch}
                    placeholder={t(
                      "pages.inventory.form.clientSearchPlaceholder"
                    )}
                    className="max-w-none"
                  />
                  <Select
                    value={clientId || undefined}
                    onValueChange={(value) => {
                      const nextId = value ?? "";
                      const client =
                        clientOptions.find((entry) => entry.id === nextId) ??
                        null;
                      applyClient(client);
                    }}
                    items={clientOptions.map((client) => ({
                      value: client.id,
                      label: `${client.name} (${client.shortCode})`,
                    }))}
                  >
                    <SelectTrigger className={employeeSelectTriggerClass}>
                      <SelectValue
                        placeholder={t(
                          "pages.inventory.form.clientOptionalPlaceholder"
                        )}
                      >
                        {(value) => {
                          if (!value) return null;
                          const client = clientOptions.find(
                            (entry) => entry.id === value
                          );
                          return client
                            ? `${client.name} (${client.shortCode})`
                            : null;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {clientOptions.length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-subtle">
                          {clientsPending
                            ? t("common.actions.loading")
                            : t("pages.inventory.form.clientNoSearchMatch")}
                        </div>
                      ) : (
                        clientOptions.map((client) => (
                          <SelectItem
                            key={client.id}
                            value={client.id}
                            label={`${client.name} (${client.shortCode})`}
                          >
                            {client.name} ({client.shortCode})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className={employeeDialogHintClass}>
                    {buyerType === "COMPANY"
                      ? t("pages.inventory.form.linkClientHintCompany")
                      : t("pages.inventory.form.linkClientHintIndividual")}
                  </p>
                  {clientId ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => applyClient(null)}
                    >
                      {t("pages.inventory.form.clearLinkedClient")}
                    </button>
                  ) : null}
                </div>

                {buyerType === "COMPANY" ? (
                  <>
                    <div className={employeeDialogFieldClass}>
                      <label
                        className={employeeDialogLabelClass}
                        htmlFor="soldoff-buyer"
                      >
                        {t("pages.inventory.form.companyName")}
                        <span className="text-danger"> *</span>
                      </label>
                      <input
                        id="soldoff-buyer"
                        name="buyer"
                        type="text"
                        required
                        value={buyer}
                        onChange={(event) => setBuyer(event.target.value)}
                        placeholder={t(
                          "pages.inventory.form.companyNamePlaceholder"
                        )}
                        className={employeeInputClass}
                      />
                      <p className={employeeDialogHintClass}>
                        {t("pages.inventory.form.companyNameHint")}
                      </p>
                    </div>
                    <div className={employeeDialogGridClass}>
                      <div className={employeeDialogFieldClass}>
                        <label
                          className={employeeDialogLabelClass}
                          htmlFor="soldoff-buyer-pic"
                        >
                          {t("pages.inventory.form.buyerPicName")}
                          <span className="text-danger"> *</span>
                        </label>
                        <input
                          id="soldoff-buyer-pic"
                          name="buyerPicName"
                          type="text"
                          required
                          value={buyerPicName}
                          onChange={(event) =>
                            setBuyerPicName(event.target.value)
                          }
                          placeholder={t(
                            "pages.inventory.form.buyerPicNamePlaceholder"
                          )}
                          className={employeeInputClass}
                        />
                        <p className={employeeDialogHintClass}>
                          {t("pages.inventory.form.buyerPicNameHint")}
                        </p>
                      </div>
                      <div className={employeeDialogFieldClass}>
                        <label
                          className={employeeDialogLabelClass}
                          htmlFor="soldoff-buyer-phone"
                        >
                          {t("pages.inventory.form.buyerPhone")}
                          <span className="text-danger"> *</span>
                        </label>
                        <input
                          id="soldoff-buyer-phone"
                          name="buyerPhone"
                          type="tel"
                          required
                          value={buyerPhone}
                          onChange={(event) =>
                            setBuyerPhone(event.target.value)
                          }
                          placeholder={t(
                            "pages.inventory.form.buyerPhonePlaceholder"
                          )}
                          className={employeeInputClass}
                        />
                        <p className={employeeDialogHintClass}>
                          {t("pages.inventory.form.buyerPhoneHintCompany")}
                        </p>
                      </div>
                    </div>
                    <div className={employeeDialogFieldClass}>
                      <label
                        className={employeeDialogLabelClass}
                        htmlFor="soldoff-buyer-tax"
                      >
                        {t("pages.inventory.form.buyerTaxId")}
                        <span className="text-danger"> *</span>
                      </label>
                      <input
                        id="soldoff-buyer-tax"
                        name="buyerTaxId"
                        type="text"
                        required
                        value={buyerTaxId}
                        onChange={(event) => setBuyerTaxId(event.target.value)}
                        placeholder={t(
                          "pages.inventory.form.buyerTaxIdPlaceholder"
                        )}
                        className={employeeInputClass}
                      />
                    </div>
                  </>
                ) : null}

                {buyerType === "INDIVIDUAL" ? (
                  <>
                    <div className={employeeDialogGridClass}>
                      <div className={employeeDialogFieldClass}>
                        <label
                          className={employeeDialogLabelClass}
                          htmlFor="soldoff-buyer"
                        >
                          {t("pages.inventory.form.buyer")}
                          <span className="text-danger"> *</span>
                        </label>
                        <input
                          id="soldoff-buyer"
                          name="buyer"
                          type="text"
                          required
                          value={buyer}
                          onChange={(event) => setBuyer(event.target.value)}
                          placeholder={t(
                            "pages.inventory.form.buyerPlaceholder"
                          )}
                          className={employeeInputClass}
                        />
                        <p className={employeeDialogHintClass}>
                          {t("pages.inventory.form.buyerManualHint")}
                        </p>
                      </div>
                      <div className={employeeDialogFieldClass}>
                        <label
                          className={employeeDialogLabelClass}
                          htmlFor="soldoff-buyer-phone"
                        >
                          {t("pages.inventory.form.buyerPhone")}
                          <span className="text-danger"> *</span>
                        </label>
                        <input
                          id="soldoff-buyer-phone"
                          name="buyerPhone"
                          type="tel"
                          required
                          value={buyerPhone}
                          onChange={(event) =>
                            setBuyerPhone(event.target.value)
                          }
                          placeholder={t(
                            "pages.inventory.form.buyerPhonePlaceholder"
                          )}
                          className={employeeInputClass}
                        />
                        <p className={employeeDialogHintClass}>
                          {t("pages.inventory.form.buyerPhoneHint")}
                        </p>
                      </div>
                    </div>
                  </>
                ) : null}

                {buyerType === "INDIVIDUAL" ? (
                  <div className={employeeDialogFieldClass}>
                    <div className={employeeDialogGridClass}>
                      <div className={employeeDialogFieldClass}>
                        <label
                          className={employeeDialogLabelClass}
                          htmlFor="soldoff-buyer-tax"
                        >
                          {t("pages.inventory.form.buyerTaxIdIndividual")}
                        </label>
                        <input
                          id="soldoff-buyer-tax"
                          name="buyerTaxId"
                          type="text"
                          value={buyerTaxId}
                          onChange={(event) =>
                            setBuyerTaxId(event.target.value)
                          }
                          placeholder={t(
                            "pages.inventory.form.buyerTaxIdPlaceholder"
                          )}
                          className={employeeInputClass}
                        />
                      </div>
                      <div className={employeeDialogFieldClass}>
                        <label
                          className={employeeDialogLabelClass}
                          htmlFor="soldoff-buyer-id-number"
                        >
                          {t("pages.inventory.form.buyerIdNumber")}
                        </label>
                        <input
                          id="soldoff-buyer-id-number"
                          name="buyerIdNumber"
                          type="text"
                          value={buyerIdNumber}
                          onChange={(event) =>
                            setBuyerIdNumber(event.target.value)
                          }
                          placeholder={t(
                            "pages.inventory.form.buyerIdNumberPlaceholder"
                          )}
                          className={employeeInputClass}
                        />
                      </div>
                    </div>
                    <p className={employeeDialogHintClass}>
                      {t("pages.inventory.form.buyerIdentityEitherHint")}
                    </p>
                  </div>
                ) : null}

                <div className={employeeDialogFieldClass}>
                  <label
                    className={employeeDialogLabelClass}
                    htmlFor="soldoff-invoice"
                  >
                    {t("pages.inventory.form.saleInvoice")}
                    <span className="text-danger"> *</span>
                  </label>
                  <input
                    id="soldoff-invoice"
                    name="invoice"
                    type="file"
                    accept="image/*,.pdf"
                    required
                    className={`${employeeInputClass} py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm`}
                  />
                  <p className={employeeDialogHintClass}>
                    {t("pages.inventory.form.saleInvoiceHint")}
                  </p>
                </div>

                {buyerType === "COMPANY" ? (
                  <div className={employeeDialogFieldClass}>
                    <label
                      className={employeeDialogLabelClass}
                      htmlFor="soldoff-buyer-identity"
                    >
                      {t("pages.inventory.form.buyerIdentityDoc")}
                      <span className="text-danger"> *</span>
                    </label>
                    <input
                      id="soldoff-buyer-identity"
                      name="buyerIdentityDoc"
                      type="file"
                      accept="image/*,.pdf"
                      required
                      className={`${employeeInputClass} py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm`}
                    />
                    <p className={employeeDialogHintClass}>
                      {t("pages.inventory.form.buyerIdentityDocHint")}
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}

            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass} htmlFor="soldoff-notes">
                {t("pages.inventory.form.notes")}
              </label>
              <textarea
                id="soldoff-notes"
                name="notes"
                rows={2}
                placeholder={t("pages.inventory.form.soldOffNotesPlaceholder")}
                className={`${employeeInputClass} h-auto min-h-[4rem] py-3`}
              />
            </div>
          </form>
        </EmployeeDialogShell>
      </Dialog>

      <EmployeeUnsavedExitDialog
        open={exitConfirmOpen}
        onConfirm={() => {
          setExitConfirmOpen(false);
          closeDialog();
        }}
        onCancel={() => setExitConfirmOpen(false)}
      />
    </>
  );
}
