"use client";

import { useMemo, useState } from "react";

import { employeeSelectTriggerClass } from "@/components/employees/employee-dialog-ui";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/use-t";
import {
  projectSelectLabel,
  sortProjectSelectOptions,
  type ProjectSelectOption,
} from "@/lib/project-select";
import { cn } from "@/lib/utils";

type SearchableProjectSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  projects: readonly ProjectSelectOption[];
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  triggerClassName?: string;
};

export default function SearchableProjectSelect({
  value,
  onValueChange,
  projects,
  placeholder,
  disabled,
  required,
  triggerClassName,
}: SearchableProjectSelectProps) {
  const { t } = useT();
  const [search, setSearch] = useState("");

  const sorted = useMemo(
    () => sortProjectSelectOptions(projects),
    [projects]
  );

  const items = useMemo(
    () =>
      sorted.map((project) => ({
        value: project.id,
        label: projectSelectLabel(project),
      })),
    [sorted]
  );

  const filtered = useMemo(
    () =>
      sorted.filter((project) =>
        matchesDirectorySearch(search, project.name, project.clientName)
      ),
    [sorted, search]
  );

  return (
    <Select
      value={value || null}
      onValueChange={(next) => onValueChange(next ?? "")}
      items={items}
      disabled={disabled}
      required={required}
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
    >
      <SelectTrigger
        className={cn(employeeSelectTriggerClass, triggerClassName)}
      >
        <SelectValue placeholder={placeholder}>
          {(selected) => {
            if (!selected) return null;
            const project = sorted.find((entry) => entry.id === selected);
            return project ? projectSelectLabel(project) : null;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        toolbar={
          <DirectorySearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("common.labels.searchProjects")}
            className="max-w-none"
          />
        }
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-subtle">
            {t("common.labels.noMatchingProjects")}
          </div>
        ) : (
          filtered.map((project) => {
            const label = projectSelectLabel(project);
            return (
              <SelectItem key={project.id} value={project.id} label={label}>
                {label}
              </SelectItem>
            );
          })
        )}
      </SelectContent>
    </Select>
  );
}
