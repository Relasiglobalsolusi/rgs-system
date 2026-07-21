"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { extendProjectContract } from "@/app/projects/actions";
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
import { Input } from "@/components/ui/input";
import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { StackedChipLabel } from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";
import {
  addDaysToDateInput,
  toDateInputValue,
  todayDateInput,
} from "@/lib/project-contract";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  currentEndDate: Date | string | null;
  size?: "default" | "lg" | "bar";
};

export default function ProjectExtendContractButton({
  projectId,
  currentEndDate,
  size = "lg",
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const currentEndInput =
    toDateInputValue(currentEndDate) || todayDateInput();
  // Server requires new end > current end — min is the day after.
  const minExtend = addDaysToDateInput(currentEndInput, 1) || currentEndInput;

  function submit() {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    const extendTo = String(formData.get("endDate") ?? "").trim();
    if (!extendTo) {
      showRejection({ reasons: t("pages.projects.extendToRequired") });
      return;
    }
    const proof = formData.get("extensionProof");
    if (!(proof instanceof File) || proof.size === 0) {
      showRejection({ reasons: t("pages.projects.extendProofRequired") });
      return;
    }

    startTransition(async () => {
      try {
        await extendProjectContract(projectId, formData);
        setOpen(false);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.extendContractFailed"));
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="infoBadge"
        size={size === "bar" ? "lg" : size}
        className={cn(size === "bar" && detailActionBarButtonClassName)}
        onClick={() => setOpen(true)}
      >
        <StackedChipLabel
          lines={[
            t("pages.projects.extendContract1"),
            t("pages.projects.extendContract2"),
          ]}
        />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <EmployeeDialogShell
          icon={CalendarPlus}
          title={t("pages.projects.extendContract")}
          description={t("pages.projects.extendProofHint")}
          maxWidth="md"
          footer={
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
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
                  : t("pages.projects.extendContract")}
              </EmployeePrimaryButton>
            </div>
          }
        >
          <form ref={formRef} className={employeeDialogFormClass}>
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-text">
                {t("pages.projects.extendTo")}
              </label>
              <Input
                type="date"
                name="endDate"
                required
                min={minExtend}
                defaultValue={minExtend}
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-text">
                {t("pages.projects.extendProof")}
              </label>
              <Input
                type="file"
                name="extensionProof"
                accept="image/*,.pdf,application/pdf"
                required
                className={employeeInputClass}
              />
            </div>
          </form>
        </EmployeeDialogShell>
      </Dialog>
    </>
  );
}
