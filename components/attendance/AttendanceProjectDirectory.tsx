"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronRight,
  FolderKanban,
  Landmark,
  Warehouse,
} from "lucide-react";

import type { AttendanceProjectRow } from "@/app/attendance/actions";
import {
  isAttendanceHeadOfficeName,
  isAttendanceWarehouseName,
  partitionAttendanceProjects,
} from "@/lib/attendance-internal-sites";
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

function ProjectCard({
  clientId,
  project,
}: {
  clientId: string;
  project: AttendanceProjectRow;
}) {
  const { t, locale } = useT();
  const shortLabel = localizeSubCategoryShort(project.subCategory, locale);
  const isHo = isAttendanceHeadOfficeName(project.name);
  const isWh = isAttendanceWarehouseName(project.name);
  const Icon = isWh ? Warehouse : isHo ? Landmark : FolderKanban;

  return (
    <Link
      href={`/attendance/${clientId}/${project.id}`}
      className="group flex items-start gap-4 rounded-2xl border border-border bg-card px-4 py-4 transition hover:border-border-strong hover:bg-elevated/40"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-inset text-muted">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text">{project.name}</p>
        {project.location ? (
          <p className="mt-0.5 truncate text-xs text-subtle">
            {project.location}
          </p>
        ) : null}
        {shortLabel !== "-" && !isHo && !isWh ? (
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
}

export default function AttendanceProjectDirectory({
  clientId,
  projects,
}: Props) {
  const { t } = useT();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return projects;
    return projects.filter(
      (project) =>
        matchesDirectorySearch(searchQuery, project.name) ||
        project.location?.toLowerCase().includes(normalized)
    );
  }, [projects, searchQuery]);

  const { internal, projects: siteProjects } = useMemo(
    () => partitionAttendanceProjects(filtered),
    [filtered]
  );

  if (projects.length === 0) {
    return (
      <EmptyState
        title={t("pages.attendance.noProjects")}
        description={t("pages.attendance.noProjectsDesc")}
      />
    );
  }

  const noMatches = internal.length === 0 && siteProjects.length === 0;

  return (
    <div className="space-y-6">
      <DirectorySearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("pages.attendance.searchProjects")}
      />

      {noMatches ? (
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.attendance.noProjectsMatch")}
        />
      ) : (
        <>
          {internal.length > 0 ? (
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
                {internal.map((project) => (
                  <ProjectCard
                    key={project.id}
                    clientId={clientId}
                    project={project}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {siteProjects.length > 0 ? (
            <section className="space-y-3">
              {internal.length > 0 ? (
                <div>
                  <h2 className="text-base font-semibold text-text">
                    {t("pages.attendance.projectsSection")}
                  </h2>
                  <p className="mt-1 text-sm text-subtle">
                    {t("pages.attendance.projectsSectionDesc")}
                  </p>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {siteProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    clientId={clientId}
                    project={project}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
