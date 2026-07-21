"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

import { reactivateClient } from "@/app/clients/actions";
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
  };
} & DirectoryDialogControlProps;

export default function ClientReactivateDialog({
  client,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [pending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      try {
        await reactivateClient(client.id);
        setOpen(false);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, "Failed to restore client.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="successBadge" size="badge">
            {t("common.actions.restore")}
          </Button>
        </DialogTrigger>
      ) : null}

      <EmployeeDialogShell
        icon={Building2}
        title={t("pages.clients.restoreTitle")}
        description={t("pages.clients.restoreDescription")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-col">
            <EmployeePrimaryButton
              type="button"
              disabled={pending}
              onClick={handleRestore}
            >
              {pending
                ? t("common.actions.processing")
                : t("pages.clients.restoreConfirm")}
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
          </div>

          <p className="mt-4 text-sm leading-6 text-muted">
            Username and credentials stay preserved. After restore, linked
            logins appear under Revoked Access until you restore access. The
            client will appear in the active directory again. Clients deleted
            forever cannot be restored.
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
