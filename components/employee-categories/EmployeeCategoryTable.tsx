"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tags } from "lucide-react";
import { toast } from "sonner";

import { reorderEmployeeCategories } from "@/app/employee-categories/actions";
import EmployeeCategoryDeleteDialog from "@/components/employee-categories/EmployeeCategoryDeleteDialog";
import EmployeeCategoryDialog from "@/components/employee-categories/EmployeeCategoryDialog";
import EmployeeCategoryEditDialog, {
  type EmployeeCategoryRow,
} from "@/components/employee-categories/EmployeeCategoryEditDialog";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  categories: EmployeeCategoryRow[];
};

function EmployeeCategoryRowActions({
  category,
  otherCategories,
  onDeleted,
}: {
  category: EmployeeCategoryRow;
  otherCategories: EmployeeCategoryRow[];
  onDeleted: () => void;
}) {
  const { t } = useT();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-center gap-2.5 whitespace-nowrap">
        <Button
          type="button"
          size="badge"
          variant="destructiveBadge"
          onClick={(event) => {
            event.stopPropagation();
            setDeleteOpen(true);
          }}
        >
          {t("common.actions.delete")}
        </Button>
      </div>

      <EmployeeCategoryDeleteDialog
        category={category}
        otherCategories={otherCategories}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        showTrigger={false}
        onDeleted={onDeleted}
      />
    </>
  );
}

export default function EmployeeCategoryTable({ categories }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const [, startTransition] = useTransition();
  const [editCategory, setEditCategory] = useState<EmployeeCategoryRow | null>(
    null
  );

  function refresh() {
    router.refresh();
  }

  function handleReorder(orderedIds: string[]) {
    startTransition(async () => {
      try {
        await reorderEmployeeCategories(orderedIds);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to reorder departments."
        );
        router.refresh();
      }
    });
  }

  const columns: DataTableColumn<EmployeeCategoryRow>[] = [
    {
      key: "name",
      title: t("common.labels.department"),
      width: "12rem",
      share: 2,
      className: "min-w-[12rem]",
      render: (category) => (
        <div>
          <p className="font-semibold text-text">
            {localizeDepartmentLabel(category.slug, category.name, locale)}
          </p>
          <p className="mt-1 text-sm text-subtle">{category.slug}</p>
        </div>
      ),
    },
    {
      key: "prefix",
      title: t("common.labels.prefix"),
      width: "6rem",
      className: "min-w-[6rem] whitespace-nowrap",
      render: (category) => (
        <span className="font-mono text-cyan-300">{category.prefix}</span>
      ),
    },
    {
      key: "employees",
      title: t("common.labels.employees"),
      width: "7rem",
      className: "min-w-[7rem] whitespace-nowrap",
      render: (category) => (
        <span className="text-muted">{category._count.employees}</span>
      ),
    },
    {
      key: "status",
      title: t("common.labels.status"),
      width: "10rem",
      className: "min-w-[10rem] overflow-visible whitespace-nowrap text-center",
      render: (category) => (
        <StatusBadge status={category.active ? "active" : "inactive"}>
          {category.active
            ? t("common.labels.active")
            : t("common.labels.inactive")}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      title: t("common.labels.actions"),
      width: "11rem",
      align: "center",
      className: "min-w-[11rem] overflow-visible whitespace-nowrap",
      render: (category) => (
        <EmployeeCategoryRowActions
          category={category}
          otherCategories={categories.filter((item) => item.id !== category.id)}
          onDeleted={refresh}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-subtle">
          <Tags className="h-4 w-4 shrink-0 text-cyan-400" />
          {t(
            categories.length === 1
              ? "pages.employees.departmentCountOne"
              : "pages.employees.departmentCount",
            { count: categories.length }
          )}
        </div>
        <EmployeeCategoryDialog onCreated={refresh} />
      </div>

      <DataTable
        columns={columns}
        data={categories}
        getRowKey={(category) => category.id}
        onRowClick={setEditCategory}
        reorderable
        onReorder={handleReorder}
        emptyMessage={t("pages.employees.emptyDepartments")}
      />

      {editCategory ? (
        <EmployeeCategoryEditDialog
          key={editCategory.id}
          category={editCategory}
          otherCategories={categories.filter(
            (item) => item.id !== editCategory.id
          )}
          showDelete
          open
          showTrigger={false}
          onOpenChange={(open) => {
            if (!open) setEditCategory(null);
          }}
          onUpdated={refresh}
        />
      ) : null}
    </div>
  );
}
