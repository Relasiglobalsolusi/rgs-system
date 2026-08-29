"use client";

import { useMemo, useState } from "react";

import ClientDeleteDialog from "@/components/clients/ClientDeleteDialog";
import ClientEditDialog from "@/components/clients/ClientEditDialog";
import ClientPermanentDeleteDialog from "@/components/clients/ClientPermanentDeleteDialog";
import ClientReactivateDialog from "@/components/clients/ClientReactivateDialog";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { createSelectionColumn } from "@/components/ui/data-table-selection";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  ACTIONS_SINGLE_CHIP_COLUMN_WIDTH,
  STATUS_COLUMN_WIDTH,
  TrashPermanentDeleteChip,
  TrashRestoreChip,
} from "@/components/ui/trash-action-buttons";
import { Button } from "@/components/ui/button";
import { formatHiredAtLabel, formatTenure } from "@/lib/format-tenure";
import { formatContactPersonName } from "@/lib/contact-person";
import { localizeJobTitle } from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/locale";
import { useT } from "@/lib/i18n/use-t";
import { formatPhoneForDisplay } from "@/lib/phone";

export type ClientPortalUserSummary = {
  id: string;
  username: string;
  active: boolean;
};

export type ClientRow = {
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
  clientType?: "COMPANY" | "INDIVIDUAL";
  clientSince: Date | string;
  paymentTermsDays?: number | null;
  active: boolean;
  _count: { projects: number; users: number };
  users: ClientPortalUserSummary[];
};

/** Portal Login column: Yes (active), Revoked (linked but inactive), No (never provisioned). */
type ClientPortalLoginStatus = "yes" | "revoked" | "no";

function getClientPortalLoginStatus(
  client: Pick<ClientRow, "users">
): ClientPortalLoginStatus {
  if (client.users.length === 0) return "no";
  if (client.users.some((user) => user.active)) return "yes";
  return "revoked";
}

function formatContactPersonLabel(
  firstName: string | null,
  lastName: string | null,
  position: string | null,
  locale: AppLocale
): string | null {
  const name = formatContactPersonName(firstName, lastName);
  const trimmedPosition = localizeJobTitle(position, locale);

  if (name && trimmedPosition) {
    return `${name} · ${trimmedPosition}`;
  }
  return name || trimmedPosition || null;
}

/** One primary contact channel: prefer phone, else email. */
function getPrimaryContact(client: ClientRow): string | null {
  const phone =
    formatPhoneForDisplay(client.contactPersonPhone) ||
    formatPhoneForDisplay(client.phone);
  if (phone) return phone;

  const email =
    client.contactPersonEmail?.trim() || client.email?.trim() || null;
  return email;
}

type DirectoryView = "active" | "trash" | "all";

type Props = {
  clients: ClientRow[];
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

function ClientRowActions({
  client,
  directoryView,
}: {
  client: ClientRow;
  directoryView: DirectoryView;
}) {
  const { t, locale } = useT();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const showDelete =
    client.active && (directoryView === "active" || directoryView === "all");
  const showTrashActions =
    !client.active && (directoryView === "trash" || directoryView === "all");

  if (!showDelete && !showTrashActions) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-2">
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
        <ClientDeleteDialog
          client={client}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          showTrigger={false}
        />
      ) : null}

      {showTrashActions ? (
        <ClientReactivateDialog
          client={client}
          open={restoreOpen}
          onOpenChange={setRestoreOpen}
          showTrigger={false}
        />
      ) : null}

      {showTrashActions ? (
        <ClientPermanentDeleteDialog
          client={client}
          open={permanentDeleteOpen}
          onOpenChange={setPermanentDeleteOpen}
          showTrigger={false}
        />
      ) : null}
    </>
  );
}

export default function ClientTable({
  clients,
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
  const { t, locale } = useT();
  const [editClient, setEditClient] = useState<ClientRow | null>(null);

  const columns = useMemo(() => {
    const cols: DataTableColumn<ClientRow>[] = [];

    if (showSelection) {
      cols.push(
        createSelectionColumn<ClientRow>({
          ariaLabelAll: t("pages.clients.selectAll"),
          getRowAriaLabel: (client) =>
            t("pages.clients.selectRow", { name: client.name }),
          getRowId: (client) => client.id,
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
        title: t("pages.clients.columns.client"),
        width: "16rem",
        share: 2.25,
        className: "min-w-[16rem]",
        render: (client) => (
          <div className="min-w-0 text-left">
            <p className="font-semibold text-text">{client.name}</p>
            {client.address?.trim() ? (
              <p className="mt-0.5 max-w-xs truncate text-sm text-subtle">
                {client.address.trim()}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        key: "shortCode",
        title: t("pages.clients.columns.shortCode"),
        className: "max-xl:min-w-[7.5rem] max-xl:px-2",
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
        share: 1.25,
        className: "min-w-[14rem] max-xl:min-w-[11rem] max-xl:px-2",
        render: (client) => {
          const isIndividual = client.clientType === "INDIVIDUAL";
          const primaryContact = getPrimaryContact(client);

          if (isIndividual) {
            const contactName = formatContactPersonName(
              client.contactPersonFirstName,
              client.contactPersonLastName
            );
            const clientName = client.name.trim();
            const showContactName =
              contactName != null &&
              contactName.toLowerCase() !== clientName.toLowerCase();

            if (!showContactName && !primaryContact) {
              return <span className="text-subtle">—</span>;
            }

            return (
              <div className="min-w-0">
                {showContactName ? (
                  <p className="text-text">{contactName}</p>
                ) : null}
                {primaryContact ? (
                  <p
                    className={
                      showContactName
                        ? "mt-0.5 text-sm text-subtle"
                        : "text-text"
                    }
                  >
                    {primaryContact}
                  </p>
                ) : null}
              </div>
            );
          }

          const contactPersonLabel = formatContactPersonLabel(
            client.contactPersonFirstName,
            client.contactPersonLastName,
            client.contactPersonPosition,
            locale
          );

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
        key: "clientSince",
        title: t("pages.clients.columns.clientSince"),
        className: "max-xl:min-w-[8rem] max-xl:px-2",
        render: (client) => {
          const dateLabel = formatHiredAtLabel(client.clientSince);
          const tenure = formatTenure(client.clientSince);

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
        key: "projects",
        title: t("pages.clients.columns.projects"),
        width: "5.5rem",
        share: 0.5,
        className: "min-w-[5.5rem] whitespace-nowrap max-xl:px-2",
        render: (client) => (
          <span className="tabular-nums text-muted">
            {client._count.projects}
          </span>
        ),
      },
      {
        key: "portalLogin",
        title: t("pages.clients.columns.portalLogin"),
        width: STATUS_COLUMN_WIDTH,
        cellAlign: "center",
        className:
          "min-w-[10rem] overflow-visible whitespace-nowrap max-xl:min-w-[9rem] max-xl:px-2",
        render: (client) => {
          const portalStatus = getClientPortalLoginStatus(client);
          const badgeStatus =
            portalStatus === "yes"
              ? "active"
              : portalStatus === "revoked"
                ? "revoked"
                : "danger";
          const label =
            portalStatus === "yes"
              ? t("pages.clients.portalStatus.yes")
              : portalStatus === "revoked"
                ? t("pages.clients.portalStatus.revoked")
                : t("pages.clients.portalStatus.no");
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
        title: t("pages.clients.columns.actions"),
        width: ACTIONS_SINGLE_CHIP_COLUMN_WIDTH,
        cellAlign: "center",
        className: "min-w-[12.5rem] overflow-visible max-xl:px-2",
        render: (client) => (
          <ClientRowActions client={client} directoryView={directoryView} />
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

  if (clients.length === 0) {
    return null;
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={clients}
        getRowKey={(client) => client.id}
        onRowClick={canManage ? setEditClient : undefined}
        isRowSelected={(client) => selectedIds?.has(client.id) ?? false}
        emptyMessage={t("pages.clients.emptyActiveListDesc")}
      />

      {canManage && editClient ? (
        <ClientEditDialog
          key={editClient.id}
          client={editClient}
          showDelete={
            editClient.active &&
            (directoryView === "active" || directoryView === "all")
          }
          open
          onOpenChange={(open) => {
            if (!open) setEditClient(null);
          }}
          showTrigger={false}
        />
      ) : null}
    </>
  );
}
