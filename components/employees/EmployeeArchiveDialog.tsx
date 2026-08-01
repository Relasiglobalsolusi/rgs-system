"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";

import { archiveEmployeeFromDirectory } from "@/app/employees/actions";
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

export default function EmployeeArchiveDialog({
  employee,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [pending, startTransition] = useTransition();

  async function handleArchive() {
    startTransition(async () => {
      try {
        await archiveEmployeeFromDirectory(employee.id);
        setOpen(false);
      } catch (error) {
        showRejectionFromError(error, t("pages.employees.deleteForeverFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="destructiveBadge" size="badge">
            {t("pages.employees.deleteForeverConfirm")}
          </Button>
        </DialogTrigger>
      ) : null}

      <EmployeeDialogShell
        icon={Trash2}
        title={t("pages.employees.deleteForeverTitle")}
        description={t("pages.employees.deleteForeverDescription")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-col">
            <EmployeePrimaryButton
              type="button"
              variant="danger"
              disabled={pending}
              onClick={handleArchive}
            >
              {pending
                ? t("common.actions.deleting")
                : t("pages.employees.deleteForeverConfirm")}
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
            {t("pages.employees.bulkDeleteForeverNote")}
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
