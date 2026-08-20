"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteOperationsTeam } from "@/app/teams/actions";
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
  teamId: string;
  teamName: string;
};

export default function TeamDeleteDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const formData = new FormData();
    formData.set("teamId", teamId);
    startTransition(async () => {
      try {
        await deleteOperationsTeam(formData);
        router.refresh();
        onOpenChange(false);
      } catch (error) {
        showRejectionFromError(error, t("pages.teams.deleteFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={Trash2}
        title={t("pages.teams.deleteTeam")}
        description={t("pages.teams.deleteConfirm", { name: teamName })}
        maxWidth="sm"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
            <EmployeePrimaryButton
              type="button"
              variant="danger"
              disabled={pending}
              onClick={handleDelete}
            >
              {pending ? t("common.actions.saving") : t("pages.teams.deleteTeam")}
            </EmployeePrimaryButton>
          </div>
        }
      >
        <div />
      </EmployeeDialogShell>
    </Dialog>
  );
}
