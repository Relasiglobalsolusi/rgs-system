"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useState, useTransition } from "react";
import { Pencil, Tags } from "lucide-react";

import { updateEmployeeCategory } from "@/app/employee-categories/actions";
import EmployeeCategoryDeleteDialog from "@/components/employee-categories/EmployeeCategoryDeleteDialog";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
} from "@/components/ui/trash-action-buttons";
import {
  useDirectoryDialogOpen,
  type DirectoryDialogControlProps,
} from "@/components/ui/use-directory-dialog-open";
import { useT } from "@/lib/i18n/use-t";

export type EmployeeCategoryRow = {
  id: string;
  name: string;
  slug: string;
  prefix: string;
  active: boolean;
  _count: {
    employees: number;
  };
};

type Props = {
  category: EmployeeCategoryRow;
  otherCategories?: EmployeeCategoryRow[];
  showDelete?: boolean;
  onUpdated?: () => void;
} & DirectoryDialogControlProps;

export default function EmployeeCategoryEditDialog({
  category,
  otherCategories = [],
  showDelete = false,
  onUpdated,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const { t } = useT();
  const [active, setActive] = useState(category.active);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const showDeleteButton = showDelete;

  function closeDialog() {
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setActive(category.active);
    }
  }

  async function submit(formData: FormData) {
    formData.set("active", String(active));

    startTransition(async () => {
      try {
        await updateEmployeeCategory(category.id, formData);
        setOpen(false);
        onUpdated?.();
      } catch (error) {
        showRejectionFromError(error, t("pages.employees.deptDialog.updateFailed"));
      }
    });
  }

  const employeeCountKey =
    category._count.employees === 1
      ? "pages.employees.deptDialog.employeeCountOne"
      : "pages.employees.deptDialog.employeeCountOther";

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        disablePointerDismissal
      >
        {showTrigger ? (
          <DialogTrigger asChild>
            <Button size="badge" variant="mutedBadge">
              <Pencil className="mr-1" />
              {t("common.actions.edit")}
            </Button>
          </DialogTrigger>
        ) : null}

        <EmployeeDialogShell
          icon={Tags}
          title={t("pages.employees.deptDialog.editTitle")}
          description={t("pages.employees.deptDialog.editDescription")}
          maxWidth="lg"
          footer={
            <div className="flex w-full flex-col gap-3">
              {showDeleteButton ? (
                <EmployeePrimaryButton
                  type="button"
                  variant="danger"
                  disabled={pending}
                  className="font-bold"
                  onClick={() => setDeleteOpen(true)}
                >
                  {t("common.actions.delete")}
                </EmployeePrimaryButton>
              ) : null}
              <EmployeePrimaryButton
                form="edit-category-form"
                disabled={pending}
                className="font-bold"
              >
                {pending
                  ? t("common.actions.saving")
                  : t("common.actions.saveChanges")}
              </EmployeePrimaryButton>
            </div>
          }
        >
          <form id="edit-category-form" action={submit}>
            <div className={employeeDialogFormClass}>
              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor="edit-category-name"
                  className="text-sm font-medium text-muted"
                >
                  {t("pages.employees.deptDialog.departmentName")}
                </label>
                <Input
                  id="edit-category-name"
                  name="name"
                  defaultValue={category.name}
                  required
                  className={employeeInputClass}
                />
              </div>

              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor="edit-category-prefix"
                  className="text-sm font-medium text-muted"
                >
                  {t("pages.employees.deptDialog.numberPrefix")}
                </label>
                <Input
                  id="edit-category-prefix"
                  name="prefix"
                  defaultValue={category.prefix}
                  required
                  maxLength={6}
                  className={employeeInputClass}
                />
                <p className="text-xs text-subtle">
                  {t("pages.employees.deptDialog.prefixHintEdit", {
                    prefix: category.prefix,
                  })}
                </p>
              </div>

              <label className="flex items-center gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) => setActive(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-elevated text-cyan-500 focus:ring-cyan-400/20"
                />
                {t("pages.employees.deptDialog.activeAvailable")}
              </label>

              <p className="text-xs text-subtle">
                {t(employeeCountKey, { count: category._count.employees })}
              </p>
            </div>
          </form>
        </EmployeeDialogShell>
      </Dialog>

      <EmployeeCategoryDeleteDialog
        category={category}
        otherCategories={otherCategories}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        showTrigger={false}
        onDeleted={() => {
          closeDialog();
          onUpdated?.();
        }}
      />
    </>
  );
}
