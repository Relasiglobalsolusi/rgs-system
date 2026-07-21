"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteProject } from "@/app/projects/actions";
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
import { PROJECT_LIST_VIEW_PATHS } from "@/lib/project-status";

export type ProjectDeleteContext = "active" | "payment-due" | "completed";

function listHrefForDeleteContext(context: ProjectDeleteContext): string {
  switch (context) {
    case "completed":
      return PROJECT_LIST_VIEW_PATHS.completed;
    case "payment-due":
      return PROJECT_LIST_VIEW_PATHS.paymentDue;
    default:
      return PROJECT_LIST_VIEW_PATHS.all;
  }
}

type Props = {
  context: ProjectDeleteContext;
  project: {
    id: string;
    name: string;
    clientName?: string | null;
    invoiceCount: number;
    reportCount: number;
  };
  /** Where to go after a successful delete (defaults from `context`). */
  redirectHref?: string;
} & DirectoryDialogControlProps;

export default function ProjectDeleteDialog({
  context,
  project,
  redirectHref,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [pending, startTransition] = useTransition();

  const title =
    context === "completed"
      ? t("pages.projects.deleteFromCompleted")
      : t("pages.projects.deleteProject");
  const description =
    context === "completed"
      ? t("pages.projects.deleteFromCompletedDescription")
      : context === "payment-due"
        ? t("pages.projects.deleteProjectPaymentDueDescription")
        : t("pages.projects.deleteProjectDescription");
  const confirmLabel =
    context === "completed"
      ? t("pages.projects.deleteFromCompletedConfirm")
      : t("pages.projects.deleteProjectConfirm");

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteProject(project.id);
        toast.success(
          context === "completed"
            ? t("pages.projects.deletedFromCompletedSuccess", {
                name: project.name,
              })
            : t("pages.projects.deletedSuccess", { name: project.name })
        );
        setOpen(false);
        router.push(redirectHref ?? listHrefForDeleteContext(context));
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("common.errors.generic"));
      }
    });
  }

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
        icon={Trash2}
        title={title}
        description={description}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-col">
            <EmployeePrimaryButton
              type="button"
              variant="danger"
              disabled={pending}
              onClick={handleDelete}
            >
              {pending ? t("common.actions.deleting") : confirmLabel}
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
            <p className="text-sm font-medium text-text">{project.name}</p>
            {project.clientName ? (
              <p className="mt-1 text-sm text-subtle">{project.clientName}</p>
            ) : null}
            <p className="mt-1 text-sm text-subtle">
              {project.invoiceCount} invoices · {project.reportCount} reports
            </p>
          </div>

          <div className="mt-4 flex gap-3 rounded-xl border border-amber-500/25 bg-card-tint-amber px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-sm leading-6 text-muted">
              {t("common.confirm.cannotUndo")}
            </p>
          </div>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
