"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, FolderKanban } from "lucide-react";

import type { AttendanceProjectRow } from "@/app/attendance/actions";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { localizeSubCategoryShort } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  clientId: string;
  projects: AttendanceProjectRow[];
};

export default function AttendanceProjectDirectory({
  clientId,
  projects,
}: Props) {
  const { t, locale } = useT();
  const [searchQuery, setSearchQuery] = useState("");

  const visible = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return projects;
    return projects.filter(
      (project) =>
        matchesDirectorySearch(searchQuery, project.name) ||
        project.location?.toLowerCase().includes(normalized)
    );
  }, [projects, searchQuery]);

  if (projects.length === 0) {
    return (
      <EmptyState
        title={t("pages.attendance.noProjects")}
        description={t("pages.attendance.noProjectsDesc")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <DirectorySearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("pages.attendance.searchProjects")}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.attendance.noProjectsMatch")}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => {
            const shortLabel = localizeSubCategoryShort(
              project.subCategory,
              locale
            );
            return (
              <Link
                key={project.id}
                href={`/attendance/${clientId}/${project.id}`}
                className="group flex items-start gap-4 rounded-2xl border border-border bg-card px-4 py-4 transition hover:border-border-strong hover:bg-elevated/40"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-inset text-muted">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text">
                    {project.name}
                  </p>
                  {project.location ? (
                    <p className="mt-0.5 truncate text-xs text-subtle">
                      {project.location}
                    </p>
                  ) : null}
                  {shortLabel !== "-" ? (
                    <div className="mt-2">
                      <StatusBadge status="info" compact>
                        {shortLabel}
                      </StatusBadge>
                    </div>
                  ) : null}
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted transition group-hover:text-text" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
