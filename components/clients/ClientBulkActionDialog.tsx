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

export default function ClientBulkActionDialog({
  open,
  onOpenChange,
  selectedCount,
  mode,
  selectedIds,
}: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();

  function formatBulkResultMessage(
    result: Awaited<ReturnType<typeof bulkDeactivateClients>>
  ) {
    if (result.failureCount === 0) {
      return mode === "deactivate"
        ? t("pages.clients.bulkDeactivateSuccess", {
            count: result.successCount,
          })
        : t("pages.clients.bulkDeleteForeverSuccess", {
            count: result.successCount,
          });
    }

    if (result.successCount === 0) {
      return mode === "deactivate"
        ? t("pages.clients.bulkDeactivateAllFailed", {
            detail: result.errors[0] ?? t("common.errors.tryAgain"),
          })
        : t("pages.clients.bulkDeleteForeverAllFailed", {
            detail: result.errors[0] ?? t("common.errors.tryAgain"),
          });
    }

    return mode === "deactivate"
      ? t("pages.clients.bulkDeactivatePartial", {
          success: result.successCount,
          failed: result.failureCount,
        })
      : t("pages.clients.bulkDeleteForeverPartial", {
          success: result.successCount,
          failed: result.failureCount,
        });
  }

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result =
          mode === "deactivate"
            ? await bulkDeactivateClients(selectedIds)
            : await bulkDeleteClients(selectedIds);

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
              {t("pages.clients.bulkActionApplies")}
            </p>
          </div>

          <p className="mt-4 text-sm leading-6 text-muted">
            {isSoftDelete
              ? t("pages.clients.deleteSoftNote")
              : t("pages.clients.bulkDeleteForeverNote")}
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
