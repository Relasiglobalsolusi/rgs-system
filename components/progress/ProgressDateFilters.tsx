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
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import { Input } from "@/components/ui/input";
import { CLEANING_PROJECT_SUB_CATEGORIES } from "@/lib/project-subcategory";
import { localizeSubCategoryShort } from "@/lib/i18n/labels";
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

export default function ProgressDateFilters({
  date,
  projectId,
  subCategory,
  projects,
}: Props) {
  const { t, locale } = useT();
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
      router.push(`/progress?${params.toString()}`);
    });
  }

  return (
    <div
      className={cn(
        "mb-6 space-y-4 no-print",
        pending && "pointer-events-none"
      )}
    >
      <div className="space-y-1.5 sm:max-w-xs">
        <label
          htmlFor="progress-filter-date"
          className="block text-xs font-medium uppercase tracking-wider text-subtle"
        >
          {t("common.labels.date")}
        </label>
        <Input
          id="progress-filter-date"
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

      <div className="flex flex-wrap gap-2">
        <DirectoryFilterTab
          active={!subCategory}
          onClick={() => navigate({ subCategory: null, projectId: null })}
        >
          {t("common.actions.all")}
        </DirectoryFilterTab>
        {CLEANING_PROJECT_SUB_CATEGORIES.map((value) => (
          <DirectoryFilterTab
            key={value}
            active={subCategory === value}
            onClick={() =>
              navigate({ subCategory: value, projectId: null })
            }
          >
            {localizeSubCategoryShort(value, locale)}
          </DirectoryFilterTab>
        ))}
      </div>

      <div className="space-y-1.5 sm:max-w-md">
        <label
          htmlFor="progress-filter-project"
          className="block text-xs font-medium uppercase tracking-wider text-subtle"
        >
          {t("common.labels.project")}
        </label>
        <ProjectFilterSelect
          id="progress-filter-project"
          projectId={projectId}
          subCategory={subCategory}
          projects={projects}
          projectsOnly
          triggerClassName={cn(employeeSelectTriggerClass, filterFieldClass)}
          onChange={({ projectId: nextProjectId }) =>
            navigate({
              projectId: nextProjectId,
              subCategory: subCategory ?? null,
            })
          }
        />
      </div>
    </div>
  );
}
