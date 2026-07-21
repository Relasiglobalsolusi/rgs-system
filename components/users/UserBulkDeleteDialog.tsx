"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { bulkDeleteUsers } from "@/app/users/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/use-t";

type SelectedUser = {
  id: string;
  name: string;
  username: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUsers: SelectedUser[];
};

function formatBulkResultMessage(
  result: Awaited<ReturnType<typeof bulkDeleteUsers>>
) {
  if (result.failureCount === 0) {
    return `${result.successCount} user account${result.successCount !== 1 ? "s" : ""} permanently deleted.`;
  }

  if (result.successCount === 0) {
    return `Could not delete selected users. ${result.errors[0] ?? "Please try again."}`;
  }

  return `${result.successCount} user account${result.successCount !== 1 ? "s" : ""} permanently deleted. ${result.failureCount} failed.`;
}

export default function UserBulkDeleteDialog({
  open,
  onOpenChange,
  selectedUsers,
}: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const selectedCount = selectedUsers.length;
  const selectedIds = selectedUsers.map((user) => user.id);

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await bulkDeleteUsers(selectedIds);

        if (result.failureCount === 0) {
          toast.success(formatBulkResultMessage(result));
        } else if (result.successCount === 0) {
          showRejection({ reasons: formatBulkResultMessage(result) });
        } else {
          toast.warning(formatBulkResultMessage(result));
        }

        onOpenChange(false);
      } catch (error) {
        showRejectionFromError(error, t("common.errors.bulkFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={Trash2}
        title={t("pages.users.bulkDeleteForeverTitle", {
          count: selectedCount,
        })}
        description={t("pages.users.deleteForeverDescription")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-col">
            <EmployeePrimaryButton
              type="button"
              variant="danger"
              disabled={pending}
              onClick={handleConfirm}
            >
              {pending
                ? t("common.actions.deleting")
                : t("pages.users.bulkDeleteForeverConfirm", {
                    count: selectedCount,
                  })}
            </EmployeePrimaryButton>

            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        <div>
          <div className="rounded-xl border border-border bg-elevated px-4 py-4">
            <p className="text-sm font-medium text-text">
              {t("pages.users.bulkSelected", { count: selectedCount })}
            </p>

            <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
              {selectedUsers.map((user) => (
                <li key={user.id} className="text-sm text-muted">
                  <span className="text-text">{user.name}</span>
                  <span className="text-subtle"> · </span>
                  {user.username}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-4 text-sm leading-6 text-muted">
            Accounts linked to active employees are skipped. Client portal links
            are revoked. Employee records are kept but unlinked from deleted
            logins.
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
