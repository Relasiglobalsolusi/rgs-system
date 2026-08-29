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
} from "@/components/ui/trash-action-buttons";
import { Button } from "@/components/ui/button";
import {
  formatEmploymentTypeLabel,
  formatPlacementLabel,
} from "@/lib/placement";
import { localizeDepartmentLabel, localizeJobTitle } from "@/lib/i18n/labels";
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
  amountOwedToCompany?: number | null;
  depositStatus?: "NONE" | "HELD" | "RETURNED" | "KEPT_BY_COMPANY";
  securityDepositRequired?: boolean;
  lastWorkingDay?: Date | string | null;
  resignAccordingToProcedure?: boolean | null;
  hasPendingLeaveRequest?: boolean;
  hiredAt: Date | string | null;
  omApprovalAreas?: ServiceArea[];
  manageAllProjects?: boolean;
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
type EmployeePortalLoginStatus = "yes" | "revoked" | "no";

function getEmployeePortalLoginStatus(
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
        cellAlign: "center",
        width: "6rem",
        className: "min-w-[6rem]",
        render: (employee) => {
          const leaveChipClassName = "min-w-0 w-fit px-1.5 [&>span]:w-auto";
          if (employee.status === "RESIGNED") {
            return (
              <div className="flex justify-center">
                <StatusBadge
                  status="danger"
                  compact
                  className={leaveChipClassName}
                >
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
                  className={leaveChipClassName}
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
                  className={leaveChipClassName}
                  lines={[
                    t("pages.employees.leavePendingChipLine1"),
                    t("pages.employees.leavePendingChipLine2"),
                  ]}
                />
              </div>
            );
          }
          if (
            employee.status === "INACTIVE" ||
            employee.status === "TERMINATED"
          ) {
            return (
              <div className="flex justify-center">
                <StatusBadge
                  status="inactive"
                  compact
                  className={leaveChipClassName}
                >
                  {t("common.labels.inactive")}
                </StatusBadge>
              </div>
            );
          }
          return (
            <div className="flex justify-center">
              <StatusBadge
                status="active"
                compact
                className={leaveChipClassName}
              >
                {t("pages.employees.active")}
              </StatusBadge>
            </div>
          );
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
          <span className="text-muted">
            {localizeJobTitle(employee.position, locale) || "—"}
          </span>
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
        width: "9.5rem",
        className: "min-w-[9.5rem]",
        cellAlign: "center",
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
        width: "9.5rem",
        className: "min-w-[9.5rem]",
        render: (employee) => {
          const status = employee.depositStatus ?? "NONE";
          if (status === "NONE") {
            return (
              <span className="text-muted">
                {employee.securityDepositRequired
                  ? t("pages.employees.depositStatusNotHeld")
                  : t("pages.employees.depositStatusNotRequired")}
              </span>
            );
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
        width: "8rem",
        className: "min-w-[8rem]",
        cellAlign: "center",
        render: (employee) => {
          const portalStatus = getEmployeePortalLoginStatus(employee);
          const badgeStatus =
            portalStatus === "yes"
              ? "active"
              : portalStatus === "revoked"
                ? "revoked"
                : "danger";
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
        width: ACTIONS_SINGLE_CHIP_COLUMN_WIDTH,
        cellAlign: "center",
        className: "overflow-visible max-xl:px-2",
        render: (employee) => (
          <div className="flex flex-col items-center justify-center gap-2">
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
