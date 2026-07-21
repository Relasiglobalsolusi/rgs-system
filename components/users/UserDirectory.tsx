"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  Building2,
  KeyRound,
  Shield,
  Truck,
  UserRound,
  Users,
} from "lucide-react";

import UserTable from "@/components/users/UserTable";
import UserDialog from "@/components/users/UserDialog";
import WithoutPortalLoginView, {
  type ClientWithoutPortalLogin,
  type EmployeeWithoutPortalLogin,
} from "@/components/users/WithoutPortalLoginView";
import { getAccountType, type AccountType } from "@/lib/permissions";
import {
  isPermanentlyRemovedLinkedUser,
  isRevokedAccessUser,
  isSoftDeletedUser,
} from "@/lib/user-directory-status";
import UserBulkDeactivateDialog from "@/components/users/UserBulkDeactivateDialog";
import UserBulkPermanentlyRemovePortalLoginDialog from "@/components/users/UserBulkPermanentlyRemovePortalLoginDialog";
import UserBulkRevokeAccessDialog from "@/components/users/UserBulkRevokeAccessDialog";
import UserBulkReactivateDialog from "@/components/users/UserBulkReactivateDialog";
import UserBulkDeleteDialog from "@/components/users/UserBulkDeleteDialog";
import BulkActionBar from "@/components/ui/BulkActionBar";
import { permanentDeleteLabelClassName } from "@/components/ui/trash-action-buttons";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
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
  moduleOverrides: Record<string, boolean> | null;
  employee: {
    id?: string;
    employeeNo: string;
    employeeType: EmployeeType;
    employmentType: EmploymentType;
    placement: Placement;
    jobPosition?: { id: string; name: string } | null;
    firstName: string;
    lastName: string;
    status: string;
    archivedFromDirectory?: boolean;
    category?: { name: string; prefix: string } | null;
  } | null;
  client: { id: string; name: string; active?: boolean } | null;
  vendor: { id: string; name: string; active?: boolean } | null;
};

type DirectoryView = "active" | "revoked" | "trash";
type StatView =
  | "active"
  | "revoked"
  | "noPortalLogin"
  | "deletedClient"
  | "deletedVendor"
  | "deletedEmployee";
type TypeFilterTab = "all" | Lowercase<AccountType>;
type BulkDialogMode =
  | "deactivate"
  | "revoke"
  | "removePortalLogin"
  | "reactivate"
  | "delete";

type Props = {
  users: UserRow[];
  clientsWithoutPortalLogin?: ClientWithoutPortalLogin[];
  employeesWithoutPortalLogin?: EmployeeWithoutPortalLogin[];
  canEditPermissions?: boolean;
  canViewPassword?: boolean;
  canManageClients?: boolean;
  canManageEmployees?: boolean;
  currentUserId?: string;
};

export default function UserDirectory({
  users,
  clientsWithoutPortalLogin = [],
  employeesWithoutPortalLogin = [],
  canEditPermissions = false,
  canViewPassword = false,
  canManageClients = false,
  canManageEmployees = false,
  currentUserId,
}: Props) {
  const { t } = useT();
  const typeTabs: {
    id: TypeFilterTab;
    label: string;
    icon?: typeof Users;
  }[] = [
    { id: "all", label: t("common.actions.all") },
    { id: "admin", label: t("common.roles.admin"), icon: Shield },
    { id: "client", label: t("common.roles.client"), icon: Users },
    { id: "vendor", label: t("common.roles.vendor"), icon: Truck },
    { id: "employee", label: t("common.roles.employee"), icon: UserRound },
  ];
  const [statView, setStatView] = useState<StatView>("active");
  const [typeFilter, setTypeFilter] = useState<TypeFilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkDialogMode, setBulkDialogMode] =
    useState<BulkDialogMode>("deactivate");

  const {
    enabledUsers,
    revokedUsers,
    deletedClientUsers,
    deletedVendorUsers,
    deletedEmployeeUsers,
  } = useMemo(() => {
    // Active = enabled logins only.
    // Revoked Access = inactive linked login, parent still active (credentials kept).
    // Soft-deleted parent always wins: Deleted* before Revoked (never both).
    // No Portal Login = separate list (no User row) — never overlaps revoked.
    // Deleted* cards = soft-deleted portal/login buckets by account type.
    const enabled: UserRow[] = [];
    const revoked: UserRow[] = [];
    const deletedClient: UserRow[] = [];
    const deletedVendor: UserRow[] = [];
    const deletedEmployee: UserRow[] = [];

    for (const user of users) {
      // Forever-deleted employee tombstones should not appear in any Users tab.
      // Incomplete archive leftovers are repaired separately; hide until then.
      if (isPermanentlyRemovedLinkedUser(user)) {
        continue;
      }

      // Soft-delete wins over revoke when parent is off roster / client inactive.
      if (isSoftDeletedUser(user)) {
        const accountType = getAccountType(user);
        if (accountType === "Client") {
          deletedClient.push(user);
        } else if (accountType === "Vendor") {
          deletedVendor.push(user);
        } else if (accountType === "Employee") {
          deletedEmployee.push(user);
        }
        // Soft-deleted admins / orphans are not shown on the typed Deleted* cards.
        continue;
      }

      if (isRevokedAccessUser(user)) {
        revoked.push(user);
        continue;
      }

      if (user.active) {
        enabled.push(user);
      }
    }

    return {
      enabledUsers: enabled,
      revokedUsers: revoked,
      deletedClientUsers: deletedClient,
      deletedVendorUsers: deletedVendor,
      deletedEmployeeUsers: deletedEmployee,
    };
  }, [users]);

  const noPortalLoginCount =
    clientsWithoutPortalLogin.length + employeesWithoutPortalLogin.length;

  const directoryStats = useMemo(
    () => ({
      active: enabledUsers.length,
      revoked: revokedUsers.length,
      noPortalLogin: noPortalLoginCount,
      deletedClient: deletedClientUsers.length,
      deletedVendor: deletedVendorUsers.length,
      deletedEmployee: deletedEmployeeUsers.length,
    }),
    [
      enabledUsers.length,
      revokedUsers.length,
      noPortalLoginCount,
      deletedClientUsers.length,
      deletedVendorUsers.length,
      deletedEmployeeUsers.length,
    ]
  );

  const isNoPortalLoginView = statView === "noPortalLogin";

  const directoryView: DirectoryView =
    statView === "active"
      ? "active"
      : statView === "revoked"
        ? "revoked"
        : "trash";

  const tabUsers = useMemo(() => {
    if (statView === "active") return enabledUsers;
    if (statView === "revoked") return revokedUsers;
    if (statView === "deletedClient") return deletedClientUsers;
    if (statView === "deletedVendor") return deletedVendorUsers;
    if (statView === "deletedEmployee") return deletedEmployeeUsers;
    return enabledUsers;
  }, [
    statView,
    enabledUsers,
    revokedUsers,
    deletedClientUsers,
    deletedVendorUsers,
    deletedEmployeeUsers,
  ]);

  const typeCounts = useMemo(() => {
    const counts = {
      all: tabUsers.length,
      admin: 0,
      employee: 0,
      client: 0,
      vendor: 0,
    };

    for (const user of tabUsers) {
      const type = getAccountType(user).toLowerCase();
      if (
        type === "admin" ||
        type === "employee" ||
        type === "client" ||
        type === "vendor"
      ) {
        counts[type] += 1;
      }
    }

    return counts;
  }, [tabUsers]);

  // Search within the card first; type chips only show/hide type tables.
  const searchedUsers = useMemo(
    () =>
      tabUsers.filter((user) =>
        matchesDirectorySearch(
          searchQuery,
          user.name,
          user.username,
          user.email,
          user.employee
            ? `${user.employee.firstName} ${user.employee.lastName}`
            : null,
          user.employee?.employeeNo,
          user.client?.name,
          user.vendor?.name
        )
      ),
    [tabUsers, searchQuery]
  );

  // Preserve server order (sortOrder asc) within each account-type slice.
  const usersByType = useMemo(() => {
    const admins: UserRow[] = [];
    const clients: UserRow[] = [];
    const vendors: UserRow[] = [];
    const employees: UserRow[] = [];

    for (const user of searchedUsers) {
      const type = getAccountType(user);
      if (type === "Admin") {
        admins.push(user);
      } else if (type === "Client") {
        clients.push(user);
      } else if (type === "Vendor") {
        vendors.push(user);
      } else {
        employees.push(user);
      }
    }

    return { admins, clients, vendors, employees };
  }, [searchedUsers]);

  // Fixed order: Admin → Clients → Vendors → Employees (same on active / revoked / trash).
  const typeSections = useMemo(() => {
    const sections: {
      id: Exclude<TypeFilterTab, "all">;
      label: string;
      users: UserRow[];
    }[] = [
      {
        id: "admin",
        label: t("pages.users.sections.admin"),
        users: usersByType.admins,
      },
      {
        id: "client",
        label: t("pages.users.sections.clients"),
        users: usersByType.clients,
      },
      {
        id: "vendor",
        label: t("pages.users.sections.vendors"),
        users: usersByType.vendors,
      },
      {
        id: "employee",
        label: t("pages.users.sections.employees"),
        users: usersByType.employees,
      },
    ];

    const hasActiveSearch = searchQuery.trim() !== "";

    return sections.filter((section) => {
      if (typeFilter !== "all" && section.id !== typeFilter) return false;
      if (section.users.length > 0) return true;
      // Keep Vendors visible (even empty) so it is never folded into Clients.
      if (section.id === "vendor" && typeFilter === "all" && !hasActiveSearch) {
        return true;
      }
      // Type chip selected with zero rows — still show that section empty.
      return typeFilter === section.id;
    });
  }, [usersByType, typeFilter, searchQuery, t]);

  const visibleUsers = useMemo(
    () => typeSections.flatMap((section) => section.users),
    [typeSections]
  );

  const showSelection = canEditPermissions;
  const showAdd = canEditPermissions && directoryView === "active";
  const isActiveDirectory = directoryView === "active";
  const bulkActionLabel = isActiveDirectory ? (
    <span className={permanentDeleteLabelClassName}>
      <span>{t("pages.users.revoke1")}</span>
      <span>{t("pages.users.revoke2")}</span>
    </span>
  ) : (
    t("pages.users.restoreSelected")
  );

  const selectableIds = useMemo(() => {
    if (!showSelection) {
      return new Set<string>();
    }

    return new Set(
      visibleUsers
        .filter((user) => {
          if (directoryView === "active") {
            // Bulk delete soft-deactivates enabled accounts only.
            return user.active && user.id !== currentUserId;
          }
          if (directoryView === "revoked") {
            return isRevokedAccessUser(user);
          }
          return isSoftDeletedUser(user);
        })
        .map((user) => user.id)
    );
  }, [visibleUsers, showSelection, directoryView, currentUserId]);

  const selectedVisibleCount = useMemo(
    () => [...selectedIds].filter((id) => selectableIds.has(id)).length,
    [selectedIds, selectableIds]
  );

  function toggleSelect(id: string) {
    if (!selectableIds.has(id)) {
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllIn(ids: Set<string>) {
    const allSelected =
      ids.size > 0 && [...ids].every((id) => selectedIds.has(id));

    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) {
        for (const id of ids) {
          next.delete(id);
        }
      } else {
        for (const id of ids) {
          next.add(id);
        }
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    clearSelection();
  }

  function selectStat(next: StatView) {
    setStatView(next);
    setTypeFilter("all");
    clearSelection();
  }

  const selectedIdsForAction = useMemo(
    () => [...selectedIds].filter((id) => selectableIds.has(id)),
    [selectedIds, selectableIds]
  );

  const selectedUsersForAction = useMemo(
    () =>
      visibleUsers.filter((user) => selectedIdsForAction.includes(user.id)),
    [visibleUsers, selectedIdsForAction]
  );

  const trimmedSearch = searchQuery.trim();
  const hasActiveSearch = trimmedSearch !== "";

  const emptyTitle = hasActiveSearch
    ? t("pages.users.emptySearch", { query: trimmedSearch })
    : typeFilter !== "all"
      ? t("pages.users.emptyType", {
          type:
            typeTabs.find((tab) => tab.id === typeFilter)?.label.toLowerCase() ??
            typeFilter,
        })
      : statView === "active"
        ? t("pages.users.emptyActiveList")
        : statView === "revoked"
          ? t("pages.users.emptyRevoked")
          : statView === "deletedClient"
            ? t("pages.users.emptyDeletedClient")
            : statView === "deletedVendor"
              ? t("pages.users.emptyDeletedVendor")
              : statView === "deletedEmployee"
                ? t("pages.users.emptyDeletedEmployee")
                : t("pages.users.emptyDeletedList");

  const emptyDescription = hasActiveSearch
    ? t("pages.users.emptySearchDesc")
    : typeFilter !== "all"
      ? t("pages.users.emptyTypeDesc")
      : statView === "active"
        ? t("pages.users.emptyActiveListDesc")
        : statView === "revoked"
          ? t("pages.users.emptyRevokedDesc")
          : statView === "deletedClient"
            ? t("pages.users.emptyDeletedClientDesc")
            : statView === "deletedVendor"
              ? t("pages.users.emptyDeletedVendorDesc")
              : statView === "deletedEmployee"
                ? t("pages.users.emptyDeletedEmployeeDesc")
                : t("pages.users.emptyTrash");

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <DirectoryStatCard
          compact
          title={t("pages.users.active")}
          value={directoryStats.active}
          subtitle={t("pages.users.activeSubtitle")}
          icon={<Users size={15} />}
          accent="success"
          selected={statView === "active"}
          onClick={() => selectStat("active")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.users.noPortalLogin")}
          value={directoryStats.noPortalLogin}
          subtitle={t("pages.users.noPortalLoginSubtitle")}
          icon={<KeyRound size={15} />}
          accent="primary"
          selected={statView === "noPortalLogin"}
          onClick={() => selectStat("noPortalLogin")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.users.revokedAccess")}
          value={directoryStats.revoked}
          subtitle={t("pages.users.revokedAccessSubtitle")}
          icon={<Ban size={15} />}
          accent="danger"
          selected={statView === "revoked"}
          onClick={() => selectStat("revoked")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.users.deletedClient")}
          value={directoryStats.deletedClient}
          subtitle={t("pages.users.deletedClientSubtitle")}
          icon={<Building2 size={15} />}
          accent="warning"
          selected={statView === "deletedClient"}
          onClick={() => selectStat("deletedClient")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.users.deletedVendor")}
          value={directoryStats.deletedVendor}
          subtitle={t("pages.users.deletedVendorSubtitle")}
          icon={<Truck size={15} />}
          accent="danger"
          selected={statView === "deletedVendor"}
          onClick={() => selectStat("deletedVendor")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.users.deletedEmployee")}
          value={directoryStats.deletedEmployee}
          subtitle={t("pages.users.deletedEmployeeSubtitle")}
          icon={<UserRound size={15} />}
          accent="info"
          selected={statView === "deletedEmployee"}
          onClick={() => selectStat("deletedEmployee")}
        />
      </div>

      {isNoPortalLoginView ? (
        <WithoutPortalLoginView
          clients={clientsWithoutPortalLogin}
          employees={employeesWithoutPortalLogin}
          canManageClients={canManageClients}
          canManageEmployees={canManageEmployees}
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {typeTabs
              .filter(
                (tab) =>
                  tab.id === "all" ||
                  tab.id === "vendor" ||
                  typeCounts[tab.id] > 0
              )
              .map((tab) => {
                const Icon = tab.icon;

                return (
                  <DirectoryFilterTab
                    key={tab.id}
                    active={typeFilter === tab.id}
                    onClick={() => {
                      setTypeFilter(tab.id);
                      clearSelection();
                    }}
                    count={typeCounts[tab.id]}
                  >
                    {Icon ? <Icon size={16} /> : null}
                    {tab.label}
                  </DirectoryFilterTab>
                );
              })}

            {showAdd ? (
              <div className="ml-auto flex items-center gap-2">
                <DirectoryAddButton
                  label={t("pages.users.addUser")}
                  onClick={() => setCreateOpen(true)}
                />
              </div>
            ) : null}
          </div>

          <div className="mb-4">
            <DirectorySearchInput
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={t("pages.users.searchPlaceholder")}
            />
          </div>

          {showSelection && (
            <BulkActionBar
              selectedCount={selectedVisibleCount}
              actionLabel={bulkActionLabel}
              actionVariant={isActiveDirectory ? "destructive" : "success"}
              onClear={clearSelection}
              onAction={() => {
                setBulkDialogMode(
                  isActiveDirectory ? "revoke" : "reactivate"
                );
                setBulkDialogOpen(true);
              }}
              middleActionLabel={
                isActiveDirectory ? (
                  <span className={permanentDeleteLabelClassName}>
                    <span>{t("pages.users.permanentlyRemoveLogin1")}</span>
                    <span>{t("pages.users.permanentlyRemoveLogin2")}</span>
                  </span>
                ) : undefined
              }
              onMiddleAction={
                isActiveDirectory
                  ? () => {
                      setBulkDialogMode("removePortalLogin");
                      setBulkDialogOpen(true);
                    }
                  : undefined
              }
              middleActionVariant="destructive"
              secondaryActionLabel={
                isActiveDirectory
                  ? t("common.actions.deleteSelected")
                  : directoryView === "trash"
                    ? t("common.actions.permanentlyDelete")
                    : undefined
              }
              onSecondaryAction={
                isActiveDirectory
                  ? () => {
                      setBulkDialogMode("deactivate");
                      setBulkDialogOpen(true);
                    }
                  : directoryView === "trash"
                    ? () => {
                        setBulkDialogMode("delete");
                        setBulkDialogOpen(true);
                      }
                    : undefined
              }
              secondaryActionVariant="destructive"
            />
          )}

          {typeSections.length === 0 ? (
            <SectionCard>
              <EmptyState title={emptyTitle} description={emptyDescription} />
            </SectionCard>
          ) : (
            <div className="space-y-6">
              {typeSections.map((section) => {
                const sectionSelectableIds = new Set(
                  section.users
                    .map((user) => user.id)
                    .filter((id) => selectableIds.has(id))
                );
                const sectionSelectedCount = [
                  ...sectionSelectableIds,
                ].filter((id) => selectedIds.has(id)).length;
                const allSectionSelected =
                  sectionSelectableIds.size > 0 &&
                  sectionSelectedCount === sectionSelectableIds.size;
                const someSectionSelected = sectionSelectedCount > 0;

                return (
                  <section key={`${statView}-${section.id}`}>
                    <div className="mb-3">
                      <h3 className="text-base font-semibold text-text">
                        {section.label}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted">
                        {section.users.length}{" "}
                        {section.users.length === 1
                          ? t("pages.users.accountOne")
                          : t("pages.users.accountOther")}
                      </p>
                    </div>

                    {section.users.length === 0 ? (
                      <SectionCard>
                        <EmptyState
                          title={
                            section.id === "vendor"
                              ? t("pages.users.emptyVendors")
                              : emptyTitle
                          }
                          description={
                            section.id === "vendor"
                              ? t("pages.users.emptyVendorsDesc")
                              : emptyDescription
                          }
                        />
                      </SectionCard>
                    ) : (
                      <UserTable
                        users={section.users}
                        canEditPermissions={canEditPermissions}
                        canViewPassword={canViewPassword}
                        currentUserId={currentUserId}
                        directoryView={directoryView}
                        showSelection={showSelection}
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect}
                        onToggleSelectAll={() =>
                          toggleSelectAllIn(sectionSelectableIds)
                        }
                        allVisibleSelected={allSectionSelected}
                        someVisibleSelected={someSectionSelected}
                        selectableIds={sectionSelectableIds}
                      />
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {showAdd ? (
        <UserDialog
          mode="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          showTrigger={false}
        />
      ) : null}

      {showSelection && bulkDialogMode === "deactivate" && (
        <UserBulkDeactivateDialog
          open={bulkDialogOpen}
          onOpenChange={(open) => {
            setBulkDialogOpen(open);
            if (!open) {
              clearSelection();
            }
          }}
          selectedCount={selectedIdsForAction.length}
          selectedIds={selectedIdsForAction}
        />
      )}

      {showSelection && bulkDialogMode === "revoke" && (
        <UserBulkRevokeAccessDialog
          open={bulkDialogOpen}
          onOpenChange={(open) => {
            setBulkDialogOpen(open);
            if (!open) {
              clearSelection();
            }
          }}
          selectedCount={selectedIdsForAction.length}
          selectedIds={selectedIdsForAction}
        />
      )}

      {showSelection && bulkDialogMode === "removePortalLogin" && (
        <UserBulkPermanentlyRemovePortalLoginDialog
          open={bulkDialogOpen}
          onOpenChange={(open) => {
            setBulkDialogOpen(open);
            if (!open) {
              clearSelection();
            }
          }}
          selectedCount={selectedIdsForAction.length}
          selectedIds={selectedIdsForAction}
        />
      )}

      {showSelection && bulkDialogMode === "reactivate" && (
        <UserBulkReactivateDialog
          open={bulkDialogOpen}
          onOpenChange={(open) => {
            setBulkDialogOpen(open);
            if (!open) {
              clearSelection();
            }
          }}
          selectedCount={selectedIdsForAction.length}
          selectedIds={selectedIdsForAction}
          mode={directoryView === "revoked" ? "access" : "deleted"}
        />
      )}

      {showSelection && bulkDialogMode === "delete" && (
        <UserBulkDeleteDialog
          open={bulkDialogOpen}
          onOpenChange={(open) => {
            setBulkDialogOpen(open);
            if (!open) {
              clearSelection();
            }
          }}
          selectedUsers={selectedUsersForAction.map((user) => ({
            id: user.id,
            name: user.name,
            username: user.username,
          }))}
        />
      )}
    </>
  );
}
