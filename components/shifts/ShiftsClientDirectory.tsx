"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FolderKanban, Landmark, Users } from "lucide-react";

import type {
  ShiftsClientRow,
  ShiftsInternalSummary,
} from "@/lib/shifts-directory";
import { SHIFTS_INTERNAL_ROUTE_CLIENT_ID } from "@/lib/shifts-directory";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";

type DirectoryRow = {
  id: string;
  name: string;
  projectCount: number;
  staffCount: number;
  kind: "internal" | "client";
  href: string;
};

type Props = {
  clients: ShiftsClientRow[];
  internal?: ShiftsInternalSummary | null;
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

export default function ShiftsClientDirectory({
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
    const clientStaff = clients.reduce(
      (sum, client) => sum + client.staffCount,
      0
    );
    return {
      clients: clients.length,
      projects: clientProjects + (internal?.projectCount ?? 0),
      internal: internal?.projectCount ?? 0,
      staff: clientStaff + (internal?.staffCount ?? 0),
    };
  }, [clients, internal]);

  const rows = useMemo(() => {
    const next: DirectoryRow[] = [];
    if (internal) {
      next.push({
        id: SHIFTS_INTERNAL_ROUTE_CLIENT_ID,
        name: t("pages.shifts.internalSection"),
        projectCount: internal.projectCount,
        staffCount: internal.staffCount,
        kind: "internal",
        href: `/shifts/${SHIFTS_INTERNAL_ROUTE_CLIENT_ID}`,
      });
    }
    for (const client of clients) {
      next.push({
        id: client.id,
        name: client.name,
        projectCount: client.projectCount,
        staffCount: client.staffCount,
        kind: "client",
        href: `/shifts/${client.id}`,
      });
    }
    return next;
  }, [clients, internal, t]);

  const visible = useMemo(() => {
    return rows.filter((row) => {
      if (row.kind === "internal" && internal) {
        return matchesDirectorySearch(
          searchQuery,
          t("pages.shifts.internalSection"),
          t("pages.shifts.internalSiteHint"),
          ...internal.siteNames
        );
      }
      return matchesDirectorySearch(searchQuery, row.name);
    });
  }, [internal, rows, searchQuery, t]);

  const columns = useMemo(() => {
    const cols: DataTableColumn<DirectoryRow>[] = [
      {
        key: "name",
        title: t("pages.shifts.columns.client"),
        width: "12rem",
        share: 1.25,
        className: "min-w-[12rem]",
        render: (row) => <p className="font-semibold text-text">{row.name}</p>,
      },
      {
        key: "type",
        title: t("pages.shifts.columns.type"),
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
              ? t("pages.shifts.internalSection")
              : t("pages.shifts.clientsSection")}
          </StatusBadge>
        ),
      },
      {
        key: "projects",
        title: t("pages.shifts.columns.project"),
        width: "9rem",
        share: 1,
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (row) => <CountCell value={row.projectCount} />,
      },
      {
        key: "staff",
        title: t("pages.shifts.columns.staff"),
        width: "9rem",
        share: 1,
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (row) => <CountCell value={row.staffCount} />,
      },
    ];
    return cols;
  }, [t]);

  const statsGrid = (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <DirectoryStatCard
        compact
        tinted
        title={t("pages.shifts.cards.clients")}
        value={stats.clients}
        accent="success"
        icon={<Building2 size={18} />}
      />
      <DirectoryStatCard
        compact
        tinted
        title={t("pages.shifts.cards.projects")}
        value={stats.projects}
        accent="info"
        icon={<FolderKanban size={18} />}
      />
      <DirectoryStatCard
        compact
        tinted
        title={t("pages.shifts.cards.internal")}
        value={stats.internal}
        accent="primary"
        icon={<Landmark size={18} />}
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

  if (clients.length === 0 && !internal) {
    return (
      <div className="space-y-4">
        {statsGrid}
        <EmptyState
          title={t("pages.shifts.noClients")}
          description={t("pages.shifts.noClientsDesc")}
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
        placeholder={t("pages.shifts.searchClients")}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.shifts.noClientsMatch")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          getRowKey={(row) => row.id}
          onRowClick={(row) => router.push(row.href)}
          emptyMessage={t("pages.shifts.noClients")}
        />
      )}
    </div>
  );
}
