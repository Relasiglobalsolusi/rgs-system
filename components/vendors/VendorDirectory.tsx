"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, Trash2, Truck } from "lucide-react";

import {
  confirmBulkImportVendors,
  previewBulkImportVendors,
} from "@/app/vendors/import-actions";
import BulkImportDialog from "@/components/bulk-import/BulkImportDialog";
import VendorBulkActionDialog from "@/components/vendors/VendorBulkActionDialog";
import VendorBulkReactivateDialog from "@/components/vendors/VendorBulkReactivateDialog";
import VendorDialog from "@/components/vendors/VendorDialog";
import VendorTable, { type VendorRow } from "@/components/vendors/VendorTable";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import EmptyState from "@/components/ui/EmptyState";
import BulkActionBar from "@/components/ui/BulkActionBar";
import SectionCard from "@/components/ui/SectionCard";
import { useT } from "@/lib/i18n/use-t";

type DirectoryTab = "active" | "trash";
type BulkDialogMode = "deactivate" | "reactivate" | "archive";

type Props = {
  vendors: VendorRow[];
  canManage?: boolean;
};

export default function VendorDirectory({
  vendors,
  canManage = false,
}: Props) {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<DirectoryTab>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkDialogMode, setBulkDialogMode] =
    useState<BulkDialogMode>("deactivate");

  const activeVendors = useMemo(
    () => vendors.filter((vendor) => vendor.active),
    [vendors]
  );

  const trashVendors = useMemo(
    () => vendors.filter((vendor) => !vendor.active),
    [vendors]
  );

  const stats = useMemo(() => {
    return {
      active: activeVendors.length,
      trash: trashVendors.length,
    };
  }, [activeVendors.length, trashVendors.length]);

  const showAdd = canManage && activeTab === "active";

  const listShowSelection =
    canManage && (activeTab === "active" || activeTab === "trash");

  const bulkActionLabel =
    activeTab === "trash"
      ? t("common.actions.restoreSelected")
      : t("common.actions.deleteSelected");

  const tabVendors = activeTab === "active" ? activeVendors : trashVendors;

  const visibleVendors = useMemo(() => {
    return tabVendors.filter((vendor) =>
      matchesDirectorySearch(
        searchQuery,
        vendor.name,
        vendor.shortCode,
        vendor.address,
        vendor.email,
        vendor.phone,
        vendor.contactPersonFirstName,
        vendor.contactPersonLastName,
        vendor.contactPersonPosition,
        vendor.contactPersonEmail,
        vendor.contactPersonPhone
      )
    );
  }, [tabVendors, searchQuery]);

  const selectableIds = useMemo(() => {
    if (!listShowSelection) {
      return new Set<string>();
    }

    return new Set(
      visibleVendors
        .filter((vendor) =>
          activeTab === "trash" ? !vendor.active : vendor.active
        )
        .map((vendor) => vendor.id)
    );
  }, [visibleVendors, listShowSelection, activeTab]);

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

  const trimmedSearch = searchQuery.trim();
  const hasActiveSearch = trimmedSearch !== "";

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    clearSelection();
  }

  function selectTab(tab: DirectoryTab) {
    setActiveTab(tab);
    clearSelection();
  }

  const emptyTitle = hasActiveSearch
    ? t("pages.vendors.emptySearch", { query: trimmedSearch })
    : activeTab === "trash"
      ? t("pages.vendors.emptyDeletedList")
      : t("pages.vendors.emptyActiveList");

  const emptyDescription = hasActiveSearch
    ? t("pages.vendors.emptySearchDesc")
    : activeTab === "trash"
      ? t("pages.vendors.emptyTrash")
      : t("pages.vendors.emptyActiveListDesc");

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DirectoryStatCard
          title={t("pages.vendors.active")}
          value={stats.active}
          subtitle={t("pages.vendors.activeSubtitle")}
          icon={<Truck size={18} />}
          accent="success"
          selected={activeTab === "active"}
          onClick={() => selectTab("active")}
        />
        <DirectoryStatCard
          title={t("pages.vendors.deleted")}
          value={stats.trash}
          subtitle={t("pages.vendors.deletedSubtitle")}
          icon={<Trash2 size={18} />}
          accent="danger"
          selected={activeTab === "trash"}
          onClick={() => selectTab("trash")}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DirectorySearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t("pages.vendors.searchPlaceholder")}
          className="min-w-[12rem] w-auto max-w-none flex-1"
        />
        {showAdd ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <DirectoryAddButton
              label={t("pages.vendors.addVendor")}
              onClick={() => setCreateOpen(true)}
            />
            <DirectoryAddButton
              label={t("common.actions.addBulk")}
              variant="infoBadge"
              icon={<FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />}
              onClick={() => setBulkImportOpen(true)}
            />
          </div>
        ) : null}
      </div>

      {listShowSelection && (
        <BulkActionBar
          selectedCount={selectedVisibleCount}
          actionLabel={bulkActionLabel}
          actionVariant={activeTab === "trash" ? "success" : "destructive"}
          onClear={clearSelection}
          onAction={() => {
            setBulkDialogMode(
              activeTab === "trash" ? "reactivate" : "deactivate"
            );
            setBulkDialogOpen(true);
          }}
          secondaryActionLabel={
            activeTab === "trash"
              ? t("common.actions.permanentlyDelete")
              : undefined
          }
          onSecondaryAction={
            activeTab === "trash"
              ? () => {
                  setBulkDialogMode("archive");
                  setBulkDialogOpen(true);
                }
              : undefined
          }
        />
      )}

      {visibleVendors.length === 0 ? (
        <SectionCard>
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </SectionCard>
      ) : (
        <VendorTable
          vendors={visibleVendors}
          canManage={canManage}
          directoryView={activeTab}
          showSelection={listShowSelection}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          allVisibleSelected={allVisibleSelected}
          someVisibleSelected={someVisibleSelected}
          selectableIds={selectableIds}
        />
      )}

      {showAdd ? (
        <VendorDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          showTrigger={false}
        />
      ) : null}

      {showAdd ? (
        <BulkImportDialog
          open={bulkImportOpen}
          onOpenChange={setBulkImportOpen}
          entityLabel="vendor"
          templateUrl="/api/vendors/bulk-template"
          onPreview={previewBulkImportVendors}
          onConfirm={confirmBulkImportVendors}
        />
      ) : null}

      {listShowSelection && bulkDialogMode === "reactivate" && (
        <VendorBulkReactivateDialog
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

      {listShowSelection &&
        (bulkDialogMode === "deactivate" || bulkDialogMode === "archive") && (
          <VendorBulkActionDialog
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
        )}
    </>
  );
}
