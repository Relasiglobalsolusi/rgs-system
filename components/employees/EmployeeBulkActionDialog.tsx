"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  bulkArchiveEmployeesFromDirectory,
  bulkDeactivateEmployees,
} from "@/app/employees/actions";
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
  result: Awaited<ReturnType<typeof bulkDeactivateEmployees>>
) {
  if (result.failureCount === 0) {
    return `${result.successCount} employee${result.successCount !== 1 ? "s" : ""} ${actionLabel}.`;
  }

  if (result.successCount === 0) {
    return `Could not ${actionLabel} selected employees. ${result.errors[0] ?? "Please try again."}`;
  }

  return `${result.successCount} employee${result.successCount !== 1 ? "s" : ""} ${actionLabel}. ${result.failureCount} failed.`;
}

export default function EmployeeBulkActionDialog({
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
            ? await bulkDeactivateEmployees(selectedIds)
            : await bulkArchiveEmployeesFromDirectory(selectedIds);

        const actionPastTense =
          mode === "deactivate"
            ? "moved to Deleted Employees"
            : "permanently removed from directory";

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
        icon={Trash2}
        title={
          isSoftDelete
            ? t("pages.employees.bulkDeleteTitle", { count: selectedCount })
            : t("pages.employees.bulkDeleteForeverTitle", {
                count: selectedCount,
              })
        }
        description={
          isSoftDelete
            ? t("pages.employees.deleteDescription")
            : t("pages.employees.deleteForeverDescription")
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
                  ? t("pages.employees.bulkDeleteConfirm", {
                      count: selectedCount,
                    })
                  : t("pages.employees.bulkDeleteForeverConfirm", {
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
              {t("pages.employees.bulkSelected", { count: selectedCount })}
            </p>
            <p className="mt-1 text-sm text-muted">
              This action applies to all selected rows in the current view.
            </p>
          </div>

          <p className="mt-4 text-sm leading-6 text-muted">
            {isSoftDelete
              ? "Linked user logins are disabled (not permanently deleted) and move to Deleted users. Credentials are kept. After restoring employees, use Users → Revoked Access → Restore Access to re-enable portal login. Historical records (attendance, leave, progress) are not deleted."
              : "Linked user logins are permanently deleted and cannot be restored. Employee numbers become available for the next new hires in those departments. Attendance, leave, progress, and other historical records remain in the system. This action cannot be undone from the directory UI."}
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
