"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BillingMode, ProjectSubCategory } from "@prisma/client";
import { toast } from "sonner";

import { reorderProjects } from "@/app/projects/actions";
import { directoryFilterSelectTriggerClass } from "@/components/ui/DirectoryFilterSelect";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { STATUS_COLUMN_WIDTH } from "@/components/ui/trash-action-buttons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  localizeBillingMode,
  localizeProjectStatus,
  localizeSubCategory,
  localizeSubCategoryChipLines,
  localizeWorkflowChipLines,
} from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import {
  PROJECT_FILTER_ALL,
  PROJECT_SUB_CATEGORIES,
  isProjectSubCategory,
} from "@/lib/project-subcategory";
import { formatContractPrice } from "@/lib/project-billing";
import {
  getProjectWorkflowStatusLabel,
} from "@/lib/project-status";
import { cn } from "@/lib/utils";

export type BillingProjectRow = {
  id: string;
  name: string;
  /** Milestone-aware list title when an unpaid period applies. */
  displayName?: string;
  location: string | null;
  status: string;
  subCategory: ProjectSubCategory;
  billingMode: BillingMode;
  contractPrice: number | null;
  openInvoices: number;
  lateInvoices: number;
};

type Props = {
  clientId: string;
  projects: BillingProjectRow[];
};

export default function BillingProjectDirectory({
  clientId,
  projects,
}: Props) {
  const { t, locale } = useT();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [subCategory, setSubCategory] = useState<string>(PROJECT_FILTER_ALL);
  const [searchQuery, setSearchQuery] = useState("");

  function handleReorder(orderedIds: string[]) {
    startTransition(async () => {
      try {
        await reorderProjects(orderedIds);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("pages.projects.reorderFailed")
        );
        router.refresh();
      }
    });
  }

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      if (
        subCategory !== PROJECT_FILTER_ALL &&
        project.subCategory !== subCategory
      ) {
        return false;
      }
      const title = project.displayName ?? project.name;
      return matchesDirectorySearch(searchQuery, title, project.name);
    });
  }, [projects, subCategory, searchQuery]);

  const trimmedSearch = searchQuery.trim();
  const hasActiveSearch = trimmedSearch !== "";
  const hasSubFilter = subCategory !== PROJECT_FILTER_ALL;
  const subLabel = isProjectSubCategory(subCategory)
    ? localizeSubCategory(subCategory, locale)
    : null;

  const columns = useMemo(() => {
    const cols: DataTableColumn<BillingProjectRow>[] = [
      {
        key: "project",
        title: t("pages.billing.columns.project"),
        width: "14rem",
        share: 2,
        className: "min-w-[14rem]",
        render: (project) => {
          const title = project.displayName ?? project.name;
          const modeLabel = localizeBillingMode(project.billingMode, locale);
          return (
            <div className="min-w-0">
              <p className="font-semibold text-text">{title}</p>
              <p className="mt-0.5 max-w-md truncate text-sm text-subtle">
                {project.location ?? t("pages.projects.noLocation")} ·{" "}
                {modeLabel}
                {project.contractPrice != null
                  ? ` · ${formatContractPrice(project.contractPrice)}`
                  : ""}
              </p>
            </div>
          );
        },
      },
      {
        key: "subCategory",
        title: t("common.labels.type"),
        width: STATUS_COLUMN_WIDTH,
        align: "center",
        className: "min-w-[10rem] overflow-visible whitespace-nowrap",
        render: (project) => {
          const typeLines = localizeSubCategoryChipLines(
            project.subCategory,
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
        key: "status",
        title: t("common.labels.status"),
        width: "14rem",
        align: "center",
        className: "min-w-[14rem] overflow-visible",
        render: (project) => {
          const englishLabel = getProjectWorkflowStatusLabel({
            status: project.status,
          });
          const statusLabel = localizeProjectStatus(project.status, locale);
          const statusLines = localizeWorkflowChipLines(englishLabel, locale);
          return (
            <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-1.5">
              <StatusBadge
                status="active"
                compact
                lines={statusLines ?? undefined}
              >
                {statusLines ? undefined : statusLabel}
              </StatusBadge>
              {project.openInvoices > 0 ? (
                <StatusBadge status="warning" compact>
                  {t("pages.billing.openCount", {
                    count: project.openInvoices,
                  })}
                </StatusBadge>
              ) : null}
              {project.lateInvoices > 0 ? (
                <StatusBadge status="danger" compact>
                  {t("pages.billing.lateCount", {
                    count: project.lateInvoices,
                  })}
                </StatusBadge>
              ) : null}
            </div>
          );
        },
      },
    ];
    return cols;
  }, [locale, t]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-subtle">
          {hasActiveSearch || hasSubFilter
            ? hasSubFilter && subLabel && hasActiveSearch
              ? t("pages.billing.filterResultsInFor", {
                  count: filtered.length,
                  type: subLabel,
                  query: trimmedSearch,
                })
              : hasSubFilter && subLabel
                ? t("pages.billing.filterResultsIn", {
                    count: filtered.length,
                    type: subLabel,
                  })
                : hasActiveSearch
                  ? t("pages.billing.filterResultsFor", {
                      count: filtered.length,
                      query: trimmedSearch,
                    })
                  : t("pages.billing.filterResults", {
                      count: filtered.length,
                    })
            : t(
                filtered.length === 1
                  ? "pages.billing.projectOne"
                  : "pages.billing.projectOther",
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
              id="billing-project-subcategory"
              aria-label={t("pages.billing.filterSubcategory")}
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
              {PROJECT_SUB_CATEGORIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {localizeSubCategory(value, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DirectorySearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t("pages.billing.searchProjects")}
            className="max-w-none sm:max-w-xs"
          />
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title={t("pages.billing.emptyProjects")}
          description={t("pages.billing.emptyProjectsDesc")}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.billing.emptyProjectsDesc")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(project) => project.id}
          onRowClick={(project) =>
            router.push(`/billing/${clientId}/${project.id}`)
          }
          reorderable
          onReorder={handleReorder}
          emptyMessage={t("pages.projects.emptyShow")}
        />
      )}
    </>
  );
}
