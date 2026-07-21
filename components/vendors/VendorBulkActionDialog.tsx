"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

import {
  bulkDeactivateVendors,
  bulkDeleteVendors,
} from "@/app/vendors/actions";
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
  result: Awaited<ReturnType<typeof bulkDeactivateVendors>>
) {
  if (result.failureCount === 0) {
    return `${result.successCount} vendor${result.successCount !== 1 ? "s" : ""} ${actionLabel}.`;
  }

  if (result.successCount === 0) {
    return `Could not ${actionLabel} selected vendors. ${result.errors[0] ?? "Please try again."}`;
  }

  return `${result.successCount} vendor${result.successCount !== 1 ? "s" : ""} ${actionLabel}. ${result.failureCount} failed.`;
}

export default function VendorBulkActionDialog({
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
            ? await bulkDeactivateVendors(selectedIds)
            : await bulkDeleteVendors(selectedIds);

        const actionPastTense =
          mode === "deactivate"
            ? "moved to Deleted vendors"
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
        icon={isSoftDelete ? Truck : Trash2}
        title={
          isSoftDelete
            ? t("pages.vendors.bulkDeleteTitle", { count: selectedCount })
            : t("pages.vendors.bulkDeleteForeverTitle", {
                count: selectedCount,
              })
        }
        description={
          isSoftDelete
            ? t("pages.vendors.deleteDescription")
            : t("pages.vendors.deleteForeverDescription")
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
                  ? t("pages.vendors.bulkDeleteConfirm", {
                      count: selectedCount,
                    })
                  : t("pages.vendors.bulkDeleteForeverConfirm", {
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
              {t("pages.vendors.bulkSelected", { count: selectedCount })}
            </p>
            <p className="mt-1 text-sm text-muted">
              {t("pages.vendors.bulkActionApplies")}
            </p>
          </div>

          <p className="mt-4 text-sm leading-6 text-muted">
            {isSoftDelete
              ? t("pages.vendors.deleteSoftNote")
              : t("pages.vendors.deleteForeverNote")}
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
