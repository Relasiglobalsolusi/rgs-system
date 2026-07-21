"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

import { reactivateEmployee } from "@/app/employees/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  useDirectoryDialogOpen,
  type DirectoryDialogControlProps,
} from "@/components/ui/use-directory-dialog-open";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNo: string;
  };
} & DirectoryDialogControlProps;

export default function EmployeeReactivateDialog({
  employee,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [pending, startTransition] = useTransition();

  async function handleRestore() {
    startTransition(async () => {
      try {
        await reactivateEmployee(employee.id);
        setOpen(false);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, "Failed to restore employee.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="successBadge" size="badge">
            {t("common.actions.restore")}
          </Button>
        </DialogTrigger>
      ) : null}

      <EmployeeDialogShell
        icon={UserPlus}
        title={t("pages.employees.restoreTitle")}
        description={t("pages.employees.restoreDescription")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-col">
            <EmployeePrimaryButton
              type="button"
              disabled={pending}
              onClick={handleRestore}
            >
              {pending
                ? t("common.actions.processing")
                : t("pages.employees.restoreConfirm")}
            </EmployeePrimaryButton>

            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        <div>
          <div className="rounded-xl border border-border bg-elevated px-4 py-4">
            <p className="text-sm font-medium text-text">
              {employee.firstName} {employee.lastName}
            </p>
            <p className="mt-1 text-sm text-muted">{employee.employeeNo}</p>
          </div>

          <p className="mt-4 text-sm leading-6 text-muted">
            Username and credentials stay preserved. After restore, the linked
            login appears under Revoked Access until you restore access.
            Historical records (attendance, leave, progress) remain intact.
            Employees deleted forever cannot be restored.
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
