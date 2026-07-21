"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useState, useTransition } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { clearProjectHistory } from "@/app/projects/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/use-t";

type HistoryItem = {
  id: string;
  name: string;
  clientName?: string | null;
};

type Props = {
  projects: HistoryItem[];
};

export default function ProjectHistoryClearAllDialog({ projects }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const count = projects.length;
  const ids = projects.map((project) => project.id);

  function handleClear() {
    startTransition(async () => {
      try {
        const result = await clearProjectHistory(ids);
        if (result.deletedCount === 0) {
          toast.message(t("pages.projects.historyClear.noProjects"));
        } else {
          toast.success(
            `Cleared ${result.deletedCount} completed project${result.deletedCount !== 1 ? "s" : ""}.`
          );
        }
        setOpen(false);
      } catch (error) {
        showRejectionFromError(error, "Failed to clear completed projects.");
      }
    });
  }

  if (count === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="destructiveBadge"
          size="badge"
          className="!w-auto !min-w-[7.5rem] !max-w-none px-3"
        >
          {t("pages.projects.clearHistory")}
        </Button>
      </DialogTrigger>

      <EmployeeDialogShell
        icon={Trash2}
        title={t("pages.projects.historyClear.title")}
        description={t("pages.projects.historyClear.description")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-col">
            <EmployeePrimaryButton
              type="button"
              variant="danger"
              disabled={pending}
              onClick={handleClear}
            >
              {pending
                ? t("pages.projects.historyClear.clearing")
                : t("pages.projects.historyClear.confirm")}
            </EmployeePrimaryButton>

            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </EmployeeSecondaryButton>
          </div>
        }
      >
        <div>
          <div className="rounded-xl border border-border bg-elevated px-4 py-4">
            <p className="text-sm font-medium text-text">
              {count} completed project{count !== 1 ? "s" : ""}
            </p>

            <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
              {projects.map((project) => (
                <li key={project.id} className="text-sm text-subtle">
                  <span className="text-muted">{project.name}</span>
                  {project.clientName ? (
                    <>
                      <span className="text-muted"> · </span>
                      {project.clientName}
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex gap-3 rounded-xl border border-amber-500/25 bg-card-tint-amber px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-sm leading-6 text-muted">
              Invoice periods, PDFs, progress reports, photos, and assignments are
              removed. Attendance records are kept but unlinked. Payment Due and
              active projects are not affected.
            </p>
          </div>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
