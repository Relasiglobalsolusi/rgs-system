"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useState, useTransition } from "react";
import { Tags } from "lucide-react";

import { createEmployeeCategory } from "@/app/employee-categories/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  onCreated?: () => void;
  trigger?: React.ReactNode;
};

export default function EmployeeCategoryDialog({
  onCreated,
  trigger,
}: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await createEmployeeCategory(formData);
        setOpen(false);
        onCreated?.();
      } catch (error) {
        showRejectionFromError(error, t("pages.employees.deptDialog.createFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen} disablePointerDismissal>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="successBadge" size="badgeFlex">
            {t("pages.employees.addDepartment")}
          </Button>
        )}
      </DialogTrigger>

      <EmployeeDialogShell
        icon={Tags}
        title={t("pages.employees.deptDialog.createTitle")}
        description={t("pages.employees.deptDialog.createDescription")}
        maxWidth="lg"
        footer={
          <EmployeePrimaryButton form="create-category-form" disabled={pending}>
            {pending
              ? t("pages.employees.deptDialog.creating")
              : t("pages.employees.deptDialog.createButton")}
          </EmployeePrimaryButton>
        }
      >
        <form id="create-category-form" action={submit}>
          <div className={employeeDialogFormClass}>
            <div className={employeeDialogFieldClass}>
              <label htmlFor="category-name" className="text-sm font-medium text-muted">
                {t("pages.employees.deptDialog.departmentName")}
              </label>
              <Input
                id="category-name"
                name="name"
                placeholder={t("pages.employees.deptDialog.namePlaceholder")}
                required
                className={employeeInputClass}
              />
            </div>

            <div className={employeeDialogFieldClass}>
              <label htmlFor="category-prefix" className="text-sm font-medium text-muted">
                {t("pages.employees.deptDialog.numberPrefix")}
              </label>
              <Input
                id="category-prefix"
                name="prefix"
                placeholder={t("pages.employees.deptDialog.prefixPlaceholder")}
                required
                maxLength={6}
                className={employeeInputClass}
              />
              <p className="text-xs text-subtle">
                {t("pages.employees.deptDialog.prefixHint")}
              </p>
            </div>
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
