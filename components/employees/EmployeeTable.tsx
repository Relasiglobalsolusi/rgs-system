"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reorderEmployees } from "@/app/employees/actions";
import EmployeeEditDialog from "@/components/employees/EmployeeEditDialog";
import {
  canAssignEmployeePosition,
  employeeCreateHierarchyError,
  type EmployeeCreateActorTier,
} from "@/lib/employee-create-hierarchy";
import { showRejection } from "@/components/ui/rejection-notice";
import EmployeeDeleteDialog from "@/components/employees/EmployeeDeleteDialog";
import EmployeeResignDialog from "@/components/employees/EmployeeResignDialog";
import EmployeeReactivateDialog from "@/components/employees/EmployeeReactivateDialog";
import EmployeeArchiveDialog from "@/components/employees/EmployeeArchiveDialog";
import type {
  EmployeeCategoryOption,
  PositionOption,
  ProjectOption,
} from "@/components/employees/EmployeeFormFields";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { createSelectionColumn } from "@/components/ui/data-table-selection";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  ACTIONS_SINGLE_CHIP_COLUMN_WIDTH,
  TrashPermanentDeleteChip,
  TrashRestoreChip,
  TRASH_ACTIONS_COLUMN_WIDTH,
} from "@/components/ui/trash-action-buttons";
import { Button } from "@/components/ui/button";
import {
  formatEmploymentTypeLabel,
  formatPlacementLabel,
} from "@/lib/placement";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import { formatContractPrice } from "@/lib/project-billing";
import { useT } from "@/lib/i18n/use-t";
import type { EmploymentType, Placement, ServiceArea } from "@prisma/client";

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
  jobPosition?: { id: string; name: string; slug: string } | null;
  categoryId: string | null;
  category: { name: string; prefix: string; slug?: string } | null;
  idDocumentUrl: string | null;
  status:
    | "ACTIVE"
    | "INACTIVE"
    | "TERMINATED"
    | "ON_LEAVE"
    | "LEAVE_PENDING"
    | "RESIGNED";
  depositHeldAmount?: number | null;
  depositStatus?: "NONE" | "HELD" | "RETURNED" | "KEPT_BY_COMPANY";
  lastWorkingDay?: Date | string | null;
  resignAccordingToProcedure?: boolean | null;
  hasPendingLeaveRequest?: boolean;
  hiredAt: Date | string | null;
  omApprovalAreas?: ServiceArea[];
  areaManagedProjects?: { projectId: string }[];
  basePay: number | null;
  bpjsKesehatanEnabled: boolean;
  bpjsKetenagakerjaanEnabled: boolean;
  jhtEnabled: boolean;
  jpEnabled: boolean;
  jkkEnabled: boolean;
  jkmEnabled: boolean;
  jkkPercent: number | null;
  projectAssignments: {
    project: { id: string; name: string; location: string | null };
  }[];
  operationsTeamMembership?: {
    team: { name: string };
  } | null;
  user: { username: string; active: boolean } | null;
};

export type EmployeeDirectoryView =
  | "allEmployees"
  | "fullTime"
  | "partTime"
  | "unassigned"
  | "trash";

/** Portal Login column: Yes (active), Revoked (linked but inactive), No (never provisioned). */
export type EmployeePortalLoginStatus = "yes" | "revoked" | "no";

export function getEmployeePortalLoginStatus(
  employee: Pick<Employee, "user">
): EmployeePortalLoginStatus {
  if (!employee.user) return "no";
  if (employee.user.active) return "yes";
  return "revoked";
}

type Props = {
  employees: Employee[];
  categories: EmployeeCategoryOption[];
  positions: PositionOption[];
  projects: ProjectOption[];
  canManage?: boolean;
  canResign?: boolean;
  canArchive?: boolean;
  createActorTier?: EmployeeCreateActorTier;
  directoryView?: EmployeeDirectoryView;
  showSelection?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  allVisibleSelected?: boolean;
  someVisibleSelected?: boolean;
  selectableIds?: Set<string>;
};

export default function EmployeeTable({
  employees,
  categories,
  positions,
  projects,
  canManage = false,
  canResign = false,
  canArchive = false,
  createActorTier = "OTHER",
  directoryView = "allEmployees",
  showSelection = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allVisibleSelected = false,
  someVisibleSelected = false,
  selectableIds,
}: Props) {
  const { t, locale } = useT();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [resigning, setResigning] = useState<Employee | null>(null);
  const [restoring, setRestoring] = useState<Employee | null>(null);
  const [archiving, setArchiving] = useState<Employee | null>(null);

  const isTrash = directoryView === "trash";

  function canEditEmployeeRecord(employee: Employee) {
    const position = employee.jobPosition ?? {
      slug: null,
      name: employee.position,
    };
    return canAssignEmployeePosition(createActorTier, position);
  }

  function openEdit(employee: Employee) {
    if (!canEditEmployeeRecord(employee)) {
      const position = employee.jobPosition ?? {
        slug: null,
        name: employee.position,
      };
      showRejection({
        reasons: position
          ? employeeCreateHierarchyError(createActorTier, position)
          : "You can only manage employees below your level.",
      });
      return;
    }
    setEditing(employee);
  }

  function reorder(ids: string[]) {
    if (!canManage || isTrash) return;
    startTransition(async () => {
      try {
        await reorderEmployees(ids);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("pages.employees.reorderFailed")
        );
        router.refresh();
      }
    });
  }

  const columns = useMemo(() => {
    const cols: DataTableColumn<Employee>[] = [];

    if (showSelection) {
      cols.push(
        createSelectionColumn<Employee>({
          ariaLabelAll: t("pages.employees.selectAll"),
          getRowAriaLabel: (employee) =>
            t("pages.employees.selectRow", {
              name: `${employee.firstName} ${employee.lastName}`,
            }),
          getRowId: (employee) => employee.id,
          allVisibleSelected,
          someVisibleSelected,
          onToggleSelectAll,
          onToggleSelect,
          selectedIds,
          selectableIds,
        })
      );
    }

    cols.push(
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
        key: "leaveStatus",
        title: t("pages.employees.columns.status"),
        align: "center",
        width: "8.5rem",
        className: "min-w-[8.5rem]",
        render: (employee) => {
          if (employee.status === "RESIGNED") {
            return (
              <div className="flex justify-center">
                <StatusBadge status="danger" compact>
                  {t("pages.employees.resign")}
                </StatusBadge>
              </div>
            );
          }
          if (employee.status === "ON_LEAVE") {
            return (
              <div className="flex justify-center">
                <StatusBadge
                  status="info"
                  compact
                  lines={[
                    t("pages.employees.onLeaveChipLine1"),
                    t("pages.employees.onLeaveChipLine2"),
                  ]}
                />
              </div>
            );
          }
          if (employee.hasPendingLeaveRequest) {
            return (
              <div className="flex justify-center">
                <StatusBadge
                  status="warning"
                  compact
                  lines={[
                    t("pages.employees.leavePendingChipLine1"),
                    t("pages.employees.leavePendingChipLine2"),
                  ]}
                />
              </div>
            );
          }
          return <span className="text-muted">—</span>;
        },
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
        key: "team",
        title: t("pages.employees.columns.team"),
        render: (employee) => (
          <span className="text-muted">
            {employee.operationsTeamMembership?.team.name ?? "—"}
          </span>
        ),
      },
      {
        key: "employmentType",
        title: t("pages.employees.columns.employmentType"),
        render: (employee) => (
          <StatusBadge
            status={
              employee.employmentType === "FULL_TIME" ? "active" : "warning"
            }
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
        key: "securityDeposit",
        title: t("pages.employees.columns.securityDeposit"),
        render: (employee) => {
          const status = employee.depositStatus ?? "NONE";
          if (status === "NONE") {
            return <span className="text-muted">—</span>;
          }
          const label =
            status === "HELD"
              ? t("pages.employees.depositStatusHeld")
              : status === "RETURNED"
                ? t("pages.employees.depositStatusReturned")
                : t("pages.employees.depositStatusKept");
          return (
            <div>
              <p className="font-medium text-text">{label}</p>
              {employee.depositHeldAmount ? (
                <p className="text-xs text-muted">
                  {formatContractPrice(employee.depositHeldAmount)}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "portal",
        title: t("pages.employees.columns.portalLogin"),
        render: (employee) => {
          const portalStatus = getEmployeePortalLoginStatus(employee);
          const badgeStatus =
            portalStatus === "yes"
              ? "active"
              : portalStatus === "revoked"
                ? "revoked"
                : "inactive";
          const label =
            portalStatus === "yes"
              ? t("pages.employees.portalStatus.yes")
              : portalStatus === "revoked"
                ? t("pages.employees.portalStatus.revoked")
                : t("pages.employees.portalStatus.no");
          return (
            <StatusBadge status={badgeStatus} compact>
              {label}
            </StatusBadge>
          );
        },
      }
    );

    if (canManage) {
      cols.push({
        key: "actions",
        title: t("pages.employees.columns.actions"),
        width: isTrash
          ? TRASH_ACTIONS_COLUMN_WIDTH
          : ACTIONS_SINGLE_CHIP_COLUMN_WIDTH,
        align: "center",
        className: isTrash
          ? "min-w-[22rem] overflow-visible whitespace-nowrap max-xl:min-w-[20rem] max-xl:px-2"
          : "min-w-[18rem] overflow-visible whitespace-nowrap max-xl:min-w-[16rem] max-xl:px-2",
        render: (employee) => (
          <div className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap">
            {isTrash ? (
              <>
                <TrashRestoreChip
                  onClick={(event) => {
                    event.stopPropagation();
                    setRestoring(employee);
                  }}
                />
                {canArchive ? (
                  <TrashPermanentDeleteChip
                    onClick={(event) => {
                      event.stopPropagation();
                      setArchiving(employee);
                    }}
                  />
                ) : null}
              </>
            ) : (
              <>
                {canResign &&
                employee.status !== "RESIGNED" &&
                employee.resignAccordingToProcedure == null ? (
                  <Button
                    size="badge"
                    variant="warningBadge"
                    onClick={(event) => {
                      event.stopPropagation();
                      setResigning(employee);
                    }}
                  >
                    {t("pages.employees.resign")}
                  </Button>
                ) : null}
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
              </>
            )}
          </div>
        ),
      });
    }

    return cols;
  }, [
    showSelection,
    allVisibleSelected,
    someVisibleSelected,
    onToggleSelectAll,
    selectableIds,
    selectedIds,
    onToggleSelect,
    canManage,
    canResign,
    canArchive,
    isTrash,
    t,
    locale,
  ]);

  return (
    <>
      <DataTable
        columns={columns}
        data={employees}
        getRowKey={(employee) => employee.id}
        onRowClick={canManage && !isTrash ? openEdit : undefined}
        reorderable={canManage && !isTrash}
        onReorder={reorder}
        isRowSelected={(employee) => selectedIds?.has(employee.id) ?? false}
        emptyMessage={t("pages.employees.emptyActiveListDesc")}
      />
      {editing ? (
        <EmployeeEditDialog
          employee={editing}
          categories={categories}
          positions={positions}
          projects={projects}
          showDelete
          canResign={canResign}
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
      {resigning ? (
        <EmployeeResignDialog
          employee={resigning}
          open
          onOpenChange={(open) => !open && setResigning(null)}
          onResigned={() => router.refresh()}
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
