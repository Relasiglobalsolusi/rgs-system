"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { bulkReactivateClients } from "@/app/clients/actions";
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
  result: Awaited<ReturnType<typeof bulkReactivateClients>>
) {
  if (result.failureCount === 0) {
    return `${result.successCount} client${result.successCount !== 1 ? "s" : ""} restored. Linked logins stay off until Restore Access.`;
  }

  if (result.successCount === 0) {
    return `Could not restore selected clients. ${result.errors[0] ?? "Please try again."}`;
  }

  return `${result.successCount} client${result.successCount !== 1 ? "s" : ""} restored. Linked logins stay off until Restore Access. ${result.failureCount} failed.`;
}

export default function ClientBulkReactivateDialog({
  open,
  onOpenChange,
  selectedCount,
  selectedIds,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await bulkReactivateClients(selectedIds);

        if (result.failureCount === 0) {
          toast.success(formatBulkResultMessage(result));
        } else if (result.successCount === 0) {
          showRejection({ reasons: formatBulkResultMessage(result) });
        } else {
          toast.warning(formatBulkResultMessage(result));
        }

        onOpenChange(false);
        if (result.successCount > 0) {
          router.refresh();
        }
      } catch (error) {
        showRejectionFromError(error, t("common.errors.bulkFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={RotateCcw}
        title={t("pages.clients.bulkRestoreTitle", { count: selectedCount })}
        description={t("pages.clients.restoreDescription")}
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
                : t("pages.clients.bulkRestoreConfirm", {
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
              {t("pages.clients.bulkSelected", { count: selectedCount })}
            </p>
            <p className="mt-1 text-sm text-muted">
              Username and credentials stay preserved. Restored clients appear
              in the active directory; linked logins move to Revoked Access.
            </p>
          </div>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
