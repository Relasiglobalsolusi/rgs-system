"use client";

import { useRef, useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import { redoProjectJob } from "@/app/projects/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { detailActionBarButtonClassName } from "@/components/projects/detail-action-bar";
import ProjectStaffPicker, {
  type ProjectStaffEmployee,
} from "@/components/projects/ProjectStaffPicker";
import ProjectTeamPicker, {
  type ProjectTeamOption,
} from "@/components/projects/ProjectTeamPicker";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { StackedChipLabel } from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";
import { DEFAULT_PROJECT_DURATION_DAYS, todayDateInput } from "@/lib/project-contract";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  employees: ProjectStaffEmployee[];
  teams?: ProjectTeamOption[];
  size?: "default" | "lg" | "bar";
};

export default function ProjectRedoJobButton({
  projectId,
  employees,
  teams = [],
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
      showRejection({ reasons: t("pages.projects.redoStartRequired") });
      return;
    }
    const proof = formData.get("agreement");
    if (!(proof instanceof File) || proof.size === 0) {
      showRejection({ reasons: t("pages.projects.redoAgreementRequired") });
      return;
    }

    startTransition(async () => {
      try {
        await redoProjectJob(projectId, formData);
        setOpen(false);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.redoJobFailed"));
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
          lines={[t("pages.projects.redoJob1"), t("pages.projects.redoJob2")]}
        />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <EmployeeDialogShell
          icon={RotateCcw}
          title={t("pages.projects.redoJob")}
          description={t("pages.projects.redoJobHint")}
          maxWidth="lg"
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
                  : t("pages.projects.redoJob")}
              </EmployeePrimaryButton>
            </div>
          }
        >
          <form ref={formRef} className={employeeDialogFormClass}>
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-text">
                {t("pages.projects.redoStart")}
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
                {t("pages.projects.redoDuration")}
              </label>
              <Input
                type="number"
                name="durationDays"
                min={1}
                defaultValue={DEFAULT_PROJECT_DURATION_DAYS}
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-text">
                {t("pages.projects.redoAgreement")}
              </label>
              <Input
                type="file"
                name="agreement"
                accept="image/*,.pdf,application/pdf"
                required
                className={employeeInputClass}
              />
            </div>
            <ProjectTeamPicker teams={teams} />
            <ProjectStaffPicker employees={employees} />
          </form>
        </EmployeeDialogShell>
      </Dialog>
    </>
  );
}
