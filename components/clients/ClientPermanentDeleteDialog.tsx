"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

import { deleteClient } from "@/app/clients/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  useDirectoryDialogOpen,
  type DirectoryDialogControlProps,
} from "@/components/ui/use-directory-dialog-open";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  client: {
    id: string;
    name: string;
    _count: { projects: number; users: number };
  };
} & DirectoryDialogControlProps;

export default function ClientPermanentDeleteDialog({
  client,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteClient(client.id);
        setOpen(false);
      } catch (error) {
        showRejectionFromError(error, "Failed to delete client.");
      }
    });
  }

  const hasLinks = client._count.projects > 0 || client._count.users > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="destructiveBadge" size="badge">
            {t("pages.clients.deleteForeverConfirm")}
          </Button>
        </DialogTrigger>
      ) : null}

      <EmployeeDialogShell
        icon={Trash2}
        title={t("pages.clients.deleteForeverTitle")}
        description={t("pages.clients.deleteForeverDescription")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-col">
            <EmployeePrimaryButton
              type="button"
              variant="danger"
              disabled={pending}
              onClick={handleDelete}
            >
              {pending
                ? t("common.actions.deleting")
                : t("pages.clients.deleteForeverConfirm")}
            </EmployeePrimaryButton>

            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        <div>
          <div className="rounded-xl border border-border bg-elevated px-4 py-4">
            <p className="text-sm font-medium text-text">{client.name}</p>
            <p className="mt-1 text-sm text-muted">
              {client._count.projects} project
              {client._count.projects !== 1 ? "s" : ""}
              {client._count.users > 0
                ? ` · ${client._count.users} portal user${client._count.users !== 1 ? "s" : ""}`
                : ""}
            </p>
          </div>

          {hasLinks ? (
            <div className="mt-4 flex gap-3 rounded-xl border border-amber-500/25 bg-card-tint-amber px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-sm leading-6 text-text">
                {client._count.projects > 0
                  ? `Linked projects (${client._count.projects}) will be kept but unassigned from this client. `
                  : ""}
                {client._count.users > 0
                  ? `Portal login${client._count.users !== 1 ? "s" : ""} (${client._count.users}) will be permanently deleted and cannot be restored.`
                  : ""}
              </p>
            </div>
          ) : null}

          <p className="mt-4 text-sm leading-6 text-muted">
            Only deleted clients can be permanently deleted. Linked portal logins
            are permanently deleted and cannot be restored. Completed projects and
            billing records remain in the system. This action cannot be undone.
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
