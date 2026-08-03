"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { writeOffInventoryStock } from "@/app/inventory/actions";
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
import { formatDateForInput } from "@/lib/format-tenure";
import { useT } from "@/lib/i18n/use-t";

const FORM_ID = "create-inventory-write-off-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryCatalogItem[];
};

export default function InventoryWriteOffDialog({
  open,
  onOpenChange,
  items,
}: Props) {
  const { t } = useT();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const stockedItems = items.filter((item) => item.active && item.currentStock > 0);
  const selected = stockedItems.find((item) => item.id === itemId);

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
    if (stockedItems.length === 0) {
      showRejection({ reasons: t("pages.inventory.noStockToIssue") });
      return;
    }
    const qty = Number(
      String(formData.get("quantity") ?? "").replace(/,/g, "").trim()
    );
    if (
      selected &&
      (!Number.isFinite(qty) || qty <= 0 || qty > selected.currentStock + 1e-9)
    ) {
      showRejection({
        reasons: t("pages.inventory.quantityExceedsStock", {
          available: String(selected.currentStock),
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
                disabled={pending || stockedItems.length === 0}
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
                onValueChange={(value) => setItemId(value ?? "")}
              >
                <SelectTrigger className={employeeSelectTriggerClass}>
                  <SelectValue
                    placeholder={t("pages.inventory.form.catalogItemPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {stockedItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} — {item.currentStock} {item.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected ? (
                <p className={employeeDialogHintClass}>
                  {t("pages.inventory.form.writeOffItemHint", {
                    available: String(selected.currentStock),
                    unit: selected.unit,
                  })}
                </p>
              ) : (
                <p className={employeeDialogHintClass}>
                  {t("pages.inventory.form.issueItemHint")}
                </p>
              )}
            </div>

            <div className={employeeDialogGridClass}>
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass} htmlFor="writeoff-qty">
                  {t("pages.inventory.form.quantity")}
                </label>
                <input
                  id="writeoff-qty"
                  name="quantity"
                  type="number"
                  min={0.001}
                  step="any"
                  required
                  max={selected?.currentStock}
                  className={employeeInputClass}
                />
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
