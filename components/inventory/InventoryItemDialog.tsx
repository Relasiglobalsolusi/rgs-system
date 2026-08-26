"use client";

import {
  showMissingRequiredFields,
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";

import {
  createInventoryItem,
  previewInventorySku,
} from "@/app/inventory/actions";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDirectoryDialogOpen,
  type DirectoryDialogControlProps,
} from "@/components/ui/use-directory-dialog-open";
import InventoryUnitSelect from "@/components/inventory/InventoryUnitSelect";
import {
  INVENTORY_ITEM_TYPE_PRESETS,
  isVehicleItemType,
} from "@/lib/inventory-sku";
import { defaultUnitForItemType } from "@/lib/inventory-units";
import { localizeInventoryItemType } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";

const CREATE_FORM_ID = "create-inventory-item-form";

type Props = DirectoryDialogControlProps;

export default function InventoryItemDialog({
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t, locale } = useT();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [previewSku, setPreviewSku] = useState("");
  const [itemType, setItemType] = useState("");
  const [unit, setUnit] = useState<string>(defaultUnitForItemType("Consumable"));
  const isVehicle = isVehicleItemType(itemType);
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    CREATE_FORM_ID,
    "",
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function closeDialog() {
    setOpen(false);
    resetDirtyTracking();
    setBaseline(null);
    setPreviewSku("");
    setItemType("");
    setUnit(defaultUnitForItemType("Consumable"));
  }

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails?: { cancel: () => void }
  ) {
    handleEmployeeDialogOpenChange(nextOpen, eventDetails, {
      isDirty: isDirtyRef.current,
      onOpen: () => {
        setOpen(true);
        resetDirtyTracking();
        setPreviewSku("");
        setItemType("");
        setUnit(defaultUnitForItemType("Consumable"));
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
      setBaseline(captureHtmlFormBaseline(CREATE_FORM_ID, ""));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || !itemType.trim()) {
      setPreviewSku("");
      return;
    }
    let cancelled = false;
    previewInventorySku(itemType)
      .then((sku) => {
        if (!cancelled) setPreviewSku(sku);
      })
      .catch(() => {
        if (!cancelled) setPreviewSku("");
      });
    return () => {
      cancelled = true;
    };
  }, [open, itemType]);

  async function submit(formData: FormData) {
    const form = document.getElementById(CREATE_FORM_ID);
    const extra = !itemType.trim() ? [t("pages.inventory.form.itemType")] : [];
    if (
      showMissingRequiredFields(
        form instanceof HTMLFormElement ? form : null,
        extra
      )
    ) {
      return;
    }
    if (!itemType.trim()) {
      showRejection({ reasons: t("pages.inventory.itemTypeRequired") });
      return;
    }
    formData.set("itemType", itemType.trim());
    if (isVehicleItemType(itemType)) {
      const brand = String(formData.get("vehicleBrand") ?? "").trim();
      const type = String(formData.get("vehicleType") ?? "").trim();
      if (!brand) {
        showRejection({ reasons: t("pages.inventory.vehicleBrandRequired") });
        return;
      }
      if (!type) {
        showRejection({ reasons: t("pages.inventory.vehicleTypeRequired") });
        return;
      }
      formData.set("vehicleBrand", brand);
      formData.set("vehicleType", type);
      formData.set("unit", defaultUnitForItemType(itemType));
    }

    startTransition(async () => {
      try {
        await createInventoryItem(formData);
        toast.success(t("pages.inventory.itemCreated"));
        closeDialog();
      } catch (error) {
        showRejectionFromError(error, t("pages.inventory.createItemFailed"));
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {showTrigger ? (
          <DialogTrigger asChild>
            <Button type="button" variant="successBadge" size="badgeFlex">
              {t("pages.inventory.addItem")}
            </Button>
          </DialogTrigger>
        ) : null}

        <EmployeeDialogShell
          icon={Package}
          title={t("pages.inventory.addItem")}
          description={t("pages.inventory.addItemDesc")}
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
                form={CREATE_FORM_ID}
                disabled={pending}
              >
                {pending
                  ? t("common.actions.saving")
                  : t("pages.inventory.saveItem")}
              </EmployeePrimaryButton>
            </>
          }
        >
          <form
            id={CREATE_FORM_ID}
            className={employeeDialogFormClass}
            action={submit}
            noValidate
            onInput={handleFormInput}
          >
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass} htmlFor="inv-item-type">
                {t("pages.inventory.form.itemType")}
              </label>
              <Select
                value={itemType || null}
                onValueChange={(value) => {
                  const next = value ?? "";
                  setItemType(next);
                  if (next) setUnit(defaultUnitForItemType(next));
                }}
              >
                <SelectTrigger
                  id="inv-item-type"
                  className={employeeSelectTriggerClass}
                >
                  <SelectValue
                    placeholder={t("pages.inventory.form.itemTypePlaceholder")}
                  >
                    {(value) => {
                      if (!value) return null;
                      return localizeInventoryItemType(value, locale);
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INVENTORY_ITEM_TYPE_PRESETS.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {localizeInventoryItemType(preset, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className={employeeDialogHintClass}>
                {t("pages.inventory.form.itemTypeHint")}
              </p>
            </div>

            {isVehicle ? (
              <>
                <div className={employeeDialogFieldClass}>
                  <label
                    className={employeeDialogLabelClass}
                    htmlFor="inv-vehicle-brand"
                  >
                    {t("pages.inventory.form.vehicleBrand")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <input
                    id="inv-vehicle-brand"
                    name="vehicleBrand"
                    required
                    className={employeeInputClass}
                    placeholder={t(
                      "pages.inventory.form.vehicleBrandPlaceholder"
                    )}
                    autoComplete="off"
                  />
                  <p className={employeeDialogHintClass}>
                    {t("pages.inventory.form.vehicleBrandHint")}
                  </p>
                </div>
                <div className={employeeDialogFieldClass}>
                  <label
                    className={employeeDialogLabelClass}
                    htmlFor="inv-vehicle-type"
                  >
                    {t("pages.inventory.form.vehicleType")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <input
                    id="inv-vehicle-type"
                    name="vehicleType"
                    required
                    className={employeeInputClass}
                    placeholder={t(
                      "pages.inventory.form.vehicleTypePlaceholder"
                    )}
                    autoComplete="off"
                  />
                  <p className={employeeDialogHintClass}>
                    {t("pages.inventory.form.vehicleTypeHint")}
                  </p>
                </div>
                <input type="hidden" name="unit" value={unit} />
              </>
            ) : (
              <>
                <div className={employeeDialogFieldClass}>
                  <label
                    className={employeeDialogLabelClass}
                    htmlFor="inv-item-name"
                  >
                    {t("pages.inventory.form.itemName")}
                  </label>
                  <input
                    id="inv-item-name"
                    name="name"
                    required
                    className={employeeInputClass}
                    placeholder={t("pages.inventory.form.itemNamePlaceholder")}
                  />
                </div>

                <div className={employeeDialogGridClass}>
                  <div className={employeeDialogFieldClass}>
                    <label
                      className={employeeDialogLabelClass}
                      htmlFor="inv-item-unit"
                    >
                      {t("pages.inventory.form.unit")}
                    </label>
                    <input type="hidden" name="unit" value={unit} />
                    <InventoryUnitSelect
                      id="inv-item-unit"
                      value={unit}
                      onChange={setUnit}
                    />
                    <p className={employeeDialogHintClass}>
                      {t("pages.inventory.form.unitHint")}
                    </p>
                  </div>
                  <div className={employeeDialogFieldClass}>
                    <label
                      className={employeeDialogLabelClass}
                      htmlFor="inv-item-min-stock"
                    >
                      {t("pages.inventory.form.minStock")}
                    </label>
                    <input
                      id="inv-item-min-stock"
                      name="minStock"
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={0}
                      className={employeeInputClass}
                    />
                    <p className={employeeDialogHintClass}>
                      {t("pages.inventory.form.minStockHint")}
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass} htmlFor="inv-item-sku">
                {t("pages.inventory.form.sku")}
              </label>
              <input
                id="inv-item-sku"
                readOnly
                value={
                  !itemType.trim()
                    ? t("pages.inventory.form.skuPickType")
                    : previewSku || t("pages.inventory.form.skuLoading")
                }
                className={`${employeeInputClass} bg-strip text-muted`}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.inventory.form.skuHint")}
              </p>
            </div>

            <div className={employeeDialogFieldClass}>
              <label
                className={employeeDialogLabelClass}
                htmlFor="inv-item-description"
              >
                {t("pages.inventory.form.description")}
              </label>
              <textarea
                id="inv-item-description"
                name="description"
                rows={3}
                className={`${employeeInputClass} h-auto min-h-[5.5rem] py-3`}
                placeholder={t("pages.inventory.form.descriptionPlaceholder")}
              />
              <p className={employeeDialogHintClass}>
                {isVehicleItemType(itemType)
                  ? t("pages.inventory.form.catalogOnlyVehicleHint")
                  : t("pages.inventory.form.catalogOnlyHint")}
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
