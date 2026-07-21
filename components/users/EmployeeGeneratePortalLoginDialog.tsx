"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { generateEmployeePortalLogins } from "@/app/employees/actions";
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
  result: Awaited<ReturnType<typeof generateEmployeePortalLogins>>,
  t: ReturnType<typeof useT>["t"]
) {
  if (result.failureCount === 0) {
    return t(
      result.successCount === 1
        ? "pages.users.generatePortalButtonOne"
        : "pages.users.generatePortalButton",
      { count: result.successCount }
    );
  }

  if (result.successCount === 0) {
    return result.errors[0] ?? t("pages.users.generateFailed");
  }

  return t("pages.users.generatePortalButton", { count: result.successCount });
}

export default function EmployeeGeneratePortalLoginDialog({
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
        const result = await generateEmployeePortalLogins(selectedIds);

        if (result.failureCount === 0) {
          toast.success(formatBulkResultMessage(result, t));
        } else if (result.successCount === 0) {
          showRejection({ reasons: formatBulkResultMessage(result, t) });
        } else {
          toast.warning(formatBulkResultMessage(result, t));
        }

        onOpenChange(false);
      } catch (error) {
        showRejectionFromError(error, t("pages.users.generateFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={KeyRound}
        title={t("pages.users.generateEmployeeTitle")}
        description={t("pages.users.generateEmployeeDescription")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-col">
            <EmployeePrimaryButton
              type="button"
              disabled={pending || selectedCount === 0}
              onClick={handleConfirm}
            >
              {pending
                ? t("pages.users.generating")
                : t(
                    selectedCount === 1
                      ? "pages.users.generatePortalButtonOne"
                      : "pages.users.generatePortalButton",
                    { count: selectedCount }
                  )}
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
              {t("common.labels.selectedCount", { count: selectedCount })}
            </p>
            <p className="mt-1 text-sm text-muted">
              {t("pages.users.generateEmployeeDescription")}
            </p>
          </div>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
