"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { Building2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  bulkDeactivateClients,
  bulkDeleteClients,
} from "@/app/clients/actions";
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
  mode: "deactivate" | "archive";
  selectedIds: string[];
};

function formatBulkResultMessage(
  actionLabel: string,
  result: Awaited<ReturnType<typeof bulkDeactivateClients>>
) {
  if (result.failureCount === 0) {
    return `${result.successCount} client${result.successCount !== 1 ? "s" : ""} ${actionLabel}.`;
  }

  if (result.successCount === 0) {
    return `Could not ${actionLabel} selected clients. ${result.errors[0] ?? "Please try again."}`;
  }

  return `${result.successCount} client${result.successCount !== 1 ? "s" : ""} ${actionLabel}. ${result.failureCount} failed.`;
}

export default function ClientBulkActionDialog({
  open,
  onOpenChange,
  selectedCount,
  mode,
  selectedIds,
}: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result =
          mode === "deactivate"
            ? await bulkDeactivateClients(selectedIds)
            : await bulkDeleteClients(selectedIds);

        const actionPastTense =
          mode === "deactivate"
            ? "moved to Deleted clients"
            : "permanently removed";

        if (result.failureCount === 0) {
          toast.success(formatBulkResultMessage(actionPastTense, result));
        } else if (result.successCount === 0) {
          showRejection({ reasons: formatBulkResultMessage(actionPastTense, result) });
        } else {
          toast.warning(formatBulkResultMessage(actionPastTense, result));
        }

        onOpenChange(false);
      } catch (error) {
        showRejectionFromError(error, t("common.errors.bulkFailed"));
      }
    });
  }

  const isSoftDelete = mode === "deactivate";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={isSoftDelete ? Building2 : Trash2}
        title={
          isSoftDelete
            ? t("pages.clients.bulkDeleteTitle", { count: selectedCount })
            : t("pages.clients.bulkDeleteForeverTitle", {
                count: selectedCount,
              })
        }
        description={
          isSoftDelete
            ? t("pages.clients.deleteDescription")
            : t("pages.clients.deleteForeverDescription")
        }
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
                : isSoftDelete
                  ? t("pages.clients.bulkDeleteConfirm", {
                      count: selectedCount,
                    })
                  : t("pages.clients.bulkDeleteForeverConfirm", {
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
              This action applies to all selected rows in the current view.
            </p>
          </div>

          <p className="mt-4 text-sm leading-6 text-muted">
            {isSoftDelete
              ? "Linked portal logins are disabled (not permanently deleted) and move to Deleted users. Credentials are kept. After restoring clients, use Users → Revoked Access → Restore Access to re-enable portal login. Projects stay assigned to these clients."
              : "Linked portal logins are permanently deleted and cannot be restored. Linked projects are kept but unassigned. This action cannot be undone."}
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
