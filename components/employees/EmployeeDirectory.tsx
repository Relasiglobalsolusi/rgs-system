"use client";

import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Trash2,
  UserRound,
  Users,
  UserX,
} from "lucide-react";
import {
  confirmBulkImportEmployees,
  previewBulkImportEmployees,
} from "@/app/employees/import-actions";
import BulkImportDialog from "@/components/bulk-import/BulkImportDialog";
import EmployeeBulkActionDialog from "@/components/employees/EmployeeBulkActionDialog";
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
import { useT } from "@/lib/i18n/use-t";
import { isRosterActiveEmployeeStatus } from "@/lib/user-directory-status";
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
  category: { id: string; name: string; prefix: string; slug?: string } | null;
  idDocumentUrl: string | null;
  status: "ACTIVE" | "INACTIVE" | "TERMINATED" | "ON_LEAVE";
  hiredAt: Date | string | null;
  jobPosition: { id: string; name: string } | null;
  projectAssignments: {
    project: { id: string; name: string; location: string | null };
  }[];
  user: { username: string; active: boolean } | null;
};

type BulkEmploymentScope = "FULL_TIME" | "PART_TIME";
type BulkDialogMode = "deactivate" | "reactivate" | "archive";
type UnassignedSegment = "FULL_TIME" | "PART_TIME";

type Props = {
  employees: Employee[];
  categories: EmployeeCategoryOption[];
  positions: PositionOption[];
  manageCategories?: EmployeeCategoryRow[];
  managePositions?: PositionRow[];
  projects: ProjectOption[];
  canManage?: boolean;
  canArchive?: boolean;
};

export default function EmployeeDirectory({
  employees,
  categories,
  positions,
  manageCategories,
  managePositions,
  projects,
  canManage = false,
  canArchive = false,
}: Props) {
  const { t } = useT();
  const [tab, setTab] = useState<EmployeeDirectoryView>("allEmployees");
  const [unassignedSegment, setUnassignedSegment] =
    useState<UnassignedSegment>("FULL_TIME");
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
  /** Assigned FT only — never AVAILABLE / Unassigned pool. */
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
  /** Assigned PT only — never AVAILABLE / Unassigned pool. */
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
          employee.status === "INACTIVE" || employee.status === "TERMINATED"
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

  const visible = useMemo(
    () =>
      selected.filter((employee) =>
        matchesDirectorySearch(
          query,
          `${employee.firstName} ${employee.lastName}`,
          employee.employeeNo,
          employee.position,
          employee.category?.name,
          employee.email,
          employee.phone,
          employee.user?.username
        )
      ),
    [selected, query]
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
    clearSelection();
  }

  function selectUnassignedSegment(next: UnassignedSegment) {
    setUnassignedSegment(next);
    clearSelection();
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    clearSelection();
  }

  function openBulkImport(scope: BulkEmploymentScope) {
    setBulkEmploymentScope(scope);
    setBulkImportOpen(true);
  }

  const bulkTemplateUrl =
    bulkEmploymentScope === "PART_TIME"
      ? "/api/employees/bulk-template?employmentType=PART_TIME"
      : "/api/employees/bulk-template";

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
                label={t("pages.employees.addBulk")}
                variant="infoBadge"
                icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                onClick={() => openBulkImport("FULL_TIME")}
              />
            ) : null}
            {showBulkImportPt ? (
              <DirectoryAddButton
                label={t("pages.employees.addBulk")}
                variant="infoBadge"
                icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                onClick={() => openBulkImport("PART_TIME")}
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
          canArchive={canArchive}
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
        <BulkImportDialog
          open={bulkImportOpen}
          onOpenChange={setBulkImportOpen}
          entityLabel="employee"
          templateUrl={bulkTemplateUrl}
          onPreview={previewBulkImportEmployees}
          onConfirm={confirmBulkImportEmployees}
          extraFormFields={
            bulkEmploymentScope === "PART_TIME"
              ? { forceEmploymentType: "PART_TIME" }
              : undefined
          }
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
