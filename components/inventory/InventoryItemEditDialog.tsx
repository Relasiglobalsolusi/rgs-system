"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
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
import { INVENTORY_ITEM_TYPE_PRESETS } from "@/lib/inventory-sku";
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
  const { t } = useT();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [itemType, setItemType] = useState("");
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    EDIT_FORM_ID,
    item?.id ?? "",
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    if (open && item) {
      setItemType(item.itemType);
    }
  }, [open, item]);

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
    const frame = requestAnimationFrame(() => {
      setBaseline(captureHtmlFormBaseline(EDIT_FORM_ID, item.id));
    });
    return () => cancelAnimationFrame(frame);
  }, [open, item]);

  if (!item) return null;

  async function submit(formData: FormData) {
    if (!itemType.trim()) {
      showRejection({ reasons: t("pages.inventory.itemTypeRequired") });
      return;
    }
    formData.set("itemType", itemType.trim());
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

  const typeOptions = Array.from(
    new Set([...INVENTORY_ITEM_TYPE_PRESETS, item.itemType])
  );

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
              <Select
                value={itemType || undefined}
                onValueChange={(value) => setItemType(value ?? "")}
              >
                <SelectTrigger className={employeeSelectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {INVENTORY_ITEM_TYPE_PRESETS.includes(
                        preset as (typeof INVENTORY_ITEM_TYPE_PRESETS)[number]
                      )
                        ? t(`pages.inventory.itemTypes.${preset}`)
                        : preset}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                htmlFor="edit-item-category"
              >
                {t("pages.inventory.form.category")}
              </label>
              <input
                id="edit-item-category"
                name="category"
                defaultValue={item.category ?? ""}
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
                <input
                  id="edit-item-unit"
                  name="unit"
                  defaultValue={item.unit}
                  className={employeeInputClass}
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
                  step="any"
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
