"use client";

import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { Tags } from "lucide-react";

import { updateProjectSubcategory } from "@/app/projects/catalog-actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/use-t";
import {
  catalogDisplayName,
  type ProjectCatalogSubcategoryDTO,
} from "@/lib/project-service-catalog";

export default function ProjectSubcategoryEditDialog({
  subcategory,
  open,
  onOpenChange,
  onUpdated,
}: {
  subcategory: ProjectCatalogSubcategoryDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}) {
  const { t, locale } = useT();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateProjectSubcategory(subcategory.id, formData);
        onOpenChange(false);
        onUpdated?.();
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.projects.catalogUpdateSubFailed")
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <EmployeeDialogShell
        icon={Tags}
        title={t("pages.projects.catalogEditSubTitle")}
        description={t("pages.projects.catalogEditSubDescription")}
        maxWidth="lg"
        footer={
          <EmployeePrimaryButton form="edit-project-sub-form" disabled={pending}>
            {pending
              ? t("common.actions.saving")
              : t("common.actions.saveChanges")}
          </EmployeePrimaryButton>
        }
      >
        <form id="edit-project-sub-form" action={submit}>
          <div className={employeeDialogFormClass}>
            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="edit-project-sub-name-en"
                className="text-sm font-medium text-muted"
              >
                {t("pages.projects.catalogName")}
              </label>
              <Input
                id="edit-project-sub-name-en"
                name="nameEn"
                defaultValue={subcategory.nameEn}
                required
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="edit-project-sub-name-id"
                className="text-sm font-medium text-muted"
              >
                {t("pages.projects.catalogNameId")}
              </label>
              <Input
                id="edit-project-sub-name-id"
                name="nameId"
                defaultValue={subcategory.nameId}
                className={employeeInputClass}
              />
            </div>
            <p className="text-xs text-subtle">
              {catalogDisplayName(subcategory, locale)}
            </p>
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
