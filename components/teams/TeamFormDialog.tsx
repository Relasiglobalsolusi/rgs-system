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
import { catalogDisplayName } from "@/lib/project-service-catalog";

export type TeamTypeOption = {
  id: string;
  nameEn: string;
  nameId: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: TeamTypeOption[];
  team?: {
    id: string;
    name: string;
    serviceAreaCatalogId: string | null;
  } | null;
};

export default function TeamFormDialog({
  open,
  onOpenChange,
  catalog,
  team,
}: Props) {
  const { t, locale } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const defaultTypeId = team?.serviceAreaCatalogId || catalog[0]?.id || "";
  const [name, setName] = useState(team?.name ?? "");
  const [serviceAreaCatalogId, setServiceAreaCatalogId] = useState(defaultTypeId);
  const isEdit = Boolean(team);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next) {
      setName(team?.name ?? "");
      setServiceAreaCatalogId(
        team?.serviceAreaCatalogId || catalog[0]?.id || ""
      );
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("name", name);
    formData.set("serviceAreaCatalogId", serviceAreaCatalogId);
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
            <EmployeePrimaryButton
              form="team-form"
              disabled={pending || catalog.length === 0}
            >
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
              value={serviceAreaCatalogId}
              onChange={(event) => setServiceAreaCatalogId(event.target.value)}
              disabled={pending || catalog.length === 0}
              required
            >
              {catalog.map((area) => (
                <option key={area.id} value={area.id}>
                  {catalogDisplayName(area, locale)}
                </option>
              ))}
            </select>
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
