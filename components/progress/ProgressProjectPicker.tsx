"use client";

import Image from "next/image";
import Link from "next/link";
import { Camera, ChevronRight } from "lucide-react";

import { useT } from "@/lib/i18n/use-t";

export type ProgressProjectCard = {
  id: string;
  name: string;
  reportCount: number;
  latestPhotoUrl: string | null;
  latestNote: string | null;
};

type Props = {
  projects: ProgressProjectCard[];
};

export default function ProgressProjectPicker({ projects }: Props) {
  const { t } = useT();

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/progress?projectId=${encodeURIComponent(project.id)}`}
          className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:border-border-strong hover:bg-elevated/40"
        >
          <div className="relative aspect-[4/3] bg-inset">
            {project.latestPhotoUrl ? (
              <Image
                src={project.latestPhotoUrl}
                alt=""
                fill
                className="object-cover transition duration-300 group-hover:scale-[1.02]"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted">
                <Camera className="h-6 w-6" />
                <span className="text-xs">
                  {t("pages.progress.noPhotosYet")}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-text">{project.name}</p>
              <p className="mt-0.5 text-xs text-subtle">
                {t(
                  project.reportCount === 1
                    ? "pages.progress.feedReportCountOne"
                    : "pages.progress.feedReportCountOther",
                  { count: project.reportCount }
                )}
              </p>
              {project.latestNote ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted">
                  {project.latestNote}
                </p>
              ) : null}
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted transition group-hover:text-text" />
          </div>
        </Link>
      ))}
    </div>
  );
}
