"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { bulkDeactivateUsers } from "@/app/users/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  selectedIds: string[];
};

function formatBulkResultMessage(
  result: Awaited<ReturnType<typeof bulkDeactivateUsers>>
) {
  if (result.failureCount === 0) {
    return `${result.successCount} user account${result.successCount !== 1 ? "s" : ""} moved to Deleted users.`;
  }

  if (result.successCount === 0) {
    return `Could not delete selected users. ${result.errors[0] ?? "Please try again."}`;
  }

  return `${result.successCount} user account${result.successCount !== 1 ? "s" : ""} moved to Deleted users. ${result.failureCount} failed.`;
}

export default function UserBulkDeactivateDialog({
  open,
  onOpenChange,
  selectedCount,
  selectedIds,
}: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await bulkDeactivateUsers(selectedIds);

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
        title={t("pages.users.bulkDeleteTitle", { count: selectedCount })}
        description={t("pages.users.deleteDescription")}
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
                ? t("common.actions.processing")
                : t("pages.users.bulkDeleteConfirm", { count: selectedCount })}
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
            <p className="mt-1 text-sm text-subtle">
              Your own account cannot be deleted and will be skipped.
            </p>
          </div>

          <p className="mt-4 text-sm leading-6 text-subtle">
            Deleted users remain in the system and can be restored from the
            Deleted users tab.
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
