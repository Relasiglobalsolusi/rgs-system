"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronRight,
  FolderKanban,
  Landmark,
  Warehouse,
} from "lucide-react";

import type { TransferOrderProjectRow } from "@/lib/transfer-order-directory";
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
import TransferOrderCountBadges from "@/components/transfer-orders/TransferOrderCountBadges";
import { localizeSubCategoryShort } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  clientId: string;
  projects: TransferOrderProjectRow[];
};

function ProjectCard({
  clientId,
  project,
}: {
  clientId: string;
  project: TransferOrderProjectRow;
}) {
  const { locale } = useT();
  const shortLabel = localizeSubCategoryShort(project.subCategory, locale);
  const isHo = isAttendanceHeadOfficeName(project.name);
  const isWh = isAttendanceWarehouseName(project.name);
  const Icon = isWh ? Warehouse : isHo ? Landmark : FolderKanban;

  return (
    <Link
      href={`/transfer-orders/${clientId}/${project.id}`}
      className="group flex items-start gap-4 rounded-2xl border border-border bg-card px-4 py-4 transition hover:border-border-strong hover:bg-elevated/40"
    >
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-inset text-muted">
        <Icon className="h-5 w-5" />
        {project.pendingSendCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[0.625rem] font-bold text-black">
            {project.pendingSendCount > 99 ? "99+" : project.pendingSendCount}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text">{project.name}</p>
        {project.location ? (
          <p className="mt-0.5 truncate text-xs text-subtle">
            {project.location}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {shortLabel !== "-" && !isHo && !isWh ? (
            <StatusBadge status="info" compact>
              {shortLabel}
            </StatusBadge>
          ) : null}
          <TransferOrderCountBadges
            pendingSendCount={project.pendingSendCount}
            inTransitCount={project.inTransitCount}
          />
        </div>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted transition group-hover:text-text" />
    </Link>
  );
}

export default function TransferOrderProjectDirectory({
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
        title={t("pages.transferOrders.noProjects")}
        description={t("pages.transferOrders.noProjectsDesc")}
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="space-y-6">
        <DirectorySearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("pages.transferOrders.searchProjects")}
        />
        <EmptyState
          title={t("common.labels.noResults")}
          description={t("pages.transferOrders.noProjectsMatch")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DirectorySearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("pages.transferOrders.searchProjects")}
      />

      {internal.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">
            {t("pages.transferOrders.internalSection")}
          </h2>
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
            <h2 className="text-base font-semibold text-text">
              {t("pages.transferOrders.projectsSection")}
            </h2>
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
    </div>
  );
}
