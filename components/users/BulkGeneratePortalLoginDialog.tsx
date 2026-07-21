"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { generateClientPortalLogins } from "@/app/clients/actions";
import { generateEmployeePortalLogins } from "@/app/employees/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import {
  createBulkActionResult,
  type BulkActionResult,
} from "@/lib/bulk-action-result";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientIds: string[];
  employeeIds: string[];
};

function confirmMessageKey(clientCount: number, employeeCount: number) {
  if (clientCount > 0 && employeeCount > 0) {
    return "pages.users.generatePortalConfirmMixed";
  }
  if (clientCount > 0) {
    return "pages.users.generatePortalConfirmClients";
  }
  return "pages.users.generatePortalConfirmEmployees";
}

function mergeResults(...results: BulkActionResult[]): BulkActionResult {
  return results.reduce(
    (acc, result) => ({
      successCount: acc.successCount + result.successCount,
      failureCount: acc.failureCount + result.failureCount,
      errors: [...acc.errors, ...result.errors],
    }),
    createBulkActionResult()
  );
}

function formatBulkResultMessage(
  result: BulkActionResult,
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

export default function BulkGeneratePortalLoginDialog({
  open,
  onOpenChange,
  clientIds,
  employeeIds,
}: Props) {
  const [pending, startTransition] = useTransition();
  const { t } = useT();

  const clientCount = clientIds.length;
  const employeeCount = employeeIds.length;
  const totalCount = clientCount + employeeCount;
  const confirmKey = confirmMessageKey(clientCount, employeeCount);

  function handleConfirm() {
    startTransition(async () => {
      try {
        const clientResult =
          clientCount > 0
            ? await generateClientPortalLogins(clientIds)
            : createBulkActionResult();
        const employeeResult =
          employeeCount > 0
            ? await generateEmployeePortalLogins(employeeIds)
            : createBulkActionResult();

        const result = mergeResults(clientResult, employeeResult);

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
        title={t("pages.users.generatePortalTitle")}
        description={t(confirmKey, { count: totalCount })}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-col">
            <EmployeePrimaryButton
              type="button"
              disabled={pending || totalCount === 0}
              onClick={handleConfirm}
            >
              {pending
                ? t("pages.users.generating")
                : t(
                    totalCount === 1
                      ? "pages.users.generatePortalButtonOne"
                      : "pages.users.generatePortalButton",
                    { count: totalCount }
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
              {t(confirmKey, { count: totalCount })}
            </p>
            <p className="mt-1 text-sm text-muted">
              {t("pages.users.generatePortalTitle")}
            </p>
          </div>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
