"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import ProjectFilterSelect, {
  type ProjectFilterOption,
} from "@/components/projects/ProjectFilterSelect";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import type { ProjectSubCategory } from "@prisma/client";

type Props = {
  date: string;
  projectId?: string;
  subCategory?: ProjectSubCategory;
  projects: ProjectFilterOption[];
};

const filterFieldClass = "min-w-0 w-full";

export default function AttendanceDateFilters({
  date,
  projectId,
  subCategory,
  projects,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(next: {
    date?: string;
    projectId?: string | null;
    subCategory?: ProjectSubCategory | null;
  }) {
    const params = new URLSearchParams();
    params.set("date", next.date ?? date);

    const nextSubCategory =
      next.subCategory === null
        ? undefined
        : (next.subCategory ?? subCategory);
    if (nextSubCategory) params.set("subCategory", nextSubCategory);

    const nextProjectId =
      next.projectId === null ? undefined : (next.projectId ?? projectId);
    if (nextProjectId) {
      const stillValid = projects.some(
        (project) =>
          project.id === nextProjectId &&
          (!nextSubCategory || project.subCategory === nextSubCategory)
      );
      if (stillValid) params.set("projectId", nextProjectId);
    }

    startTransition(() => {
      router.push(`/attendance?${params.toString()}`);
    });
  }

  return (
    <div
      className={cn(
        "mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2",
        pending && "pointer-events-none"
      )}
    >
      <div className="space-y-1.5">
        <label
          htmlFor="attendance-filter-date"
          className="block text-xs font-medium uppercase tracking-wider text-subtle"
        >
          {t("common.labels.date")}
        </label>
        <Input
          id="attendance-filter-date"
          type="date"
          value={date}
          onChange={(e) => navigate({ date: e.target.value })}
          className={cn(
            employeeInputClass,
            filterFieldClass,
            "[color-scheme:dark]"
          )}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="attendance-filter-project"
          className="block text-xs font-medium uppercase tracking-wider text-subtle"
        >
          {t("common.labels.project")}
        </label>
        <ProjectFilterSelect
          id="attendance-filter-project"
          projectId={projectId}
          subCategory={subCategory}
          projects={projects}
          triggerClassName={cn(employeeSelectTriggerClass, filterFieldClass)}
          onChange={({ projectId: nextProjectId, subCategory: nextSub }) =>
            navigate({
              projectId: nextProjectId,
              subCategory: nextSub,
            })
          }
        />
      </div>
    </div>
  );
}
