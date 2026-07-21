"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROJECT_FILTER_ALL,
  PROJECT_SUB_CATEGORIES,
  getProjectFilterSelectValue,
  parseProjectFilterSelectValue,
  toProjectSubCategoryFilterValue,
} from "@/lib/project-subcategory";
import { localizeSubCategory } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";
import type { ProjectSubCategory } from "@prisma/client";

export type ProjectFilterOption = {
  id: string;
  name: string;
  subCategory: ProjectSubCategory;
};

type Props = {
  id: string;
  projectId?: string;
  subCategory?: ProjectSubCategory;
  projects: ProjectFilterOption[];
  triggerClassName?: string;
  /** When true, dropdown is flat All + projects (subcategory handled elsewhere, e.g. chips). */
  projectsOnly?: boolean;
  onChange: (next: {
    projectId: string | null;
    subCategory: ProjectSubCategory | null;
  }) => void;
};

export default function ProjectFilterSelect({
  id,
  projectId,
  subCategory,
  projects,
  triggerClassName,
  projectsOnly = false,
  onChange,
}: Props) {
  const { t, locale } = useT();
  const selectedValue = projectsOnly
    ? (projectId ?? PROJECT_FILTER_ALL)
    : getProjectFilterSelectValue({ projectId, subCategory });

  // When a subcategory is the active filter, only list projects in that subcategory.
  const listedProjects = subCategory
    ? projects.filter((project) => project.subCategory === subCategory)
    : projects;

  return (
    <Select
      value={selectedValue}
      onValueChange={(value) => {
        const parsed = parseProjectFilterSelectValue(value);
        if (parsed.kind === "all") {
          onChange({
            projectId: null,
            subCategory: projectsOnly ? (subCategory ?? null) : null,
          });
          return;
        }
        if (parsed.kind === "subCategory") {
          onChange({ projectId: null, subCategory: parsed.subCategory });
          return;
        }
        onChange({
          projectId: parsed.projectId,
          subCategory: projectsOnly ? (subCategory ?? null) : null,
        });
      }}
    >
      <SelectTrigger id={id} className={cn(triggerClassName)}>
        <SelectValue placeholder={t("pages.projects.filterAllProjects")}>
          {(value) => {
            if (!value || value === PROJECT_FILTER_ALL) {
              return t("pages.projects.filterAllProjects");
            }
            const parsed = parseProjectFilterSelectValue(value);
            if (parsed.kind === "subCategory") {
              return localizeSubCategory(parsed.subCategory, locale);
            }
            if (parsed.kind === "project") {
              return (
                projects.find((project) => project.id === parsed.projectId)
                  ?.name ?? t("pages.projects.filterAllProjects")
              );
            }
            return t("pages.projects.filterAllProjects");
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={PROJECT_FILTER_ALL}>
          {t("pages.projects.filterAllProjects")}
        </SelectItem>
        {!projectsOnly &&
          PROJECT_SUB_CATEGORIES.map((value) => (
            <SelectItem
              key={value}
              value={toProjectSubCategoryFilterValue(value)}
            >
              {localizeSubCategory(value, locale)}
            </SelectItem>
          ))}
        {listedProjects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
