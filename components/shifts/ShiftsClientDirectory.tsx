"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, ChevronRight, Landmark } from "lucide-react";

import type {
  ShiftsClientRow,
  ShiftsInternalSummary,
} from "@/lib/shifts-directory";
import { SHIFTS_INTERNAL_ROUTE_CLIENT_ID } from "@/lib/shifts-directory";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  clients: ShiftsClientRow[];
  internal?: ShiftsInternalSummary | null;
};

export default function ShiftsClientDirectory({
  clients,
  internal = null,
}: Props) {
  const { t } = useT();
  const [searchQuery, setSearchQuery] = useState("");

  const showInternal = Boolean(
    internal &&
      matchesDirectorySearch(
        searchQuery,
        t("pages.shifts.internalSection"),
        t("pages.shifts.internalSiteHint"),
        ...internal.siteNames
      )
  );

  const visibleClients = useMemo(
    () =>
      clients.filter((client) =>
        matchesDirectorySearch(searchQuery, client.name)
      ),
    [clients, searchQuery]
  );

  if (clients.length === 0 && !internal) {
    return (
      <EmptyState
        title={t("pages.shifts.noClients")}
        description={t("pages.shifts.noClientsDesc")}
      />
    );
  }

  const noMatches = !showInternal && visibleClients.length === 0;

  return (
    <div className="space-y-6">
      <DirectorySearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("pages.shifts.searchClients")}
      />

      {noMatches ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.shifts.noClientsMatch")}
        />
      ) : (
        <>
          {showInternal && internal ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-text">
                  {t("pages.shifts.internalSection")}
                </h2>
                <p className="mt-1 text-sm text-subtle">
                  {t("pages.shifts.internalSectionDesc")}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Link
                  href={`/shifts/${SHIFTS_INTERNAL_ROUTE_CLIENT_ID}`}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4 transition hover:border-border-strong hover:bg-elevated/40"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-inset text-muted">
                    <Landmark className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text">
                      {t("pages.shifts.internalSection")}
                    </p>
                    <p className="mt-0.5 text-xs text-subtle">
                      {t(
                        internal.projectCount === 1
                          ? "pages.shifts.projectCountOne"
                          : "pages.shifts.projectCountOther",
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
                  {t("pages.shifts.clientsSection")}
                </h2>
                <p className="mt-1 text-sm text-subtle">
                  {t("pages.shifts.clientsSectionDesc")}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleClients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/shifts/${client.id}`}
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
                            ? "pages.shifts.projectCountOne"
                            : "pages.shifts.projectCountOther",
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
