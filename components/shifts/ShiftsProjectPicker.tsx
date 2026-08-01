"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, FolderKanban, Users } from "lucide-react";

import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { useT } from "@/lib/i18n/use-t";

export type ShiftsProjectRow = {
  id: string;
  name: string;
  location: string | null;
  clientName: string | null;
  staffCount: number;
};

type Props = {
  projects: ShiftsProjectRow[];
};

export default function ShiftsProjectPicker({ projects }: Props) {
  const { t } = useT();
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () =>
      projects.filter((project) =>
        matchesDirectorySearch(
          query,
          project.name,
          project.clientName,
          project.location
        )
      ),
    [projects, query]
  );

  return (
    <>
      <div className="mb-3">
        <DirectorySearchInput
          value={query}
          onChange={setQuery}
          placeholder={t("pages.shifts.searchProjectsPlaceholder")}
          className="min-w-[12rem] w-auto max-w-none flex-1"
        />
      </div>

      {visible.length === 0 ? (
        <SectionCard>
          <EmptyState
            title={
              query.trim()
                ? t("pages.shifts.emptySearch", { query: query.trim() })
                : t("pages.shifts.emptyProjectsTitle")
            }
            description={
              query.trim()
                ? t("pages.shifts.emptySearchDesc")
                : t("pages.shifts.emptyProjectsDescription")
            }
          />
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((project) => (
            <Link
              key={project.id}
              href={`/shifts?projectId=${project.id}`}
              className="group flex items-center gap-3 rounded-xl border border-border bg-elevated px-4 py-3.5 text-left transition hover:border-primary/45 hover:bg-card-hover"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FolderKanban className="h-4.5 w-4.5" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-text group-hover:text-primary">
                  {project.name}
                </div>
                <div className="truncate text-xs text-muted">
                  {[project.clientName, project.location]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-subtle">
                  <Users size={12} />
                  {t("pages.shifts.staffCount", { count: project.staffCount })}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted group-hover:text-primary" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
