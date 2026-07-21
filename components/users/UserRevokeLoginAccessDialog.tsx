"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { revokeUserLoginAccess } from "@/app/users/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
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
  linkedLabel: string;
  disabled?: boolean;
  disabledReason?: string;
  onRevoked?: () => void;
} & DirectoryDialogControlProps;

export default function UserRevokeLoginAccessDialog({
  user,
  linkedLabel,
  disabled = false,
  disabledReason,
  onRevoked,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [pending, startTransition] = useTransition();
  const { t } = useT();

  function handleRevoke() {
    if (disabled) return;

    startTransition(async () => {
      try {
        await revokeUserLoginAccess(user.id);
        toast.success(
          t("pages.users.accessRevokedFor", { name: user.name })
        );
        onRevoked?.();
        setOpen(false);
      } catch (error) {
        showRejectionFromError(error, t("pages.users.revokeFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <EmployeeDialogShell
        icon={KeyRound}
        title={t("pages.users.revokeAccessTitle")}
        description={t("pages.users.revokeAccessDescription")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-col">
            <EmployeePrimaryButton
              type="button"
              variant="danger"
              disabled={pending || disabled}
              title={disabledReason}
              onClick={handleRevoke}
            >
              {pending
                ? t("pages.users.revoking")
                : t("pages.users.revokeAccessConfirm")}
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
            <p className="mt-2 text-sm text-muted">{linkedLabel}</p>
          </div>

          <p className="mt-4 text-sm leading-6 text-subtle">
            {t("pages.users.revokeAccessDescription")}
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
