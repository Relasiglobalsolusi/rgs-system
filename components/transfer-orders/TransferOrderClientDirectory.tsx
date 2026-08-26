"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  TransferOrderClientRow,
  TransferOrderInternalSiteRow,
} from "@/lib/transfer-order-directory";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";

type DestinationRow = {
  id: string;
  name: string;
  hint: string | null;
  kind: "internal" | "client";
  projectCount: number;
  pendingSendCount: number;
  inTransitCount: number;
  completedCount: number;
  href: string;
};

type Props = {
  clients: TransferOrderClientRow[];
  internalSites?: TransferOrderInternalSiteRow[];
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

export default function TransferOrderClientDirectory({
  clients,
  internalSites = [],
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const rows = useMemo(() => {
    const next: DestinationRow[] = [];
    for (const site of internalSites) {
      next.push({
        id: site.projectId,
        name: site.name,
        hint: t("pages.transferOrders.internalSiteHint"),
        kind: "internal",
        projectCount: 1,
        pendingSendCount: site.pendingSendCount,
        inTransitCount: site.inTransitCount,
        completedCount: site.completedCount,
        href: `/transfer-orders/${site.clientId}/${site.projectId}`,
      });
    }
    for (const client of clients) {
      next.push({
        id: client.id,
        name: client.name,
        hint: null,
        kind: "client",
        projectCount: client.projectCount,
        pendingSendCount: client.pendingSendCount,
        inTransitCount: client.inTransitCount,
        completedCount: client.completedCount,
        href: `/transfer-orders/${client.id}`,
      });
    }
    return next;
  }, [clients, internalSites, t]);

  const visible = useMemo(
    () =>
      rows.filter((row) =>
        matchesDirectorySearch(searchQuery, row.name, row.hint)
      ),
    [rows, searchQuery]
  );

  const columns = useMemo(() => {
    const cols: DataTableColumn<DestinationRow>[] = [
      {
        key: "name",
        title: t("pages.transferOrders.columns.destination"),
        width: "12rem",
        share: 1.25,
        className: "min-w-[12rem]",
        render: (row) => (
          <div className="min-w-0">
            <p className="font-semibold text-text">{row.name}</p>
            {row.hint ? (
              <p className="mt-0.5 truncate text-sm text-subtle">{row.hint}</p>
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
        render: (row) => (
          <StatusBadge
            status={row.kind === "internal" ? "info" : "success"}
            compact
          >
            {row.kind === "internal"
              ? t("pages.transferOrders.internalSection")
              : t("pages.transferOrders.clientsSection")}
          </StatusBadge>
        ),
      },
      {
        key: "projects",
        title: t("pages.transferOrders.projectsSection"),
        width: "9rem",
        share: 1,
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (row) => <CountCell value={row.projectCount} />,
      },
      {
        key: "pending",
        title: t("pages.transferOrders.columns.pending"),
        width: "9rem",
        share: 1,
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (row) => <CountCell value={row.pendingSendCount} />,
      },
      {
        key: "inTransit",
        title: t("pages.transferOrders.columns.inTransit"),
        width: "9rem",
        share: 1,
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (row) => <CountCell value={row.inTransitCount} />,
      },
      {
        key: "completed",
        title: t("pages.transferOrders.columns.completed"),
        width: "9rem",
        share: 1,
        cellAlign: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (row) => <CountCell value={row.completedCount} />,
      },
    ];
    return cols;
  }, [t]);

  if (clients.length === 0 && internalSites.length === 0) {
    return (
      <EmptyState
        title={t("pages.transferOrders.emptyTitle")}
        description={t("pages.transferOrders.emptyDescription")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <DirectorySearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("pages.transferOrders.searchClients")}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.transferOrders.noClientsMatch")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          getRowKey={(row) => row.id}
          onRowClick={(row) => router.push(row.href)}
          emptyMessage={t("pages.transferOrders.emptyTitle")}
        />
      )}
    </div>
  );
}
