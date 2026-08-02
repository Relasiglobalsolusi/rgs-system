"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

import {
  deactivateClient,
  fetchClientSoftDeleteBlockers,
} from "@/app/clients/actions";
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
  client: {
    id: string;
    name: string;
    _count: { projects: number; users: number };
  };
  onDeleted?: () => void;
} & DirectoryDialogControlProps;

export default function ClientDeleteDialog({
  client,
  onDeleted,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [pending, startTransition] = useTransition();
  const [blockers, setBlockers] = useState<string[]>([]);
  const [blockersFailed, setBlockersFailed] = useState(false);
  const [loadingBlockers, setLoadingBlockers] = useState(false);

  useEffect(() => {
    if (!open) {
      setBlockers([]);
      setBlockersFailed(false);
      setLoadingBlockers(false);
      return;
    }

    let cancelled = false;
    setLoadingBlockers(true);
    setBlockersFailed(false);
    void fetchClientSoftDeleteBlockers(client.id)
      .then((next) => {
        if (!cancelled) {
          setBlockers(next);
          setBlockersFailed(false);
        }
      })
      .catch(() => {
        // Fail closed — do not enable Delete when the check could not run.
        if (!cancelled) {
          setBlockers([]);
          setBlockersFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBlockers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, client.id]);

  function handleDelete() {
    if (blockersFailed || blockers.length > 0) return;
    startTransition(async () => {
      try {
        await deactivateClient(client.id);
        onDeleted?.();
        setOpen(false);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.clients.deleteFailed"));
      }
    });
  }

  const isBlocked = blockersFailed || blockers.length > 0;

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
        icon={Building2}
        title={t("pages.clients.deleteTitle")}
        description={t("pages.clients.deleteDescription")}
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
                : t("pages.clients.deleteConfirm")}
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
            <p className="text-sm font-medium text-text">{client.name}</p>
            <p className="mt-1 text-sm text-muted">
              {t("pages.clients.projectCount", {
                count: client._count.projects,
              })}
              {client._count.users > 0
                ? ` · ${t("pages.clients.portalUserCount", {
                    count: client._count.users,
                  })}`
                : ""}
            </p>
          </div>

          {loadingBlockers ? (
            <p className="mt-4 text-sm leading-6 text-muted">
              {t("pages.clients.checkingSoftDelete")}
            </p>
          ) : blockersFailed ? (
            <div className="mt-4 rounded-xl border border-amber-500/25 bg-card-tint-amber px-4 py-3">
              <p className="text-sm font-medium text-text">
                {t("pages.clients.softDeleteBlockedTitle")}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                {t("pages.clients.softDeleteCheckFailed")}
              </p>
            </div>
          ) : isBlocked ? (
            <div className="mt-4 rounded-xl border border-amber-500/25 bg-card-tint-amber px-4 py-3">
              <p className="text-sm font-medium text-text">
                {t("pages.clients.softDeleteBlockedTitle")}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted">
              {t("pages.clients.deleteSoftNote")}
            </p>
          )}
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
