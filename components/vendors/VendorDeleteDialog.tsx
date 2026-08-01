"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useState, useTransition } from "react";
import { Truck } from "lucide-react";

import {
  deactivateVendor,
  fetchVendorSoftDeleteBlockers,
} from "@/app/vendors/actions";
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
  onDeleted?: () => void;
} & DirectoryDialogControlProps;

export default function VendorDeleteDialog({
  vendor,
  onDeleted,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [pending, startTransition] = useTransition();
  const [blockers, setBlockers] = useState<string[]>([]);
  const [loadingBlockers, setLoadingBlockers] = useState(false);

  useEffect(() => {
    if (!open) {
      setBlockers([]);
      setLoadingBlockers(false);
      return;
    }

    let cancelled = false;
    setLoadingBlockers(true);
    void fetchVendorSoftDeleteBlockers(vendor.id)
      .then((next) => {
        if (!cancelled) setBlockers(next);
      })
      .catch(() => {
        if (!cancelled) setBlockers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBlockers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, vendor.id]);

  function handleDelete() {
    startTransition(async () => {
      try {
        await deactivateVendor(vendor.id);
        onDeleted?.();
        setOpen(false);
      } catch (error) {
        showRejectionFromError(error, t("pages.vendors.deleteFailed"));
      }
    });
  }

  const isBlocked = blockers.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="destructiveBadge" size="badge">
            {t("common.actions.delete")}
          </Button>
        </DialogTrigger>
      ) : null}

      <EmployeeDialogShell
        icon={Truck}
        title={t("pages.vendors.deleteTitle")}
        description={t("pages.vendors.deleteDescription")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-col">
            <EmployeePrimaryButton
              type="button"
              variant="danger"
              disabled={pending || loadingBlockers || isBlocked}
              onClick={handleDelete}
            >
              {pending
                ? t("common.actions.deleting")
                : t("pages.vendors.deleteConfirm")}
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

          {loadingBlockers ? (
            <p className="mt-4 text-sm leading-6 text-muted">
              {t("pages.vendors.checkingSoftDelete")}
            </p>
          ) : isBlocked ? (
            <div className="mt-4 rounded-xl border border-amber-500/25 bg-card-tint-amber px-4 py-3">
              <p className="text-sm font-medium text-text">
                {t("pages.vendors.softDeleteBlockedTitle")}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted">
              {t("pages.vendors.deleteSoftNote")}
            </p>
          )}
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
