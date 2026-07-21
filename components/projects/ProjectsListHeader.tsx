"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useT } from "@/lib/i18n/use-t";
import { localizeSubCategory } from "@/lib/i18n/labels";
import type { ProjectSubCategory } from "@prisma/client";

type Props = {
  listTitleKey?: string;
  subCategory?: ProjectSubCategory | null;
  count: number;
  countKind: "project" | "item";
  filterClient?: { name: string; clearHref: string } | null;
  actions?: ReactNode;
};

export default function ProjectsListHeader({
  listTitleKey,
  subCategory,
  count,
  countKind,
  filterClient,
  actions,
}: Props) {
  const { t, locale } = useT();

  const title = listTitleKey
    ? t(listTitleKey)
    : subCategory
      ? t("pages.projects.subCategoryProjects", {
          type: localizeSubCategory(subCategory, locale),
        })
      : t("pages.projects.allTitle");

  const countLabel =
    countKind === "item"
      ? t(count === 1 ? "pages.projects.itemOne" : "pages.projects.itemOther", {
          count,
        })
      : t(
          count === 1
            ? "pages.projects.projectOne"
            : "pages.projects.projectOther",
          { count }
        );

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        <p className="mt-1 text-xs text-muted">
          {countLabel}
          {filterClient ? (
            <>
              {" "}
              {t("pages.projects.forClient")}{" "}
              <Link
                href={filterClient.clearHref}
                className="text-cyan-400 hover:text-cyan-300"
              >
                {filterClient.name}
              </Link>
            </>
          ) : null}
        </p>
      </div>
      {actions}
    </div>
  );
}
