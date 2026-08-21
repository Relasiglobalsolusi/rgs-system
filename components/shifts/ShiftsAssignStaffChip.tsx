"use client";

import { useState, type FormEvent } from "react";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { assignProjectStaff } from "@/app/projects/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFormClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import ProjectStaffPicker, {
  type ProjectStaffEmployee,
} from "@/components/projects/ProjectStaffPicker";
import ProjectTeamPicker, {
  type ProjectTeamOption,
} from "@/components/projects/ProjectTeamPicker";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { teamsForProjectServiceArea } from "@/lib/operations-team-kind";
import type { ProjectSubCategory } from "@prisma/client";
import { useT } from "@/lib/i18n/use-t";

export default function ShiftsAssignStaffChip({
  projectId,
  subCategory,
  areaCatalogId,
  serviceArea,
  employees,
  teams,
  assignedEmployeeIds,
  assignedTeamIds,
}: {
  projectId: string;
  subCategory: ProjectSubCategory | string;
  areaCatalogId?: string | null;
  serviceArea?: string | null;
  employees: ProjectStaffEmployee[];
  teams: ProjectTeamOption[];
  assignedEmployeeIds: string[];
  assignedTeamIds: string[];
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("projectId", projectId);
    setPending(true);
    try {
      await assignProjectStaff(formData);
      setOpen(false);
      router.refresh();
    } catch (error) {
      showRejectionFromError(error, t("pages.shifts.assignStaffFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="successBadge" size="badgeFlex">
          <Users />
          {t("pages.projects.assignStaff")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={Users}
        title={t("pages.projects.assignStaff")}
        description={t("pages.shifts.assignStaffDesc")}
        maxWidth="lg"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="shifts-assign-staff-form"
              disabled={pending}
            >
              {pending
                ? t("pages.shifts.assignStaffSaving")
                : t("pages.projects.assignStaff")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        <form
          id="shifts-assign-staff-form"
          onSubmit={handleSubmit}
          className={employeeDialogFormClass}
        >
          <ProjectTeamPicker
            teams={teamsForProjectServiceArea(teams, {
              areaCatalogId,
              serviceArea,
              subCategory,
            })}
            defaultCheckedIds={assignedTeamIds}
          />
          <ProjectStaffPicker
            employees={employees}
            defaultCheckedIds={assignedEmployeeIds}
          />
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
