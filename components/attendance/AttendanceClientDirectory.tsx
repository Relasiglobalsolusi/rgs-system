"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, ChevronRight } from "lucide-react";

import type { AttendanceClientRow } from "@/app/attendance/actions";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  clients: AttendanceClientRow[];
};

export default function AttendanceClientDirectory({ clients }: Props) {
  const { t } = useT();
  const [searchQuery, setSearchQuery] = useState("");

  const visible = useMemo(
    () =>
      clients.filter((client) =>
        matchesDirectorySearch(searchQuery, client.name)
      ),
    [clients, searchQuery]
  );

  if (clients.length === 0) {
    return (
      <EmptyState
        title={t("pages.attendance.noClients")}
        description={t("pages.attendance.noClientsDesc")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <DirectorySearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("pages.attendance.searchClients")}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.attendance.noClientsMatch")}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((client) => (
            <Link
              key={client.id}
              href={`/attendance/${client.id}`}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4 transition hover:border-border-strong hover:bg-elevated/40"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-inset text-muted">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-text">{client.name}</p>
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
      )}
    </div>
  );
}
