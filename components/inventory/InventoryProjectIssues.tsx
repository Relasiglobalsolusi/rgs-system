"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

import {
  compareMovedAtDesc,
  matchInventoryItemType,
  partitionByInventoryItemType,
} from "@/components/inventory/inventory-category";
import type { InventoryIssueRow } from "@/components/inventory/inventory-types";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import { matchesDirectorySearch } from "@/components/ui/DirectorySearchInput";
import { formatInventoryQtyWithUnit } from "@/lib/inventory";
import { useT } from "@/lib/i18n/use-t";
import { formatDisplayDate } from "@/lib/format-date";
import { formatContractPrice } from "@/lib/project-billing";

function issueExpenseCost(row: InventoryIssueRow): number {
  if (matchInventoryItemType(row.item.itemType, "equipment")) return 0;
  return row.totalCost;
}

function isEquipmentIssue(row: InventoryIssueRow): boolean {
  return matchInventoryItemType(row.item.itemType, "equipment");
}

/** Costed stock issues only (chemical / consumable / other) — not equipment deploys. */
function countCostedIssues(rows: InventoryIssueRow[]): number {
  return rows.reduce((n, row) => n + (isEquipmentIssue(row) ? 0 : 1), 0);
}

function countEquipmentDeploys(rows: InventoryIssueRow[]): number {
  return rows.reduce((n, row) => n + (isEquipmentIssue(row) ? 1 : 0), 0);
}

type Props = {
  issues: InventoryIssueRow[];
  searchQuery: string;
};

type ProjectIssueGroup = {
  projectId: string;
  projectName: string;
  projectStatus: string;
  issues: InventoryIssueRow[];
  totalCost: number;
};

export default function InventoryProjectIssues({
  issues,
  searchQuery,
}: Props) {
  const { t } = useT();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const trimmedSearch = searchQuery.trim();

  const issueRows = useMemo(
    () =>
      issues
        .filter((row) => row.item?.id != null && row.project?.id != null)
        .slice()
        .sort(compareMovedAtDesc),
    [issues]
  );

  const projectGroups = useMemo(() => {
    const map = new Map<string, ProjectIssueGroup>();
    for (const row of issueRows) {
      const project = row.project!;
      const existing = map.get(project.id);
      if (existing) {
        existing.issues.push(row);
        existing.totalCost += issueExpenseCost(row);
      } else {
        map.set(project.id, {
          projectId: project.id,
          projectName: project.name,
          projectStatus: project.status,
          issues: [row],
          totalCost: issueExpenseCost(row),
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.projectName.localeCompare(b.projectName)
    );
  }, [issueRows]);

  const visibleProjects = useMemo(() => {
    if (!trimmedSearch) return projectGroups;
    return projectGroups.filter((group) => {
      if (
        matchesDirectorySearch(
          searchQuery,
          group.projectName,
          group.projectStatus
        )
      ) {
        return true;
      }
      return group.issues.some((row) =>
        matchesDirectorySearch(
          searchQuery,
          row.item?.name,
          row.item?.sku,
          row.notes
        )
      );
    });
  }, [projectGroups, searchQuery, trimmedSearch]);

  const selectedGroup = useMemo(
    () =>
      selectedProjectId
        ? projectGroups.find((g) => g.projectId === selectedProjectId) ?? null
        : null,
    [projectGroups, selectedProjectId]
  );

  const selectedRows = useMemo(() => {
    if (!selectedGroup) return [];
    const rows = selectedGroup.issues;
    if (!trimmedSearch) return rows;
    return rows.filter((row) =>
      matchesDirectorySearch(
        searchQuery,
        row.item?.name,
        row.item?.sku,
        row.notes,
        selectedGroup.projectName
      )
    );
  }, [selectedGroup, searchQuery, trimmedSearch]);

  const categorized = useMemo(
    () => partitionByInventoryItemType(selectedRows),
    [selectedRows]
  );

  const issueColumns: DataTableColumn<InventoryIssueRow>[] = [
    {
      key: "movedAt",
      title: t("pages.inventory.columns.date"),
      width: "8rem",
      render: (row) => formatDisplayDate(row.movedAt),
    },
    {
      key: "item",
      title: t("pages.inventory.columns.item"),
      share: 2,
      render: (row) => (
        <div>
          <p className="font-medium text-text">{row.item?.name ?? "—"}</p>
          <p className="text-xs text-subtle">{row.item?.sku ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "quantity",
      title: t("pages.inventory.columns.qty"),
      width: "7rem",
      align: "right",
      render: (row) =>
        formatInventoryQtyWithUnit(row.quantity, row.item?.unit ?? "pcs"),
    },
    {
      key: "unitCost",
      title: t("pages.inventory.columns.unitCost"),
      width: "8rem",
      align: "right",
      render: (row) =>
        matchInventoryItemType(row.item.itemType, "equipment")
          ? "—"
          : formatContractPrice(row.unitCost),
    },
    {
      key: "totalCost",
      title: t("pages.inventory.columns.projectCost"),
      width: "8rem",
      align: "right",
      render: (row) =>
        matchInventoryItemType(row.item.itemType, "equipment")
          ? t("pages.inventory.form.equipmentDeployed")
          : formatContractPrice(row.totalCost),
    },
  ];

  function renderCategoryTable(
    title: string,
    rows: InventoryIssueRow[]
  ) {
    if (rows.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">
          {title}
        </p>
        <DataTable
          columns={issueColumns}
          data={rows}
          getRowKey={(row) => row.id}
        />
      </div>
    );
  }

  /** Issues = costed stock only; optionally append equipment deploy count. */
  function renderProjectIssueSummary(group: ProjectIssueGroup) {
    const issueCount = countCostedIssues(group.issues);
    const deployCount = countEquipmentDeploys(group.issues);
    const parts = [
      t(
        issueCount === 1
          ? "pages.inventory.projectIssues.issueCountOne"
          : "pages.inventory.projectIssues.issueCountOther",
        { count: issueCount }
      ),
    ];
    if (deployCount > 0) {
      parts.push(
        t(
          deployCount === 1
            ? "pages.inventory.projectIssues.deployCountOne"
            : "pages.inventory.projectIssues.deployCountOther",
          { count: deployCount }
        )
      );
    }
    parts.push(
      t("pages.inventory.projectIssues.totalCost", {
        amount: formatContractPrice(group.totalCost),
      })
    );
    return parts.join(" · ");
  }

  if (issueRows.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          title={t("pages.inventory.emptyIssues")}
          description={t("pages.inventory.emptyIssuesDesc")}
        />
      </SectionCard>
    );
  }

  if (selectedGroup) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Button
              type="button"
              variant="infoBadge"
              size="badgeFlex"
              className="gap-1.5"
              onClick={() => setSelectedProjectId(null)}
            >
              <ArrowLeft className="size-3.5 shrink-0 opacity-80" aria-hidden />
              {t("pages.inventory.projectIssues.backToProjects")}
            </Button>
            <h2 className="mt-3 text-lg font-semibold text-text">
              <Link
                href={`/projects/${selectedGroup.projectId}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                {selectedGroup.projectName}
              </Link>
            </h2>
            <p className="mt-1 text-xs text-subtle">
              {renderProjectIssueSummary(selectedGroup)}
            </p>
          </div>
        </div>

        {selectedRows.length === 0 ? (
          <SectionCard>
            <EmptyState
              title={
                trimmedSearch
                  ? t("pages.inventory.emptySearch", { query: trimmedSearch })
                  : t("pages.inventory.projectIssues.emptyProjectRows")
              }
              description={
                trimmedSearch
                  ? t("pages.inventory.emptySearchDesc")
                  : t("pages.inventory.projectIssues.emptyProjectRowsDesc")
              }
            />
          </SectionCard>
        ) : (
          <div className="space-y-8">
            {categorized.equipment.length > 0
              ? renderCategoryTable(
                  t("pages.inventory.overview.categoryEquipment"),
                  categorized.equipment
                )
              : null}
            {categorized.chemical.length > 0
              ? renderCategoryTable(
                  t("pages.inventory.overview.categoryChemicals"),
                  categorized.chemical
                )
              : null}
            {categorized.consumable.length > 0
              ? renderCategoryTable(
                  t("pages.inventory.overview.categoryConsumables"),
                  categorized.consumable
                )
              : null}
            {categorized.other.length > 0
              ? renderCategoryTable(
                  t("pages.inventory.overview.categoryOthers"),
                  categorized.other
                )
              : null}
          </div>
        )}
      </div>
    );
  }

  if (visibleProjects.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          title={
            trimmedSearch
              ? t("pages.inventory.emptySearch", { query: trimmedSearch })
              : t("pages.inventory.projectIssues.emptyProjects")
          }
          description={
            trimmedSearch
              ? t("pages.inventory.emptySearchDesc")
              : t("pages.inventory.projectIssues.emptyProjectsDesc")
          }
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {t("pages.inventory.projectIssues.selectHint")}
      </p>
      <div className="space-y-2">
        {visibleProjects.map((group) => (
          <SectionCard key={group.projectId} className="!p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setSelectedProjectId(group.projectId)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-elevated/60 sm:px-6"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text">{group.projectName}</p>
                <p className="mt-0.5 text-xs text-subtle">
                  {renderProjectIssueSummary(group)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
            </button>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
