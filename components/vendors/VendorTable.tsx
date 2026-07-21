"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { reorderVendors } from "@/app/vendors/actions";
import VendorDeleteDialog from "@/components/vendors/VendorDeleteDialog";
import VendorEditDialog from "@/components/vendors/VendorEditDialog";
import VendorPermanentDeleteDialog from "@/components/vendors/VendorPermanentDeleteDialog";
import VendorReactivateDialog from "@/components/vendors/VendorReactivateDialog";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { createSelectionColumn } from "@/components/ui/data-table-selection";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  ACTIONS_SINGLE_CHIP_COLUMN_WIDTH,
  STATUS_COLUMN_WIDTH,
  TrashPermanentDeleteChip,
  TrashRestoreChip,
  TRASH_ACTIONS_COLUMN_WIDTH,
} from "@/components/ui/trash-action-buttons";
import { Button } from "@/components/ui/button";
import { formatHiredAtLabel, formatTenure } from "@/lib/format-tenure";
import { formatContactPersonName } from "@/lib/contact-person";
import { useT } from "@/lib/i18n/use-t";
import { formatPhoneForDisplay } from "@/lib/phone";

export type VendorPortalUserSummary = {
  id: string;
  username: string;
  active: boolean;
};

export type VendorRow = {
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
  vendorSince: Date | string;
  paymentTermsDays?: number | null;
  active: boolean;
  users: VendorPortalUserSummary[];
};

/** True when the vendor has at least one active linked portal user. */
export function vendorHasPortalLogin(vendor: VendorRow) {
  return vendor.users.some((user) => user.active);
}

function formatContactPersonLabel(
  firstName: string | null,
  lastName: string | null,
  position: string | null
): string | null {
  const name = formatContactPersonName(firstName, lastName);
  const trimmedPosition = position?.trim();

  if (name && trimmedPosition) {
    return `${name} · ${trimmedPosition}`;
  }
  return name || trimmedPosition || null;
}

/** One primary contact channel: prefer phone, else email. */
function getPrimaryContact(vendor: VendorRow): string | null {
  const phone =
    formatPhoneForDisplay(vendor.contactPersonPhone) ||
    formatPhoneForDisplay(vendor.phone);
  if (phone) return phone;

  const email =
    vendor.contactPersonEmail?.trim() || vendor.email?.trim() || null;
  return email;
}

type DirectoryView = "active" | "trash" | "all";

type Props = {
  vendors: VendorRow[];
  canManage?: boolean;
  directoryView?: DirectoryView;
  showSelection?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  allVisibleSelected?: boolean;
  someVisibleSelected?: boolean;
  selectableIds?: Set<string>;
};

function VendorRowActions({
  vendor,
  directoryView,
}: {
  vendor: VendorRow;
  directoryView: DirectoryView;
}) {
  const { t } = useT();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const showDelete =
    vendor.active && (directoryView === "active" || directoryView === "all");
  const showTrashActions =
    !vendor.active && (directoryView === "trash" || directoryView === "all");

  if (!showDelete && !showTrashActions) {
    return null;
  }

  return (
    <>
      <div className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap">
        {showTrashActions ? (
          <TrashRestoreChip
            onClick={(event) => {
              event.stopPropagation();
              setRestoreOpen(true);
            }}
          />
        ) : null}

        {showDelete ? (
          <Button
            type="button"
            size="badge"
            variant="destructiveBadge"
            onClick={(event) => {
              event.stopPropagation();
              setDeleteOpen(true);
            }}
          >
            {t("common.actions.delete")}
          </Button>
        ) : null}

        {showTrashActions ? (
          <TrashPermanentDeleteChip
            onClick={(event) => {
              event.stopPropagation();
              setPermanentDeleteOpen(true);
            }}
          />
        ) : null}
      </div>

      {showDelete ? (
        <VendorDeleteDialog
          vendor={vendor}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          showTrigger={false}
        />
      ) : null}

      {showTrashActions ? (
        <VendorReactivateDialog
          vendor={vendor}
          open={restoreOpen}
          onOpenChange={setRestoreOpen}
          showTrigger={false}
        />
      ) : null}

      {showTrashActions ? (
        <VendorPermanentDeleteDialog
          vendor={vendor}
          open={permanentDeleteOpen}
          onOpenChange={setPermanentDeleteOpen}
          showTrigger={false}
        />
      ) : null}
    </>
  );
}

export default function VendorTable({
  vendors,
  canManage = false,
  directoryView = "active",
  showSelection = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allVisibleSelected = false,
  someVisibleSelected = false,
  selectableIds,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editVendor, setEditVendor] = useState<VendorRow | null>(null);

  function handleReorder(orderedIds: string[]) {
    if (!canManage) return;
    startTransition(async () => {
      try {
        await reorderVendors(orderedIds);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to reorder vendors."
        );
        router.refresh();
      }
    });
  }

  const columns = useMemo(() => {
    const cols: DataTableColumn<VendorRow>[] = [];

    if (showSelection) {
      cols.push(
        createSelectionColumn<VendorRow>({
          ariaLabelAll: "Select all vendors",
          getRowAriaLabel: (vendor) => `Select ${vendor.name}`,
          getRowId: (vendor) => vendor.id,
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
        title: t("pages.vendors.columns.vendor"),
        width: "16rem",
        share: 2.25,
        className: "min-w-[16rem]",
        render: (vendor) => (
          <div className="min-w-0 text-left">
            <p className="font-semibold text-text">{vendor.name}</p>
            {vendor.address?.trim() ? (
              <p className="mt-0.5 max-w-xs truncate text-sm text-subtle">
                {vendor.address.trim()}
              </p>
            ) : null}
          </div>
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
        share: 1.25,
        className: "min-w-[14rem]",
        render: (vendor) => {
          const contactPersonLabel = formatContactPersonLabel(
            vendor.contactPersonFirstName,
            vendor.contactPersonLastName,
            vendor.contactPersonPosition
          );
          const primaryContact = getPrimaryContact(vendor);

          if (!contactPersonLabel && !primaryContact) {
            return <span className="text-subtle">—</span>;
          }

          return (
            <div className="min-w-0">
              {contactPersonLabel ? (
                <p className="text-text">{contactPersonLabel}</p>
              ) : null}
              {primaryContact ? (
                <p className="mt-0.5 text-sm text-subtle">{primaryContact}</p>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "vendorSince",
        title: t("pages.vendors.columns.vendorSince"),
        render: (vendor) => {
          const dateLabel = formatHiredAtLabel(vendor.vendorSince);
          const tenure = formatTenure(vendor.vendorSince);

          if (!dateLabel) {
            return <span className="text-subtle">—</span>;
          }

          return (
            <div className="min-w-0">
              <p className="text-sm text-muted">{dateLabel}</p>
              {tenure ? (
                <p className="mt-0.5 text-xs text-subtle">{tenure}</p>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "paymentTerms",
        title: t("pages.vendors.columns.paymentTerms"),
        width: "12rem",
        share: 0.75,
        className: "min-w-[12rem] whitespace-nowrap",
        render: (vendor) => (
          <span className="tabular-nums text-muted">
            {vendor.paymentTermsDays == null
              ? "—"
              : vendor.paymentTermsDays === 0
                ? t("common.paymentTerms.cashShort")
                : t("common.paymentTerms.netShort", {
                    days: vendor.paymentTermsDays,
                  })}
          </span>
        ),
      },
      {
        key: "portalLogin",
        title: t("pages.vendors.columns.portalLogin"),
        width: STATUS_COLUMN_WIDTH,
        className:
          "min-w-[10rem] overflow-visible whitespace-nowrap text-center",
        render: (vendor) => {
          const hasPortalLogin = vendorHasPortalLogin(vendor);
          return (
            <StatusBadge
              status={hasPortalLogin ? "active" : "danger"}
              compact
            >
              {hasPortalLogin ? t("common.actions.yes") : t("common.actions.no")}
            </StatusBadge>
          );
        },
      }
    );

    if (canManage) {
      const isTrashActions =
        directoryView === "trash" || directoryView === "all";
      cols.push({
        key: "actions",
        title: t("pages.vendors.columns.actions"),
        width: isTrashActions
          ? TRASH_ACTIONS_COLUMN_WIDTH
          : ACTIONS_SINGLE_CHIP_COLUMN_WIDTH,
        align: "center",
        className: isTrashActions
          ? "min-w-[22rem] overflow-visible whitespace-nowrap"
          : "min-w-[12.5rem] overflow-visible whitespace-nowrap",
        render: (vendor) => (
          <VendorRowActions vendor={vendor} directoryView={directoryView} />
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
    directoryView,
    t,
  ]);

  if (vendors.length === 0) {
    return null;
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={vendors}
        getRowKey={(vendor) => vendor.id}
        onRowClick={canManage ? setEditVendor : undefined}
        isRowSelected={(vendor) => selectedIds?.has(vendor.id) ?? false}
        reorderable={canManage}
        onReorder={canManage ? handleReorder : undefined}
        emptyMessage={t("pages.vendors.emptyActiveListDesc")}
      />

      {canManage && editVendor ? (
        <VendorEditDialog
          key={editVendor.id}
          vendor={editVendor}
          showDelete={
            editVendor.active &&
            (directoryView === "active" || directoryView === "all")
          }
          open
          onOpenChange={(open) => {
            if (!open) setEditVendor(null);
          }}
          showTrigger={false}
        />
      ) : null}
    </>
  );
}
