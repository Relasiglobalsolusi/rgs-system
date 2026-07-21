"use client";

import { useMemo, useState } from "react";
import { Building2, FileSpreadsheet, Trash2 } from "lucide-react";

import {
  confirmBulkImportClients,
  previewBulkImportClients,
} from "@/app/clients/import-actions";
import BulkImportDialog from "@/components/bulk-import/BulkImportDialog";
import ClientBulkActionDialog from "@/components/clients/ClientBulkActionDialog";
import ClientBulkReactivateDialog from "@/components/clients/ClientBulkReactivateDialog";
import ClientDialog from "@/components/clients/ClientDialog";
import ClientTable, { type ClientRow } from "@/components/clients/ClientTable";
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
  clients: ClientRow[];
  canManage?: boolean;
};

export default function ClientDirectory({
  clients,
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

  const activeClients = useMemo(
    () => clients.filter((client) => client.active),
    [clients]
  );

  const trashClients = useMemo(
    () => clients.filter((client) => !client.active),
    [clients]
  );

  const stats = useMemo(() => {
    return {
      active: activeClients.length,
      trash: trashClients.length,
    };
  }, [activeClients.length, trashClients.length]);

  const showAdd = canManage && activeTab === "active";

  const listShowSelection =
    canManage && (activeTab === "active" || activeTab === "trash");

  const bulkActionLabel =
    activeTab === "trash"
      ? t("common.actions.restoreSelected")
      : t("common.actions.deleteSelected");

  const tabClients = activeTab === "active" ? activeClients : trashClients;

  const visibleClients = useMemo(() => {
    return tabClients.filter((client) =>
      matchesDirectorySearch(
        searchQuery,
        client.name,
        client.shortCode,
        client.address,
        client.email,
        client.phone,
        client.contactPersonFirstName,
        client.contactPersonLastName,
        client.contactPersonPosition,
        client.contactPersonEmail,
        client.contactPersonPhone
      )
    );
  }, [tabClients, searchQuery]);

  const selectableIds = useMemo(() => {
    if (!listShowSelection) {
      return new Set<string>();
    }

    return new Set(
      visibleClients
        .filter((client) =>
          activeTab === "trash" ? !client.active : client.active
        )
        .map((client) => client.id)
    );
  }, [visibleClients, listShowSelection, activeTab]);

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
    ? t("pages.clients.emptySearch", { query: trimmedSearch })
    : activeTab === "trash"
      ? t("pages.clients.emptyDeletedList")
      : t("pages.clients.emptyActiveList");

  const emptyDescription = hasActiveSearch
    ? t("pages.clients.emptySearchDesc")
    : activeTab === "trash"
      ? t("pages.clients.emptyTrash")
      : t("pages.clients.emptyActiveListDesc");

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DirectoryStatCard
          title={t("pages.clients.active")}
          value={stats.active}
          subtitle={t("pages.clients.activeSubtitle")}
          icon={<Building2 size={18} />}
          accent="success"
          selected={activeTab === "active"}
          onClick={() => selectTab("active")}
        />
        <DirectoryStatCard
          title={t("pages.clients.deleted")}
          value={stats.trash}
          subtitle={t("pages.clients.deletedSubtitle")}
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
          placeholder={t("pages.clients.searchPlaceholder")}
          className="min-w-[12rem] w-auto max-w-none flex-1"
        />
        {showAdd ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <DirectoryAddButton
              label={t("pages.clients.addClient")}
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

      {visibleClients.length === 0 ? (
        <SectionCard>
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </SectionCard>
      ) : (
        <ClientTable
          clients={visibleClients}
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
        <ClientDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          showTrigger={false}
        />
      ) : null}

      {showAdd ? (
        <BulkImportDialog
          open={bulkImportOpen}
          onOpenChange={setBulkImportOpen}
          entityLabel="client"
          templateUrl="/api/clients/bulk-template"
          onPreview={previewBulkImportClients}
          onConfirm={confirmBulkImportClients}
        />
      ) : null}

      {listShowSelection && bulkDialogMode === "reactivate" && (
        <ClientBulkReactivateDialog
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
          <ClientBulkActionDialog
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
