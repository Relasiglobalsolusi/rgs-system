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

export default function UserBulkDeactivateDialog({
  open,
  onOpenChange,
  selectedCount,
  selectedIds,
}: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();

  function formatBulkResultMessage(
    result: Awaited<ReturnType<typeof bulkDeactivateUsers>>
  ) {
    if (result.failureCount === 0) {
      return t("pages.users.bulkDeactivateSuccess", {
        count: result.successCount,
      });
    }

    if (result.successCount === 0) {
      return t("pages.users.bulkDeactivateNone", {
        error: result.errors[0] ?? t("pages.users.tryAgain"),
      });
    }

    return t("pages.users.bulkDeactivatePartial", {
      success: result.successCount,
      failed: result.failureCount,
    });
  }

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
              {t("pages.users.bulkDeactivateOwnSkipped")}
            </p>
          </div>

          <p className="mt-4 text-sm leading-6 text-subtle">
            {t("pages.users.bulkDeactivateTrashHint")}
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
