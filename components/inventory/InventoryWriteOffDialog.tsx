"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { writeOffInventoryStock } from "@/app/inventory/actions";
import type {
  InventoryCatalogItem,
  InventoryOverviewAssetRow,
} from "@/components/inventory/inventory-types";
import {
  formatCatalogItemLabel,
  formatCatalogItemStockLabel,
} from "@/components/inventory/inventory-select-labels";
import { matchInventoryItemType } from "@/components/inventory/inventory-category";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateForInput } from "@/lib/format-tenure";
import {
  formatInventoryQty,
  isWholeInventoryQty,
} from "@/lib/inventory";
import { useT } from "@/lib/i18n/use-t";

const FORM_ID = "create-inventory-write-off-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryCatalogItem[];
  equipmentAssets: InventoryOverviewAssetRow[];
};

export default function InventoryWriteOffDialog({
  open,
  onOpenChange,
  items,
  equipmentAssets,
}: Props) {
  const { t } = useT();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [writeOffSource, setWriteOffSource] = useState<"new" | "issued" | "">("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const stockedItems = items.filter((item) => item.active && item.currentStock > 0);
  const selected = stockedItems.find((item) => item.id === itemId);
  const isEquipmentSelected = Boolean(
    selected && matchInventoryItemType(selected.itemType, "equipment")
  );
  const availableAssets = equipmentAssets.filter(
    (asset) => asset.item?.id === itemId && asset.status === "AVAILABLE"
  );
  const uncodedNew =
    selected && isEquipmentSelected
      ? Math.max(0, selected.currentStock - availableAssets.length)
      : 0;

  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    FORM_ID,
    "",
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function closeDialog() {
    onOpenChange(false);
    resetDirtyTracking();
    setBaseline(null);
    setItemId("");
    setWriteOffSource("");
    setSelectedAssetIds([]);
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
        setItemId("");
        setWriteOffSource("");
        setSelectedAssetIds([]);
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

  function toggleAsset(assetId: string, checked: boolean) {
    setSelectedAssetIds((prev) =>
      checked
        ? prev.includes(assetId)
          ? prev
          : [...prev, assetId]
        : prev.filter((id) => id !== assetId)
    );
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
    if (isEquipmentSelected) {
      if (writeOffSource !== "new" && writeOffSource !== "issued") {
        showRejection({ reasons: t("pages.inventory.saleSource.required") });
        return;
      }
      if (writeOffSource === "issued") {
        if (selectedAssetIds.length === 0) {
          showRejection({ reasons: t("pages.inventory.writeOffAssetsRequired") });
          return;
        }
        formData.set("quantity", String(selectedAssetIds.length));
        formData.delete("assetIds");
        for (const assetId of selectedAssetIds) {
          formData.append("assetIds", assetId);
        }
      }
      formData.set("writeOffSource", writeOffSource);
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
    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) {
      showRejection({ reasons: t("pages.inventory.writeOffReasonRequired") });
      return;
    }
    formData.set("itemId", itemId);

    startTransition(async () => {
      try {
        await writeOffInventoryStock(formData);
        toast.success(t("pages.inventory.writeOffCreated"));
        closeDialog();
      } catch (error) {
        showRejectionFromError(error, t("pages.inventory.createWriteOffFailed"));
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <EmployeeDialogShell
          icon={Trash2}
          title={t("pages.inventory.addWriteOff")}
          description={t("pages.inventory.addWriteOffDesc")}
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
                disabled={
                  pending ||
                  stockedItems.length === 0 ||
                  (isEquipmentSelected &&
                    writeOffSource === "issued" &&
                    selectedAssetIds.length === 0)
                }
              >
                {pending
                  ? t("common.actions.saving")
                  : t("pages.inventory.saveWriteOff")}
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
              <Select
                value={itemId || undefined}
                onValueChange={(value) => {
                  setItemId(value ?? "");
                  setWriteOffSource("");
                  setSelectedAssetIds([]);
                }}
                items={stockedItems.map((item) => ({
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
                  {stockedItems.map((item) => (
                    <SelectItem
                      key={item.id}
                      value={item.id}
                      label={formatCatalogItemLabel(item)}
                    >
                      {formatCatalogItemStockLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected ? (
                <p className={employeeDialogHintClass}>
                  {t("pages.inventory.form.writeOffItemHint", {
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
                  {t("pages.inventory.saleSource.label")}
                </label>
                <Select
                  value={writeOffSource || undefined}
                  onValueChange={(value) => {
                    setWriteOffSource((value as "new" | "issued") ?? "");
                    setSelectedAssetIds([]);
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
                    />
                    <SelectItem
                      value="issued"
                      label={t("pages.inventory.saleSource.issuedAsset")}
                    />
                  </SelectContent>
                </Select>
                <p className={employeeDialogHintClass}>
                  {writeOffSource === "new"
                    ? t("pages.inventory.saleSource.newHint", {
                        available: formatInventoryQty(uncodedNew),
                      })
                    : t("pages.inventory.form.writeOffAssetsHint")}
                </p>
              </div>
            ) : null}

            {isEquipmentSelected && writeOffSource === "issued" ? (
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.inventory.form.writeOffAssets")}
                </label>
                {availableAssets.length === 0 ? (
                  <p className={employeeDialogHintClass}>
                    {t("pages.inventory.form.writeOffNoAssets")}
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
                              toggleAsset(asset.id, Boolean(next))
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
                  {t("pages.inventory.form.writeOffAssetsHint")}
                </p>
              </div>
            ) : null}

            <div className={employeeDialogGridClass}>
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass} htmlFor="writeoff-qty">
                  {t("pages.inventory.form.quantity")}
                </label>
                {isEquipmentSelected && writeOffSource === "issued" ? (
                  <>
                    <input
                      type="hidden"
                      name="quantity"
                      value={
                        selectedAssetIds.length > 0
                          ? String(selectedAssetIds.length)
                          : ""
                      }
                    />
                    <div
                      id="writeoff-qty"
                      className={`${employeeInputClass} flex items-center text-muted`}
                    >
                      {selectedAssetIds.length > 0
                        ? String(selectedAssetIds.length)
                        : "—"}
                    </div>
                  </>
                ) : (
                  <input
                    id="writeoff-qty"
                    name="quantity"
                    type="number"
                    min={1}
                    step={1}
                    required
                    max={selected?.currentStock}
                    className={employeeInputClass}
                  />
                )}
              </div>
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass} htmlFor="writeoff-date">
                  {t("pages.inventory.form.writeOffDate")}
                </label>
                <input
                  id="writeoff-date"
                  name="movedAt"
                  type="date"
                  required
                  defaultValue={formatDateForInput(new Date())}
                  className={employeeInputClass}
                />
              </div>
            </div>

            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass} htmlFor="writeoff-reason">
                {t("pages.inventory.form.writeOffReason")}
              </label>
              <textarea
                id="writeoff-reason"
                name="reason"
                rows={3}
                required
                placeholder={t("pages.inventory.form.writeOffReasonPlaceholder")}
                className={`${employeeInputClass} h-auto min-h-[4.5rem] py-3`}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.inventory.form.writeOffReasonHint")}
              </p>
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
