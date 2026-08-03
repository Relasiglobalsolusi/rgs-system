"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { createInventoryPurchase } from "@/app/inventory/actions";
import type {
  InventoryCatalogItem,
  InventoryVendorOption,
} from "@/components/inventory/inventory-types";
import {
  formatCatalogItemLabel,
  formatVendorLabel,
} from "@/components/inventory/inventory-select-labels";
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
import { isWholeInventoryQty } from "@/lib/inventory";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

const FORM_ID = "create-inventory-purchase-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryCatalogItem[];
  vendors: InventoryVendorOption[];
};

export default function InventoryPurchaseDialog({
  open,
  onOpenChange,
  items,
  vendors,
}: Props) {
  const { t } = useT();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const activeItems = items.filter((item) => item.active);
  const selectedItem = activeItems.find((item) => item.id === itemId) ?? null;

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
    setVendorId("");
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
        setVendorId("");
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

  async function submit(formData: FormData) {
    if (!itemId) {
      showRejection({ reasons: t("pages.inventory.itemRequired") });
      return;
    }
    if (!vendorId) {
      showRejection({ reasons: t("pages.inventory.vendorRequired") });
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
    formData.set("itemId", itemId);
    formData.set("vendorId", vendorId);

    startTransition(async () => {
      try {
        await createInventoryPurchase(formData);
        toast.success(t("pages.inventory.purchaseCreated"));
        closeDialog();
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.inventory.createPurchaseFailed")
        );
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <EmployeeDialogShell
          icon={ShoppingCart}
          title={t("pages.inventory.addPurchase")}
          description={t("pages.inventory.addPurchaseDesc")}
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
                disabled={pending || activeItems.length === 0}
              >
                {pending
                  ? t("common.actions.saving")
                  : t("pages.inventory.savePurchase")}
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
                onValueChange={(value) => setItemId(value ?? "")}
                items={activeItems.map((item) => ({
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
                      const item = activeItems.find((entry) => entry.id === value);
                      return item ? formatCatalogItemLabel(item) : null;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeItems.map((item) => (
                    <SelectItem
                      key={item.id}
                      value={item.id}
                      label={formatCatalogItemLabel(item)}
                    >
                      {formatCatalogItemLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className={employeeDialogHintClass}>
                {t("pages.inventory.form.catalogItemHint")}
              </p>
              {selectedItem ? (
                <p className={employeeDialogHintClass}>
                  {selectedItem.lastUnitCost != null
                    ? t("pages.inventory.form.lastPurchaseCostHint", {
                        lastCost: formatContractPrice(selectedItem.lastUnitCost),
                        avgCost:
                          selectedItem.avgUnitCost != null
                            ? formatContractPrice(selectedItem.avgUnitCost)
                            : "—",
                      })
                    : t("pages.inventory.form.noPriorPurchaseCostHint")}
                </p>
              ) : null}
            </div>

            <div className={employeeDialogGridClass}>
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.inventory.form.vendor")}
                </label>
                <Select
                  value={vendorId || undefined}
                  onValueChange={(value) => setVendorId(value ?? "")}
                  items={vendors.map((vendor) => ({
                    value: vendor.id,
                    label: formatVendorLabel(vendor),
                  }))}
                >
                  <SelectTrigger className={employeeSelectTriggerClass}>
                    <SelectValue
                      placeholder={t("pages.inventory.form.vendorPlaceholder")}
                    >
                      {(value) => {
                        if (!value) return null;
                        const vendor = vendors.find((entry) => entry.id === value);
                        return vendor ? formatVendorLabel(vendor) : null;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem
                        key={vendor.id}
                        value={vendor.id}
                        label={formatVendorLabel(vendor)}
                      >
                        {formatVendorLabel(vendor)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={employeeDialogFieldClass}>
                <label
                  className={employeeDialogLabelClass}
                  htmlFor="purchase-date"
                >
                  {t("pages.inventory.form.purchasedAt")}
                </label>
                <input
                  id="purchase-date"
                  name="purchasedAt"
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
                  htmlFor="purchase-qty"
                >
                  {t("pages.inventory.form.quantity")}
                </label>
                <input
                  id="purchase-qty"
                  name="quantity"
                  type="number"
                  min={1}
                  step={1}
                  required
                  className={employeeInputClass}
                />
              </div>
              <div className={employeeDialogFieldClass}>
                <label
                  className={employeeDialogLabelClass}
                  htmlFor="purchase-unit-price"
                >
                  {t("pages.inventory.form.unitPrice")}
                </label>
                <input
                  id="purchase-unit-price"
                  name="unitPrice"
                  type="number"
                  min={0}
                  step="any"
                  required
                  className={employeeInputClass}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.inventory.form.unitPriceExTaxHint")}
                </p>
              </div>
            </div>

            <div className={employeeDialogGridClass}>
              <div className={employeeDialogFieldClass}>
                <label
                  className={employeeDialogLabelClass}
                  htmlFor="purchase-invoice"
                >
                  {t("pages.inventory.form.invoiceNo")}
                </label>
                <input
                  id="purchase-invoice"
                  name="invoiceNo"
                  className={employeeInputClass}
                />
              </div>
              <div className={employeeDialogFieldClass}>
                <label
                  className={employeeDialogLabelClass}
                  htmlFor="purchase-receipt"
                >
                  {t("pages.inventory.form.receipt")}
                </label>
                <input
                  id="purchase-receipt"
                  name="receipt"
                  type="file"
                  accept="image/*,.pdf"
                  className={`${employeeInputClass} py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm`}
                />
              </div>
            </div>

            <div className={employeeDialogFieldClass}>
              <label
                className={employeeDialogLabelClass}
                htmlFor="purchase-notes"
              >
                {t("pages.inventory.form.notes")}
              </label>
              <textarea
                id="purchase-notes"
                name="notes"
                rows={2}
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
