"use client";

import { useRef, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { renewProjectContract } from "@/app/projects/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { detailActionBarButtonClassName } from "@/components/projects/detail-action-bar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FileDropField } from "@/components/ui/FileDropField";
import { Input } from "@/components/ui/input";
import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { StackedChipLabel } from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";
import { todayDateInput } from "@/lib/project-contract";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  size?: "default" | "lg" | "bar";
};

export default function ProjectRenewContractButton({
  projectId,
  size = "lg",
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    if (!String(formData.get("startDate") ?? "").trim()) {
      showRejection({ reasons: t("pages.projects.renewStartRequired") });
      return;
    }
    if (!String(formData.get("endDate") ?? "").trim()) {
      showRejection({ reasons: t("pages.projects.renewEndRequired") });
      return;
    }
    const proof = formData.get("agreement");
    if (!(proof instanceof File) || proof.size === 0) {
      showRejection({ reasons: t("pages.projects.renewAgreementRequired") });
      return;
    }

    startTransition(async () => {
      try {
        await renewProjectContract(projectId, formData);
        setOpen(false);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.renewContractFailed"));
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="successBadge"
        size={size === "bar" ? "lg" : size}
        className={cn(size === "bar" && detailActionBarButtonClassName)}
        onClick={() => setOpen(true)}
      >
        <StackedChipLabel
          lines={[
            t("pages.projects.renewContract1"),
            t("pages.projects.renewContract2"),
          ]}
        />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <EmployeeDialogShell
          icon={RefreshCw}
          title={t("pages.projects.renewContract")}
          description={t("pages.projects.renewContractHint")}
          maxWidth="md"
          footer={
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
              <EmployeeSecondaryButton
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                {t("common.actions.cancel")}
              </EmployeeSecondaryButton>
              <EmployeePrimaryButton
                type="button"
                disabled={pending}
                onClick={submit}
              >
                {pending
                  ? t("common.actions.saving")
                  : t("pages.projects.renewContract")}
              </EmployeePrimaryButton>
            </div>
          }
        >
          <form ref={formRef} className={employeeDialogFormClass}>
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-text">
                {t("pages.projects.renewStart")}
              </label>
              <Input
                type="date"
                name="startDate"
                required
                defaultValue={todayDateInput()}
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-text">
                {t("pages.projects.renewEnd")}
              </label>
              <Input
                type="date"
                name="endDate"
                required
                className={employeeInputClass}
              />
            </div>
            <FileDropField
              id="project-renew-agreement"
              name="agreement"
              label={t("pages.projects.renewAgreement")}
              required
              accept="image/*,.pdf,application/pdf"
            />
          </form>
        </EmployeeDialogShell>
      </Dialog>
    </>
  );
}
