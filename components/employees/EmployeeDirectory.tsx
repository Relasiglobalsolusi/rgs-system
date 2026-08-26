"use client";

import { useMemo, useState } from "react";
import {
  ListPlus,
  Trash2,
  UserRound,
  Users,
  UserX,
} from "lucide-react";
import EmployeeBulkActionDialog from "@/components/employees/EmployeeBulkActionDialog";
import EmployeeBulkCreateDialog from "@/components/employees/EmployeeBulkCreateDialog";
import EmployeeBulkReactivateDialog from "@/components/employees/EmployeeBulkReactivateDialog";
import EmployeeDialog from "@/components/employees/EmployeeDialog";
import EmployeeTable, {
  type EmployeeDirectoryView,
} from "@/components/employees/EmployeeTable";
import EmployeeCategoryManageDialog from "@/components/employee-categories/EmployeeCategoryManageDialog";
import PositionManageDialog from "@/components/positions/PositionManageDialog";
import type { PositionRow } from "@/components/positions/PositionEditDialog";
import type { EmployeeCategoryRow } from "@/components/employee-categories/EmployeeCategoryEditDialog";
import type {
  EmployeeCategoryOption,
  PositionOption,
  ProjectOption,
} from "@/components/employees/EmployeeFormFields";
import BulkActionBar from "@/components/ui/BulkActionBar";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import type { EmployeeCreateActorTier } from "@/lib/employee-create-hierarchy";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { titleCaseWords } from "@/lib/text-case";
import { isRosterActiveEmployeeStatus } from "@/lib/user-directory-status";
import type { EmploymentType, Placement, ServiceArea } from "@prisma/client";

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
  category: { id: string; name: string; prefix: string; slug?: string } | null;
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

type BulkEmploymentScope = "FULL_TIME" | "PART_TIME";
type BulkDialogMode = "deactivate" | "reactivate" | "archive";
type UnassignedSegment = "FULL_TIME" | "PART_TIME";
type StatusSegment = "all" | "onLeave" | "leavePending";

type Props = {
  employees: Employee[];
  categories: EmployeeCategoryOption[];
  positions: PositionOption[];
  manageCategories?: EmployeeCategoryRow[];
  managePositions?: PositionRow[];
  projects: ProjectOption[];
  canManage?: boolean;
  canResign?: boolean;
  canArchive?: boolean;
  createActorTier?: EmployeeCreateActorTier;
};

export default function EmployeeDirectory({
  employees,
  categories,
  positions,
  manageCategories,
  managePositions,
  projects,
  canManage = false,
  canResign = false,
  canArchive = false,
  createActorTier = "OTHER",
}: Props) {
  const { t, locale } = useT();
  const [tab, setTab] = useState<EmployeeDirectoryView>("allEmployees");
  const [unassignedSegment, setUnassignedSegment] =
    useState<UnassignedSegment>("FULL_TIME");
  const [statusSegment, setStatusSegment] = useState<StatusSegment>("all");
  const [departmentFilter, setDepartmentFilter] = useState(ALL_DEPARTMENTS);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkEmploymentScope, setBulkEmploymentScope] =
    useState<BulkEmploymentScope>("FULL_TIME");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkDialogMode, setBulkDialogMode] =
    useState<BulkDialogMode>("deactivate");

  const allEmployees = useMemo(
    () =>
      employees.filter((employee) =>
        isRosterActiveEmployeeStatus(employee.status)
      ),
    [employees]
  );
  /** Assigned Full Time only — never AVAILABLE / Unassigned pool. */
  const fullTime = useMemo(
    () =>
      allEmployees.filter(
        (employee) =>
          employee.employmentType === "FULL_TIME" &&
          (employee.placement === "HEAD_OFFICE" ||
            employee.placement === "ON_PROJECT")
      ),
    [allEmployees]
  );
  /** Assigned Part Time only — never AVAILABLE / Unassigned pool. */
  const partTime = useMemo(
    () =>
      allEmployees.filter(
        (employee) =>
          employee.employmentType === "PART_TIME" &&
          (employee.placement === "HEAD_OFFICE" ||
            employee.placement === "ON_PROJECT")
      ),
    [allEmployees]
  );
  const unassigned = useMemo(
    () =>
      allEmployees.filter((employee) => employee.placement === "AVAILABLE"),
    [allEmployees]
  );
  const unassignedFullTime = useMemo(
    () =>
      unassigned.filter((employee) => employee.employmentType === "FULL_TIME"),
    [unassigned]
  );
  const unassignedPartTime = useMemo(
    () =>
      unassigned.filter((employee) => employee.employmentType === "PART_TIME"),
    [unassigned]
  );
  const trash = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.status === "INACTIVE" ||
          employee.status === "TERMINATED" ||
          employee.status === "RESIGNED"
      ),
    [employees]
  );

  const selected =
    tab === "allEmployees"
      ? allEmployees
      : tab === "fullTime"
        ? fullTime
        : tab === "partTime"
          ? partTime
          : tab === "unassigned"
            ? unassignedSegment === "FULL_TIME"
              ? unassignedFullTime
              : unassignedPartTime
            : trash;

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

  const departmentFiltered = useMemo(
    () =>
      departmentFilter === ALL_DEPARTMENTS
        ? selected
        : selected.filter((employee) => employee.categoryId === departmentFilter),
    [selected, departmentFilter]
  );

  const selectedDepartment = useMemo(
    () =>
      departmentOptions.find((category) => category.id === departmentFilter) ??
      null,
    [departmentOptions, departmentFilter]
  );

  const onLeaveInCard = useMemo(
    () =>
      tab === "trash"
        ? []
        : departmentFiltered.filter((employee) => employee.status === "ON_LEAVE"),
    [departmentFiltered, tab]
  );

  const leavePendingInCard = useMemo(
    () =>
      tab === "trash"
        ? []
        : departmentFiltered.filter((employee) => employee.hasPendingLeaveRequest),
    [departmentFiltered, tab]
  );

  const statusFiltered =
    tab !== "trash" && statusSegment === "onLeave"
      ? onLeaveInCard
      : tab !== "trash" && statusSegment === "leavePending"
        ? leavePendingInCard
        : departmentFiltered;

  const visible = useMemo(
    () =>
      statusFiltered.filter((employee) =>
        matchesDirectorySearch(
          query,
          `${employee.firstName} ${employee.lastName}`,
          employee.employeeNo,
          employee.position,
          employee.category?.name,
          employee.email,
          employee.phone,
          employee.user?.username,
          employee.operationsTeamMembership?.team.name
        )
      ),
    [statusFiltered, query]
  );

  const listShowSelection = canManage;
  const isTrash = tab === "trash";

  const selectableIds = useMemo(() => {
    if (!listShowSelection) {
      return new Set<string>();
    }
    return new Set(visible.map((employee) => employee.id));
  }, [visible, listShowSelection]);

  const selectedVisibleCount = useMemo(
    () => [...selectedIds].filter((id) => selectableIds.has(id)).length,
    [selectedIds, selectableIds]
  );

  const allVisibleSelected =
    selectableIds.size > 0 && selectedVisibleCount === selectableIds.size;
  const someVisibleSelected = selectedVisibleCount > 0;

  const selectedIdsForAction = useMemo(
    () => [...selectedIds].filter((id) => selectableIds.has(id)),
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

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of selectableIds) {
          next.delete(id);
        }
        return next;
      });
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of selectableIds) {
        next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function selectTab(next: EmployeeDirectoryView) {
    setTab(next);
    setStatusSegment("all");
    clearSelection();
  }

  function selectUnassignedSegment(next: UnassignedSegment) {
    setUnassignedSegment(next);
    setStatusSegment("all");
    clearSelection();
  }

  function selectStatusSegment(next: StatusSegment) {
    setStatusSegment(next);
    clearSelection();
  }

  function selectDepartment(next: string) {
    setDepartmentFilter(next);
    clearSelection();
  }

  function departmentLabel(category: EmployeeCategoryOption): string {
    return titleCaseWords(
      localizeDepartmentLabel(category.slug, category.name, locale)
    );
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    clearSelection();
  }

  function openBulkCreate(scope: BulkEmploymentScope) {
    setBulkEmploymentScope(scope);
    setBulkImportOpen(true);
  }

  const showBulkImportFt =
    canManage &&
    (tab === "allEmployees" ||
      tab === "fullTime" ||
      (tab === "unassigned" && unassignedSegment === "FULL_TIME"));
  const showBulkImportPt =
    canManage &&
    (tab === "allEmployees" ||
      tab === "partTime" ||
      (tab === "unassigned" && unassignedSegment === "PART_TIME"));

  const trimmedSearch = query.trim();
  const hasActiveSearch = trimmedSearch !== "";

  const emptyTitle = hasActiveSearch
    ? t("pages.employees.emptySearch", { query: trimmedSearch })
    : tab !== "trash" && statusSegment === "onLeave"
      ? t("pages.employees.emptyOnLeave")
      : tab !== "trash" && statusSegment === "leavePending"
        ? t("pages.employees.emptyLeavePending")
        : selectedDepartment
          ? t("pages.employees.emptyDepartment", {
              name: departmentLabel(selectedDepartment),
              prefix: selectedDepartment.prefix,
            })
        : tab === "allEmployees"
        ? t("pages.employees.emptyActiveList")
        : tab === "fullTime"
          ? t("pages.employees.emptyFullTime")
          : tab === "partTime"
            ? t("pages.employees.emptyPartTime")
            : tab === "unassigned"
              ? unassignedSegment === "FULL_TIME"
                ? t("pages.employees.emptyUnassignedFt")
                : t("pages.employees.emptyUnassignedPt")
              : t("pages.employees.emptyDeletedList");

  const emptyDescription = hasActiveSearch
    ? t("pages.employees.emptySearchDesc")
    : tab !== "trash" && statusSegment === "onLeave"
      ? t("pages.employees.emptyOnLeaveDesc")
      : tab !== "trash" && statusSegment === "leavePending"
        ? t("pages.employees.emptyLeavePendingDesc")
        : selectedDepartment
          ? t("pages.employees.emptyDepartmentDesc")
        : tab === "allEmployees"
        ? t("pages.employees.emptyActiveListDesc")
        : tab === "fullTime"
          ? t("pages.employees.emptyFullTimeDesc")
          : tab === "partTime"
            ? t("pages.employees.emptyPartTimeDesc")
            : tab === "unassigned"
              ? unassignedSegment === "FULL_TIME"
                ? t("pages.employees.emptyUnassignedFtDesc")
                : t("pages.employees.emptyUnassignedPtDesc")
              : t("pages.employees.emptyTrash");

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <DirectoryStatCard
          compact
          title={t("pages.employees.allEmployees")}
          value={allEmployees.length}
          subtitle={t("pages.employees.allEmployeesSubtitle")}
          icon={<Users size={15} />}
          accent="success"
          selected={tab === "allEmployees"}
          onClick={() => selectTab("allEmployees")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.employees.fullTime")}
          value={fullTime.length}
          subtitle={t("pages.employees.fullTimeSubtitle")}
          icon={<UserRound size={15} />}
          accent="primary"
          selected={tab === "fullTime"}
          onClick={() => selectTab("fullTime")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.employees.partTime")}
          value={partTime.length}
          subtitle={t("pages.employees.partTimeSubtitle")}
          icon={<Users size={15} />}
          accent="warning"
          selected={tab === "partTime"}
          onClick={() => selectTab("partTime")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.employees.unassigned")}
          value={unassigned.length}
          subtitle={t("pages.employees.unassignedSubtitle")}
          icon={<UserX size={15} />}
          accent="info"
          selected={tab === "unassigned"}
          onClick={() => selectTab("unassigned")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.employees.deleted")}
          value={trash.length}
          subtitle={t("pages.employees.deletedSubtitle")}
          icon={<Trash2 size={15} />}
          accent="danger"
          selected={tab === "trash"}
          onClick={() => selectTab("trash")}
        />
      </div>

      {tab === "unassigned" ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <DirectoryFilterTab
            size="sm"
            active={unassignedSegment === "FULL_TIME"}
            count={unassignedFullTime.length}
            onClick={() => selectUnassignedSegment("FULL_TIME")}
          >
            {t("pages.employees.fullTime")}
          </DirectoryFilterTab>
          <DirectoryFilterTab
            size="sm"
            active={unassignedSegment === "PART_TIME"}
            count={unassignedPartTime.length}
            onClick={() => selectUnassignedSegment("PART_TIME")}
          >
            {t("pages.employees.partTime")}
          </DirectoryFilterTab>
        </div>
      ) : null}

      {departmentOptions.length > 0 ? (
        <div
          className="mb-3 flex flex-wrap items-center gap-2"
          role="group"
          aria-label={t("pages.employees.filterDepartment")}
        >
          <DirectoryFilterTab
            size="sm"
            active={departmentFilter === ALL_DEPARTMENTS}
            count={selected.length}
            onClick={() => selectDepartment(ALL_DEPARTMENTS)}
          >
            {t("pages.employees.statusFilterAll")}
          </DirectoryFilterTab>
          {departmentOptions.map((category) => (
            <DirectoryFilterTab
              key={category.id}
              size="sm"
              active={departmentFilter === category.id}
              count={
                selected.filter(
                  (employee) => employee.categoryId === category.id
                ).length
              }
              onClick={() => selectDepartment(category.id)}
            >
              {departmentLabel(category)}
            </DirectoryFilterTab>
          ))}
        </div>
      ) : null}

      {tab !== "trash" ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <DirectoryFilterTab
            size="sm"
            active={statusSegment === "all"}
            count={departmentFiltered.length}
            onClick={() => selectStatusSegment("all")}
          >
            {t("pages.employees.statusFilterAll")}
          </DirectoryFilterTab>
          <DirectoryFilterTab
            size="sm"
            active={statusSegment === "onLeave"}
            count={onLeaveInCard.length}
            onClick={() => selectStatusSegment("onLeave")}
          >
            {t("pages.employees.onLeave")}
          </DirectoryFilterTab>
          <DirectoryFilterTab
            size="sm"
            active={statusSegment === "leavePending"}
            count={leavePendingInCard.length}
            onClick={() => selectStatusSegment("leavePending")}
          >
            {t("pages.employees.leavePendingFilter")}
          </DirectoryFilterTab>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DirectorySearchInput
          value={query}
          onChange={handleSearchChange}
          placeholder={t("pages.employees.searchPlaceholder")}
          className="min-w-[12rem] w-auto max-w-none flex-1"
        />
        {canManage ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <DirectoryAddButton
              label={t("pages.employees.addEmployee")}
              onClick={() => setCreateOpen(true)}
            />
            {showBulkImportFt ? (
              <DirectoryAddButton
                label={t("pages.employees.addBulkFullTime")}
                variant="infoBadge"
                icon={<ListPlus className="h-3.5 w-3.5" />}
                onClick={() => openBulkCreate("FULL_TIME")}
              />
            ) : null}
            {showBulkImportPt ? (
              <DirectoryAddButton
                label={t("pages.employees.addBulkPartTime")}
                variant="infoBadge"
                icon={<ListPlus className="h-3.5 w-3.5" />}
                onClick={() => openBulkCreate("PART_TIME")}
              />
            ) : null}
            {manageCategories ? (
              <EmployeeCategoryManageDialog categories={manageCategories} />
            ) : null}
            {managePositions ? (
              <PositionManageDialog
                positions={managePositions}
                categories={categories}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {listShowSelection ? (
        <BulkActionBar
          selectedCount={selectedVisibleCount}
          actionLabel={
            isTrash
              ? t("common.actions.restoreSelected")
              : t("common.actions.deleteSelected")
          }
          actionVariant={isTrash ? "success" : "destructive"}
          onClear={clearSelection}
          onAction={() => {
            setBulkDialogMode(isTrash ? "reactivate" : "deactivate");
            setBulkDialogOpen(true);
          }}
          secondaryActionLabel={
            isTrash ? t("common.actions.permanentlyDelete") : undefined
          }
          onSecondaryAction={
            isTrash
              ? () => {
                  setBulkDialogMode("archive");
                  setBulkDialogOpen(true);
                }
              : undefined
          }
        />
      ) : null}

      {visible.length === 0 ? (
        <SectionCard>
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </SectionCard>
      ) : (
        <EmployeeTable
          employees={visible}
          categories={categories}
          positions={positions}
          projects={projects}
          canManage={canManage}
          canResign={canResign}
          canArchive={canArchive}
          createActorTier={createActorTier}
          directoryView={tab}
          showSelection={listShowSelection}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          allVisibleSelected={allVisibleSelected}
          someVisibleSelected={someVisibleSelected}
          selectableIds={selectableIds}
        />
      )}
      {canManage ? (
        <EmployeeDialog
          categories={categories}
          positions={positions}
          projects={projects}
          open={createOpen}
          onOpenChange={setCreateOpen}
          showTrigger={false}
        />
      ) : null}
      {canManage ? (
        <EmployeeBulkCreateDialog
          open={bulkImportOpen}
          onOpenChange={setBulkImportOpen}
          employmentType={bulkEmploymentScope}
          categories={categories}
          positions={positions}
          projects={projects}
        />
      ) : null}

      {listShowSelection && bulkDialogMode === "reactivate" ? (
        <EmployeeBulkReactivateDialog
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
      ) : null}

      {listShowSelection &&
      (bulkDialogMode === "deactivate" || bulkDialogMode === "archive") ? (
        <EmployeeBulkActionDialog
          open={bulkDialogOpen}
          onOpenChange={(open) => {
            setBulkDialogOpen(open);
            if (!open) {
              clearSelection();
            }
          }}
          selectedCount={selectedIdsForAction.length}
          mode={bulkDialogMode}
          selectedIds={selectedIdsForAction}
        />
      ) : null}
    </>
  );
}
