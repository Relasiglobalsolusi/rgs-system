"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness } from "lucide-react";
import { toast } from "sonner";
import { reorderPositions } from "@/app/positions/actions";
import PositionDialog from "@/components/positions/PositionDialog";
import PositionEditDialog, {
  type PositionRow,
} from "@/components/positions/PositionEditDialog";
import type { EmployeeCategoryOption } from "@/components/employees/EmployeeFormFields";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  localizeDepartmentLabel,
  localizeJobTitle,
} from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { titleCaseWords } from "@/lib/text-case";

const ALL_DEPARTMENTS = "all";

function isFilterableDepartment(category: EmployeeCategoryOption): boolean {
  return (
    category.active &&
    category.slug?.toLowerCase() !== "una" &&
    category.slug?.toLowerCase() !== "finance" &&
    category.prefix.toUpperCase() !== "UNA" &&
    category.prefix.toUpperCase() !== "FIN"
  );
}

export default function PositionTable({
  positions,
  categories,
}: {
  positions: PositionRow[];
  categories: EmployeeCategoryOption[];
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const [, startTransition] = useTransition();
  const [editPosition, setEditPosition] = useState<PositionRow | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState(ALL_DEPARTMENTS);

  const departmentOptions = useMemo(
    () =>
      [...categories]
        .filter(isFilterableDepartment)
        .sort((left, right) => {
          if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder;
          }
          return left.name.localeCompare(right.name);
        }),
    [categories]
  );

  const sortedPositions = useMemo(
    () =>
      [...positions].sort((left, right) => {
        const departmentOrder =
          (left.category.sortOrder ?? 0) - (right.category.sortOrder ?? 0);
        if (departmentOrder !== 0) return departmentOrder;
        const departmentName = left.category.name.localeCompare(
          right.category.name
        );
        if (departmentName !== 0) return departmentName;
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }
        return left.name.localeCompare(right.name);
      }),
    [positions]
  );

  const visiblePositions = useMemo(
    () =>
      departmentFilter === ALL_DEPARTMENTS
        ? sortedPositions
        : sortedPositions.filter(
            (position) => position.categoryId === departmentFilter
          ),
    [sortedPositions, departmentFilter]
  );

  function departmentLabel(category: EmployeeCategoryOption): string {
    return titleCaseWords(
      localizeDepartmentLabel(category.slug, category.name, locale)
    );
  }

  function refresh() {
    router.refresh();
  }

  function reorder(ids: string[]) {
    const visibleIds = new Set(
      visiblePositions.map((position) => position.id)
    );
    let nextIndex = 0;
    const mergedIds = sortedPositions.map((position) =>
      visibleIds.has(position.id)
        ? (ids[nextIndex++] ?? position.id)
        : position.id
    );
    const byId = new Map(positions.map((position) => [position.id, position]));
    const departmentIds = [
      ...new Set(sortedPositions.map((position) => position.categoryId)),
    ];
    const groupedIds = departmentIds.flatMap((categoryId) =>
      mergedIds.filter((id) => byId.get(id)?.categoryId === categoryId)
    );
    startTransition(async () => {
      try {
        await reorderPositions(groupedIds);
        refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("pages.employees.positionDialog.reorderFailed")
        );
        refresh();
      }
    });
  }

  const columns: DataTableColumn<PositionRow>[] = [
    {
      key: "name",
      title: t("pages.employees.columns.position"),
      share: 2,
      render: (position) => (
        <p className="font-semibold text-text">
          {localizeJobTitle(position.name, locale)}
        </p>
      ),
    },
    {
      key: "department",
      title: t("common.labels.department"),
      render: (position) => (
        <span className="text-muted">
          {titleCaseWords(
            localizeDepartmentLabel(
              position.category.slug,
              position.category.name,
              locale
            )
          )}{" "}
          ({position.category.prefix.toUpperCase()})
        </span>
      ),
    },
    {
      key: "description",
      title: t("common.labels.description"),
      share: 2,
      render: (position) => (
        <span className="text-muted">
          {position.description
            ? titleCaseWords(position.description)
            : t("common.labels.na")}
        </span>
      ),
    },
    {
      key: "employees",
      title: t("common.labels.employees"),
      render: (position) => (
        <span className="text-muted">{position._count.employees}</span>
      ),
    },
    {
      key: "status",
      title: t("common.labels.status"),
      cellAlign: "center",
      render: (position) => (
        <StatusBadge status={position.active ? "active" : "inactive"}>
          {position.active
            ? t("common.labels.active")
            : t("common.labels.inactive")}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-subtle">
          <BriefcaseBusiness className="h-4 w-4 text-cyan-400" />
          {t(
            visiblePositions.length === 1
              ? "pages.employees.positionCountOne"
              : "pages.employees.positionCount",
            { count: visiblePositions.length }
          )}
        </div>
        <PositionDialog
          categories={categories}
          defaultCategoryId={
            departmentFilter === ALL_DEPARTMENTS
              ? undefined
              : departmentFilter
          }
          onCreated={refresh}
        />
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("pages.employees.filterDepartment")}
      >
        <DirectoryFilterTab
          size="sm"
          active={departmentFilter === ALL_DEPARTMENTS}
          onClick={() => setDepartmentFilter(ALL_DEPARTMENTS)}
          count={positions.length}
        >
          {t("common.actions.all")}
        </DirectoryFilterTab>
        {departmentOptions.map((category) => (
          <DirectoryFilterTab
            key={category.id}
            size="sm"
            active={departmentFilter === category.id}
            onClick={() => setDepartmentFilter(category.id)}
            count={
              positions.filter(
                (position) => position.categoryId === category.id
              ).length
            }
          >
            {departmentLabel(category)}
          </DirectoryFilterTab>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={visiblePositions}
        getRowKey={(position) => position.id}
        onRowClick={setEditPosition}
        reorderable
        onReorder={reorder}
        emptyMessage={
          departmentFilter === ALL_DEPARTMENTS
            ? t("pages.employees.emptyPositions")
            : t("pages.employees.emptyPositionsDepartment")
        }
      />
      {editPosition ? (
        <PositionEditDialog
          position={editPosition}
          otherPositions={positions.filter(
            (position) => position.id !== editPosition.id
          )}
          open
          onOpenChange={(open) => !open && setEditPosition(null)}
          onUpdated={refresh}
        />
      ) : null}
    </div>
  );
}
