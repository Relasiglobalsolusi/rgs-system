"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";

import { reactivateVendor } from "@/app/vendors/actions";
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
  vendor: {
    id: string;
    name: string;
  };
} & DirectoryDialogControlProps;

export default function VendorReactivateDialog({
  vendor,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [pending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      try {
        await reactivateVendor(vendor.id);
        setOpen(false);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, "Failed to restore vendor.");
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
        icon={Truck}
        title={t("pages.vendors.restoreTitle")}
        description={t("pages.vendors.restoreDescription")}
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
                : t("pages.vendors.restoreConfirm")}
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
            <p className="text-sm font-medium text-text">{vendor.name}</p>
          </div>

          <p className="mt-4 text-sm leading-6 text-muted">
            {t("pages.vendors.restoreSoftNote")}
          </p>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
