"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { bulkPermanentlyRemovePortalLoginAccess } from "@/app/users/actions";
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
  result: Awaited<ReturnType<typeof bulkPermanentlyRemovePortalLoginAccess>>,
  t: ReturnType<typeof useT>["t"]
) {
  if (result.successCount === 0 && result.failureCount === 0) {
    return t("pages.users.noEligiblePermanentlyRemove");
  }

  if (result.successCount === 0) {
    return result.errors[0] ?? t("pages.users.permanentlyRemoveFailed");
  }

  return t("pages.users.bulkPermanentlyRemoveConfirm", {
    count: result.successCount,
  });
}

export default function UserBulkPermanentlyRemovePortalLoginDialog({
  open,
  onOpenChange,
  selectedCount,
  selectedIds,
}: Props) {
  const [pending, startTransition] = useTransition();
  const { t } = useT();

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result =
          await bulkPermanentlyRemovePortalLoginAccess(selectedIds);

        const message = formatBulkResultMessage(result, t);
        if (result.successCount > 0 && result.failureCount === 0) {
          toast.success(message);
        } else if (result.successCount === 0 && result.failureCount > 0) {
          showRejection({ reasons: message });
        } else {
          toast.warning(message);
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
        icon={KeyRound}
        title={t("pages.users.bulkPermanentlyRemoveTitle", {
          count: selectedCount,
        })}
        description={t("pages.users.bulkPermanentlyRemoveDescription")}
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
                ? t("pages.users.permanentlyRemoving")
                : t("pages.users.bulkPermanentlyRemoveConfirm", {
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
              {t("pages.users.bulkPermanentlyRemoveDescription")}
            </p>
          </div>

          <p className="mt-4 text-sm leading-6 text-subtle">
            {t("pages.users.bulkPermanentlyRemoveDescription")}
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
