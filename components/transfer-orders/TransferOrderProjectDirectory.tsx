"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { TransferOrderProjectRow } from "@/lib/transfer-order-directory";
import {
  isAttendanceHeadOfficeName,
  isAttendanceWarehouseName,
} from "@/lib/attendance-internal-sites";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectoryStatGrid from "@/components/ui/DirectoryStatGrid";
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
import { FolderKanban, Package, Truck } from "lucide-react";

type Props = {
  clientId: string;
  projects: TransferOrderProjectRow[];
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

export default function TransferOrderProjectDirectory({
  clientId,
  projects,
}: Props) {
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
      pending: projects.reduce((sum, project) => sum + project.pendingSendCount, 0),
      inTransit: projects.reduce((sum, project) => sum + project.inTransitCount, 0),
    }),
    [projects]
  );

  const columns = useMemo(() => {
    const cols: DataTableColumn<TransferOrderProjectRow>[] = [
      {
        key: "project",
        title: t("pages.transferOrders.columns.project"),
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
        title: t("common.labels.type"),
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
                {t("pages.transferOrders.internalSection")}
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
        key: "pending",
        title: t("pages.transferOrders.columns.pending"),
        width: "9rem",
        share: 1,
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (project) => <CountCell value={project.pendingSendCount} />,
      },
      {
        key: "inTransit",
        title: t("pages.transferOrders.columns.inTransit"),
        width: "9rem",
        share: 1,
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (project) => <CountCell value={project.inTransitCount} />,
      },
      {
        key: "completed",
        title: t("pages.transferOrders.columns.completed"),
        width: "9rem",
        share: 1,
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (project) => <CountCell value={project.completedCount} />,
      },
    ];
    return cols;
  }, [locale, t]);

  const statsGrid = (
    <DirectoryStatGrid>
      <DirectoryStatCard
        compact
        tinted
        title={t("pages.transferOrders.cards.projects")}
        value={stats.projects}
        accent="primary"
        icon={<FolderKanban size={18} />}
      />
      <DirectoryStatCard
        compact
        tinted
        title={t("pages.transferOrders.cards.pendingSend")}
        value={stats.pending}
        accent="warning"
        icon={<Package size={18} />}
      />
      <DirectoryStatCard
        compact
        tinted
        title={t("pages.transferOrders.cards.inTransit")}
        value={stats.inTransit}
        accent="info"
        icon={<Truck size={18} />}
      />
    </DirectoryStatGrid>
  );

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        {statsGrid}
        <EmptyState
          title={t("pages.transferOrders.noProjects")}
          description={t("pages.transferOrders.noProjectsDesc")}
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
        placeholder={t("pages.transferOrders.searchProjects")}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.transferOrders.noProjectsMatch")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(project) => project.id}
          onRowClick={(project) =>
            router.push(`/transfer-orders/${clientId}/${project.id}`)
          }
          emptyMessage={t("pages.transferOrders.noProjects")}
        />
      )}
    </div>
  );
}
