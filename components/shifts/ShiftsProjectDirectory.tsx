"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Users } from "lucide-react";

import type { ShiftsProjectRow } from "@/lib/shifts-directory";
import {
  isAttendanceHeadOfficeName,
  isAttendanceWarehouseName,
} from "@/lib/attendance-internal-sites";
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

type Props = {
  clientId: string;
  projects: ShiftsProjectRow[];
};

function CountCell({ value }: { value: number }) {
  return (
    <span
      className={
        value > 0
          ? "text-lg font-semibold tabular-nums text-text"
          : "text-lg tabular-nums text-subtle"
      }
    >
      {value}
    </span>
  );
}

export default function ShiftsProjectDirectory({ clientId, projects }: Props) {
  const { t, locale } = useT();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return projects;
    return projects.filter(
      (project) =>
        matchesDirectorySearch(searchQuery, project.name) ||
        project.location?.toLowerCase().includes(normalized)
    );
  }, [projects, searchQuery]);

  const stats = useMemo(
    () => ({
      projects: projects.length,
      staff: projects.reduce((sum, project) => sum + project.staffCount, 0),
    }),
    [projects]
  );

  const columns = useMemo(() => {
    const cols: DataTableColumn<ShiftsProjectRow>[] = [
      {
        key: "project",
        title: t("pages.shifts.columns.project"),
        width: "12rem",
        share: 1.25,
        className: "min-w-[12rem]",
        render: (project) => (
          <div className="min-w-0">
            <p className="font-semibold text-text">{project.name}</p>
            {project.location ? (
              <p className="mt-0.5 truncate text-sm text-subtle">
                {project.location}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        key: "type",
        title: t("pages.shifts.columns.type"),
        width: "10rem",
        share: 1,
        cellAlign: "center",
        className: "min-w-[10rem] overflow-visible",
        render: (project) => {
          const isInternal =
            isAttendanceHeadOfficeName(project.name) ||
            isAttendanceWarehouseName(project.name);
          if (isInternal) {
            return (
              <StatusBadge status="info" compact>
                {t("pages.shifts.internalSection")}
              </StatusBadge>
            );
          }
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
        key: "staff",
        title: t("pages.shifts.columns.staff"),
        width: "9rem",
        share: 1,
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (project) => <CountCell value={project.staffCount} />,
      },
    ];
    return cols;
  }, [locale, t]);

  const statsGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <DirectoryStatCard
        compact
        tinted
        title={t("pages.shifts.cards.projects")}
        value={stats.projects}
        accent="primary"
        icon={<FolderKanban size={18} />}
      />
      <DirectoryStatCard
        compact
        tinted
        title={t("pages.shifts.cards.staff")}
        value={stats.staff}
        accent="warning"
        icon={<Users size={18} />}
      />
    </div>
  );

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        {statsGrid}
        <EmptyState
          title={t("pages.shifts.noProjects")}
          description={t("pages.shifts.noProjectsDesc")}
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
        placeholder={t("pages.shifts.searchProjects")}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.shifts.noProjectsMatch")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(project) => project.id}
          onRowClick={(project) =>
            router.push(`/shifts/${clientId}/${project.id}`)
          }
          emptyMessage={t("pages.shifts.noProjects")}
        />
      )}
    </div>
  );
}
