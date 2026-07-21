"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { Building2 } from "lucide-react";

import { deactivateClient } from "@/app/clients/actions";
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
  onDeleted?: () => void;
} & DirectoryDialogControlProps;

export default function ClientDeleteDialog({
  client,
  onDeleted,
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
        await deactivateClient(client.id);
        onDeleted?.();
        setOpen(false);
      } catch (error) {
        showRejectionFromError(error, "Failed to delete client.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="destructiveBadge" size="badge">
            {t("common.actions.delete")}
          </Button>
        </DialogTrigger>
      ) : null}

      <EmployeeDialogShell
        icon={Building2}
        title={t("pages.clients.deleteTitle")}
        description={t("pages.clients.deleteDescription")}
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
                : t("pages.clients.deleteConfirm")}
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

          <p className="mt-4 text-sm leading-6 text-muted">
            Linked portal logins are disabled (not permanently deleted) and move
            to Deleted users. Credentials are kept. After you restore this
            client, use Users → Revoked Access → Restore Access to re-enable
            portal login. Projects stay assigned to this client.
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
