"use client";

import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useState, useTransition } from "react";
import { Layers } from "lucide-react";

import { createProjectServiceArea } from "@/app/projects/catalog-actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import YesNoChoiceCards, {
  type YesNoChoice,
} from "@/components/ui/YesNoChoiceCards";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  onCreated?: () => void;
};

export default function ProjectServiceAreaDialog({ onCreated }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [allowsOneTime, setAllowsOneTime] = useState<YesNoChoice>("Yes");

  async function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await createProjectServiceArea(formData);
        setOpen(false);
        onCreated?.();
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.catalogCreateArea"));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setAllowsOneTime("Yes");
      }}
      disablePointerDismissal
    >
      <DialogTrigger asChild>
        <Button variant="successBadge" size="badgeFlex">
          {t("pages.projects.addServiceArea")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={Layers}
        title={t("pages.projects.catalogAreaTitle")}
        description={t("pages.projects.catalogAreaDescription")}
        maxWidth="lg"
        footer={
          <EmployeePrimaryButton form="create-service-area-form" disabled={pending}>
            {pending
              ? t("pages.projects.catalogCreating")
              : t("pages.projects.catalogCreateArea")}
          </EmployeePrimaryButton>
        }
      >
        <form id="create-service-area-form" action={submit}>
          <div className={employeeDialogFormClass}>
            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="service-area-name-en"
                className="text-sm font-medium text-text"
              >
                {t("pages.projects.catalogName")}
              </label>
              <Input
                id="service-area-name-en"
                name="nameEn"
                required
                placeholder={t("pages.projects.catalogNamePlaceholder")}
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="service-area-name-id"
                className="text-sm font-medium text-muted"
              >
                {t("pages.projects.catalogNameId")}
              </label>
              <Input
                id="service-area-name-id"
                name="nameId"
                placeholder={t("pages.projects.catalogNamePlaceholder")}
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label
                id="service-area-one-time-label"
                htmlFor="service-area-one-time"
                className={employeeDialogLabelClass}
              >
                {t("pages.projects.catalogEnableOneTime")}
              </label>
              <YesNoChoiceCards
                id="service-area-one-time"
                labelledBy="service-area-one-time-label"
                value={allowsOneTime}
                onChange={setAllowsOneTime}
              />
              <input
                type="hidden"
                name="allowsOneTime"
                value={allowsOneTime === "Yes" ? "yes" : "no"}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.projects.catalogEnableOneTimeHint")}
              </p>
            </div>
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
