"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectSubCategory } from "@prisma/client";

import type { FinancialReportProjectRow } from "@/app/billing/financial-report/actions";
import { directoryFilterSelectTriggerClass } from "@/components/ui/DirectoryFilterSelect";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_COLUMN_WIDTH } from "@/components/ui/trash-action-buttons";
import {
  localizeProjectStatus,
  localizeSubCategory,
  localizeSubCategoryChipLines,
  localizeWorkflowChipLines,
} from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import {
  PROJECT_FILTER_ALL,
  COMMERCIAL_PROJECT_SUB_CATEGORIES,
  isProjectSubCategory,
} from "@/lib/project-subcategory";
import { formatContractPrice } from "@/lib/project-billing";
import { getProjectWorkflowStatusLabel } from "@/lib/project-status";
import { cn } from "@/lib/utils";

type Props = {
  clientId: string;
  projects: FinancialReportProjectRow[];
};

export default function FinancialReportProjectDirectory({
  clientId,
  projects,
}: Props) {
  const { t, locale } = useT();
  const router = useRouter();
  const [subCategory, setSubCategory] = useState<string>(PROJECT_FILTER_ALL);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      if (
        subCategory !== PROJECT_FILTER_ALL &&
        project.subCategory !== subCategory
      ) {
        return false;
      }
      return matchesDirectorySearch(
        searchQuery,
        project.name,
        project.location ?? undefined
      );
    });
  }, [projects, subCategory, searchQuery]);

  const columns = useMemo(() => {
    const cols: DataTableColumn<FinancialReportProjectRow>[] = [
      {
        key: "project",
        title: t("pages.financialReport.columns.project"),
        width: "14rem",
        share: 2,
        className: "min-w-[14rem]",
        render: (project) => (
          <div className="min-w-0">
            <p className="font-semibold text-text">{project.name}</p>
            <p className="mt-0.5 max-w-md truncate text-sm text-subtle">
              {project.location ?? t("pages.projects.noLocation")}
            </p>
          </div>
        ),
      },
      {
        key: "subCategory",
        title: t("common.labels.type"),
        width: STATUS_COLUMN_WIDTH,
        align: "center",
        className: "min-w-[10rem] overflow-visible whitespace-nowrap",
        render: (project) => {
          const typeLines = localizeSubCategoryChipLines(
            project.subCategory as ProjectSubCategory,
            locale
          );
          return (
            <div className="inline-flex shrink-0 items-center justify-center">
              <StatusBadge
                status="success"
                compact
                lines={typeLines ?? undefined}
              >
                {typeLines
                  ? undefined
                  : localizeSubCategory(project.subCategory, locale)}
              </StatusBadge>
            </div>
          );
        },
      },
      {
        key: "contract",
        title: t("pages.financialReport.columns.contractValue"),
        width: "8.5rem",
        align: "right",
        className: "min-w-[8.5rem] tabular-nums",
        render: (project) =>
          project.contractValue != null
            ? formatContractPrice(project.contractValue)
            : "—",
      },
      {
        key: "spending",
        title: t("pages.financialReport.columns.spending"),
        width: "8.5rem",
        align: "right",
        className: "min-w-[8.5rem] tabular-nums",
        render: (project) => formatContractPrice(project.moneyOut),
      },
      {
        key: "profit",
        title: t("pages.financialReport.columns.profit"),
        width: "8.5rem",
        align: "right",
        className: "min-w-[8.5rem] tabular-nums",
        render: (project) => (
          <span className={project.profit < 0 ? "text-danger" : "text-text"}>
            {formatContractPrice(project.profit)}
          </span>
        ),
      },
      {
        key: "status",
        title: t("common.labels.status"),
        width: "10rem",
        align: "center",
        className: "min-w-[10rem] overflow-visible",
        render: (project) => {
          const englishLabel = getProjectWorkflowStatusLabel({
            status: project.status,
          });
          const statusLabel = localizeProjectStatus(project.status, locale);
          const statusLines = localizeWorkflowChipLines(englishLabel, locale);
          return (
            <StatusBadge
              status="active"
              compact
              lines={statusLines ?? undefined}
            >
              {statusLines ? undefined : statusLabel}
            </StatusBadge>
          );
        },
      },
    ];
    return cols;
  }, [locale, t]);

  const trimmedSearch = searchQuery.trim();
  const hasActiveSearch = trimmedSearch !== "";
  const hasSubFilter = subCategory !== PROJECT_FILTER_ALL;
  const subLabel = isProjectSubCategory(subCategory)
    ? localizeSubCategory(subCategory, locale)
    : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-subtle">
          {hasActiveSearch || hasSubFilter
            ? hasSubFilter && subLabel && hasActiveSearch
              ? t("pages.financialReport.filterResultsInFor", {
                  count: filtered.length,
                  type: subLabel,
                  query: trimmedSearch,
                })
              : hasSubFilter && subLabel
                ? t("pages.financialReport.filterResultsIn", {
                    count: filtered.length,
                    type: subLabel,
                  })
                : hasActiveSearch
                  ? t("pages.financialReport.filterResultsFor", {
                      count: filtered.length,
                      query: trimmedSearch,
                    })
                  : t("pages.financialReport.filterResults", {
                      count: filtered.length,
                    })
            : t(
                filtered.length === 1
                  ? "pages.financialReport.projectOne"
                  : "pages.financialReport.projectOther",
                { count: filtered.length }
              )}
        </p>

        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
          <Select
            value={subCategory}
            onValueChange={(value) => {
              if (value == null) return;
              setSubCategory(value);
            }}
          >
            <SelectTrigger
              id="financial-report-project-subcategory"
              aria-label={t("pages.financialReport.filterSubcategory")}
              className={cn(
                directoryFilterSelectTriggerClass,
                "w-full min-w-[12rem] sm:w-[14rem]"
              )}
            >
              <SelectValue>
                {(value) =>
                  value && isProjectSubCategory(value)
                    ? localizeSubCategory(value, locale)
                    : t("common.actions.all")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PROJECT_FILTER_ALL}>
                {t("common.actions.all")}
              </SelectItem>
              {COMMERCIAL_PROJECT_SUB_CATEGORIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {localizeSubCategory(value, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DirectorySearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t("pages.financialReport.searchProjects")}
            className="max-w-none sm:w-auto sm:max-w-xs"
          />
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title={t("pages.financialReport.emptyProjects")}
          description={t("pages.financialReport.emptyProjectsDesc")}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.financialReport.noProjectsMatch")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(project) => project.id}
          onRowClick={(project) =>
            router.push(`/billing/financial-report/${clientId}/${project.id}`)
          }
          emptyMessage={t("pages.projects.emptyShow")}
        />
      )}
    </>
  );
}
