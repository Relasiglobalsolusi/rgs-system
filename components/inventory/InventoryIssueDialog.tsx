"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { FolderKanban } from "lucide-react";
import { toast } from "sonner";

import { createInventoryProjectIssue } from "@/app/inventory/actions";
import type {
  InventoryCatalogItem,
  InventoryProjectOption,
} from "@/components/inventory/inventory-types";
import {
  formatCatalogItemLabel,
  formatCatalogItemStockLabel,
  formatProjectLabel,
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
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateForInput } from "@/lib/format-tenure";
import { formatContractPrice } from "@/lib/project-billing";
import {
  formatInventoryQty,
  isWholeInventoryQty,
} from "@/lib/inventory";
import { useT } from "@/lib/i18n/use-t";

const FORM_ID = "create-inventory-issue-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryCatalogItem[];
  projects: InventoryProjectOption[];
  /** When set, project is fixed (e.g. assign from project detail). */
  lockedProjectId?: string;
  /**
   * When true (project-page assign stock), Equipment is omitted — issue equipment
   * only from Inventory → Project Issues.
   */
  excludeEquipment?: boolean;
};

export default function InventoryIssueDialog({
  open,
  onOpenChange,
  items,
  projects,
  lockedProjectId,
  excludeEquipment = false,
}: Props) {
  const { t } = useT();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [projectId, setProjectId] = useState(lockedProjectId ?? "");
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const stockedItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.active &&
          item.currentStock > 0 &&
          !(excludeEquipment && matchInventoryItemType(item.itemType, "equipment"))
      ),
    [items, excludeEquipment]
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
  const effectiveProjectId = lockedProjectId ?? projectId;

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
    setItemSearch("");
    setProjectId(lockedProjectId ?? "");
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
        setItemSearch("");
        setProjectId(lockedProjectId ?? "");
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
    if (lockedProjectId) {
      setProjectId(lockedProjectId);
    }
    const frame = requestAnimationFrame(() => {
      setBaseline(captureHtmlFormBaseline(FORM_ID, ""));
    });
    return () => cancelAnimationFrame(frame);
  }, [open, lockedProjectId]);

  async function submit(formData: FormData) {
    if (!itemId) {
      showRejection({ reasons: t("pages.inventory.itemRequired") });
      return;
    }
    if (!effectiveProjectId) {
      showRejection({ reasons: t("pages.inventory.projectRequired") });
      return;
    }
    if (stockedItems.length === 0) {
      showRejection({ reasons: t("pages.inventory.noStockToIssue") });
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
    if (
      selected &&
      qty > selected.currentStock
    ) {
      showRejection({
        reasons: t("pages.inventory.quantityExceedsStock", {
          available: formatInventoryQty(selected.currentStock),
          unit: selected.unit,
        }),
      });
      return;
    }
    formData.set("itemId", itemId);
    formData.set("projectId", effectiveProjectId);

    startTransition(async () => {
      try {
        await createInventoryProjectIssue(formData);
        toast.success(t("pages.inventory.issueCreated"));
        closeDialog();
      } catch (error) {
        showRejectionFromError(error, t("pages.inventory.createIssueFailed"));
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <EmployeeDialogShell
          icon={FolderKanban}
          title={t("pages.inventory.addIssue")}
          description={t("pages.inventory.addIssueDesc")}
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
                  (!lockedProjectId && projects.length === 0)
                }
              >
                {pending
                  ? t("common.actions.saving")
                  : t("pages.inventory.saveIssue")}
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
                  {isEquipmentSelected
                    ? t("pages.inventory.form.issueEquipmentDeployHint", {
                        available: formatInventoryQty(selected.currentStock),
                        unit: selected.unit,
                      })
                    : t("pages.inventory.form.issueCostHint", {
                        unitCost: formatContractPrice(
                          selected.avgUnitCost ?? selected.lastUnitCost ?? 0
                        ),
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

            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.inventory.form.project")}
              </label>
              {lockedProjectId ? (
                <>
                  <input type="hidden" name="projectId" value={lockedProjectId} />
                  <p className="rounded-xl border border-border bg-elevated px-3 py-2.5 text-sm font-medium text-text">
                    {projects.find((project) => project.id === lockedProjectId)
                      ?.name ?? lockedProjectId}
                  </p>
                </>
              ) : (
                <Select
                  value={projectId || undefined}
                  onValueChange={(value) => setProjectId(value ?? "")}
                  items={projects.map((project) => ({
                    value: project.id,
                    label: formatProjectLabel(project),
                  }))}
                >
                  <SelectTrigger className={employeeSelectTriggerClass}>
                    <SelectValue
                      placeholder={t("pages.inventory.form.projectPlaceholder")}
                    >
                      {(value) => {
                        if (!value) return null;
                        const project = projects.find((entry) => entry.id === value);
                        return project ? formatProjectLabel(project) : null;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem
                        key={project.id}
                        value={project.id}
                        label={formatProjectLabel(project)}
                      >
                        {formatProjectLabel(project)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className={employeeDialogHintClass}>
                {stockedItems.length === 0
                  ? t("pages.inventory.noStockToIssue")
                  : t("pages.inventory.form.projectHint")}
              </p>
            </div>

            <div className={employeeDialogGridClass}>
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass} htmlFor="issue-qty">
                  {t("pages.inventory.form.quantity")}
                </label>
                <input
                  id="issue-qty"
                  name="quantity"
                  type="number"
                  min={1}
                  step={1}
                  required
                  max={selected?.currentStock}
                  className={employeeInputClass}
                />
              </div>
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass} htmlFor="issue-date">
                  {t("pages.inventory.form.issueDate")}
                </label>
                <input
                  id="issue-date"
                  name="movedAt"
                  type="date"
                  required
                  defaultValue={formatDateForInput(new Date())}
                  className={employeeInputClass}
                />
              </div>
            </div>

            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass} htmlFor="issue-notes">
                {t("pages.inventory.form.notes")}
              </label>
              <textarea
                id="issue-notes"
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
