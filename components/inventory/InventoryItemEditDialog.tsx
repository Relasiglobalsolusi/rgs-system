"use client";

import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";

import { updateInventoryItem } from "@/app/inventory/actions";
import type { InventoryCatalogItem } from "@/components/inventory/inventory-types";
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
  handleEmployeeDialogOpenChange,
  useHtmlFormDirty,
  type HtmlFormDirtyBaseline,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import InventoryUnitSelect from "@/components/inventory/InventoryUnitSelect";
import { localizeInventoryItemType } from "@/lib/i18n/labels";
import { normalizeInventoryUnit } from "@/lib/inventory-units";
import { useT } from "@/lib/i18n/use-t";

const EDIT_FORM_ID = "edit-inventory-item-form";

type Props = {
  item: InventoryCatalogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function InventoryItemEditDialog({
  item,
  open,
  onOpenChange,
}: Props) {
  const { t, locale } = useT();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);
  const [unit, setUnit] = useState("pcs");

  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    EDIT_FORM_ID,
    item?.id ?? "",
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function closeDialog() {
    onOpenChange(false);
    resetDirtyTracking();
    setBaseline(null);
  }

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails?: { cancel: () => void }
  ) {
    handleEmployeeDialogOpenChange(nextOpen, eventDetails, {
      isDirty: isDirtyRef.current,
      onOpen: () => onOpenChange(true),
      onClose: closeDialog,
      onRequestExitConfirm: () => setExitConfirmOpen(true),
    });
  }

  useEffect(() => {
    if (!open || !item) {
      setBaseline(null);
      return;
    }
    setUnit(normalizeInventoryUnit(item.unit));
    const frame = requestAnimationFrame(() => {
      setBaseline(captureHtmlFormBaseline(EDIT_FORM_ID, item.id));
    });
    return () => cancelAnimationFrame(frame);
  }, [open, item]);

  if (!item) return null;

  async function submit(formData: FormData) {
    formData.set("itemType", item!.itemType);
    formData.set("id", item!.id);

    startTransition(async () => {
      try {
        await updateInventoryItem(formData);
        toast.success(t("pages.inventory.itemUpdated"));
        closeDialog();
      } catch (error) {
        showRejectionFromError(error, t("pages.inventory.updateItemFailed"));
      }
    });
  }

  const itemTypeLabel = localizeInventoryItemType(item.itemType, locale);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <EmployeeDialogShell
          icon={Package}
          title={t("pages.inventory.editItem")}
          description={t("pages.inventory.editItemDesc")}
          maxWidth="md"
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
                form={EDIT_FORM_ID}
                disabled={pending}
              >
                {pending
                  ? t("common.actions.saving")
                  : t("common.actions.saveChanges")}
              </EmployeePrimaryButton>
            </>
          }
        >
          <form
            id={EDIT_FORM_ID}
            className={employeeDialogFormClass}
            action={submit}
            onInput={handleFormInput}
          >
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.inventory.form.sku")}
              </label>
              <input
                readOnly
                value={item.sku}
                className={`${employeeInputClass} bg-strip text-muted`}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.inventory.form.skuReadonlyHint")}
              </p>
            </div>

            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.inventory.form.itemType")}
              </label>
              <input
                readOnly
                value={itemTypeLabel}
                className={`${employeeInputClass} bg-strip text-muted`}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.inventory.form.itemTypeLockedHint")}
              </p>
            </div>

            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass} htmlFor="edit-item-name">
                {t("pages.inventory.form.itemName")}
              </label>
              <input
                id="edit-item-name"
                name="name"
                required
                defaultValue={item.name}
                className={employeeInputClass}
              />
            </div>

            <div className={employeeDialogFieldClass}>
              <label
                className={employeeDialogLabelClass}
                htmlFor="edit-item-description"
              >
                {t("pages.inventory.form.description")}
              </label>
              <textarea
                id="edit-item-description"
                name="description"
                rows={3}
                defaultValue={item.description ?? ""}
                className={`${employeeInputClass} h-auto min-h-[5.5rem] py-3`}
              />
            </div>

            <div className={employeeDialogGridClass}>
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass} htmlFor="edit-item-unit">
                  {t("pages.inventory.form.unit")}
                </label>
                <input type="hidden" name="unit" value={unit} />
                <InventoryUnitSelect
                  id="edit-item-unit"
                  value={unit}
                  extraCodes={[item.unit]}
                  onChange={setUnit}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.inventory.form.unitHint")}
                </p>
              </div>
              <div className={employeeDialogFieldClass}>
                <label
                  className={employeeDialogLabelClass}
                  htmlFor="edit-item-min-stock"
                >
                  {t("pages.inventory.form.minStock")}
                </label>
                <input
                  id="edit-item-min-stock"
                  name="minStock"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={item.minStock}
                  className={employeeInputClass}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.inventory.form.minStockHint")}
                </p>
              </div>
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
