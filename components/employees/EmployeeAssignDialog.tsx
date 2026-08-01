"use client";

import { useState, useTransition } from "react";
import { BriefcaseBusiness, Building2 } from "lucide-react";
import {
  assignEmployeeToHeadOffice,
  assignEmployeeToProject,
} from "@/app/employees/actions";
import type { ProjectOption } from "@/components/employees/EmployeeFormFields";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type AssignTarget = "headOffice" | "projects";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  projects: ProjectOption[];
};

export default function EmployeeAssignDialog({
  open,
  onOpenChange,
  employeeId,
  projects,
}: Props) {
  const { t } = useT();
  const [target, setTarget] = useState<AssignTarget>("headOffice");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function reset() {
    setTarget("headOffice");
    setSelectedIds([]);
  }

  function toggle(projectId: string) {
    setSelectedIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId]
    );
  }

  function selectTarget(next: AssignTarget) {
    setTarget(next);
    if (next === "headOffice") {
      setSelectedIds([]);
    }
  }

  function assign() {
    startTransition(async () => {
      try {
        if (target === "headOffice") {
          await assignEmployeeToHeadOffice(employeeId);
        } else {
          const formData = new FormData();
          formData.set("projectIds", selectedIds.join(","));
          await assignEmployeeToProject(employeeId, formData);
        }
        reset();
        onOpenChange(false);
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.employees.projectAssignDialog.assignFailed")
        );
      }
    });
  }

  const canSubmit =
    target === "headOffice" ||
    (target === "projects" && selectedIds.length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <EmployeeDialogShell
        icon={BriefcaseBusiness}
        title={t("pages.employees.projectAssignDialog.title")}
        description={t("pages.employees.projectAssignDialog.description")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="button"
              disabled={pending || !canSubmit}
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
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => selectTarget("headOffice")}
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition",
              target === "headOffice"
                ? "border-primary bg-primary/10 text-text"
                : "border-border bg-elevated text-text hover:border-border-strong"
            )}
          >
            <Building2 size={18} className="shrink-0 text-primary" />
            <span className="font-semibold">
              {t("pages.employees.projectAssignDialog.headOffice")}
            </span>
          </button>

          <div className="space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {t("pages.employees.projectAssignDialog.projectsHeading")}
            </p>
            {projects.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">
                {t("pages.employees.projectAssignDialog.noActiveProjects")}
              </p>
            ) : (
              projects.map((project) => {
                const checked = selectedIds.includes(project.id);
                return (
                  <label
                    key={project.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm text-text transition",
                      target === "projects" && checked
                        ? "border-primary bg-primary/10"
                        : "border-border bg-elevated hover:border-border-strong"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => {
                        selectTarget("projects");
                        toggle(project.id);
                      }}
                    />
                    <span>
                      {project.name}
                      {project.location ? ` · ${project.location}` : ""}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
