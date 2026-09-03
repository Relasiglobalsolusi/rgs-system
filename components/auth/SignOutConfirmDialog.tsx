"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

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
  /** Where to send the user after they sign out. */
  callbackUrl?: string;
};

export default function SignOutConfirmDialog({
  open,
  onOpenChange,
  callbackUrl = "/login",
}: Props) {
  const { t } = useT();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      // Avoid relying on NextAuth redirect behavior; if redirect doesn't happen,
      // we must still allow the UI to recover from the "Processing..." state.
      await signOut({ callbackUrl, redirect: false });
      window.location.href = callbackUrl;
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      skipUnsavedGuard
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <EmployeeDialogShell
        icon={LogOut}
        title={t("header.signOut")}
        description={t("header.signOutConfirm")}
        maxWidth="sm"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
            <EmployeePrimaryButton
              type="button"
              variant="danger"
              disabled={pending}
              onClick={() => {
                void handleSignOut();
              }}
            >
              {pending
                ? t("common.actions.processing")
                : t("header.signOut")}
            </EmployeePrimaryButton>
          </div>
        }
      >
        <div />
      </EmployeeDialogShell>
    </Dialog>
  );
}
