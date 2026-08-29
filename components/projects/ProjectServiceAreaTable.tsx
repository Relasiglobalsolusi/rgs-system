"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Layers, Tags } from "lucide-react";

import ProjectServiceAreaDeleteDialog from "@/components/projects/ProjectServiceAreaDeleteDialog";
import ProjectServiceAreaDialog from "@/components/projects/ProjectServiceAreaDialog";
import ProjectServiceAreaEditDialog from "@/components/projects/ProjectServiceAreaEditDialog";
import ProjectSubcategoryDeleteDialog from "@/components/projects/ProjectSubcategoryDeleteDialog";
import ProjectSubcategoryDialog from "@/components/projects/ProjectSubcategoryDialog";
import ProjectSubcategoryEditDialog from "@/components/projects/ProjectSubcategoryEditDialog";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";
import {
  allowsCustomOneTimeSubcategory,
  catalogDisplayName,
  manageSubcategoriesForArea,
  type ProjectCatalogAreaDTO,
  type ProjectCatalogSubcategoryDTO,
} from "@/lib/project-service-catalog";

type Props = {
  catalog: ProjectCatalogAreaDTO[];
  selectedAreaId: string | null;
  onSelectedAreaIdChange: (id: string | null) => void;
};

/** Same box as Add Subcategory — do not size these with the dialog wrapper. */
const catalogToolbarPairClass =
  "box-border h-[2.75rem] min-h-[2.75rem] w-fit max-w-full min-w-0 sm:w-[12.75rem] sm:min-w-[12.75rem] sm:max-w-[12.75rem]";

function CatalogRowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useT();

  function stop(event: MouseEvent) {
    event.stopPropagation();
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2.5 sm:flex-row">
      <Button
        type="button"
        size="badge"
        variant="mutedBadge"
        onClick={(event) => {
          stop(event);
          onEdit();
        }}
      >
        {t("common.actions.edit")}
      </Button>
      <Button
        type="button"
        size="badge"
        variant="destructiveBadge"
        onClick={(event) => {
          stop(event);
          onDelete();
        }}
      >
        {t("common.actions.delete")}
      </Button>
    </div>
  );
}

export default function ProjectServiceAreaTable({
  catalog,
  selectedAreaId,
  onSelectedAreaIdChange,
}: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const [editArea, setEditArea] = useState<ProjectCatalogAreaDTO | null>(null);
  const [deleteArea, setDeleteArea] = useState<ProjectCatalogAreaDTO | null>(
    null
  );
  const [editSub, setEditSub] =
    useState<ProjectCatalogSubcategoryDTO | null>(null);
  const [deleteSub, setDeleteSub] =
    useState<ProjectCatalogSubcategoryDTO | null>(null);

  const selectedArea = useMemo(
    () => catalog.find((area) => area.id === selectedAreaId) ?? null,
    [catalog, selectedAreaId]
  );
  const subcategories = useMemo(
    () => (selectedArea ? manageSubcategoriesForArea(selectedArea) : []),
    [selectedArea]
  );

  function refresh() {
    router.refresh();
  }

  if (selectedArea) {
    const subColumns: DataTableColumn<ProjectCatalogSubcategoryDTO>[] = [
      {
        key: "name",
        title: t("pages.projects.subcategory"),
        share: 2,
        width: "12rem",
        className: "min-w-[12rem]",
        render: (sub) => (
          <p className="font-semibold text-text">
            {catalogDisplayName(sub, locale)}
          </p>
        ),
      },
      {
        key: "billingKind",
        title: t("pages.projects.oneTime"),
        width: "7rem",
        className: "min-w-[7rem] whitespace-nowrap",
        render: (sub) => (
          <span className="text-muted">
            {sub.billingKind === "ONE_TIME"
              ? t("common.actions.yes")
              : t("common.actions.no")}
          </span>
        ),
      },
      {
        key: "projects",
        title: t("pages.projects.catalogProjects"),
        width: "7rem",
        className: "min-w-[7rem] whitespace-nowrap",
        render: (sub) => (
          <span className="text-muted">{sub.projectCount}</span>
        ),
      },
      {
        key: "actions",
        title: t("common.labels.actions"),
        width: "13rem",
        cellAlign: "center",
        className: "min-w-[13rem] overflow-visible whitespace-nowrap",
        render: (sub) => (
          <CatalogRowActions
            onEdit={() => setEditSub(sub)}
            onDelete={() => setDeleteSub(sub)}
          />
        ),
      },
    ];

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="mutedBadge"
              size="badgeFlex"
              onClick={() => onSelectedAreaIdChange(null)}
            >
              <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
              {t("pages.projects.backToServiceAreas")}
            </Button>
            <div className="flex items-center gap-2 text-sm text-subtle">
              <Tags className="h-4 w-4 shrink-0 text-cyan-400" />
              <span className="font-medium text-text">
                {catalogDisplayName(selectedArea, locale)}
              </span>
              <span>
                {t(
                  subcategories.length === 1
                    ? "pages.projects.subcategoryManageCountOne"
                    : "pages.projects.subcategoryManageCount",
                  { count: subcategories.length }
                )}
              </span>
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="mutedBadge"
              size="badgeFlex"
              className={catalogToolbarPairClass}
              onClick={() => setEditArea(selectedArea)}
            >
              {t("common.actions.edit")}
            </Button>
            <ProjectSubcategoryDialog
              areaId={selectedArea.id}
              allowsOneTime={allowsCustomOneTimeSubcategory(selectedArea)}
              onCreated={refresh}
              triggerClassName={catalogToolbarPairClass}
            />
          </div>
        </div>

        <DataTable
          columns={subColumns}
          data={subcategories}
          getRowKey={(sub) => sub.id}
          onRowClick={setEditSub}
          emptyMessage={t("pages.projects.emptyCatalogSubcategories")}
        />

        {editArea ? (
          <ProjectServiceAreaEditDialog
            key={editArea.id}
            area={editArea}
            open
            onOpenChange={(open) => {
              if (!open) setEditArea(null);
            }}
            onUpdated={refresh}
          />
        ) : null}
        {editSub ? (
          <ProjectSubcategoryEditDialog
            key={editSub.id}
            area={selectedArea}
            subcategory={editSub}
            open
            onOpenChange={(open) => {
              if (!open) setEditSub(null);
            }}
            onUpdated={refresh}
          />
        ) : null}
        {deleteSub ? (
          <ProjectSubcategoryDeleteDialog
            key={deleteSub.id}
            subcategory={deleteSub}
            open
            onOpenChange={(open) => {
              if (!open) setDeleteSub(null);
            }}
            onDeleted={refresh}
          />
        ) : null}
      </div>
    );
  }

  const areaColumns: DataTableColumn<ProjectCatalogAreaDTO>[] = [
    {
      key: "name",
      title: t("pages.projects.serviceArea"),
      share: 2,
      width: "12rem",
      className: "min-w-[12rem]",
      render: (area) => (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-text">
              {catalogDisplayName(area, locale)}
            </p>
            <p className="mt-1 text-sm text-subtle">
              {t(
                area.subcategoryCount === 1
                  ? "pages.projects.subcategoryManageCountOne"
                  : "pages.projects.subcategoryManageCount",
                { count: area.subcategoryCount }
              )}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-subtle" />
        </div>
      ),
    },
    {
      key: "oneTime",
      title: t("pages.projects.oneTime"),
      width: "7rem",
      className: "min-w-[7rem] whitespace-nowrap",
      render: (area) => (
        <span className="text-muted">
          {area.allowsOneTime
            ? t("common.actions.yes")
            : t("common.actions.no")}
        </span>
      ),
    },
    {
      key: "projects",
      title: t("pages.projects.catalogProjects"),
      width: "7rem",
      className: "min-w-[7rem] whitespace-nowrap",
      render: (area) => (
        <span className="text-muted">{area.projectCount}</span>
      ),
    },
    {
      key: "actions",
      title: t("common.labels.actions"),
      width: "13rem",
      cellAlign: "center",
      className: "min-w-[13rem] overflow-visible whitespace-nowrap",
      render: (area) => (
        <CatalogRowActions
          onEdit={() => setEditArea(area)}
          onDelete={() => setDeleteArea(area)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-subtle">
          <Layers className="h-4 w-4 shrink-0 text-cyan-400" />
          {t(
            catalog.length === 1
              ? "pages.projects.serviceAreaCountOne"
              : "pages.projects.serviceAreaCount",
            { count: catalog.length }
          )}
        </div>
        <ProjectServiceAreaDialog onCreated={refresh} />
      </div>

      <DataTable
        columns={areaColumns}
        data={catalog}
        getRowKey={(area) => area.id}
        onRowClick={(area) => onSelectedAreaIdChange(area.id)}
        emptyMessage={t("pages.projects.emptyServiceAreas")}
      />

      {editArea ? (
        <ProjectServiceAreaEditDialog
          key={editArea.id}
          area={editArea}
          open
          onOpenChange={(open) => {
            if (!open) setEditArea(null);
          }}
          onUpdated={refresh}
        />
      ) : null}
      {deleteArea ? (
        <ProjectServiceAreaDeleteDialog
          key={deleteArea.id}
          area={deleteArea}
          open
          onOpenChange={(open) => {
            if (!open) setDeleteArea(null);
          }}
          onDeleted={refresh}
        />
      ) : null}
    </div>
  );
}
