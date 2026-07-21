"use client";

import { useState, useTransition } from "react";
import { BriefcaseBusiness } from "lucide-react";
import { assignEmployeeToProject } from "@/app/employees/actions";
import type { ProjectOption } from "@/components/employees/EmployeeFormFields";
import { EmployeeDialogShell, EmployeePrimaryButton, EmployeeSecondaryButton } from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { showRejectionFromError } from "@/components/ui/rejection-notice";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; employeeId: string; projects: ProjectOption[] };

export default function EmployeeAssignDialog({ open, onOpenChange, employeeId, projects }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  function toggle(projectId: string) {
    setSelectedIds((current) => current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId]);
  }
  function assign() {
    const formData = new FormData();
    formData.set("projectIds", selectedIds.join(","));
    startTransition(async () => {
      try { await assignEmployeeToProject(employeeId, formData); setSelectedIds([]); onOpenChange(false); }
      catch (error) { showRejectionFromError(error, "Failed to assign employee to project."); }
    });
  }
  return <Dialog open={open} onOpenChange={(nextOpen) => { onOpenChange(nextOpen); if (!nextOpen) setSelectedIds([]); }}>
    <EmployeeDialogShell icon={BriefcaseBusiness} title="Assign to project" description="Choose one or more active projects. This updates the employee's placement to On project." maxWidth="md" footer={
      <div className="flex w-full flex-col gap-3">
        <EmployeePrimaryButton type="button" disabled={pending || selectedIds.length === 0} onClick={assign}>{pending ? "Assigning…" : "Assign"}</EmployeePrimaryButton>
        <EmployeeSecondaryButton disabled={pending} onClick={() => onOpenChange(false)}>Cancel</EmployeeSecondaryButton>
      </div>
    }>
      <div className="space-y-2">
        {projects.length === 0 ? <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">No active projects are available.</p> : projects.map((project) => (
          <label key={project.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-text">
            <Checkbox checked={selectedIds.includes(project.id)} onCheckedChange={() => toggle(project.id)} />
            <span>{project.name}{project.location ? ` · ${project.location}` : ""}</span>
          </label>
        ))}
      </div>
    </EmployeeDialogShell>
  </Dialog>;
}
