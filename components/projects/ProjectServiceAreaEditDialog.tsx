"use client";

import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useState, useTransition } from "react";
import { Layers } from "lucide-react";

import { updateProjectServiceArea } from "@/app/projects/catalog-actions";
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
  areaOneTimeIsLocked,
  catalogDisplayName,
  type ProjectCatalogAreaDTO,
} from "@/lib/project-service-catalog";

export default function ProjectServiceAreaEditDialog({
  area,
  open,
  onOpenChange,
  onUpdated,
}: {
  area: ProjectCatalogAreaDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}) {
  const { t, locale } = useT();
  const [pending, startTransition] = useTransition();
  const oneTimeLocked = areaOneTimeIsLocked(area);
  const [allowsOneTime, setAllowsOneTime] = useState<YesNoChoice>(
    area.allowsOneTime && !oneTimeLocked ? "Yes" : "No"
  );

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateProjectServiceArea(area.id, formData);
        onOpenChange(false);
        onUpdated?.();
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.projects.catalogUpdateAreaFailed")
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <EmployeeDialogShell
        icon={Layers}
        title={t("pages.projects.catalogEditAreaTitle")}
        description={t("pages.projects.catalogEditAreaDescription")}
        maxWidth="lg"
        footer={
          <EmployeePrimaryButton form="edit-service-area-form" disabled={pending}>
            {pending
              ? t("common.actions.saving")
              : t("common.actions.saveChanges")}
          </EmployeePrimaryButton>
        }
      >
        <form id="edit-service-area-form" action={submit}>
          <div className={employeeDialogFormClass}>
            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="edit-service-area-name-en"
                className="text-sm font-medium text-muted"
              >
                {t("pages.projects.catalogName")}
              </label>
              <Input
                id="edit-service-area-name-en"
                name="nameEn"
                defaultValue={area.nameEn}
                required
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="edit-service-area-name-id"
                className="text-sm font-medium text-muted"
              >
                {t("pages.projects.catalogNameId")}
              </label>
              <Input
                id="edit-service-area-name-id"
                name="nameId"
                defaultValue={area.nameId}
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label
                id="edit-service-area-one-time-label"
                htmlFor="edit-service-area-one-time"
                className={employeeDialogLabelClass}
              >
                {t("pages.projects.oneTime")}
              </label>
              <YesNoChoiceCards
                id="edit-service-area-one-time"
                labelledBy="edit-service-area-one-time-label"
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
                  ? t("pages.projects.catalogOneTimeLockedAreaHint")
                  : t("pages.projects.catalogEnableOneTimeHint")}
              </p>
            </div>
            <p className="text-xs text-subtle">
              {catalogDisplayName(area, locale)}
            </p>
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
