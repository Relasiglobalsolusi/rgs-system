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
  createInventoryItemsInBulk,
  previewInventorySkus,
} from "@/app/inventory/actions";
import BulkLineList from "@/components/bulk-create/BulkLineList";
import {
  captureHtmlFormBaseline,
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeUnsavedExitDialog,
  employeeDialogFieldClass,
  employeeDialogFormClass,
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
import { bulkLineField, createBulkLineKey } from "@/lib/bulk-create";
import { INVENTORY_ITEM_TYPE_PRESETS } from "@/lib/inventory-sku";
import { localizeInventoryItemType } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";

const FORM_ID = "bulk-create-inventory-item-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ItemCatalogBulkCreateDialog({
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const { t, locale } = useT();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [itemType, setItemType] = useState("");
  const [previewSkus, setPreviewSkus] = useState<string[]>([]);
  const [lineKeys, setLineKeys] = useState<string[]>(() => [createBulkLineKey()]);
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    FORM_ID,
    "",
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function resetForm() {
    resetDirtyTracking();
    setBaseline(null);
    setItemType("");
    setPreviewSkus([]);
    setLineKeys([createBulkLineKey()]);
  }

  function closeDialog() {
    onOpenChange(false);
    resetForm();
  }

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails?: { cancel: () => void }
  ) {
    handleEmployeeDialogOpenChange(nextOpen, eventDetails, {
      isDirty: isDirtyRef.current,
      onOpen: () => {
        onOpenChange(true);
        resetForm();
      },
      onClose: closeDialog,
      onRequestExitConfirm: () => setExitConfirmOpen(true),
    });
  }

  useEffect(() => {
    if (!controlledOpen) {
      setBaseline(null);
      return;
    }
    const frame = requestAnimationFrame(() => {
      setBaseline(captureHtmlFormBaseline(FORM_ID, ""));
    });
    return () => cancelAnimationFrame(frame);
  }, [controlledOpen]);

  useEffect(() => {
    if (!controlledOpen || !itemType.trim()) {
      setPreviewSkus([]);
      return;
    }
    let cancelled = false;
    previewInventorySkus(itemType, lineKeys.length)
      .then((skus) => {
        if (!cancelled) setPreviewSkus(skus);
      })
      .catch(() => {
        if (!cancelled) setPreviewSkus([]);
      });
    return () => {
      cancelled = true;
    };
  }, [controlledOpen, itemType, lineKeys.length]);

  function submit(formData: FormData) {
    const form = document.getElementById(FORM_ID);
    if (
      showMissingRequiredFields(
        form instanceof HTMLFormElement ? form : null
      )
    ) {
      return;
    }
    if (!itemType.trim()) {
      showRejection({ reasons: t("pages.inventory.itemTypeRequired") });
      return;
    }
    formData.set("itemType", itemType.trim());

    startTransition(async () => {
      try {
        const created = await createInventoryItemsInBulk(formData);
        toast.success(
          t("pages.itemCatalog.bulkCreateSuccess", { count: String(created) })
        );
        closeDialog();
      } catch (error) {
        showRejectionFromError(error, t("pages.inventory.createItemFailed"));
      }
    });
  }

  return (
    <>
      <Dialog open={controlledOpen} onOpenChange={handleOpenChange}>
        <EmployeeDialogShell
          icon={Package}
          title={t("pages.itemCatalog.bulkCreateTitle")}
          description={t("pages.itemCatalog.bulkCreateDesc")}
          footer={
            <EmployeePrimaryButton form={FORM_ID} disabled={pending}>
              {pending
                ? t("bulkCreate.addingCount", { count: String(lineKeys.length) })
                : t("bulkCreate.addCount", { count: String(lineKeys.length) })}
            </EmployeePrimaryButton>
          }
        >
          <form
            id={FORM_ID}
            className={employeeDialogFormClass}
            action={submit}
            noValidate
            onInput={handleFormInput}
          >
            <input type="hidden" name="lineCount" value={lineKeys.length} />
            <div>
              <h3 className="text-sm font-semibold text-text">
                {t("bulkCreate.sharedTerms")}
              </h3>
              <p className="mt-1 text-xs text-muted">
                {t("pages.itemCatalog.bulkCreateSharedHint")}
              </p>
            </div>

            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass} htmlFor="bulk-inv-item-type">
                {t("pages.inventory.form.itemType")}
              </label>
              <Select
                value={itemType || undefined}
                onValueChange={(value) => setItemType(value ?? "")}
                items={INVENTORY_ITEM_TYPE_PRESETS.map((preset) => ({
                  value: preset,
                  label: localizeInventoryItemType(preset, locale),
                }))}
              >
                <SelectTrigger
                  id="bulk-inv-item-type"
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
                    <SelectItem
                      key={preset}
                      value={preset}
                      label={localizeInventoryItemType(preset, locale)}
                    >
                      {localizeInventoryItemType(preset, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className={employeeDialogHintClass}>
                {t("pages.inventory.form.itemTypeHint")}
              </p>
            </div>

            <BulkLineList
              title={t("pages.itemCatalog.bulkCreateItems")}
              description={t("pages.itemCatalog.bulkCreateItemsHint")}
              lineKeys={lineKeys}
              onAdd={(count) =>
                setLineKeys((current) => [
                  ...current,
                  ...Array.from({ length: count }, () => createBulkLineKey()),
                ])
              }
              onRemove={(index) =>
                setLineKeys((current) =>
                  current.length <= 1
                    ? current
                    : current.filter((_, itemIndex) => itemIndex !== index)
                )
              }
              renderLine={(index) => (
                <div className="grid grid-cols-1 gap-4">
                  <div className={employeeDialogFieldClass}>
                    <label className={employeeDialogLabelClass}>
                      {t("pages.inventory.form.sku")}
                    </label>
                    <input
                      readOnly
                      value={
                        !itemType.trim()
                          ? t("pages.inventory.form.skuPickType")
                          : previewSkus[index] ||
                            t("pages.inventory.form.skuLoading")
                      }
                      className={`${employeeInputClass} bg-strip font-mono text-muted`}
                    />
                    <p className={employeeDialogHintClass}>
                      {t("pages.itemCatalog.bulkCreateSkuHint")}
                    </p>
                  </div>
                  <div className={employeeDialogFieldClass}>
                    <label className={employeeDialogLabelClass}>
                      {t("pages.inventory.form.itemName")}
                    </label>
                    <input
                      name={bulkLineField(index, "name")}
                      required
                      className={employeeInputClass}
                      placeholder={t("pages.inventory.form.itemNamePlaceholder")}
                    />
                  </div>
                  <div className={employeeDialogFieldClass}>
                    <label className={employeeDialogLabelClass}>
                      {t("pages.inventory.form.description")}
                    </label>
                    <textarea
                      name={bulkLineField(index, "description")}
                      rows={2}
                      className={`${employeeInputClass} h-auto min-h-[4.5rem] py-3`}
                      placeholder={t(
                        "pages.inventory.form.descriptionPlaceholder"
                      )}
                    />
                  </div>
                </div>
              )}
            />
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
