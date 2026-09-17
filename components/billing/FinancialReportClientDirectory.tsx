"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { FinancialReportClientRow } from "@/app/billing/financial-report/actions";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import {
  financialReportPnlGroupTitle,
  groupFinancialReportPnlTree,
} from "@/lib/financial-report-pnl";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";

type Props = {
  clients: FinancialReportClientRow[];
  queryString: string;
};

function Amount({ value }: { value: number }) {
  return (
    <span className={cn("tabular-nums", value < 0 && "text-danger")}>
      {formatContractPrice(value)}
    </span>
  );
}

export default function FinancialReportClientDirectory({
  clients,
  queryString,
}: Props) {
  const { t, locale } = useT();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const qs = queryString ? `?${queryString}` : "";

  const visibleClients = useMemo(
    () =>
      clients
        .map((client) => {
          const projects = client.projects.filter((project) =>
            matchesDirectorySearch(
              searchQuery,
              client.name,
              project.name,
              project.location ?? undefined
            )
          );
          if (
            projects.length === 0 &&
            !matchesDirectorySearch(searchQuery, client.name)
          ) {
            return null;
          }
          return { ...client, projects: projects.length ? projects : client.projects };
        })
        .filter((row): row is FinancialReportClientRow => row != null)
        .filter((row) =>
          searchQuery.trim()
            ? row.projects.some((project) =>
                matchesDirectorySearch(
                  searchQuery,
                  row.name,
                  project.name,
                  project.location ?? undefined
                )
              ) || matchesDirectorySearch(searchQuery, row.name)
            : true
        ),
    [clients, searchQuery]
  );

  const groups = useMemo(
    () => groupFinancialReportPnlTree(visibleClients),
    [visibleClients]
  );

  return (
    <>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text">
          {t("pages.financialReport.pnlTreeTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {t("pages.financialReport.pnlTreeHint")}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-subtle">
          {searchQuery.trim()
            ? t("pages.financialReport.filterResultsFor", {
                count: visibleClients.length,
                query: searchQuery.trim(),
              })
            : t(
                visibleClients.length === 1
                  ? "pages.financialReport.clientOne"
                  : "pages.financialReport.clientOther",
                { count: visibleClients.length }
              )}
        </p>
        <DirectorySearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("pages.financialReport.searchClients")}
          className="min-w-0 w-full max-w-none sm:max-w-xs"
        />
      </div>

      {clients.length === 0 ? (
        <EmptyState
          title={t("pages.financialReport.emptyClients")}
          description={t("pages.financialReport.emptyClientsDesc")}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.financialReport.noClientsMatch")}
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section
              key={group.key}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border bg-surface-muted/40 px-4 py-3 sm:px-5">
                <h3 className="text-sm font-semibold text-text">
                  {financialReportPnlGroupTitle(group.key, locale)}
                </h3>
                <p className="text-sm text-subtle">
                  {t("pages.financialReport.pnlSubcategoryTotal")}
                  {": "}
                  <Amount value={group.grossProfit} />
                </p>
              </div>
              <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(7rem,1fr))] gap-3 px-4 py-2 text-xs font-medium text-subtle sm:grid sm:px-5">
                <span />
                <span className="text-right">
                  {t("pages.financialReport.columns.moneyIn")}
                </span>
                <span className="text-right">
                  {t("pages.financialReport.columns.costOfSales")}
                </span>
                <span className="text-right">
                  {t("pages.financialReport.columns.grossProfit")}
                </span>
              </div>
              {group.clients.map((client) => (
                <div key={client.id} className="border-t border-border/70">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/billing/financial-report/${client.id}${qs}`)
                    }
                    className="grid w-full grid-cols-1 gap-1 px-4 py-2.5 text-left hover:bg-card-hover sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(7rem,1fr))] sm:items-baseline sm:gap-3 sm:px-5"
                  >
                    <p className="font-semibold text-text">{client.name}</p>
                    <p className="text-sm text-subtle sm:text-right sm:text-text">
                      <span className="sm:hidden">
                        {t("pages.financialReport.columns.moneyIn")}:{" "}
                      </span>
                      <Amount value={client.revenue} />
                    </p>
                    <p className="text-sm text-subtle sm:text-right sm:text-text">
                      <span className="sm:hidden">
                        {t("pages.financialReport.columns.costOfSales")}:{" "}
                      </span>
                      <Amount value={client.costOfSales} />
                    </p>
                    <p className="text-sm font-medium text-subtle sm:text-right sm:text-text">
                      <span className="sm:hidden">
                        {t("pages.financialReport.columns.grossProfit")}:{" "}
                      </span>
                      <Amount value={client.grossProfit} />
                    </p>
                  </button>
                  {client.projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() =>
                        router.push(
                          `/billing/financial-report/${client.id}/${project.id}${qs}`
                        )
                      }
                      className="grid w-full grid-cols-1 gap-1 px-4 py-2 pl-8 text-left hover:bg-card-hover sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(7rem,1fr))] sm:items-baseline sm:gap-3 sm:px-5 sm:pl-10"
                    >
                      <p className="min-w-0 truncate text-sm text-text">
                        {project.name}
                      </p>
                      <p className="text-sm text-subtle sm:text-right">
                        <Amount value={project.revenue} />
                      </p>
                      <p className="text-sm text-subtle sm:text-right">
                        <Amount value={project.costOfSales} />
                      </p>
                      <p className="text-sm text-subtle sm:text-right">
                        <Amount value={project.grossProfit} />
                      </p>
                    </button>
                  ))}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
