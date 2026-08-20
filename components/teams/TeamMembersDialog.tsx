"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";

import {
  addOperationsTeamMember,
  removeOperationsTeamMember,
} from "@/app/teams/actions";
import {
  EmployeeDialogShell,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogLabelClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";

export type TeamMemberRow = {
  employeeId: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
};

export type EligibleEmployeeRow = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  members: TeamMemberRow[];
  eligible: EligibleEmployeeRow[];
};

export default function TeamMembersDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  members,
  eligible,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [employeeId, setEmployeeId] = useState("");

  function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeeId) return;
    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("employeeId", employeeId);
    startTransition(async () => {
      try {
        await addOperationsTeamMember(formData);
        setEmployeeId("");
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.teams.addMemberFailed"));
      }
    });
  }

  function handleRemove(id: string) {
    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("employeeId", id);
    startTransition(async () => {
      try {
        await removeOperationsTeamMember(formData);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.teams.removeMemberFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={Users}
        title={t("pages.teams.members")}
        description={teamName}
        maxWidth="md"
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.actions.done")}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <form className={employeeDialogFormClass} onSubmit={handleAdd}>
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass} htmlFor="team-add-member">
                {t("pages.teams.addMember")}
              </label>
              {eligible.length === 0 ? (
                <p className="text-sm text-muted">{t("pages.teams.emptyEligible")}</p>
              ) : (
                <div className="flex gap-2">
                  <select
                    id="team-add-member"
                    className={employeeSelectTriggerClass}
                    value={employeeId}
                    onChange={(event) => setEmployeeId(event.target.value)}
                    disabled={pending}
                  >
                    <option value="">{t("common.actions.select")}</option>
                    {eligible.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName} · {employee.employeeNo}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="submit"
                    variant="successBadge"
                    size="badgeFlex"
                    disabled={pending || !employeeId}
                  >
                    {t("common.actions.add")}
                  </Button>
                </div>
              )}
            </div>
          </form>

          {members.length === 0 ? (
            <p className="text-sm text-muted">{t("pages.teams.emptyMembers")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {members.map((member) => (
                <li
                  key={member.employeeId}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-text">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="font-mono text-xs text-muted">{member.employeeNo}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => handleRemove(member.employeeId)}
                  >
                    {t("common.actions.remove")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
