"use client";

import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useState, useTransition } from "react";
import { Tags } from "lucide-react";

import { updateProjectSubcategory } from "@/app/projects/catalog-actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import YesNoChoiceCards, {
  type YesNoChoice,
} from "@/components/ui/YesNoChoiceCards";
import { useT } from "@/lib/i18n/use-t";
import {
  catalogDisplayName,
  subcategoryOneTimeIsLocked,
  type ProjectCatalogAreaDTO,
  type ProjectCatalogSubcategoryDTO,
} from "@/lib/project-service-catalog";

export default function ProjectSubcategoryEditDialog({
  area,
  subcategory,
  open,
  onOpenChange,
  onUpdated,
}: {
  area: ProjectCatalogAreaDTO;
  subcategory: ProjectCatalogSubcategoryDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}) {
  const { t, locale } = useT();
  const [pending, startTransition] = useTransition();
  const oneTimeLocked = subcategoryOneTimeIsLocked(area);
  const [allowsOneTime, setAllowsOneTime] = useState<YesNoChoice>(
    subcategory.billingKind === "ONE_TIME" && !oneTimeLocked ? "Yes" : "No"
  );

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
            <div className={employeeDialogFieldClass}>
              <label
                id="edit-project-sub-one-time-label"
                htmlFor="edit-project-sub-one-time"
                className={employeeDialogLabelClass}
              >
                {t("pages.projects.oneTime")}
              </label>
              <YesNoChoiceCards
                id="edit-project-sub-one-time"
                labelledBy="edit-project-sub-one-time-label"
                value={allowsOneTime}
                onChange={setAllowsOneTime}
                disabled={oneTimeLocked}
              />
              <input
                type="hidden"
                name="allowsOneTime"
                value={allowsOneTime === "Yes" ? "yes" : "no"}
              />
              <p className={employeeDialogHintClass}>
                {oneTimeLocked
                  ? t("pages.projects.catalogOneTimeLockedSubHint")
                  : t("pages.projects.catalogSubOneTimeHint")}
              </p>
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
