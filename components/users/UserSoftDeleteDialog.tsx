"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";

import { deactivateUser } from "@/app/users/actions";
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
  user: {
    id: string;
    name: string;
    username: string;
  };
  disabled?: boolean;
  disabledReason?: string;
  onDeleted?: () => void;
} & DirectoryDialogControlProps;

export default function UserSoftDeleteDialog({
  user,
  disabled = false,
  disabledReason,
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
        await deactivateUser(user.id);
        onDeleted?.();
        setOpen(false);
      } catch (error) {
        showRejectionFromError(error, "Failed to delete user account.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button
            size="badge"
            variant="destructiveBadge"
            disabled={disabled}
            title={disabledReason}
          >
            {t("common.actions.delete")}
          </Button>
        </DialogTrigger>
      ) : null}

      <EmployeeDialogShell
        icon={Trash2}
        title={t("pages.users.deleteTitle")}
        description={t("pages.users.deleteDescription")}
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
                : t("pages.users.deleteConfirm")}
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
            <p className="text-sm font-medium text-text">{user.name}</p>
            <p className="mt-1 text-sm text-subtle">@{user.username}</p>
          </div>

          <p className="mt-4 text-sm leading-6 text-subtle">
            Credentials stay saved until forever-delete from trash. To disable
            login only while keeping the employee or client Active, use Revoke
            Access. To destroy the login forever and leave them under No Portal
            Login, use Permanently Remove Portal Login Access.
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
