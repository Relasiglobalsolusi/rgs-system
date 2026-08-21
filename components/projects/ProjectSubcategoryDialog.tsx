"use client";

import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useState, useTransition } from "react";
import { Tags } from "lucide-react";

import { createProjectSubcategory } from "@/app/projects/catalog-actions";
import ProjectOptionPills from "@/components/projects/ProjectOptionPills";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  areaId: string;
  allowsOneTime: boolean;
  onCreated?: () => void;
};

export default function ProjectSubcategoryDialog({
  areaId,
  allowsOneTime,
  onCreated,
}: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [billingKind, setBillingKind] = useState<"CONTRACT" | "ONE_TIME">(
    "CONTRACT"
  );

  async function submit(formData: FormData) {
    formData.set("areaId", areaId);
    formData.set("billingKind", allowsOneTime ? billingKind : "CONTRACT");
    startTransition(async () => {
      try {
        await createProjectSubcategory(formData);
        setOpen(false);
        onCreated?.();
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.catalogCreateSub"));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setBillingKind("CONTRACT");
      }}
      disablePointerDismissal
    >
      <DialogTrigger asChild>
        <Button variant="successBadge" size="badgeFlex">
          {t("pages.projects.addSubcategory")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={Tags}
        title={t("pages.projects.catalogSubTitle")}
        description={t("pages.projects.catalogSubDescription")}
        maxWidth="lg"
        footer={
          <EmployeePrimaryButton form="create-project-sub-form" disabled={pending}>
            {pending
              ? t("pages.projects.catalogCreating")
              : t("pages.projects.catalogCreateSub")}
          </EmployeePrimaryButton>
        }
      >
        <form id="create-project-sub-form" action={submit}>
          <div className={employeeDialogFormClass}>
            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="project-sub-name-en"
                className="text-sm font-medium text-text"
              >
                {t("pages.projects.catalogName")}
              </label>
              <Input
                id="project-sub-name-en"
                name="nameEn"
                required
                placeholder={t("pages.projects.catalogNamePlaceholder")}
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="project-sub-name-id"
                className="text-sm font-medium text-muted"
              >
                {t("pages.projects.catalogNameId")}
              </label>
              <Input
                id="project-sub-name-id"
                name="nameId"
                placeholder={t("pages.projects.catalogNamePlaceholder")}
                className={employeeInputClass}
              />
            </div>
            {allowsOneTime ? (
              <ProjectOptionPills
                label={t("pages.projects.catalogBillingKind")}
                value={billingKind}
                options={[
                  {
                    value: "CONTRACT",
                    label: t("pages.projects.catalogBillingContract"),
                  },
                  {
                    value: "ONE_TIME",
                    label: t("pages.projects.catalogBillingOneTime"),
                  },
                ]}
                onChange={(value) =>
                  setBillingKind(value as "CONTRACT" | "ONE_TIME")
                }
                columns={2}
              />
            ) : (
              <input type="hidden" name="billingKind" value="CONTRACT" />
            )}
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
