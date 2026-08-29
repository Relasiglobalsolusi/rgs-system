"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  ProgressClientRow,
  ProgressInternalSummary,
} from "@/lib/progress-directory";
import { PROGRESS_INTERNAL_ROUTE_CLIENT_ID } from "@/lib/progress-directory";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectoryStatGrid from "@/components/ui/DirectoryStatGrid";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";
import { Building2, Camera, FolderKanban, Landmark } from "lucide-react";

type DirectoryRow = {
  id: string;
  name: string;
  projectCount: number;
  reportCount: number;
  kind: "internal" | "client";
  href: string;
};

type Props = {
  clients: ProgressClientRow[];
  internal?: ProgressInternalSummary | null;
};

export default function ProgressClientDirectory({
  clients,
  internal = null,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const stats = useMemo(() => {
    const clientProjects = clients.reduce(
      (sum, client) => sum + client.projectCount,
      0
    );
    const clientReports = clients.reduce(
      (sum, client) => sum + client.reportCount,
      0
    );
    return {
      clients: clients.length,
      projects: clientProjects + (internal?.projectCount ?? 0),
      internal: internal?.projectCount ?? 0,
      reports: clientReports + (internal?.reportCount ?? 0),
    };
  }, [clients, internal]);

  const rows = useMemo(() => {
    const next: DirectoryRow[] = [];
    if (internal) {
      next.push({
        id: PROGRESS_INTERNAL_ROUTE_CLIENT_ID,
        name: t("pages.progress.internalSection"),
        projectCount: internal.projectCount,
        reportCount: internal.reportCount,
        kind: "internal",
        href: `/progress/${PROGRESS_INTERNAL_ROUTE_CLIENT_ID}`,
      });
    }
    for (const client of clients) {
      next.push({
        id: client.id,
        name: client.name,
        projectCount: client.projectCount,
        reportCount: client.reportCount,
        kind: "client",
        href: `/progress/${client.id}`,
      });
    }
    return next;
  }, [clients, internal, t]);

  const visible = useMemo(() => {
    return rows.filter((row) => {
      if (row.kind === "internal" && internal) {
        return matchesDirectorySearch(
          searchQuery,
          t("pages.progress.internalSection"),
          t("pages.progress.internalSiteHint"),
          ...internal.siteNames
        );
      }
      const client = clients.find((item) => item.id === row.id);
      return matchesDirectorySearch(
        searchQuery,
        row.name,
        client?.shortCode,
        ...(client?.projectNames ?? [])
      );
    });
  }, [clients, internal, rows, searchQuery, t]);

  const columns = useMemo(() => {
    const cols: DataTableColumn<DirectoryRow>[] = [
      {
        key: "name",
        title: t("pages.progress.columns.client"),
        width: "12rem",
        share: 1.25,
        className: "min-w-[12rem]",
        render: (row) => <p className="font-semibold text-text">{row.name}</p>,
      },
      {
        key: "type",
        title: t("pages.progress.columns.type"),
        width: "10rem",
        share: 1,
        cellAlign: "center",
        className: "min-w-[10rem] overflow-visible",
        render: (row) => (
          <StatusBadge
            status={row.kind === "internal" ? "info" : "success"}
            compact
          >
            {row.kind === "internal"
              ? t("pages.progress.internalSection")
              : t("pages.progress.clientsSection")}
          </StatusBadge>
        ),
      },
      {
        key: "projects",
        title: t("pages.progress.columns.project"),
        width: "9rem",
        share: 1,
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (row) => (
          <span className="text-lg font-semibold tabular-nums text-text">
            {row.projectCount}
          </span>
        ),
      },
      {
        key: "reports",
        title: t("pages.progress.columns.reports"),
        width: "9rem",
        share: 1,
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (row) => (
          <span className="text-lg font-semibold tabular-nums text-text">
            {row.reportCount}
          </span>
        ),
      },
    ];
    return cols;
  }, [t]);

  const statsGrid = (
    <DirectoryStatGrid>
      <DirectoryStatCard
        compact
        tinted
        title={t("pages.progress.cards.clients")}
        value={stats.clients}
        accent="success"
        icon={<Building2 size={18} />}
      />
      <DirectoryStatCard
        compact
        tinted
        title={t("pages.progress.cards.projects")}
        value={stats.projects}
        accent="info"
        icon={<FolderKanban size={18} />}
      />
      <DirectoryStatCard
        compact
        tinted
        title={t("pages.progress.cards.internal")}
        value={stats.internal}
        accent="primary"
        icon={<Landmark size={18} />}
      />
      <DirectoryStatCard
        compact
        tinted
        title={t("pages.progress.cards.reports")}
        value={stats.reports}
        accent="warning"
        icon={<Camera size={18} />}
      />
    </DirectoryStatGrid>
  );

  if (clients.length === 0 && !internal) {
    return (
      <div className="space-y-4">
        {statsGrid}
        <EmptyState
          title={t("pages.progress.noClients")}
          description={t("pages.progress.noClientsDesc")}
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
        placeholder={t("pages.progress.searchClients")}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.progress.noClientsMatch")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          getRowKey={(row) => row.id}
          onRowClick={(row) => router.push(row.href)}
          emptyMessage={t("pages.progress.noClients")}
        />
      )}
    </div>
  );
}
