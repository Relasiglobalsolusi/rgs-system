"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reorderEmployees } from "@/app/employees/actions";
import EmployeeEditDialog from "@/components/employees/EmployeeEditDialog";
import EmployeeDeleteDialog from "@/components/employees/EmployeeDeleteDialog";
import EmployeeReactivateDialog from "@/components/employees/EmployeeReactivateDialog";
import EmployeeArchiveDialog from "@/components/employees/EmployeeArchiveDialog";
import type {
  EmployeeCategoryOption,
  PositionOption,
  ProjectOption,
} from "@/components/employees/EmployeeFormFields";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  formatEmploymentTypeLabel,
  formatPlacementLabel,
} from "@/lib/placement";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import type { EmploymentType, Placement } from "@prisma/client";

type Employee = {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  employmentType: EmploymentType;
  placement: Placement;
  portalAccessRequested: boolean;
  positionId: string | null;
  position: string | null;
  categoryId: string | null;
  category: { name: string; prefix: string; slug?: string } | null;
  idDocumentUrl: string | null;
  status: "ACTIVE" | "INACTIVE" | "TERMINATED" | "ON_LEAVE";
  hiredAt: Date | string | null;
  projectAssignments: {
    project: { id: string; name: string; location: string | null };
  }[];
  user: { username: string; active: boolean } | null;
};
type Props = {
  employees: Employee[];
  categories: EmployeeCategoryOption[];
  positions: PositionOption[];
  projects: ProjectOption[];
  canManage?: boolean;
  canArchive?: boolean;
  directoryView?: "available" | "partTime" | "trash";
};

export default function EmployeeTable({
  employees,
  categories,
  positions,
  projects,
  canManage = false,
  canArchive = false,
  directoryView = "available",
}: Props) {
  const { t, locale } = useT();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [restoring, setRestoring] = useState<Employee | null>(null);
  const [archiving, setArchiving] = useState<Employee | null>(null);

  function reorder(ids: string[]) {
    if (!canManage) return;
    startTransition(async () => {
      try {
        await reorderEmployees(ids);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to reorder employees."
        );
        router.refresh();
      }
    });
  }

  const columns = useMemo<DataTableColumn<Employee>[]>(
    () => [
      {
        key: "name",
        title: t("pages.employees.columns.employee"),
        share: 2,
        render: (employee) => (
          <p className="font-semibold text-text">
            {employee.firstName} {employee.lastName}
          </p>
        ),
      },
      {
        key: "number",
        title: t("pages.employees.columns.employeeNo"),
        render: (employee) => (
          <span className="font-mono text-sm text-muted">
            {employee.employeeNo}
          </span>
        ),
      },
      {
        key: "department",
        title: t("pages.employees.columns.department"),
        render: (employee) => (
          <span className="text-muted">
            {employee.category
              ? `${localizeDepartmentLabel(employee.category.slug, employee.category.name, locale)} (${employee.category.prefix})`
              : "—"}
          </span>
        ),
      },
      {
        key: "position",
        title: t("pages.employees.columns.position"),
        render: (employee) => (
          <span className="text-muted">{employee.position ?? "—"}</span>
        ),
      },
      {
        key: "employmentType",
        title: t("pages.employees.columns.employmentType"),
        render: (employee) => (
          <StatusBadge
            status={employee.employmentType === "FULL_TIME" ? "active" : "warning"}
            compact
          >
            {formatEmploymentTypeLabel(employee.employmentType, locale)}
          </StatusBadge>
        ),
      },
      {
        key: "placement",
        title: t("pages.employees.columns.placement"),
        render: (employee) => (
          <span className="text-muted">
            {formatPlacementLabel(employee.placement, locale)}
          </span>
        ),
      },
      {
        key: "portal",
        title: t("pages.employees.columns.portalLogin"),
        render: (employee) => (
          <StatusBadge
            status={employee.user?.active ? "active" : "danger"}
            compact
          >
            {employee.user?.active ? t("common.actions.yes") : t("common.actions.no")}
          </StatusBadge>
        ),
      },
      ...(canManage
        ? [
            {
              key: "actions",
              title: t("pages.employees.columns.actions"),
              align: "center" as const,
              render: (employee: Employee) => (
                <div className="flex justify-center gap-2">
                  {directoryView === "trash" ? (
                    <>
                      <Button
                        size="badge"
                        variant="successBadge"
                        onClick={(event) => {
                          event.stopPropagation();
                          setRestoring(employee);
                        }}
                      >
                        {t("common.actions.restore")}
                      </Button>
                      {canArchive ? (
                        <Button
                          size="badge"
                          variant="destructiveBadge"
                          onClick={(event) => {
                            event.stopPropagation();
                            setArchiving(employee);
                          }}
                        >
                          {t("common.actions.delete")}
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <Button
                      size="badge"
                      variant="destructiveBadge"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleting(employee);
                      }}
                    >
                      {t("common.actions.delete")}
                    </Button>
                  )}
                </div>
              ),
            },
          ]
        : []),
    ],
    [canManage, directoryView, canArchive, t, locale]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={employees}
        getRowKey={(employee) => employee.id}
        onRowClick={
          canManage && directoryView !== "trash" ? setEditing : undefined
        }
        reorderable={canManage && directoryView !== "trash"}
        onReorder={reorder}
        emptyMessage={t("pages.employees.emptyActiveListDesc")}
      />
      {editing ? (
        <EmployeeEditDialog
          employee={editing}
          categories={categories}
          positions={positions}
          projects={projects}
          showDelete
          open
          showTrigger={false}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <EmployeeDeleteDialog
          employee={deleting}
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          showTrigger={false}
        />
      ) : null}
      {restoring ? (
        <EmployeeReactivateDialog
          employee={restoring}
          open
          onOpenChange={(open) => !open && setRestoring(null)}
          showTrigger={false}
        />
      ) : null}
      {archiving ? (
        <EmployeeArchiveDialog
          employee={archiving}
          open
          onOpenChange={(open) => !open && setArchiving(null)}
          showTrigger={false}
        />
      ) : null}
    </>
  );
}
