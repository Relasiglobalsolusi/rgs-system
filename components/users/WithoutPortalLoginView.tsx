"use client";

import { useMemo, useState } from "react";

import ClientGeneratePortalLoginDialog from "@/components/clients/ClientGeneratePortalLoginDialog";
import ClientEditDialog from "@/components/clients/ClientEditDialog";
import VendorGeneratePortalLoginDialog from "@/components/vendors/VendorGeneratePortalLoginDialog";
import VendorEditDialog from "@/components/vendors/VendorEditDialog";
import BulkGeneratePortalLoginDialog from "@/components/users/BulkGeneratePortalLoginDialog";
import EmployeeGeneratePortalLoginDialog from "@/components/users/EmployeeGeneratePortalLoginDialog";
import BulkActionBar from "@/components/ui/BulkActionBar";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { createSelectionColumn } from "@/components/ui/data-table-selection";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import { flexibleBadgeChipClassName } from "@/components/ui/trash-action-buttons";
import { formatContactPersonName } from "@/lib/contact-person";
import { formatPhoneForDisplay } from "@/lib/phone";
import { isRosterActiveEmployeeStatus } from "@/lib/user-directory-status";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import type { EmployeeType, EmploymentType, Placement } from "@prisma/client";

/** Wide enough for the "Generate Portal Login" chip. */
const GENERATE_ACTIONS_COLUMN_WIDTH = "15.5rem";

export type ClientWithoutPortalLogin = {
  id: string;
  name: string;
  shortCode: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  npwp: string | null;
  contactPersonFirstName: string | null;
  contactPersonLastName: string | null;
  contactPersonPosition: string | null;
  contactPersonEmail: string | null;
  contactPersonPhone: string | null;
  clientSince: Date | string;
  active: boolean;
  _count: { projects: number; users: number };
  users: Array<{ id: string; username: string; active: boolean }>;
};

export type VendorWithoutPortalLogin = {
  id: string;
  name: string;
  shortCode: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  npwp: string | null;
  taxIdDocumentUrl?: string | null;
  contactPersonFirstName: string | null;
  contactPersonLastName: string | null;
  contactPersonPosition: string | null;
  contactPersonEmail: string | null;
  contactPersonPhone: string | null;
  vendorSince: Date | string;
  paymentTermsDays?: number | null;
  active: boolean;
  users: Array<{ id: string; username: string; active: boolean }>;
};

export type EmployeeWithoutPortalLogin = {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  employeeType: EmployeeType;
  employmentType: EmploymentType;
  placement: Placement;
  jobPosition: { id: string; name: string } | null;
  status: "ACTIVE" | "INACTIVE" | "TERMINATED" | "ON_LEAVE";
  category: { name: string } | null;
  user: { username: string; active: boolean } | null;
};

function isGenerateEligibleClient(client: { active: boolean }) {
  return client.active;
}

function isGenerateEligibleVendor(vendor: { active: boolean }) {
  return vendor.active;
}

function isGenerateEligibleEmployee(employee: {
  status: EmployeeWithoutPortalLogin["status"];
}) {
  return isRosterActiveEmployeeStatus(employee.status);
}

type Props = {
  clients: ClientWithoutPortalLogin[];
  vendors: VendorWithoutPortalLogin[];
  employees: EmployeeWithoutPortalLogin[];
  canManageClients?: boolean;
  canManageVendors?: boolean;
  canManageEmployees?: boolean;
};

function getOrgContact(row: {
  contactPersonPhone: string | null;
  phone: string | null;
  contactPersonEmail: string | null;
  email: string | null;
}): string | null {
  const phone =
    formatPhoneForDisplay(row.contactPersonPhone) ||
    formatPhoneForDisplay(row.phone);
  if (phone) return phone;

  return row.contactPersonEmail?.trim() || row.email?.trim() || null;
}

export default function WithoutPortalLoginView({
  clients,
  vendors,
  employees,
  canManageClients = false,
  canManageVendors = false,
  canManageEmployees = false,
}: Props) {
  const { t } = useT();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    () => new Set()
  );
  const [bulkGenerateOpen, setBulkGenerateOpen] = useState(false);
  const [editClient, setEditClient] =
    useState<ClientWithoutPortalLogin | null>(null);
  const [editVendor, setEditVendor] =
    useState<VendorWithoutPortalLogin | null>(null);
  const [singleClientGenerateIds, setSingleClientGenerateIds] = useState<
    string[]
  >([]);
  const [singleVendorGenerateIds, setSingleVendorGenerateIds] = useState<
    string[]
  >([]);
  const [singleEmployeeGenerateIds, setSingleEmployeeGenerateIds] = useState<
    string[]
  >([]);

  const filteredClients = useMemo(
    () =>
      clients.filter((client) =>
        matchesDirectorySearch(
          searchQuery,
          client.name,
          client.shortCode,
          client.email,
          client.phone,
          client.contactPersonFirstName,
          client.contactPersonLastName,
          client.contactPersonPosition,
          client.contactPersonEmail,
          client.contactPersonPhone
        )
      ),
    [clients, searchQuery]
  );

  const filteredVendors = useMemo(
    () =>
      vendors.filter((vendor) =>
        matchesDirectorySearch(
          searchQuery,
          vendor.name,
          vendor.shortCode,
          vendor.email,
          vendor.phone,
          vendor.contactPersonFirstName,
          vendor.contactPersonLastName,
          vendor.contactPersonPosition,
          vendor.contactPersonEmail,
          vendor.contactPersonPhone
        )
      ),
    [vendors, searchQuery]
  );

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) =>
        matchesDirectorySearch(
          searchQuery,
          employee.firstName,
          employee.lastName,
          `${employee.firstName} ${employee.lastName}`,
          employee.employeeNo,
          employee.email,
          employee.phone,
          employee.jobPosition?.name,
          employee.category?.name,
          employee.placement
        )
      ),
    [employees, searchQuery]
  );

  const clientsIncludeSoftDeleted = useMemo(
    () => filteredClients.some((client) => !client.active),
    [filteredClients]
  );
  const vendorsIncludeSoftDeleted = useMemo(
    () => filteredVendors.some((vendor) => !vendor.active),
    [filteredVendors]
  );
  const employeesIncludeSoftDeleted = useMemo(
    () =>
      filteredEmployees.some(
        (employee) => !isRosterActiveEmployeeStatus(employee.status)
      ),
    [filteredEmployees]
  );

  const clientSelectableIds = useMemo(
    () =>
      canManageClients
        ? new Set(
            filteredClients
              .filter(isGenerateEligibleClient)
              .map((client) => client.id)
          )
        : new Set<string>(),
    [canManageClients, filteredClients]
  );

  const vendorSelectableIds = useMemo(
    () =>
      canManageVendors
        ? new Set(
            filteredVendors
              .filter(isGenerateEligibleVendor)
              .map((vendor) => vendor.id)
          )
        : new Set<string>(),
    [canManageVendors, filteredVendors]
  );

  const employeeSelectableIds = useMemo(
    () =>
      canManageEmployees
        ? new Set(
            filteredEmployees
              .filter(isGenerateEligibleEmployee)
              .map((employee) => employee.id)
          )
        : new Set<string>(),
    [canManageEmployees, filteredEmployees]
  );

  const selectedVisibleClientCount = useMemo(
    () =>
      [...selectedClientIds].filter((id) => clientSelectableIds.has(id)).length,
    [selectedClientIds, clientSelectableIds]
  );

  const selectedVisibleVendorCount = useMemo(
    () =>
      [...selectedVendorIds].filter((id) => vendorSelectableIds.has(id)).length,
    [selectedVendorIds, vendorSelectableIds]
  );

  const selectedVisibleEmployeeCount = useMemo(
    () =>
      [...selectedEmployeeIds].filter((id) =>
        employeeSelectableIds.has(id)
      ).length,
    [selectedEmployeeIds, employeeSelectableIds]
  );

  const allClientsSelected =
    clientSelectableIds.size > 0 &&
    selectedVisibleClientCount === clientSelectableIds.size;
  const someClientsSelected = selectedVisibleClientCount > 0;

  const allVendorsSelected =
    vendorSelectableIds.size > 0 &&
    selectedVisibleVendorCount === vendorSelectableIds.size;
  const someVendorsSelected = selectedVisibleVendorCount > 0;

  const allEmployeesSelected =
    employeeSelectableIds.size > 0 &&
    selectedVisibleEmployeeCount === employeeSelectableIds.size;
  const someEmployeesSelected = selectedVisibleEmployeeCount > 0;

  const selectedClientIdsForAction = useMemo(
    () => [...selectedClientIds].filter((id) => clientSelectableIds.has(id)),
    [selectedClientIds, clientSelectableIds]
  );

  const selectedVendorIdsForAction = useMemo(
    () => [...selectedVendorIds].filter((id) => vendorSelectableIds.has(id)),
    [selectedVendorIds, vendorSelectableIds]
  );

  const selectedEmployeeIdsForAction = useMemo(
    () =>
      [...selectedEmployeeIds].filter((id) => employeeSelectableIds.has(id)),
    [selectedEmployeeIds, employeeSelectableIds]
  );

  const totalSelectedCount =
    selectedVisibleClientCount +
    selectedVisibleVendorCount +
    selectedVisibleEmployeeCount;

  function clearAllSelection() {
    setSelectedClientIds(new Set());
    setSelectedVendorIds(new Set());
    setSelectedEmployeeIds(new Set());
  }

  function handleBulkGenerate() {
    if (
      selectedClientIdsForAction.length === 0 &&
      selectedVendorIdsForAction.length === 0 &&
      selectedEmployeeIdsForAction.length === 0
    ) {
      return;
    }
    setBulkGenerateOpen(true);
  }

  function toggleClientSelect(id: string) {
    if (!clientSelectableIds.has(id)) return;
    setSelectedClientIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVendorSelect(id: string) {
    if (!vendorSelectableIds.has(id)) return;
    setSelectedVendorIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleEmployeeSelect(id: string) {
    if (!employeeSelectableIds.has(id)) return;
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllClients() {
    if (allClientsSelected) {
      setSelectedClientIds((current) => {
        const next = new Set(current);
        for (const id of clientSelectableIds) next.delete(id);
        return next;
      });
      return;
    }
    setSelectedClientIds((current) => {
      const next = new Set(current);
      for (const id of clientSelectableIds) next.add(id);
      return next;
    });
  }

  function toggleSelectAllVendors() {
    if (allVendorsSelected) {
      setSelectedVendorIds((current) => {
        const next = new Set(current);
        for (const id of vendorSelectableIds) next.delete(id);
        return next;
      });
      return;
    }
    setSelectedVendorIds((current) => {
      const next = new Set(current);
      for (const id of vendorSelectableIds) next.add(id);
      return next;
    });
  }

  function toggleSelectAllEmployees() {
    if (allEmployeesSelected) {
      setSelectedEmployeeIds((current) => {
        const next = new Set(current);
        for (const id of employeeSelectableIds) next.delete(id);
        return next;
      });
      return;
    }
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      for (const id of employeeSelectableIds) next.add(id);
      return next;
    });
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    clearAllSelection();
  }

  const clientColumns = useMemo(() => {
    const cols: DataTableColumn<ClientWithoutPortalLogin>[] = [];

    if (canManageClients) {
      cols.push(
        createSelectionColumn<ClientWithoutPortalLogin>({
          ariaLabelAll: t("pages.users.selectAllClients"),
          getRowAriaLabel: (client) =>
            t("pages.users.selectClientRow", { name: client.name }),
          getRowId: (client) => client.id,
          allVisibleSelected: allClientsSelected,
          someVisibleSelected: someClientsSelected,
          onToggleSelectAll: toggleSelectAllClients,
          onToggleSelect: toggleClientSelect,
          selectedIds: selectedClientIds,
          selectableIds: clientSelectableIds,
        })
      );
    }

    cols.push(
      {
        key: "name",
        title: t("pages.clients.columns.client"),
        width: "16rem",
        className: "min-w-[16rem]",
        render: (client) => (
          <p className="font-semibold text-text">{client.name}</p>
        ),
      },
      {
        key: "shortCode",
        title: t("pages.clients.columns.shortCode"),
        render: (client) => (
          <span className="font-mono text-sm text-muted">
            {client.shortCode || "—"}
          </span>
        ),
      },
      {
        key: "contact",
        title: t("pages.clients.columns.contact"),
        width: "14rem",
        className: "min-w-[14rem]",
        render: (client) => {
          const person = formatContactPersonName(
            client.contactPersonFirstName,
            client.contactPersonLastName
          );
          const contact = getOrgContact(client);
          if (!person && !contact) {
            return <span className="text-subtle">—</span>;
          }
          return (
            <div className="min-w-0">
              {person ? <p className="text-text">{person}</p> : null}
              {contact ? (
                <p className="mt-0.5 text-sm text-subtle">{contact}</p>
              ) : null}
            </div>
          );
        },
      }
    );

    if (canManageClients) {
      cols.push({
        key: "actions",
        title: t("pages.clients.columns.actions"),
        width: GENERATE_ACTIONS_COLUMN_WIDTH,
        align: "center",
        className: "min-w-[14rem] overflow-visible whitespace-nowrap",
        render: (client) => {
          const canGenerate = isGenerateEligibleClient(client);
          return (
            <div className="flex shrink-0 items-center justify-center whitespace-nowrap">
              <Button
                type="button"
                size="badge"
                variant="successBadge"
                disabled={!canGenerate}
                title={
                  canGenerate
                    ? undefined
                    : t("pages.users.withoutPortalRestoreHint")
                }
                className={cn(flexibleBadgeChipClassName)}
                onClick={(event) => {
                  event.stopPropagation();
                  if (canGenerate) setSingleClientGenerateIds([client.id]);
                }}
              >
                {t("pages.users.generatePortalLogin")}
              </Button>
            </div>
          );
        },
      });
    }

    return cols;
  }, [
    canManageClients,
    allClientsSelected,
    someClientsSelected,
    selectedClientIds,
    clientSelectableIds,
    t,
  ]);

  const vendorColumns = useMemo(() => {
    const cols: DataTableColumn<VendorWithoutPortalLogin>[] = [];

    if (canManageVendors) {
      cols.push(
        createSelectionColumn<VendorWithoutPortalLogin>({
          ariaLabelAll: t("pages.users.selectAllVendors"),
          getRowAriaLabel: (vendor) =>
            t("pages.users.selectVendorRow", { name: vendor.name }),
          getRowId: (vendor) => vendor.id,
          allVisibleSelected: allVendorsSelected,
          someVisibleSelected: someVendorsSelected,
          onToggleSelectAll: toggleSelectAllVendors,
          onToggleSelect: toggleVendorSelect,
          selectedIds: selectedVendorIds,
          selectableIds: vendorSelectableIds,
        })
      );
    }

    cols.push(
      {
        key: "name",
        title: t("pages.vendors.columns.vendor"),
        width: "16rem",
        className: "min-w-[16rem]",
        render: (vendor) => (
          <p className="font-semibold text-text">{vendor.name}</p>
        ),
      },
      {
        key: "shortCode",
        title: t("pages.vendors.columns.shortCode"),
        render: (vendor) => (
          <span className="font-mono text-sm text-muted">
            {vendor.shortCode || "—"}
          </span>
        ),
      },
      {
        key: "contact",
        title: t("pages.vendors.columns.contact"),
        width: "14rem",
        className: "min-w-[14rem]",
        render: (vendor) => {
          const person = formatContactPersonName(
            vendor.contactPersonFirstName,
            vendor.contactPersonLastName
          );
          const contact = getOrgContact(vendor);
          if (!person && !contact) {
            return <span className="text-subtle">—</span>;
          }
          return (
            <div className="min-w-0">
              {person ? <p className="text-text">{person}</p> : null}
              {contact ? (
                <p className="mt-0.5 text-sm text-subtle">{contact}</p>
              ) : null}
            </div>
          );
        },
      }
    );

    if (canManageVendors) {
      cols.push({
        key: "actions",
        title: t("pages.vendors.columns.actions"),
        width: GENERATE_ACTIONS_COLUMN_WIDTH,
        align: "center",
        className: "min-w-[14rem] overflow-visible whitespace-nowrap",
        render: (vendor) => {
          const canGenerate = isGenerateEligibleVendor(vendor);
          return (
            <div className="flex shrink-0 items-center justify-center whitespace-nowrap">
              <Button
                type="button"
                size="badge"
                variant="successBadge"
                disabled={!canGenerate}
                title={
                  canGenerate
                    ? undefined
                    : t("pages.users.withoutPortalRestoreHint")
                }
                className={cn(flexibleBadgeChipClassName)}
                onClick={(event) => {
                  event.stopPropagation();
                  if (canGenerate) setSingleVendorGenerateIds([vendor.id]);
                }}
              >
                {t("pages.users.generatePortalLogin")}
              </Button>
            </div>
          );
        },
      });
    }

    return cols;
  }, [
    canManageVendors,
    allVendorsSelected,
    someVendorsSelected,
    selectedVendorIds,
    vendorSelectableIds,
    t,
  ]);

  const employeeColumns = useMemo(() => {
    const cols: DataTableColumn<EmployeeWithoutPortalLogin>[] = [];

    if (canManageEmployees) {
      cols.push(
        createSelectionColumn<EmployeeWithoutPortalLogin>({
          ariaLabelAll: t("pages.users.selectAllEmployees"),
          getRowAriaLabel: (employee) =>
            t("pages.users.selectEmployeeRow", {
              name: `${employee.firstName} ${employee.lastName}`,
            }),
          getRowId: (employee) => employee.id,
          allVisibleSelected: allEmployeesSelected,
          someVisibleSelected: someEmployeesSelected,
          onToggleSelectAll: toggleSelectAllEmployees,
          onToggleSelect: toggleEmployeeSelect,
          selectedIds: selectedEmployeeIds,
          selectableIds: employeeSelectableIds,
        })
      );
    }

    cols.push(
      {
        key: "name",
        title: t("pages.employees.title"),
        width: "14rem",
        className: "min-w-[14rem]",
        render: (employee) => (
          <p className="font-semibold text-text">
            {employee.firstName} {employee.lastName}
          </p>
        ),
      },
      {
        key: "employeeNo",
        title: t("pages.employees.columns.employeeNo"),
        render: (employee) => (
          <span className="font-mono text-sm text-muted">
            {employee.employeeNo}
          </span>
        ),
      },
      {
        key: "dept",
        title: t("pages.employees.columns.department"),
        width: "12rem",
        className: "min-w-[12rem]",
        render: (employee) => {
          const position = employee.jobPosition?.name.trim() || null;
          const department = employee.category?.name ?? null;
          if (!position && !department) {
            return <span className="text-subtle">—</span>;
          }
          return (
            <div className="min-w-0">
              {position ? <p className="text-text">{position}</p> : null}
              {department ? (
                <p className="mt-0.5 text-sm text-subtle">{department}</p>
              ) : null}
            </div>
          );
        },
      }
    );

    if (canManageEmployees) {
      cols.push({
        key: "actions",
        title: t("pages.employees.columns.actions"),
        width: GENERATE_ACTIONS_COLUMN_WIDTH,
        align: "center",
        className: "min-w-[14rem] overflow-visible whitespace-nowrap",
        render: (employee) => {
          const canGenerate = isGenerateEligibleEmployee(employee);
          return (
            <div className="flex shrink-0 items-center justify-center whitespace-nowrap">
              <Button
                type="button"
                size="badge"
                variant="successBadge"
                disabled={!canGenerate}
                title={
                  canGenerate
                    ? undefined
                    : t("pages.users.withoutPortalRestoreHint")
                }
                className={cn(flexibleBadgeChipClassName)}
                onClick={(event) => {
                  event.stopPropagation();
                  if (canGenerate) setSingleEmployeeGenerateIds([employee.id]);
                }}
              >
                {t("pages.users.generatePortalLogin")}
              </Button>
            </div>
          );
        },
      });
    }

    return cols;
  }, [
    canManageEmployees,
    allEmployeesSelected,
    someEmployeesSelected,
    selectedEmployeeIds,
    employeeSelectableIds,
    t,
  ]);

  const trimmedSearch = searchQuery.trim();
  const hasActiveSearch = trimmedSearch !== "";
  const showClients = filteredClients.length > 0;
  const showVendors = filteredVendors.length > 0;
  const showEmployees = filteredEmployees.length > 0;
  const isEmpty = !showClients && !showVendors && !showEmployees;
  const canManageAny =
    canManageClients || canManageVendors || canManageEmployees;

  return (
    <>
      <div className="mb-4">
        <DirectorySearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t("pages.users.withoutPortalSearch")}
        />
      </div>

      {canManageAny ? (
        <BulkActionBar
          selectedCount={totalSelectedCount}
          actionLabel={t("pages.users.generatePortalLogin")}
          actionVariant="success"
          onClear={clearAllSelection}
          onAction={handleBulkGenerate}
        />
      ) : null}

      {isEmpty ? (
        <SectionCard>
          <EmptyState
            title={
              hasActiveSearch
                ? t("pages.users.emptySearch", { query: trimmedSearch })
                : t("pages.users.withoutPortalEmpty")
            }
            description={
              hasActiveSearch
                ? t("pages.users.emptySearchDesc")
                : t("pages.users.withoutPortalEmptyDesc")
            }
          />
        </SectionCard>
      ) : (
        <div className="space-y-6">
          {showClients ? (
            <section>
              <div className="mb-3">
                <h3 className="text-base font-semibold text-text">
                  {t("pages.users.withoutPortalClients")}
                </h3>
                <p className="mt-0.5 text-sm text-muted">
                  {clientsIncludeSoftDeleted
                    ? t("pages.users.withoutPortalRestoreHint")
                    : t("pages.users.withoutPortalSectionCount", {
                        count: filteredClients.length,
                      })}
                </p>
              </div>

              <DataTable
                columns={clientColumns}
                data={filteredClients}
                getRowKey={(client) => client.id}
                onRowClick={
                  canManageClients ? setEditClient : undefined
                }
                isRowSelected={(client) =>
                  selectedClientIds.has(client.id)
                }
                emptyMessage={t("pages.users.withoutPortalEmptyClients")}
              />
            </section>
          ) : null}

          {showVendors ? (
            <section>
              <div className="mb-3">
                <h3 className="text-base font-semibold text-text">
                  {t("pages.users.withoutPortalVendors")}
                </h3>
                <p className="mt-0.5 text-sm text-muted">
                  {vendorsIncludeSoftDeleted
                    ? t("pages.users.withoutPortalRestoreHint")
                    : t("pages.users.withoutPortalSectionCount", {
                        count: filteredVendors.length,
                      })}
                </p>
              </div>

              <DataTable
                columns={vendorColumns}
                data={filteredVendors}
                getRowKey={(vendor) => vendor.id}
                onRowClick={
                  canManageVendors ? setEditVendor : undefined
                }
                isRowSelected={(vendor) =>
                  selectedVendorIds.has(vendor.id)
                }
                emptyMessage={t("pages.users.withoutPortalEmptyVendors")}
              />
            </section>
          ) : null}

          {showEmployees ? (
            <section>
              <div className="mb-3">
                <h3 className="text-base font-semibold text-text">
                  {t("pages.users.withoutPortalEmployees")}
                </h3>
                <p className="mt-0.5 text-sm text-muted">
                  {employeesIncludeSoftDeleted
                    ? t("pages.users.withoutPortalRestoreHint")
                    : t("pages.users.withoutPortalSectionCount", {
                        count: filteredEmployees.length,
                      })}
                </p>
              </div>

              <DataTable
                columns={employeeColumns}
                data={filteredEmployees}
                getRowKey={(employee) => employee.id}
                isRowSelected={(employee) =>
                  selectedEmployeeIds.has(employee.id)
                }
                emptyMessage={t("pages.users.withoutPortalEmptyEmployees")}
              />
            </section>
          ) : null}
        </div>
      )}

      {canManageClients && editClient ? (
        <ClientEditDialog
          key={editClient.id}
          client={editClient}
          showDelete={false}
          open
          onOpenChange={(open) => {
            if (!open) setEditClient(null);
          }}
          showTrigger={false}
        />
      ) : null}

      {canManageVendors && editVendor ? (
        <VendorEditDialog
          key={editVendor.id}
          vendor={editVendor}
          showDelete={false}
          open
          onOpenChange={(open) => {
            if (!open) setEditVendor(null);
          }}
          showTrigger={false}
        />
      ) : null}

      {canManageAny && bulkGenerateOpen ? (
        <BulkGeneratePortalLoginDialog
          open={bulkGenerateOpen}
          onOpenChange={(open) => {
            if (!open) {
              setBulkGenerateOpen(false);
              clearAllSelection();
            }
          }}
          clientIds={
            canManageClients ? selectedClientIdsForAction : []
          }
          vendorIds={
            canManageVendors ? selectedVendorIdsForAction : []
          }
          employeeIds={
            canManageEmployees ? selectedEmployeeIdsForAction : []
          }
        />
      ) : null}

      {canManageClients && singleClientGenerateIds.length > 0 ? (
        <ClientGeneratePortalLoginDialog
          open
          onOpenChange={(open) => {
            if (!open) setSingleClientGenerateIds([]);
          }}
          selectedCount={singleClientGenerateIds.length}
          selectedIds={singleClientGenerateIds}
        />
      ) : null}

      {canManageVendors && singleVendorGenerateIds.length > 0 ? (
        <VendorGeneratePortalLoginDialog
          open
          onOpenChange={(open) => {
            if (!open) setSingleVendorGenerateIds([]);
          }}
          selectedCount={singleVendorGenerateIds.length}
          selectedIds={singleVendorGenerateIds}
        />
      ) : null}

      {canManageEmployees && singleEmployeeGenerateIds.length > 0 ? (
        <EmployeeGeneratePortalLoginDialog
          open
          onOpenChange={(open) => {
            if (!open) setSingleEmployeeGenerateIds([]);
          }}
          selectedCount={singleEmployeeGenerateIds.length}
          selectedIds={singleEmployeeGenerateIds}
        />
      ) : null}
    </>
  );
}
