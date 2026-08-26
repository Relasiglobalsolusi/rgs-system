"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ProgressProjectRow } from "@/lib/progress-directory";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  localizeSubCategory,
  localizeSubCategoryChipLines,
} from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { Camera, FolderKanban } from "lucide-react";

type Props = {
  projects: ProgressProjectRow[];
};

export default function ProgressProjectDirectory({ projects }: Props) {
  const { t, locale } = useT();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const visible = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return projects;
    return projects.filter(
      (project) =>
        matchesDirectorySearch(searchQuery, project.name) ||
        project.location?.toLowerCase().includes(normalized)
    );
  }, [projects, searchQuery]);

  const columns = useMemo(() => {
    const cols: DataTableColumn<ProgressProjectRow>[] = [
      {
        key: "project",
        title: t("pages.progress.columns.project"),
        width: "12rem",
        share: 1.25,
        className: "min-w-[12rem]",
        render: (project) => (
          <p className="font-semibold text-text">{project.name}</p>
        ),
      },
      {
        key: "location",
        title: t("pages.progress.columns.location"),
        width: "11rem",
        share: 1.1,
        className: "min-w-[11rem]",
        render: (project) => (
          <p className="min-w-0 text-muted">
            {project.location || t("common.labels.na")}
          </p>
        ),
      },
      {
        key: "type",
        title: t("pages.progress.columns.type"),
        width: "10rem",
        share: 1,
        cellAlign: "center",
        className: "min-w-[10rem] overflow-visible",
        render: (project) => {
          const typeLines = localizeSubCategoryChipLines(
            project.subCategory,
            locale
          );
          return (
            <StatusBadge
              status="success"
              compact
              lines={typeLines ?? undefined}
            >
              {typeLines
                ? undefined
                : localizeSubCategory(project.subCategory, locale)}
            </StatusBadge>
          );
        },
      },
      {
        key: "reports",
        title: t("pages.progress.columns.reports"),
        width: "9rem",
        share: 1,
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (project) => (
          <span className="text-lg font-semibold tabular-nums text-text">
            {project.reportCount}
          </span>
        ),
      },
    ];
    return cols;
  }, [locale, t]);

  const reportTotal = useMemo(
    () => projects.reduce((sum, project) => sum + project.reportCount, 0),
    [projects]
  );

  const statsGrid = (
    <div className="grid grid-cols-2 gap-3">
      <DirectoryStatCard
        compact
        tinted
        title={t("pages.progress.cards.projects")}
        value={projects.length}
        accent="info"
        icon={<FolderKanban size={18} />}
      />
      <DirectoryStatCard
        compact
        tinted
        title={t("pages.progress.cards.reports")}
        value={reportTotal}
        accent="warning"
        icon={<Camera size={18} />}
      />
    </div>
  );

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        {statsGrid}
        <EmptyState
          title={t("pages.progress.noProjects")}
          description={t("pages.progress.noProjectsDesc")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {statsGrid}
      <DirectorySearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("pages.progress.searchProjects")}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.progress.noProjectsMatch")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          getRowKey={(project) => project.id}
          onRowClick={(project) =>
            router.push(`/progress?projectId=${encodeURIComponent(project.id)}`)
          }
          emptyMessage={t("pages.progress.noProjects")}
        />
      )}
    </div>
  );
}
