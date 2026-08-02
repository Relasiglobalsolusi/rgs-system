"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useMemo, useTransition } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteUserPermanently } from "@/app/users/actions";
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
import { formatEmployeeName } from "@/lib/employee-user-link";
import { useT } from "@/lib/i18n/use-t";

type LinkedEmployee = {
  employeeNo: string;
  firstName: string;
  lastName: string;
  status: string;
};

type Props = {
  user: {
    id: string;
    name: string;
    username: string;
  };
  linkedEmployee?: LinkedEmployee | null;
} & DirectoryDialogControlProps;

const ACTIVE_EMPLOYEE_STATUSES = new Set(["ACTIVE", "ON_LEAVE", "LEAVE_PENDING"]);

export default function UserDeleteDialog({
  user,
  linkedEmployee,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [pending, startTransition] = useTransition();

  const linkedEmployeeNotice = useMemo(() => {
    if (!linkedEmployee) return null;
    const employeeLabel = `${formatEmployeeName(linkedEmployee)} (${linkedEmployee.employeeNo})`;
    const isActive = ACTIVE_EMPLOYEE_STATUSES.has(linkedEmployee.status);

    if (isActive) {
      return {
        tone: "warning" as const,
        message: t("pages.users.deleteForeverActiveEmployee", {
          label: employeeLabel,
        }),
      };
    }

    return {
      tone: "info" as const,
      message: t("pages.users.deleteForeverInactiveEmployee", {
        label: employeeLabel,
        status: linkedEmployee.status.toLowerCase().replace("_", " "),
      }),
    };
  }, [linkedEmployee, t]);

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteUserPermanently(user.id);
        toast.success(
          t("pages.users.permanentlyDeletedToast", { name: user.name })
        );
        setOpen(false);
      } catch (error) {
        showRejectionFromError(error, t("pages.users.errors.deleteFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="destructiveBadge" size="badge">
            {t("pages.users.deleteForeverConfirm")}
          </Button>
        </DialogTrigger>
      ) : null}

      <EmployeeDialogShell
        icon={Trash2}
        title={t("pages.users.deleteForeverTitle")}
        description={t("pages.users.deleteForeverDescription")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-col">
            <EmployeePrimaryButton
              type="button"
              variant="danger"
              disabled={pending}
              onClick={handleDelete}
            >
              {pending
                ? t("common.actions.deleting")
                : t("pages.users.deleteForeverConfirm")}
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
            <p className="text-sm font-medium text-text">{user.name}</p>
            <p className="mt-1 text-sm text-muted">{user.username}</p>
          </div>

          {linkedEmployeeNotice ? (
            <div
              className={`mt-4 flex gap-3 rounded-xl border px-4 py-3 ${
                linkedEmployeeNotice.tone === "warning"
                  ? "border-amber-500/25 bg-card-tint-amber"
                  : "border-accent-blue/25 bg-card-tint-sky"
              }`}
            >
              <AlertTriangle
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  linkedEmployeeNotice.tone === "warning"
                    ? "text-warning"
                    : "text-accent-blue"
                }`}
              />
              <p className="text-sm leading-6 text-text">
                {linkedEmployeeNotice.message}
              </p>
            </div>
          ) : null}

          <p className="mt-4 text-sm leading-6 text-muted">
            {t("pages.users.deleteForeverBody")}
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
