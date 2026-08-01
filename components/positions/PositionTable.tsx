"use client";

import { useState, useTransition } from "react";
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
import StatusBadge from "@/components/ui/StatusBadge";
import {
  localizeDepartmentLabel,
  localizeJobTitle,
} from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { titleCaseWords } from "@/lib/text-case";

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

  function refresh() {
    router.refresh();
  }

  function reorder(ids: string[]) {
    startTransition(async () => {
      try {
        await reorderPositions(ids);
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
            positions.length === 1
              ? "pages.employees.positionCountOne"
              : "pages.employees.positionCount",
            { count: positions.length }
          )}
        </div>
        <PositionDialog categories={categories} onCreated={refresh} />
      </div>
      <DataTable
        columns={columns}
        data={positions}
        getRowKey={(position) => position.id}
        onRowClick={setEditPosition}
        reorderable
        onReorder={reorder}
        emptyMessage={t("pages.employees.emptyPositions")}
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
