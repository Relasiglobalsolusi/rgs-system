"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UsersRound } from "lucide-react";

import {
  createOperationsTeam,
  updateOperationsTeam,
} from "@/app/teams/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import type { OperationsTeamKindValue } from "@/lib/operations-teams";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: {
    id: string;
    name: string;
    kind: OperationsTeamKindValue;
  } | null;
};

export default function TeamFormDialog({ open, onOpenChange, team }: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(team?.name ?? "");
  const [kind, setKind] = useState<OperationsTeamKindValue>(
    team?.kind ?? "GENERAL_CLEANING"
  );
  const isEdit = Boolean(team);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next) {
      setName(team?.name ?? "");
      setKind(team?.kind ?? "GENERAL_CLEANING");
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("name", name);
    formData.set("kind", kind);
    if (team) formData.set("teamId", team.id);
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateOperationsTeam(formData);
        } else {
          await createOperationsTeam(formData);
        }
        router.refresh();
        onOpenChange(false);
      } catch (error) {
        showRejectionFromError(
          error,
          isEdit ? t("pages.teams.updateFailed") : t("pages.teams.createFailed")
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <EmployeeDialogShell
        icon={UsersRound}
        title={isEdit ? t("pages.teams.editTeam") : t("pages.teams.addTeam")}
        description={t("pages.teams.assignmentDescription")}
        maxWidth="sm"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
            <EmployeePrimaryButton form="team-form" disabled={pending}>
              {pending
                ? t("common.actions.saving")
                : isEdit
                  ? t("common.actions.save")
                  : t("pages.teams.addTeam")}
            </EmployeePrimaryButton>
          </div>
        }
      >
        <form id="team-form" className={employeeDialogFormClass} onSubmit={handleSubmit}>
          <div className={employeeDialogFieldClass}>
            <label className={employeeDialogLabelClass} htmlFor="team-name">
              {t("pages.teams.name")}
            </label>
            <input
              id="team-name"
              className={employeeInputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={pending}
            />
          </div>
          <div className={employeeDialogFieldClass}>
            <label className={employeeDialogLabelClass} htmlFor="team-kind">
              {t("pages.teams.kind")}
            </label>
            <select
              id="team-kind"
              className={employeeSelectTriggerClass}
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as OperationsTeamKindValue)
              }
              disabled={pending}
            >
              <option value="GENERAL_CLEANING">
                {t("pages.teams.kindGeneral")}
              </option>
              <option value="FACADE_CLEANING">
                {t("pages.teams.kindFacade")}
              </option>
            </select>
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
