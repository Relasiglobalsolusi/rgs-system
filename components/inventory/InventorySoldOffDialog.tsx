"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CircleDollarSign } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileDropField } from "@/components/ui/FileDropField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import CompanyBankAccountField from "@/components/company-details/CompanyBankAccountField";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import { formatDateForInput } from "@/lib/format-tenure";
import { formatContractPrice, parseContractPrice } from "@/lib/project-billing";
import {
  formatInventoryQty,
  isWholeInventoryQty,
} from "@/lib/inventory";
import { isValidNpwp } from "@/lib/npwp";
import { localizeInventoryItemType } from "@/lib/i18n/labels";
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
  bankAccounts?: CompanyBankAccountOption[];
};

export default function InventorySoldOffDialog({
  open,
  onOpenChange,
  items,
  equipmentAssets,
  bankAccounts = [],
}: Props) {
  const { t, locale } = useT();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [itemType, setItemType] = useState("");
  const [itemId, setItemId] = useState("");
  const [saleSource, setSaleSource] = useState<"new" | "issued" | "">("");
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
  const [bankAccountId, setBankAccountId] = useState("");
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);
  const [lossConfirmOpen, setLossConfirmOpen] = useState(false);
  const lossConfirmedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const saleItemTypes = [
    "Consumable",
    "Chemical",
    "Equipment",
    "Spare Part",
    "Other",
  ] as const;

  const stockedItems = useMemo(
    () =>
      items.filter((item) => {
        if (!item.active) return false;
        if (!itemType || item.itemType.trim() !== itemType) return false;
        if (!matchInventoryItemType(item.itemType, "equipment")) {
          return item.currentStock > 0;
        }
        const hasIssued = equipmentAssets.some(
          (asset) =>
            asset.item?.id === item.id &&
            (asset.status === "AVAILABLE" || asset.status === "ON_PROJECT")
        );
        return item.currentStock > 0 || hasIssued;
      }),
    [equipmentAssets, itemType, items]
  );

  const filteredItems = useMemo(() => {
    const typeLabel = (itemType: string) =>
      localizeInventoryItemType(itemType, locale);
    return stockedItems.filter((item) =>
      matchesDirectorySearch(
        itemSearch,
        item.name,
        item.sku,
        item.itemType,
        typeLabel(item.itemType)
      )
    );
  }, [stockedItems, itemSearch, locale]);

  const selected = stockedItems.find((item) => item.id === itemId);
  const isEquipmentSelected = Boolean(
    selected && matchInventoryItemType(selected.itemType, "equipment")
  );

  const sellableAssets = useMemo(
    () =>
      equipmentAssets
        .filter(
          (asset) =>
            asset.item?.id === itemId &&
            (asset.status === "AVAILABLE" || asset.status === "ON_PROJECT")
        )
        .slice()
        .sort((a, b) => {
          if (a.status !== b.status) {
            return a.status === "AVAILABLE" ? -1 : 1;
          }
          return a.assetCode.localeCompare(b.assetCode);
        }),
    [equipmentAssets, itemId]
  );
  const sellableWarehouseCount = sellableAssets.filter(
    (asset) => asset.status === "AVAILABLE"
  ).length;
  const sellableOnSiteCount = sellableAssets.length - sellableWarehouseCount;
  const uncodedNew =
    selected && isEquipmentSelected
      ? Math.max(0, selected.currentStock - sellableWarehouseCount)
      : 0;

  const qtyNumber = Number(String(quantity).replace(/,/g, "").trim());
  const priceNumber = parseContractPrice(unitPrice) ?? Number.NaN;
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
    setItemType("");
    setItemId("");
    setSaleSource("");
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
    setBankAccountId("");
    setLossConfirmOpen(false);
    lossConfirmedRef.current = false;
  }

  function estimateSaleCostBasis(qty: number) {
    const catalogUnit = Math.max(
      0,
      selected?.avgUnitCost ?? selected?.lastUnitCost ?? 0
    );
    if (isEquipmentSelected && saleSource === "issued") {
      return selectedAssetIds.reduce((sum, id) => {
        const asset = sellableAssets.find((row) => row.id === id);
        return sum + Math.max(0, asset?.unitCost ?? catalogUnit);
      }, 0);
    }
    return catalogUnit * qty;
  }

  function isSaleAtLoss(qty: number, unitSalePrice: number) {
    const saleTotal = qty * unitSalePrice;
    const costBasis = estimateSaleCostBasis(qty);
    return costBasis > 0 && saleTotal + 0.005 < costBasis;
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
    setSaleSource("");
  }, [itemId]);

  useEffect(() => {
    setItemId("");
    setSaleSource("");
    setSelectedAssetIds([]);
    setQuantity("");
    setItemSearch("");
  }, [itemType]);

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
    if (isEquipmentSelected) {
      if (saleSource !== "new" && saleSource !== "issued") {
        showRejection({
          reasons: t("pages.inventory.saleSource.required"),
        });
        return;
      }
      if (saleSource === "issued") {
        if (selectedAssetIds.length === 0 || selectedAssetIds.length !== qty) {
          showRejection({
            reasons: t("pages.inventory.soldOffSelectAssetsRequired"),
          });
          return;
        }
      } else if (qty > uncodedNew) {
        showRejection({
          reasons: t("pages.inventory.quantityExceedsStock", {
            available: formatInventoryQty(uncodedNew),
            unit: selected?.unit ?? "pcs",
          }),
        });
        return;
      }
    } else if (selected && qty > selected.currentStock) {
      showRejection({
        reasons: t("pages.inventory.quantityExceedsStock", {
          available: formatInventoryQty(selected.currentStock),
          unit: selected.unit,
        }),
      });
      return;
    }
    const price = parseContractPrice(String(formData.get("unitPrice") ?? ""));
    if (price == null || price < 0) {
      showRejection({
        reasons: t("pages.inventory.quantityMustBeNonNegative", {
          field: t("pages.inventory.form.saleUnitPrice"),
        }),
      });
      return;
    }
    if (!String(formData.get("bankAccountId") ?? bankAccountId).trim()) {
      showRejection({
        reasons: bankAccounts.length === 0
          ? t("pages.sales.bankAccountEmpty")
          : t("pages.sales.bankAccountRequired"),
      });
      return;
    }
    if (
      isEquipmentSelected &&
      saleSource === "issued" &&
      selectedAssetIds.length !== qty
    ) {
      showRejection({
        reasons: t("pages.inventory.soldOffAssetQtyMismatch"),
      });
      return;
    }

    formData.set("itemId", itemId);
    formData.set("bankAccountId", bankAccountId);
    formData.set("saleSource", saleSource);
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

    if (isSaleAtLoss(qty, price) && !lossConfirmedRef.current) {
      setLossConfirmOpen(true);
      return;
    }
    lossConfirmedRef.current = false;

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
            ref={formRef}
            className={employeeDialogFormClass}
            action={submit}
            onInput={handleFormInput}
          >
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.inventory.form.itemType")}
              </label>
              <Select
                value={itemType || undefined}
                onValueChange={(value) => setItemType(value ?? "")}
                items={saleItemTypes.map((type) => ({
                  value: type,
                  label: localizeInventoryItemType(type, locale),
                }))}
              >
                <SelectTrigger className={employeeSelectTriggerClass}>
                  <SelectValue
                    placeholder={t("pages.inventory.form.itemTypePlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {saleItemTypes.map((type) => (
                    <SelectItem
                      key={type}
                      value={type}
                      label={localizeInventoryItemType(type, locale)}
                    >
                      {localizeInventoryItemType(type, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {itemType ? (
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.inventory.form.catalogItem")}
                </label>
                {stockedItems.length === 0 ? (
                  <p className={employeeDialogHintClass}>
                    {t("pages.inventory.form.soldOffNoStockForType")}
                  </p>
                ) : (
                  <>
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
                          placeholder={t(
                            "pages.inventory.form.catalogItemPlaceholder"
                          )}
                        >
                          {(value) => {
                            if (!value) return null;
                            const item = stockedItems.find(
                              (entry) => entry.id === value
                            );
                            return item ? formatCatalogItemLabel(item) : null;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {filteredItems.length === 0 ? (
                          <div className="px-3 py-4 text-center text-sm text-subtle">
                            {t("pages.inventory.form.catalogItemNoSearchMatch")}
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
                        {isEquipmentSelected
                          ? t("pages.inventory.form.soldOffEquipmentHint", {
                              warehouse: formatInventoryQty(uncodedNew),
                              onSite: formatInventoryQty(sellableOnSiteCount),
                            })
                          : t("pages.inventory.form.soldOffItemHint", {
                              available: formatInventoryQty(selected.currentStock),
                              unit: selected.unit,
                            })}
                      </p>
                    ) : (
                      <p className={employeeDialogHintClass}>
                        {itemSearch.trim()
                          ? t("pages.inventory.form.catalogItemNoSearchMatch")
                          : t("pages.inventory.form.issueItemHint")}
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : null}

            {isEquipmentSelected ? (
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.inventory.saleSource.label")}
                </label>
                <Select
                  value={saleSource || undefined}
                  onValueChange={(value) => {
                    setSaleSource((value as "new" | "issued") ?? "");
                    setSelectedAssetIds([]);
                    setQuantity("");
                  }}
                  items={[
                    {
                      value: "new",
                      label: t("pages.inventory.saleSource.newInWarehouse"),
                    },
                    {
                      value: "issued",
                      label: t("pages.inventory.saleSource.issuedAsset"),
                    },
                  ]}
                >
                  <SelectTrigger className={employeeSelectTriggerClass}>
                    <SelectValue
                      placeholder={t("pages.inventory.saleSource.placeholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="new"
                      label={t("pages.inventory.saleSource.newInWarehouse")}
                    >
                      {t("pages.inventory.saleSource.newInWarehouse")}
                    </SelectItem>
                    <SelectItem
                      value="issued"
                      label={t("pages.inventory.saleSource.issuedAsset")}
                    >
                      {t("pages.inventory.saleSource.issuedAsset")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className={employeeDialogHintClass}>
                  {saleSource === "new"
                    ? t("pages.inventory.saleSource.newHint", {
                        available: formatInventoryQty(uncodedNew),
                      })
                    : saleSource === "issued"
                      ? t("pages.inventory.saleSource.issuedHint")
                      : t("pages.inventory.saleSource.chooseHint")}
                </p>
              </div>
            ) : null}

            {isEquipmentSelected && saleSource === "issued" ? (
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.inventory.form.soldOffAssets")}
                </label>
                {sellableAssets.length === 0 ? (
                  <p className={employeeDialogHintClass}>
                    {t("pages.inventory.form.soldOffNoAssets")}
                  </p>
                ) : (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-elevated p-2">
                    {sellableAssets.map((asset) => {
                      const checked = selectedAssetIds.includes(asset.id);
                      const locationLabel =
                        asset.status === "ON_PROJECT"
                          ? t("pages.inventory.form.soldOffOnSite", {
                              project: asset.project?.name?.trim() || "—",
                            })
                          : t("pages.inventory.product.headOffice");
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
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">{asset.assetCode}</span>
                            {asset.serialNo ? (
                              <span className="ml-2 text-xs text-subtle">
                                {asset.serialNo}
                              </span>
                            ) : null}
                            <span className="mt-0.5 block text-xs text-muted">
                              {locationLabel}
                            </span>
                          </span>
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
                    if (isEquipmentSelected && saleSource === "issued") return;
                    setQuantity(event.target.value);
                  }}
                  readOnly={isEquipmentSelected && saleSource === "issued"}
                  max={
                    isEquipmentSelected
                      ? saleSource === "issued"
                        ? sellableAssets.length
                        : uncodedNew
                      : selected?.currentStock
                  }
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
                <MoneyInput
                  id="soldoff-unit-price"
                  name="unitPrice"
                  required
                  value={unitPrice}
                  onValueChange={setUnitPrice}
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

            <CompanyBankAccountField
              id="soldoff-bank-account"
              accounts={bankAccounts}
              value={bankAccountId}
              onChange={setBankAccountId}
              required
              label={t("pages.sales.bankAccount")}
              hint={
                bankAccounts.length === 0
                  ? t("pages.sales.bankAccountEmpty")
                  : t("pages.sales.invoiceAutoHint")
              }
            />

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
                  <FileDropField
                    id="soldoff-payment-proof"
                    name="paymentProof"
                    label={t("pages.sales.form.paymentProof")}
                    accept="image/*,.pdf"
                  />
                  <p className={employeeDialogHintClass}>
                    {t("pages.sales.form.paymentProofHint")}
                  </p>
                </div>

                <div className={employeeDialogFieldClass}>
                  <label
                    className={employeeDialogLabelClass}
                    htmlFor="soldoff-paid-at"
                  >
                    {t("pages.sales.form.paidAt")}
                  </label>
                  <input
                    id="soldoff-paid-at"
                    name="paidAt"
                    type="date"
                    className={employeeInputClass}
                  />
                  <p className={employeeDialogHintClass}>
                    {t("pages.sales.form.paidAtHint")}
                  </p>
                </div>

                {buyerType === "COMPANY" ? (
                  <div className={employeeDialogFieldClass}>
                    <FileDropField
                      id="soldoff-buyer-identity"
                      name="buyerIdentityDoc"
                      label={t("pages.inventory.form.buyerIdentityDoc")}
                      required
                      accept="image/*,.pdf"
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

      <Dialog
        open={lossConfirmOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setLossConfirmOpen(false);
            lossConfirmedRef.current = false;
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden rounded-2xl border border-border bg-panel p-0 text-text ring-0 sm:max-w-sm"
        >
          <div className="px-8 pt-8 pb-7 sm:px-10">
            <DialogHeader className="items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card-tint-amber ring-1 ring-amber-500/25">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
              <div className="space-y-2.5">
                <DialogTitle className="text-lg font-semibold text-text">
                  {t("pages.inventory.saleLossConfirmTitle")}
                </DialogTitle>
                <DialogDescription className="text-sm leading-6 text-muted">
                  {t("pages.inventory.saleLossConfirmDescription")}
                </DialogDescription>
              </div>
            </DialogHeader>
          </div>
          <DialogFooter className="mx-0 mb-0 mt-0 flex-col gap-3 rounded-none border-t border-border bg-strip px-8 py-6 sm:flex-col sm:justify-stretch sm:px-10">
            <EmployeePrimaryButton
              type="button"
              disabled={pending}
              onClick={() => {
                setLossConfirmOpen(false);
                lossConfirmedRef.current = true;
                formRef.current?.requestSubmit();
              }}
            >
              {t("common.actions.yes")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => {
                setLossConfirmOpen(false);
                lossConfirmedRef.current = false;
              }}
            >
              {t("common.actions.no")}
            </EmployeeSecondaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
