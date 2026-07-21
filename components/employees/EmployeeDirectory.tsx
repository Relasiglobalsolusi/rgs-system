"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, Trash2, Users } from "lucide-react";
import {
  confirmBulkImportEmployees,
  previewBulkImportEmployees,
} from "@/app/employees/import-actions";
import BulkImportDialog from "@/components/bulk-import/BulkImportDialog";
import EmployeeDialog from "@/components/employees/EmployeeDialog";
import EmployeeTable from "@/components/employees/EmployeeTable";
import EmployeeCategoryManageDialog from "@/components/employee-categories/EmployeeCategoryManageDialog";
import PositionManageDialog from "@/components/positions/PositionManageDialog";
import type { PositionRow } from "@/components/positions/PositionEditDialog";
import type { EmployeeCategoryRow } from "@/components/employee-categories/EmployeeCategoryEditDialog";
import type {
  EmployeeCategoryOption,
  PositionOption,
  ProjectOption,
} from "@/components/employees/EmployeeFormFields";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
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
type Tab = "available" | "partTime" | "trash";
type BulkEmploymentScope = "FULL_TIME" | "PART_TIME";
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
  const [tab, setTab] = useState<Tab>("available");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkEmploymentScope, setBulkEmploymentScope] =
    useState<BulkEmploymentScope>("FULL_TIME");

  const available = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.status === "ACTIVE" &&
          employee.employmentType === "FULL_TIME" &&
          employee.placement === "AVAILABLE"
      ),
    [employees]
  );
  const partTime = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.status === "ACTIVE" && employee.employmentType === "PART_TIME"
      ),
    [employees]
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
    tab === "available" ? available : tab === "partTime" ? partTime : trash;
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

  function openBulkImport(scope: BulkEmploymentScope) {
    setBulkEmploymentScope(scope);
    setBulkImportOpen(true);
  }

  const bulkTemplateUrl =
    bulkEmploymentScope === "PART_TIME"
      ? "/api/employees/bulk-template?employmentType=PART_TIME"
      : "/api/employees/bulk-template";

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DirectoryStatCard
          title={t("pages.employees.availableFt")}
          value={available.length}
          subtitle={t("pages.employees.availableFtSubtitle")}
          icon={<Users size={18} />}
          accent="success"
          selected={tab === "available"}
          onClick={() => setTab("available")}
        />
        <DirectoryStatCard
          title={t("pages.employees.partTimeRoster")}
          value={partTime.length}
          subtitle={t("pages.employees.partTimeRosterSubtitle")}
          icon={<Users size={18} />}
          accent="warning"
          selected={tab === "partTime"}
          onClick={() => setTab("partTime")}
        />
        <DirectoryStatCard
          title={t("pages.employees.deleted")}
          value={trash.length}
          subtitle={t("pages.employees.deletedSubtitle")}
          icon={<Trash2 size={18} />}
          accent="danger"
          selected={tab === "trash"}
          onClick={() => setTab("trash")}
        />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DirectorySearchInput
          value={query}
          onChange={setQuery}
          placeholder={t("pages.employees.searchPlaceholder")}
          className="min-w-[12rem] w-auto max-w-none flex-1"
        />
        {canManage ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <DirectoryAddButton
              label={t("pages.employees.addEmployee")}
              onClick={() => setCreateOpen(true)}
            />
            {tab === "available" ? (
              <DirectoryAddButton
                label={t("pages.employees.addBulk")}
                variant="infoBadge"
                icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                onClick={() => openBulkImport("FULL_TIME")}
              />
            ) : null}
            {tab === "partTime" ? (
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
      {visible.length === 0 ? (
        <SectionCard>
          <EmptyState
            title={
              query
                ? t("pages.employees.emptySearch", { query })
                : tab === "available"
                  ? t("pages.employees.emptyAvailableFt")
                  : tab === "partTime"
                    ? t("pages.employees.emptyPartTime")
                    : t("pages.employees.emptyDeletedList")
            }
            description={
              tab === "available"
                ? t("pages.employees.emptyAvailableFtDesc")
                : tab === "partTime"
                  ? t("pages.employees.emptyPartTimeDesc")
                  : t("pages.employees.emptyTrash")
            }
          />
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
    </>
  );
}
