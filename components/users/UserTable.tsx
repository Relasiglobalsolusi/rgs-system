"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { reorderUsers } from "@/app/users/actions";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { createSelectionColumn } from "@/components/ui/data-table-selection";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  ACTIONS_SINGLE_CHIP_COLUMN_WIDTH,
  permanentDeleteLabelClassName,
  permissionsChipTextClassName,
  STATUS_COLUMN_WIDTH,
  TrashPermanentDeleteChip,
  TrashRestoreAccessChip,
  TrashRestoreChip,
  trashActionChipClassName,
} from "@/components/ui/trash-action-buttons";
import { Button } from "@/components/ui/button";
import {
  getAccessibleModules,
  getAccountType,
  getAccountTypeBadgeStatus,
  getVisibleModules,
} from "@/lib/permissions";
import { canRestorePortalAccess } from "@/lib/user-directory-status";
import AdminPasswordDisplay from "@/components/users/AdminPasswordDisplay";
import UserPermissionsDialog from "@/components/users/UserPermissionsDialog";
import UserDeleteDialog from "@/components/users/UserDeleteDialog";
import UserDialog from "@/components/users/UserDialog";
import UserRestoreDialog from "@/components/users/UserRestoreDialog";
import UserRevokeLoginAccessDialog from "@/components/users/UserRevokeLoginAccessDialog";
import UserSoftDeleteDialog from "@/components/users/UserSoftDeleteDialog";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";

import type {
  EmployeeType,
  EmploymentType,
  Placement,
  UserRole,
} from "@prisma/client";

type UserRow = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: UserRole;
  active: boolean;
  passwordDisplay?: string | null;
  recoverableStoredAtRest?: boolean;
  decryptFailed?: boolean;
  mustSetPassword?: boolean;
  passwordSetupCompletedAt?: Date | string | null;
  moduleOverrides: Record<string, boolean> | null;
  employee: {
    id?: string;
    employeeNo: string;
    employeeType: EmployeeType;
    employmentType: EmploymentType;
    placement: Placement;
    jobPosition?: {
      id: string;
      name: string;
      slug?: string | null;
      defaultModuleAccess?: unknown;
    } | null;
    firstName: string;
    lastName: string;
    status: string;
    archivedFromDirectory?: boolean;
    category?: { name: string; prefix: string } | null;
  } | null;
  client: { id: string; name: string; active?: boolean } | null;
  vendor?: { id: string; name: string; active?: boolean } | null;
};

function getLinkedRecordLabel(user: UserRow): string | null {
  if (user.employee?.employeeNo && user.employee.category) {
    return user.employee.employeeNo;
  }
  if (user.client?.name) return user.client.name;
  if (user.vendor?.name) return user.vendor.name;
  return null;
}

function formatRevokeLinkedLabel(
  user: UserRow,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (user.employee) {
    const name = `${user.employee.firstName} ${user.employee.lastName}`.trim();
    return t("pages.users.linkedEmployee", {
      label: `${user.employee.employeeNo} — ${name}`,
    });
  }
  if (user.client) {
    return t("pages.users.linkedClient", { name: user.client.name });
  }
  if (user.vendor) {
    return t("pages.users.linkedVendor", { name: user.vendor.name });
  }
  return t("pages.users.linkedAccount");
}

type Props = {
  users: UserRow[];
  canEditPermissions?: boolean;
  canViewPassword?: boolean;
  currentUserId?: string;
  directoryView?: "active" | "revoked" | "trash";
  showSelection?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  allVisibleSelected?: boolean;
  someVisibleSelected?: boolean;
  selectableIds?: Set<string>;
};

function getEnabledModuleCount(user: UserRow): number {
  const permissionUser = {
    role: user.role,
    employeeType: user.employee?.employeeType ?? null,
    moduleOverrides: user.moduleOverrides,
    clientId: user.client?.id ?? null,
    vendorId: user.vendor?.id ?? null,
    username: user.username,
    client: user.client,
    vendor: user.vendor,
    employee: user.employee,
  };

  const visibleModules = getVisibleModules();

  return getAccessibleModules(permissionUser).filter((module) =>
    visibleModules.includes(module)
  ).length;
}

function buildPasswordSetupContext(row: UserRow) {
  return {
    mustSetPassword: row.mustSetPassword,
    email: row.email,
    passwordSetupCompletedAt: row.passwordSetupCompletedAt,
    isLinkedPortalLogin: Boolean(row.client || row.vendor || row.employee),
  };
}

function buildEditUser(row: UserRow, canViewPassword: boolean) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    active: row.active,
    passwordDisplay: canViewPassword
      ? (row.passwordDisplay ?? null)
      : undefined,
    recoverableStoredAtRest: canViewPassword
      ? row.recoverableStoredAtRest
      : undefined,
    decryptFailed: canViewPassword ? row.decryptFailed : undefined,
    mustSetPassword: canViewPassword ? row.mustSetPassword : undefined,
    passwordSetupCompletedAt: canViewPassword
      ? (row.passwordSetupCompletedAt ?? null)
      : undefined,
    employee: row.employee?.id
      ? {
          id: row.employee.id,
          employeeNo: row.employee.employeeNo,
          firstName: row.employee.firstName,
          lastName: row.employee.lastName,
          category: row.employee.category ?? null,
        }
      : null,
    client: row.client,
    vendor: row.vendor ?? null,
  };
}

function accountTypeRoleKey(
  accountType: ReturnType<typeof getAccountType>
): "admin" | "client" | "employee" | "vendor" {
  if (accountType === "Client") return "client";
  if (accountType === "Vendor") return "vendor";
  if (accountType === "Employee") return "employee";
  return "admin";
}

function UserRowActions({
  row,
  directoryView,
  isCurrentUser,
}: {
  row: UserRow;
  directoryView: "active" | "revoked" | "trash";
  isCurrentUser: boolean;
}) {
  const { t } = useT();
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [softDeleteOpen, setSoftDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteForeverOpen, setDeleteForeverOpen] = useState(false);

  const showSoftDelete = directoryView === "active" && row.active;
  const showRevoke =
    directoryView === "active" &&
    row.active &&
    Boolean(row.employee || row.client || row.vendor);
  const showRestoreAccess =
    directoryView === "revoked" && canRestorePortalAccess(row);
  const showTrashActions = directoryView === "trash";

  return (
    <>
      <div className="flex flex-col items-stretch justify-center gap-2">
        <Button
          type="button"
          size="badge"
          variant="permissionsBadge"
          className={permissionsChipTextClassName}
          onClick={(event) => {
            event.stopPropagation();
            setPermissionsOpen(true);
          }}
        >
          {t("pages.users.permissions")}
        </Button>

        {showRevoke ? (
          <Button
            type="button"
            size="badge"
            variant="revokeBadge"
            disabled={isCurrentUser}
            title={
              isCurrentUser ? t("pages.users.cannotRevokeOwn") : undefined
            }
            className={cn(trashActionChipClassName, "whitespace-normal")}
            onClick={(event) => {
              event.stopPropagation();
              if (!isCurrentUser) setRevokeOpen(true);
            }}
          >
            <span className={permanentDeleteLabelClassName}>
              <span>{t("pages.users.revoke1")}</span>
              <span>{t("pages.users.revoke2")}</span>
            </span>
          </Button>
        ) : null}

        {showSoftDelete ? (
          <Button
            type="button"
            size="badge"
            variant="destructiveBadge"
            disabled={isCurrentUser}
            title={
              isCurrentUser ? t("pages.users.cannotDeleteOwn") : undefined
            }
            onClick={(event) => {
              event.stopPropagation();
              if (!isCurrentUser) setSoftDeleteOpen(true);
            }}
          >
            {t("common.actions.delete")}
          </Button>
        ) : null}

        {showRestoreAccess ? (
          <TrashRestoreAccessChip
            onClick={(event) => {
              event.stopPropagation();
              setRestoreOpen(true);
            }}
          />
        ) : null}

        {showTrashActions ? (
          <>
            <TrashRestoreChip
              onClick={(event) => {
                event.stopPropagation();
                setRestoreOpen(true);
              }}
            />

            {!isCurrentUser ? (
              <TrashPermanentDeleteChip
                onClick={(event) => {
                  event.stopPropagation();
                  setDeleteForeverOpen(true);
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>

      <UserPermissionsDialog
        user={row}
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        showTrigger={false}
      />

      {showRevoke ? (
        <UserRevokeLoginAccessDialog
          user={{
            id: row.id,
            name: row.name,
            username: row.username,
          }}
          linkedLabel={formatRevokeLinkedLabel(row, t)}
          disabled={isCurrentUser}
          disabledReason={
            isCurrentUser ? t("pages.users.cannotRevokeOwn") : undefined
          }
          open={revokeOpen}
          onOpenChange={setRevokeOpen}
        />
      ) : null}

      {showSoftDelete ? (
        <UserSoftDeleteDialog
          user={{
            id: row.id,
            name: row.name,
            username: row.username,
          }}
          disabled={isCurrentUser}
          disabledReason={
            isCurrentUser ? t("pages.users.cannotDeleteOwn") : undefined
          }
          open={softDeleteOpen}
          onOpenChange={setSoftDeleteOpen}
          showTrigger={false}
        />
      ) : null}

      {showRestoreAccess || showTrashActions ? (
        <UserRestoreDialog
          user={{
            id: row.id,
            name: row.name,
            username: row.username,
          }}
          mode={showRestoreAccess ? "access" : "deleted"}
          open={restoreOpen}
          onOpenChange={setRestoreOpen}
          showTrigger={false}
        />
      ) : null}

      {showTrashActions && !isCurrentUser ? (
        <UserDeleteDialog
          user={{
            id: row.id,
            name: row.name,
            username: row.username,
          }}
          linkedEmployee={row.employee}
          open={deleteForeverOpen}
          onOpenChange={setDeleteForeverOpen}
          showTrigger={false}
        />
      ) : null}
    </>
  );
}

export default function UserTable({
  users,
  canEditPermissions = false,
  canViewPassword = false,
  currentUserId,
  directoryView = "active",
  showSelection = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allVisibleSelected = false,
  someVisibleSelected = false,
  selectableIds,
}: Props) {
  const router = useRouter();
  const { t } = useT();
  const [, startTransition] = useTransition();
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const visibleModuleCount = getVisibleModules().length;

  const editUser = useMemo(() => {
    if (!editUserId) return null;
    const row = users.find((user) => user.id === editUserId);
    if (!row) return null;
    return buildEditUser(row, canViewPassword);
  }, [editUserId, users, canViewPassword]);

  function handleReorder(orderedIds: string[]) {
    if (!canEditPermissions) return;
    startTransition(async () => {
      try {
        await reorderUsers(orderedIds);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("pages.users.errors.reorderFailed")
        );
        router.refresh();
      }
    });
  }

  const columns = useMemo(() => {
    const cols: DataTableColumn<UserRow>[] = [];

    if (showSelection) {
      cols.push(
        createSelectionColumn<UserRow>({
          ariaLabelAll: t("pages.users.selectAllUsers"),
          getRowAriaLabel: (row) =>
            t("pages.users.selectUserRow", { name: row.name }),
          getRowId: (row) => row.id,
          allVisibleSelected,
          someVisibleSelected,
          onToggleSelectAll,
          onToggleSelect,
          selectedIds,
          selectableIds,
          selectAllDisabled: (selectableIds?.size ?? 0) === 0,
        })
      );
    }

    cols.push(
      {
        key: "name",
        title: t("pages.users.columns.user"),
        width: "11rem",
        share: 1.15,
        className: "min-w-[11rem]",
        render: (row) => {
          const isCurrentUser = row.id === currentUserId;
          return (
            <div className="min-w-0">
              <p className="font-semibold text-text">
                {row.name}
                {isCurrentUser ? (
                  <span className="ml-2 text-xs font-normal text-primary">
                    {t("pages.users.form.you")}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-sm text-subtle">
                {t("pages.users.usernameDisplay", { username: row.username })}
              </p>
            </div>
          );
        },
      },
      {
        key: "type",
        title: t("pages.users.columns.type"),
        width: STATUS_COLUMN_WIDTH,
        cellAlign: "center",
        className: "min-w-[10rem] overflow-visible whitespace-nowrap",
        render: (row) => {
          const accountType = getAccountType(row);
          return (
            <StatusBadge
              status={getAccountTypeBadgeStatus(accountType)}
              compact
            >
              {t(`common.roles.${accountTypeRoleKey(accountType)}`)}
            </StatusBadge>
          );
        },
      },
      {
        key: "linked",
        title: t("pages.users.columns.linked"),
        render: (row) => {
          const linkedLabel = getLinkedRecordLabel(row);
          const email = row.email?.trim() || null;

          if (!linkedLabel && !email) {
            return <span className="text-subtle">{t("common.labels.na")}</span>;
          }

          return (
            <div className="min-w-0">
              {linkedLabel ? (
                <p className="text-sm text-muted">{linkedLabel}</p>
              ) : null}
              {email ? (
                <p className="mt-0.5 max-w-[14rem] truncate text-sm text-subtle">
                  {email}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "modules",
        title: t("pages.users.columns.modules"),
        render: (row) => (
          <span className="text-sm text-subtle">
            {t("pages.users.moduleAccess", {
              enabled: getEnabledModuleCount(row),
              total: visibleModuleCount,
            })}
          </span>
        ),
      }
    );

    if (canViewPassword) {
      cols.push({
        key: "password",
        title: t("pages.users.columns.password"),
        width: "12rem",
        className: "min-w-[12rem] whitespace-nowrap",
        render: (row) => (
          <AdminPasswordDisplay
            password={row.passwordDisplay}
            recoverableStoredAtRest={row.recoverableStoredAtRest}
            decryptFailed={row.decryptFailed}
            setup={buildPasswordSetupContext(row)}
            compact
          />
        ),
      });
    }

    if (canEditPermissions) {
      // Active: Permissions+Revoke+Delete. Revoked: Permissions+Restore Access. Trash: Permissions+Restore+Delete.
      cols.push({
        key: "actions",
        title: t("pages.users.columns.actions"),
        width: ACTIONS_SINGLE_CHIP_COLUMN_WIDTH,
        cellAlign: "center",
        share: 0,
        className: "min-w-[12.5rem] overflow-visible",
        render: (row) => (
          <UserRowActions
            row={row}
            directoryView={directoryView}
            isCurrentUser={row.id === currentUserId}
          />
        ),
      });
    }

    return cols;
  }, [
    t,
    showSelection,
    allVisibleSelected,
    someVisibleSelected,
    selectableIds,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    currentUserId,
    canViewPassword,
    canEditPermissions,
    directoryView,
    visibleModuleCount,
  ]);

  if (users.length === 0) {
    return null;
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={users}
        getRowKey={(row) => row.id}
        onRowClick={
          canEditPermissions ? (row) => setEditUserId(row.id) : undefined
        }
        isRowSelected={(row) => selectedIds?.has(row.id) ?? false}
        reorderable={canEditPermissions}
        onReorder={canEditPermissions ? handleReorder : undefined}
        emptyMessage={t("pages.users.noUsersToShow")}
      />

      {canEditPermissions && editUser ? (
        <UserDialog
          key={editUser.id}
          user={editUser}
          canEditUsername={canEditPermissions}
          showDelete={directoryView === "active" && editUser.active}
          deleteDisabled={editUser.id === currentUserId}
          deleteDisabledReason={
            editUser.id === currentUserId
              ? t("pages.users.cannotDeleteOwn")
              : undefined
          }
          revokeDisabled={editUser.id === currentUserId}
          revokeDisabledReason={
            editUser.id === currentUserId
              ? t("pages.users.cannotRevokeOrRemoveOwn")
              : undefined
          }
          open
          onOpenChange={(open) => {
            if (!open) setEditUserId(null);
          }}
          showTrigger={false}
        />
      ) : null}
    </>
  );
}
