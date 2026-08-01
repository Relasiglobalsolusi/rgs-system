"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { bulkReactivateVendors } from "@/app/vendors/actions";
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

export default function VendorBulkReactivateDialog({
  open,
  onOpenChange,
  selectedCount,
  selectedIds,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function formatBulkResultMessage(
    result: Awaited<ReturnType<typeof bulkReactivateVendors>>
  ) {
    if (result.failureCount === 0) {
      return t("pages.vendors.bulkRestoreSuccess", {
        count: result.successCount,
      });
    }

    if (result.successCount === 0) {
      return t("pages.vendors.bulkRestoreAllFailed", {
        detail: result.errors[0] ?? t("common.errors.tryAgain"),
      });
    }

    return t("pages.vendors.bulkRestorePartial", {
      success: result.successCount,
      failed: result.failureCount,
    });
  }

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await bulkReactivateVendors(selectedIds);

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
        title={t("pages.vendors.bulkRestoreTitle", { count: selectedCount })}
        description={t("pages.vendors.restoreDescription")}
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
                : t("pages.vendors.bulkRestoreConfirm", {
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
              {t("pages.vendors.bulkRestoreNote")}
            </p>
          </div>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
