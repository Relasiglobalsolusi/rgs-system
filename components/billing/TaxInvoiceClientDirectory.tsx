"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { STATUS_COLUMN_WIDTH } from "@/components/ui/trash-action-buttons";
import { useT } from "@/lib/i18n/use-t";

export type TaxInvoiceClientRow = {
  id: string;
  name: string;
  pendingCount: number;
  overdueCount: number;
  completedCount: number;
  invoiceCount: number;
};

type Props = {
  clients: TaxInvoiceClientRow[];
  isPending: boolean;
  emptyTitleKey: string;
  emptyDescriptionKey: string;
};

function clientDetailHref(clientId: string, isPending: boolean) {
  const base = `/billing/tax-invoices/${clientId}`;
  return isPending ? base : `${base}?view=completed`;
}

export default function TaxInvoiceClientDirectory({
  clients,
  isPending,
  emptyTitleKey,
  emptyDescriptionKey,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const visible = useMemo(() => {
    return clients.filter((client) =>
      matchesDirectorySearch(searchQuery, client.name)
    );
  }, [clients, searchQuery]);

  const trimmedSearch = searchQuery.trim();
  const hasActiveSearch = trimmedSearch !== "";

  const columns = useMemo(() => {
    const cols: DataTableColumn<TaxInvoiceClientRow>[] = [
      {
        key: "name",
        title: t("pages.billing.columns.client"),
        width: "14rem",
        share: 2,
        className: "min-w-[14rem]",
        render: (client) => (
          <div className="min-w-0">
            <Link
              href={clientDetailHref(client.id, isPending)}
              className="font-semibold text-primary-dark hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {client.name}
            </Link>
            <p className="mt-0.5 text-sm text-subtle">
              {t("pages.billing.invoiceCountForClient", {
                count: client.invoiceCount,
              })}
            </p>
          </div>
        ),
      },
      {
        key: "attention",
        title: t("pages.billing.attention"),
        width: "12rem",
        share: 1.25,
        className: "min-w-[12rem]",
        render: (client) => {
          if (isPending) {
            if (client.pendingCount === 0) {
              return (
                <p className="text-sm text-muted">{t("pages.billing.allSettled")}</p>
              );
            }
            return (
              <p className="text-sm text-amber-200/90">
                {t("pages.billing.taxInvoiceDueBadge")}
              </p>
            );
          }
          return (
            <p className="text-sm text-muted">
              {t("pages.billing.invoiceCountAcknowledged", {
                count: client.completedCount,
              })}
            </p>
          );
        },
      },
      {
        key: "status",
        title: t("common.labels.status"),
        width: STATUS_COLUMN_WIDTH,
        align: "center",
        className: "min-w-[12rem] overflow-visible whitespace-nowrap",
        render: (client) => (
          <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-1.5">
            {isPending ? (
              <>
                {client.overdueCount > 0 ? (
                  <StatusBadge status="danger" compact>
                    {t("pages.billing.overdueCount", {
                      count: client.overdueCount,
                    })}
                  </StatusBadge>
                ) : null}
                {client.pendingCount > 0 ? (
                  <StatusBadge status="warning" compact>
                    {t("pages.billing.taxPendingCount", {
                      count: client.pendingCount,
                    })}
                  </StatusBadge>
                ) : (
                  <StatusBadge status="success" compact>
                    {t("pages.billing.allSettled")}
                  </StatusBadge>
                )}
              </>
            ) : (
              <StatusBadge status="success" compact>
                {t("pages.billing.taxInvoiceSent")}
              </StatusBadge>
            )}
          </div>
        ),
      },
    ];
    return cols;
  }, [isPending, t]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-subtle">
          {hasActiveSearch
            ? t("pages.billing.emptySearchClients", { query: trimmedSearch })
            : t("pages.billing.taxClientCount", { count: visible.length })}
        </p>
        <DirectorySearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("pages.billing.searchClients")}
        />
      </div>

      {clients.length === 0 ? (
        <EmptyState titleKey={emptyTitleKey} descriptionKey={emptyDescriptionKey} />
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
          onRowClick={(client) =>
            router.push(clientDetailHref(client.id, isPending))
          }
          emptyMessage={t("common.empty.description")}
        />
      )}
    </>
  );
}
