"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { reactivateUser } from "@/app/users/actions";
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
  /** "access" = re-enable a revoked login; "deleted" = restore from soft-delete trash. */
  mode?: "access" | "deleted";
} & DirectoryDialogControlProps;

export default function UserRestoreDialog({
  user,
  mode = "deleted",
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [pending, startTransition] = useTransition();
  const isAccessRestore = mode === "access";

  function handleRestore() {
    startTransition(async () => {
      try {
        await reactivateUser(user.id, mode);
        setOpen(false);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, isAccessRestore
              ? "Failed to restore login access."
              : "Failed to restore user account.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button size="badge" variant="successBadge">
            {t("common.actions.restore")}
          </Button>
        </DialogTrigger>
      ) : null}

      <EmployeeDialogShell
        icon={RotateCcw}
        title={
          isAccessRestore
            ? t("pages.users.restoreAccessTitle")
            : t("pages.users.restoreTitle")
        }
        description={
          isAccessRestore
            ? t("pages.users.restoreAccessDescription")
            : t("pages.users.restoreDescription")
        }
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
                : isAccessRestore
                  ? t("pages.users.restoreAccess")
                  : t("pages.users.restoreConfirm")}
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
            {isAccessRestore
              ? "Username and password stay the same. Module permissions are unchanged."
              : "Username and password stay preserved. Linked login stays under Revoked Access until access is restored before the user can sign in again."}
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
