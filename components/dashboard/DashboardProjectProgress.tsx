"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban, MapPin } from "lucide-react";

import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { localizeProjectStatus } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import type { ProjectStatus } from "@prisma/client";

type Project = {
  id: string;
  name: string;
  location: string | null;
  status: string;
  _count?: { progressReports: number };
};

type Props = {
  projects: Project[];
};

function statusTone(
  status: ProjectStatus | string
): "active" | "success" | "warning" | "inactive" | "pending" {
  switch (status) {
    case "IN_PROGRESS":
      return "active";
    case "COMPLETED":
      return "success";
    case "ON_HOLD":
      return "warning";
    case "PLANNED":
      return "pending";
    default:
      return "inactive";
  }
}

export default function DashboardProjectProgress({ projects }: Props) {
  const router = useRouter();
  const { t, locale } = useT();

  return (
    <SectionCard className="max-lg:p-4">
      <div className="mb-4 flex items-center justify-between gap-3 lg:mb-6">
        <div className="flex min-w-0 items-center gap-2">
          <FolderKanban size={18} className="shrink-0 text-cyan-400" />
          <h3 className="truncate text-base font-semibold text-text lg:text-lg">
            {t("pages.dashboard.activeProjects")}
          </h3>
        </div>
        <Link
          href="/projects"
          className="shrink-0 text-xs font-medium text-subtle hover:text-cyan-300"
        >
          {t("pages.dashboard.viewAll")}
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-inset px-4 py-10 text-center sm:px-6 sm:py-12">
          <FolderKanban size={28} className="mx-auto text-muted" />
          <p className="mt-4 text-sm font-medium text-subtle">
            {t("pages.dashboard.noActiveProjects")}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t("pages.dashboard.noActiveProjectsDesc")}
          </p>
        </div>
      ) : (
        <div className="space-y-3 lg:space-y-5">
          {projects.map((project) => {
            const href = `/projects/${project.id}`;
            const reportCount = project._count?.progressReports ?? 0;
            return (
              <div
                key={project.id}
                role="link"
                tabIndex={0}
                className="cursor-pointer rounded-2xl border border-border bg-elevated p-3.5 transition hover:border-border-strong hover:bg-card-hover sm:p-4"
                onClick={() => router.push(href)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(href);
                  }
                }}
              >
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-text sm:text-base">
                      {project.name}
                    </p>
                    {project.location && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-subtle">
                        <MapPin size={12} className="shrink-0" />
                        {project.location}
                      </p>
                    )}
                  </div>
                  <StatusBadge
                    status={statusTone(project.status)}
                    compact
                    className="w-fit"
                  >
                    {localizeProjectStatus(project.status, locale)}
                  </StatusBadge>
                </div>
                <p className="text-xs text-subtle">
                  {reportCount === 1
                    ? t("pages.dashboard.progressReportCountOne", {
                        count: reportCount,
                      })
                    : t("pages.dashboard.progressReportCountOther", {
                        count: reportCount,
                      })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
