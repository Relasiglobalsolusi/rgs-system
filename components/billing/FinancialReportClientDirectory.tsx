"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, TrendingUp, Wallet } from "lucide-react";

import type { FinancialReportClientRow } from "@/app/billing/financial-report/actions";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import EmptyState from "@/components/ui/EmptyState";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  clients: FinancialReportClientRow[];
};

export default function FinancialReportClientDirectory({ clients }: Props) {
  const { t } = useT();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const stats = useMemo(() => {
    return {
      clients: clients.length,
      contractValue: clients.reduce((sum, c) => sum + c.totalContractValue, 0),
      spending: clients.reduce((sum, c) => sum + c.totalSpending, 0),
      profit: clients.reduce((sum, c) => sum + c.profit, 0),
    };
  }, [clients]);

  const visible = useMemo(
    () =>
      clients.filter((client) =>
        matchesDirectorySearch(searchQuery, client.name)
      ),
    [clients, searchQuery]
  );

  const columns = useMemo(() => {
    const cols: DataTableColumn<FinancialReportClientRow>[] = [
      {
        key: "name",
        title: t("pages.financialReport.columns.client"),
        width: "12rem",
        share: 2,
        className: "min-w-[12rem]",
        render: (client) => (
          <div className="min-w-0">
            <p className="font-semibold text-text">{client.name}</p>
            <p className="mt-0.5 text-sm text-subtle">
              {t(
                client.projectCount === 1
                  ? "pages.financialReport.projectOne"
                  : "pages.financialReport.projectOther",
                { count: client.projectCount }
              )}
            </p>
          </div>
        ),
      },
      {
        key: "contract",
        title: t("pages.financialReport.columns.contractValue"),
        width: "9rem",
        align: "right",
        className: "min-w-[9rem] tabular-nums",
        render: (client) => formatContractPrice(client.totalContractValue),
      },
      {
        key: "spending",
        title: t("pages.financialReport.columns.spending"),
        width: "9rem",
        align: "right",
        className: "min-w-[9rem] tabular-nums",
        render: (client) => formatContractPrice(client.totalSpending),
      },
      {
        key: "profit",
        title: t("pages.financialReport.columns.profit"),
        width: "9rem",
        align: "right",
        className: "min-w-[9rem] tabular-nums",
        render: (client) => (
          <span
            className={
              client.profit < 0 ? "text-danger" : "text-text"
            }
          >
            {formatContractPrice(client.profit)}
          </span>
        ),
      },
    ];
    return cols;
  }, [t]);

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DirectoryStatCard
          title={t("pages.financialReport.totalClients")}
          value={stats.clients}
          subtitle={t("pages.financialReport.withProjects")}
          icon={<Building2 size={18} />}
          accent="primary"
        />
        <DirectoryStatCard
          title={t("pages.financialReport.totalContractValue")}
          value={formatContractPrice(stats.contractValue)}
          subtitle={t("pages.financialReport.acrossClients")}
          icon={<Wallet size={18} />}
          accent="info"
        />
        <DirectoryStatCard
          title={t("pages.financialReport.totalProfit")}
          value={formatContractPrice(stats.profit)}
          subtitle={t("pages.financialReport.contractMinusSpending")}
          icon={<TrendingUp size={18} />}
          accent={stats.profit < 0 ? "danger" : "success"}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-subtle">
          {searchQuery.trim()
            ? t("pages.financialReport.filterResultsFor", {
                count: visible.length,
                query: searchQuery.trim(),
              })
            : t(
                visible.length === 1
                  ? "pages.financialReport.clientOne"
                  : "pages.financialReport.clientOther",
                { count: visible.length }
              )}
        </p>
        <DirectorySearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("pages.financialReport.searchClients")}
        />
      </div>

      {clients.length === 0 ? (
        <EmptyState
          title={t("pages.financialReport.emptyClients")}
          description={t("pages.financialReport.emptyClientsDesc")}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.financialReport.noClientsMatch")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          getRowKey={(client) => client.id}
          onRowClick={(client) =>
            router.push(`/billing/financial-report/${client.id}`)
          }
          emptyMessage={t("common.empty.description")}
        />
      )}
    </>
  );
}
