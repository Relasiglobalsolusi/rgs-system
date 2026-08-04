"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Building2,
  ChevronRight,
  Landmark,
  Warehouse,
} from "lucide-react";

import type {
  AttendanceClientRow,
  AttendanceInternalSiteRow,
} from "@/app/attendance/actions";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  clients: AttendanceClientRow[];
  internalSites?: AttendanceInternalSiteRow[];
};

export default function AttendanceClientDirectory({
  clients,
  internalSites = [],
}: Props) {
  const { t } = useT();
  const [searchQuery, setSearchQuery] = useState("");

  const visibleInternal = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return internalSites;
    return internalSites.filter((site) =>
      matchesDirectorySearch(searchQuery, site.name)
    );
  }, [internalSites, searchQuery]);

  const visibleClients = useMemo(
    () =>
      clients.filter((client) =>
        matchesDirectorySearch(searchQuery, client.name)
      ),
    [clients, searchQuery]
  );

  if (clients.length === 0 && internalSites.length === 0) {
    return (
      <EmptyState
        title={t("pages.attendance.noClients")}
        description={t("pages.attendance.noClientsDesc")}
      />
    );
  }

  const noMatches =
    visibleInternal.length === 0 && visibleClients.length === 0;

  return (
    <div className="space-y-6">
      <DirectorySearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("pages.attendance.searchClients")}
      />

      {noMatches ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.attendance.noClientsMatch")}
        />
      ) : (
        <>
          {visibleInternal.length > 0 ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-text">
                  {t("pages.attendance.internalSection")}
                </h2>
                <p className="mt-1 text-sm text-subtle">
                  {t("pages.attendance.internalSectionDesc")}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleInternal.map((site) => {
                  const Icon =
                    site.kind === "WAREHOUSE" ? Warehouse : Landmark;
                  return (
                    <Link
                      key={site.projectId}
                      href={`/attendance/${site.clientId}/${site.projectId}`}
                      className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4 transition hover:border-border-strong hover:bg-elevated/40"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-inset text-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-text">
                          {site.name}
                        </p>
                        <p className="mt-0.5 text-xs text-subtle">
                          {t("pages.attendance.internalSiteHint")}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted transition group-hover:text-text" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {visibleClients.length > 0 ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-text">
                  {t("pages.attendance.projectsSection")}
                </h2>
                <p className="mt-1 text-sm text-subtle">
                  {t("pages.attendance.projectsSectionDesc")}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleClients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/attendance/${client.id}`}
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
                            ? "pages.attendance.projectCountOne"
                            : "pages.attendance.projectCountOther",
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
