"use client";

import { useMemo } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Combobox } from "@base-ui/react/combobox";

import { employeeSelectTriggerClass } from "@/components/employees/employee-dialog-ui";
import type { ProjectOption } from "@/components/employees/EmployeeFormFields";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  projects: ProjectOption[];
  projectIds: string[];
  onProjectIdsChange: (value: string[]) => void;
};

function projectSearchText(project: ProjectOption) {
  return `${project.name} ${project.location ?? ""}`.toLowerCase();
}

export default function ProjectMultiSelect({
  projects,
  projectIds,
  onProjectIdsChange,
}: Props) {
  const { t } = useT();
  const selectedProjects = useMemo(
    () => projects.filter((project) => projectIds.includes(project.id)),
    [projects, projectIds]
  );

  const removeProject = (projectId: string) => {
    onProjectIdsChange(projectIds.filter((id) => id !== projectId));
  };

  return (
    <div className="space-y-2">
      <Combobox.Root
        multiple
        items={projects}
        value={selectedProjects}
        onValueChange={(value) =>
          onProjectIdsChange((value as ProjectOption[]).map((project) => project.id))
        }
        isItemEqualToValue={(a, b) => a.id === b.id}
        itemToStringLabel={(project) => project.name}
        filter={(item, query) =>
          projectSearchText(item as ProjectOption).includes(query.toLowerCase())
        }
      >
        <Combobox.Trigger
          className={cn(
            employeeSelectTriggerClass,
            "flex w-full items-center justify-between gap-2"
          )}
        >
          <span
            className={cn(
              "truncate",
              selectedProjects.length > 0 ? "text-text" : "text-subtle"
            )}
          >
            {selectedProjects.length > 0
              ? `${selectedProjects.length} project${selectedProjects.length === 1 ? "" : "s"} selected`
              : t("pages.employees.projectMultiSelect.selectProjects")}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-subtle" />
        </Combobox.Trigger>

        <Combobox.Portal>
          <Combobox.Positioner side="bottom" align="start" className="z-50">
            <Combobox.Popup className="z-50 w-(--anchor-width) min-w-(--anchor-width) overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-[0_10px_28px_rgba(0,0,0,0.45)] ring-1 ring-black/25">
              <div className="border-b border-border p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
                  <Combobox.Input
                    placeholder={t(
                      "pages.employees.projectMultiSelect.searchPlaceholder"
                    )}
                    className="h-10 w-full rounded-md border border-border bg-elevated py-2 pr-3 pl-9 text-sm text-text placeholder:text-subtle outline-none focus:border-primary/45 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              <Combobox.List className="max-h-60 overflow-y-auto p-1">
                <Combobox.Empty className="px-3 py-6 text-center text-sm text-subtle">
                  {t("pages.employees.projectMultiSelect.noProjects")}
                </Combobox.Empty>
                <Combobox.Collection>
                  {(project: ProjectOption) => (
                    <Combobox.Item
                      key={project.id}
                      value={project}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm outline-none transition-colors",
                        "data-highlighted:bg-elevated data-highlighted:text-text",
                        projectIds.includes(project.id) &&
                          "bg-card-tint-cyan text-text"
                      )}
                    >
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                        <Combobox.ItemIndicator>
                          <Check className="size-3.5 text-accent-cyan" />
                        </Combobox.ItemIndicator>
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-text">
                          {project.name}
                        </span>
                        {project.location && (
                          <span className="mt-0.5 block text-xs text-subtle">
                            {project.location}
                          </span>
                        )}
                      </span>
                    </Combobox.Item>
                  )}
                </Combobox.Collection>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      {selectedProjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedProjects.map((project) => (
            <span
              key={project.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent-cyan/35 bg-card-tint-cyan px-2.5 py-1 text-xs font-medium text-cyan-300"
            >
              {project.name}
              <button
                type="button"
                onClick={() => removeProject(project.id)}
                className="rounded-full p-0.5 text-cyan-300 transition hover:bg-elevated hover:text-accent-teal"
                aria-label={t("pages.employees.projectMultiSelect.removeProject")}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
