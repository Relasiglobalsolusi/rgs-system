import { Input } from "@/components/ui/input";
import { employeeInputClass } from "@/components/employees/employee-dialog-ui";
import type { ProjectOption } from "@/components/employees/EmployeeFormFields";

export type AssignmentShiftDefaults = Record<
  string,
  { shiftStart: string | null; shiftEnd: string | null }
>;

type Props = {
  projects: ProjectOption[];
  projectIds: string[];
  defaults?: AssignmentShiftDefaults;
};

export default function AssignmentShiftFields({
  projects,
  projectIds,
  defaults = {},
}: Props) {
  const selected = projects.filter((project) => projectIds.includes(project.id));

  if (selected.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-elevated p-4">
      <div>
        <p className="text-sm font-medium text-text">Shift times</p>
        <p className="mt-1 text-xs text-muted">
          When this staff member works at each site. They should clock in on CICO
          before shift start when possible — late check-ins are still allowed.
        </p>
      </div>

      <div className="space-y-3">
        {selected.map((project) => {
          const shift = defaults[project.id];
          return (
            <div
              key={project.id}
              className="space-y-3 rounded-lg border border-border bg-inset p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">
                  {project.name}
                </p>
                {project.location && (
                  <p className="truncate text-xs text-muted">
                    {project.location}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0 space-y-1">
                  <label className="text-[11px] font-medium tracking-wide text-muted uppercase">
                    Start
                  </label>
                  <Input
                    type="time"
                    name={`shiftStart_${project.id}`}
                    defaultValue={shift?.shiftStart ?? ""}
                    className={employeeInputClass}
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <label className="text-[11px] font-medium tracking-wide text-muted uppercase">
                    End
                  </label>
                  <Input
                    type="time"
                    name={`shiftEnd_${project.id}`}
                    defaultValue={shift?.shiftEnd ?? ""}
                    className={employeeInputClass}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
