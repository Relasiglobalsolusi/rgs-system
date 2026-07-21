"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useState, useTransition } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

import { deleteEmployeeCategory } from "@/app/employee-categories/actions";
import type { EmployeeCategoryRow } from "@/components/employee-categories/EmployeeCategoryEditDialog";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeSelectTriggerClass,
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
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  category: EmployeeCategoryRow;
  otherCategories: EmployeeCategoryRow[];
  onDeleted?: () => void;
} & DirectoryDialogControlProps;

export default function EmployeeCategoryDeleteDialog({
  category,
  otherCategories,
  onDeleted,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const { t, locale } = useT();
  const [pending, startTransition] = useTransition();

  const employeeCount = category._count.employees;
  const hasEmployees = employeeCount > 0;
  const assignableCategories = otherCategories.filter((item) => item.active);
  const [reassignTarget, setReassignTarget] = useState<string>(() =>
    assignableCategories.length > 0
      ? assignableCategories[0].id
      : ""
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setReassignTarget(
        assignableCategories.length > 0
          ? assignableCategories[0].id
          : ""
      );
    }
  }

  function handleDelete() {
    if (hasEmployees && !reassignTarget) {
      showRejection({
        reasons: "Choose another active department before deleting this department.",
      });
      return;
    }

    startTransition(async () => {
      try {
        await deleteEmployeeCategory(
          category.id,
          hasEmployees ? reassignTarget : null
        );
        setOpen(false);
        onDeleted?.();
      } catch (error) {
        showRejectionFromError(error, t("pages.employees.deptDialog.deleteFailed"));
      }
    });
  }

  const canSubmit = !pending;

  const assignedKey =
    employeeCount === 1
      ? "pages.employees.deptDialog.employeesAssignedOne"
      : "pages.employees.deptDialog.employeesAssignedOther";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="destructiveBadge" size="badge">
            {t("common.actions.delete")}
          </Button>
        </DialogTrigger>
      ) : null}

      <EmployeeDialogShell
        icon={Trash2}
        title={t("pages.employees.deptDialog.deleteTitle")}
        description={
          hasEmployees
            ? t("pages.employees.deptDialog.deleteDescWithEmployees")
            : t("pages.employees.deptDialog.deleteDescEmpty")
        }
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-col">
            <EmployeePrimaryButton
              type="button"
              variant="danger"
              disabled={!canSubmit}
              onClick={handleDelete}
            >
              {pending
                ? t("common.actions.deleting")
                : t("pages.employees.deptDialog.deleteConfirm")}
            </EmployeePrimaryButton>

            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        <div>
          <div className="rounded-xl border border-border bg-elevated px-4 py-4">
            <p className="text-sm font-medium text-text">
              {localizeDepartmentLabel(category.slug, category.name, locale)}
            </p>
            <p className="mt-1 font-mono text-sm text-muted">{category.prefix}</p>
          </div>

          {hasEmployees ? (
            <>
              <div className="mt-4 flex gap-3 rounded-xl border border-amber-500/25 bg-card-tint-amber px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-sm leading-6 text-text">
                  {t(assignedKey, { count: employeeCount })}
                </p>
              </div>

              <div className="mt-4 space-y-2">
                <label
                  htmlFor="reassign-target"
                  className="text-sm font-medium text-muted"
                >
                  {t("pages.employees.deptDialog.moveEmployeesTo")}
                </label>
                <Select
                  value={reassignTarget}
                  onValueChange={(value) => {
                    if (value == null) return;
                    setReassignTarget(value);
                  }}
                >
                  <SelectTrigger
                    id="reassign-target"
                    className={employeeSelectTriggerClass}
                  >
                    <SelectValue
                      placeholder={t(
                        "pages.employees.deptDialog.selectDestination"
                      )}
                    >
                      {(value) => {
                        if (!value) return null;
                        const target = otherCategories.find(
                          (item) => item.id === value
                        );
                        return target
                          ? `${localizeDepartmentLabel(target.slug, target.name, locale)} (${target.prefix})`
                          : null;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {assignableCategories.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {localizeDepartmentLabel(item.slug, item.name, locale)}{" "}
                        ({item.prefix})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-subtle">
                  {t("pages.employees.deptDialog.reassignHint")}
                </p>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted">
              {t("pages.employees.deptDialog.noEmployeesAssigned")}
            </p>
          )}
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
