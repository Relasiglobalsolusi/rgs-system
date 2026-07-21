"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFormClass,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import ProgressDialog from "@/components/progress/ProgressDialog";
import { acknowledgeProgressWarnings } from "@/app/progress/actions";
import { useT } from "@/lib/i18n/use-t";

export type MissingReportWarningItem = {
  projectId: string;
  projectName: string;
  date: string;
  dateLabel: string;
};

type Props = {
  warnings: MissingReportWarningItem[];
};

function warningKey(item: Pick<MissingReportWarningItem, "projectId" | "date">) {
  return `${item.projectId}:${item.date}`;
}

export default function MissingReportsWarning({ warnings }: Props) {
  const { t } = useT();
  const router = useRouter();
  const [manualClosed, setManualClosed] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [ackedLocally, setAckedLocally] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();

  const visible = warnings.filter((w) => !ackedLocally.has(warningKey(w)));
  const open = visible.length > 0 && !manualClosed;

  const acknowledge = useCallback(
    (items: MissingReportWarningItem[]) => {
      if (items.length === 0) return;
      startTransition(async () => {
        await acknowledgeProgressWarnings(
          items.map((item) => ({
            projectId: item.projectId,
            date: item.date,
          }))
        );
        setAckedLocally((prev) => {
          const next = new Set(prev);
          for (const item of items) next.add(warningKey(item));
          return next;
        });
        router.refresh();
      });
    },
    [router]
  );

  if (warnings.length === 0) return null;

  const projectsForUpload = Array.from(
    new Map(
      visible.map((w) => [w.projectId, { id: w.projectId, name: w.projectName }])
    ).values()
  );

  const description = t("pages.progress.missingReportMessage");

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setManualClosed(true);
        }}
      >
        <EmployeeDialogShell
          icon={AlertTriangle}
          title={t("pages.progress.missingReportTitle")}
          description={description}
          maxWidth="md"
          footer={
            <div className="flex w-full flex-col gap-3">
              <EmployeePrimaryButton
                type="button"
                onClick={() => {
                  setManualClosed(true);
                  setSubmitOpen(true);
                }}
              >
                {t("pages.progress.uploadNow")}
              </EmployeePrimaryButton>
              <EmployeeSecondaryButton
                disabled={isPending || visible.length === 0}
                onClick={() => acknowledge(visible)}
              >
                {isPending
                  ? t("common.actions.saving")
                  : t("pages.progress.acknowledgeAll")}
              </EmployeeSecondaryButton>
              <EmployeeSecondaryButton onClick={() => setManualClosed(true)}>
                {t("pages.progress.remindLater")}
              </EmployeeSecondaryButton>
              <Link
                href="/progress"
                className="inline-flex h-11 items-center justify-center rounded-xl px-3 text-sm font-medium text-cyan-400 transition hover:bg-elevated"
              >
                {t("pages.progress.openProgressReports")}
              </Link>
            </div>
          }
        >
          <div className={employeeDialogFormClass}>
            <ul className="space-y-2 rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-muted">
              {visible.map((warning) => (
                <li
                  key={warningKey(warning)}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span>
                    • {warning.projectName}
                    <span className="text-subtle">
                      {" "}
                      {t("pages.progress.noUploadOn", {
                        date: warning.dateLabel,
                      })}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => acknowledge([warning])}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-cyan-400 transition hover:bg-elevated disabled:opacity-50"
                  >
                    {t("pages.progress.acknowledge")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </EmployeeDialogShell>
      </Dialog>

      <ProgressDialog
        projects={projectsForUpload}
        defaultProjectId={projectsForUpload[0]?.id}
        defaultDate={visible[0]?.date}
        hideTrigger
        open={submitOpen}
        onOpenChange={setSubmitOpen}
      />
    </>
  );
}
