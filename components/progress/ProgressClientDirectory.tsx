"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, ChevronRight, Landmark } from "lucide-react";

import type {
  ProgressClientRow,
  ProgressInternalSummary,
} from "@/lib/progress-directory";
import { PROGRESS_INTERNAL_ROUTE_CLIENT_ID } from "@/lib/progress-directory";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  clients: ProgressClientRow[];
  internal?: ProgressInternalSummary | null;
};

export default function ProgressClientDirectory({
  clients,
  internal = null,
}: Props) {
  const { t } = useT();
  const [searchQuery, setSearchQuery] = useState("");

  const showInternal = Boolean(
    internal &&
      matchesDirectorySearch(
        searchQuery,
        t("pages.progress.internalSection"),
        t("pages.progress.internalSiteHint"),
        ...internal.siteNames
      )
  );

  const visibleClients = useMemo(
    () =>
      clients.filter((client) =>
        matchesDirectorySearch(
          searchQuery,
          client.name,
          client.shortCode,
          ...client.projectNames
        )
      ),
    [clients, searchQuery]
  );

  if (clients.length === 0 && !internal) {
    return (
      <EmptyState
        title={t("pages.progress.noClients")}
        description={t("pages.progress.noClientsDesc")}
      />
    );
  }

  const noMatches = !showInternal && visibleClients.length === 0;

  return (
    <div className="space-y-6">
      <DirectorySearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("pages.progress.searchClients")}
      />

      {noMatches ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.progress.noClientsMatch")}
        />
      ) : (
        <>
          {showInternal && internal ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-text">
                  {t("pages.progress.internalSection")}
                </h2>
                <p className="mt-1 text-sm text-subtle">
                  {t("pages.progress.internalSectionDesc")}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Link
                  href={`/progress/${PROGRESS_INTERNAL_ROUTE_CLIENT_ID}`}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4 transition hover:border-border-strong hover:bg-elevated/40"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-inset text-muted">
                    <Landmark className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text">
                      {t("pages.progress.internalSection")}
                    </p>
                    <p className="mt-0.5 text-xs text-subtle">
                      {t(
                        internal.projectCount === 1
                          ? "pages.progress.projectCountOne"
                          : "pages.progress.projectCountOther",
                        { count: internal.projectCount }
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted transition group-hover:text-text" />
                </Link>
              </div>
            </section>
          ) : null}

          {visibleClients.length > 0 ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-text">
                  {t("pages.progress.clientsSection")}
                </h2>
                <p className="mt-1 text-sm text-subtle">
                  {t("pages.progress.clientsSectionDesc")}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleClients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/progress/${client.id}`}
                    className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4 transition hover:border-border-strong hover:bg-elevated/40"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-inset text-muted">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-text">
                        {client.name}
                      </p>
                      <p className="mt-0.5 text-xs text-subtle">
                        {t(
                          client.projectCount === 1
                            ? "pages.progress.projectCountOne"
                            : "pages.progress.projectCountOther",
                          { count: client.projectCount }
                        )}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted transition group-hover:text-text" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
