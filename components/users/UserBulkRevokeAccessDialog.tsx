"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { bulkRevokeUserLoginAccess } from "@/app/users/actions";
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
  result: Awaited<ReturnType<typeof bulkRevokeUserLoginAccess>>,
  t: ReturnType<typeof useT>["t"]
) {
  if (result.successCount === 0 && result.failureCount === 0) {
    return t("pages.users.noEligibleRevoke");
  }

  if (result.successCount === 0) {
    return result.errors[0] ?? t("pages.users.revokeFailed");
  }

  return t("pages.users.bulkRevokeConfirm", { count: result.successCount });
}

export default function UserBulkRevokeAccessDialog({
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
        const result = await bulkRevokeUserLoginAccess(selectedIds);

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
        title={t("pages.users.bulkRevokeTitle", { count: selectedCount })}
        description={t("pages.users.bulkRevokeDescription")}
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
                ? t("pages.users.revoking")
                : t("pages.users.bulkRevokeConfirm", { count: selectedCount })}
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
              {t("pages.users.bulkRevokeDescription")}
            </p>
          </div>

          <p className="mt-4 text-sm leading-6 text-subtle">
            {t("pages.users.bulkRevokeDescription")}
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
