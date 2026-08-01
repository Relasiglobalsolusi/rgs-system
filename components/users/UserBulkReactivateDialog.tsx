"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { bulkReactivateUsers } from "@/app/users/actions";
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
  /** "access" = re-enable revoked logins; "deleted" = restore from soft-delete trash. */
  mode?: "access" | "deleted";
};

export default function UserBulkReactivateDialog({
  open,
  onOpenChange,
  selectedCount,
  selectedIds,
  mode = "deleted",
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isAccessRestore = mode === "access";

  function formatBulkResultMessage(
    result: Awaited<ReturnType<typeof bulkReactivateUsers>>
  ) {
    if (result.failureCount === 0) {
      if (isAccessRestore) {
        return t(
          result.successCount === 1
            ? "pages.users.bulkRestoreAccessSuccess"
            : "pages.users.bulkRestoreAccessSuccessOther",
          { count: result.successCount }
        );
      }
      return t(
        result.successCount === 1
          ? "pages.users.bulkRestoreDeletedSuccess"
          : "pages.users.bulkRestoreDeletedSuccessOther",
        { count: result.successCount }
      );
    }

    if (result.successCount === 0) {
      return t("pages.users.bulkRestoreNone", {
        error: result.errors[0] ?? t("pages.users.tryAgain"),
      });
    }

    return t("pages.users.bulkRestorePartial", {
      success: result.successCount,
      failed: result.failureCount,
    });
  }

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await bulkReactivateUsers(selectedIds, mode);

        if (result.failureCount === 0) {
          toast.success(formatBulkResultMessage(result));
        } else if (result.successCount === 0) {
          showRejection({ reasons: formatBulkResultMessage(result) });
        } else {
          toast.warning(formatBulkResultMessage(result));
        }

        onOpenChange(false);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("common.errors.bulkFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={RotateCcw}
        title={
          isAccessRestore
            ? t("pages.users.bulkRestoreAccessTitle", { count: selectedCount })
            : t("pages.users.bulkRestoreTitle", { count: selectedCount })
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
              onClick={handleConfirm}
            >
              {pending
                ? t("common.actions.processing")
                : isAccessRestore
                  ? t("pages.users.bulkRestoreAccessConfirm", {
                      count: selectedCount,
                    })
                  : t("pages.users.bulkRestoreConfirm", {
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
            <p className="mt-1 text-sm text-subtle">
              {isAccessRestore
                ? t("pages.users.bulkRestoreAccessHint")
                : t("pages.users.bulkRestoreDeletedHint")}
            </p>
          </div>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
