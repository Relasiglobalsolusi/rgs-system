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
import { formatContractPrice } from "@/lib/project-billing";
import { useT } from "@/lib/i18n/use-t";

const FORM_ID = "create-inventory-issue-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryCatalogItem[];
  projects: InventoryProjectOption[];
};

export default function InventoryIssueDialog({
  open,
  onOpenChange,
  items,
  projects,
}: Props) {
  const { t } = useT();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const stockedItems = useMemo(
    () => items.filter((item) => item.active && item.currentStock > 0),
    [items]
  );
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
    setProjectId("");
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
        setProjectId("");
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
    if (!projectId) {
      showRejection({ reasons: t("pages.inventory.projectRequired") });
      return;
    }
    formData.set("itemId", itemId);
    formData.set("projectId", projectId);

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
                  pending || stockedItems.length === 0 || projects.length === 0
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
                  {t("pages.inventory.form.issueCostHint", {
                    unitCost: formatContractPrice(
                      selected.avgUnitCost ?? selected.lastUnitCost ?? 0
                    ),
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

            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.inventory.form.project")}
              </label>
              <Select
                value={projectId || undefined}
                onValueChange={(value) => setProjectId(value ?? "")}
              >
                <SelectTrigger className={employeeSelectTriggerClass}>
                  <SelectValue
                    placeholder={t("pages.inventory.form.projectPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className={employeeDialogHintClass}>
                {t("pages.inventory.form.projectHint")}
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
                  min={0.001}
                  step="any"
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
