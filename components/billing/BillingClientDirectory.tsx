"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { reorderClients } from "@/app/clients/actions";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { STATUS_COLUMN_WIDTH } from "@/components/ui/trash-action-buttons";
import { useT } from "@/lib/i18n/use-t";

export type BillingClientRow = {
  id: string;
  name: string;
  projectCount: number;
  openInvoices: number;
  lateInvoices: number;
  paidInvoices: number;
};

type Props = {
  clients: BillingClientRow[];
};

export default function BillingClientDirectory({ clients }: Props) {
  const { t } = useT();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");

  function paymentHint(client: BillingClientRow) {
    if (client.lateInvoices > 0) {
      return t("pages.billing.overdueCount", { count: client.lateInvoices });
    }
    if (client.openInvoices > 0) {
      return t("pages.billing.unpaidCount", { count: client.openInvoices });
    }
    return t("pages.billing.allSettled");
  }

  function handleReorder(orderedIds: string[]) {
    startTransition(async () => {
      try {
        await reorderClients(orderedIds);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("pages.billing.reorderClientsFailed")
        );
        router.refresh();
      }
    });
  }

  const stats = useMemo(() => {
    return {
      total: clients.length,
      open: clients.reduce((sum, c) => sum + c.openInvoices, 0),
      late: clients.reduce((sum, c) => sum + c.lateInvoices, 0),
      projects: clients.reduce((sum, c) => sum + c.projectCount, 0),
    };
  }, [clients]);

  const visible = useMemo(() => {
    return clients.filter((client) =>
      matchesDirectorySearch(searchQuery, client.name)
    );
  }, [clients, searchQuery]);

  const trimmedSearch = searchQuery.trim();
  const hasActiveSearch = trimmedSearch !== "";

  const columns = useMemo(() => {
    const cols: DataTableColumn<BillingClientRow>[] = [
      {
        key: "name",
        title: t("pages.billing.columns.client"),
        width: "12rem",
        share: 2,
        className: "min-w-[12rem]",
        render: (client) => (
          <p className="font-semibold text-text">{client.name}</p>
        ),
      },
      {
        key: "projects",
        title: t("pages.billing.projects"),
        width: "7rem",
        align: "center",
        className: "min-w-[7rem] whitespace-nowrap",
        render: (client) => (
          <span className="tabular-nums text-muted">
            {client.projectCount}
          </span>
        ),
      },
      {
        key: "billing",
        title: t("pages.billing.billing"),
        width: "10rem",
        share: 1.25,
        className: "min-w-[10rem]",
        render: (client) => (
          <div className="min-w-0">
            <p className="text-muted">{paymentHint(client)}</p>
            <p className="mt-0.5 text-sm text-subtle">
              {client.paidInvoices > 0
                ? client.paidInvoices === 1
                  ? t("pages.billing.paidInvoiceOne", {
                      count: client.paidInvoices,
                    })
                  : t("pages.billing.paidInvoiceOther", {
                      count: client.paidInvoices,
                    })
                : t("pages.billing.noPaidInvoices")}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        title: t("common.labels.status"),
        width: STATUS_COLUMN_WIDTH,
        align: "center",
        className: "min-w-[10rem] overflow-visible whitespace-nowrap",
        render: (client) => (
          <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-1.5">
            {client.lateInvoices > 0 ? (
              <StatusBadge status="danger" compact>
                {t("pages.billing.overdueCount", {
                  count: client.lateInvoices,
                })}
              </StatusBadge>
            ) : null}
            {client.openInvoices > 0 ? (
              <StatusBadge status="warning" compact>
                {t("pages.billing.unpaidCount", {
                  count: client.openInvoices,
                })}
              </StatusBadge>
            ) : null}
            {client.openInvoices === 0 && client.lateInvoices === 0 ? (
              <StatusBadge status="success" compact>
                {t("pages.billing.allSettled")}
              </StatusBadge>
            ) : null}
          </div>
        ),
      },
    ];
    return cols;
  }, [t]);

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DirectoryStatCard
          title={t("pages.billing.totalClients")}
          value={stats.total}
          subtitle={t(
            stats.projects === 1
              ? "pages.billing.projectOne"
              : "pages.billing.projectOther",
            { count: stats.projects }
          )}
          icon={<Building2 size={18} />}
          accent="primary"
        />
        <DirectoryStatCard
          title={t("pages.billing.openInvoices")}
          value={stats.open}
          subtitle={t("pages.billing.awaitingOrLate")}
          icon={<Clock size={18} />}
          accent="warning"
        />
        <DirectoryStatCard
          title={t("pages.billing.lateInvoices")}
          value={stats.late}
          subtitle={t("pages.billing.lateInvoices")}
          icon={<AlertTriangle size={18} />}
          accent="danger"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-subtle">
          {hasActiveSearch
            ? t("pages.billing.emptySearchClients", { query: trimmedSearch })
            : `${visible.length} ${t("pages.billing.clients").toLowerCase()}`}
        </p>
        <DirectorySearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("pages.billing.searchClients")}
        />
      </div>

      {clients.length === 0 ? (
        <EmptyState
          title={t("pages.billing.emptyClients")}
          description={t("pages.billing.emptyClientsDesc")}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.clients.emptySearchDesc")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          getRowKey={(client) => client.id}
          onRowClick={(client) => router.push(`/billing/${client.id}`)}
          reorderable
          onReorder={handleReorder}
          emptyMessage={t("common.empty.description")}
        />
      )}
    </>
  );
}
