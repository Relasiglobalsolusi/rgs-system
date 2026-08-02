"use client";

import { useTransition } from "react";
import { Building2 } from "lucide-react";
import { assignEmployeeToHeadOffice } from "@/app/employees/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
};

export default function EmployeeAssignDialog({
  open,
  onOpenChange,
  employeeId,
}: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();

  function assign() {
    startTransition(async () => {
      try {
        await assignEmployeeToHeadOffice(employeeId);
        onOpenChange(false);
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.employees.projectAssignDialog.assignFailed")
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
      }}
    >
      <EmployeeDialogShell
        icon={Building2}
        title={t("pages.employees.projectAssignDialog.title")}
        description={t("pages.employees.projectAssignDialog.description")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="button"
              disabled={pending}
              onClick={assign}
            >
              {pending
                ? t("pages.employees.projectAssignDialog.assigning")
                : t("pages.employees.projectAssignDialog.assign")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-text">
          <div className="flex items-center gap-3">
            <Building2 size={18} className="shrink-0 text-primary" />
            <span className="font-semibold">
              {t("pages.employees.projectAssignDialog.headOffice")}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">
            {t("pages.employees.projectAssignDialog.siteCrewNote")}
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
