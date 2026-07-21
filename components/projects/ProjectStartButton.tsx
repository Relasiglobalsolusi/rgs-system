"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Play } from "lucide-react";
import type { ProjectSubCategory } from "@prisma/client";

import {
  moveProjectToPlanning,
  startProject,
} from "@/app/projects/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import ProjectStaffPicker, {
  type ProjectStaffEmployee,
} from "@/components/projects/ProjectStaffPicker";
import ProjectTimelineFields from "@/components/projects/ProjectTimelineFields";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StackedChipLabel } from "@/components/ui/StatusBadge";
import {
  DEFAULT_PROJECT_DURATION_DAYS,
  clampProjectDurationDays,
  daysBetweenDates,
  isContractSubCategory,
  toDateInputValue,
  todayDateInput,
} from "@/lib/project-contract";
import { detailActionBarButtonClassName } from "@/components/projects/detail-action-bar";
import { useT } from "@/lib/i18n/use-t";
import { PROJECT_LIST_VIEW_PATHS } from "@/lib/project-status";
import { cn } from "@/lib/utils";

type ActionButtonSize = "default" | "sm" | "badge" | "bar";

type StartArgs = {
  projectId: string;
  projectName: string;
  subCategory: ProjectSubCategory | string;
  estimatedStartDate?: Date | string | null;
  estimatedDurationDays?: number | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  employees?: ProjectStaffEmployee[];
  assignedEmployeeIds?: string[];
};

function initialDurationDays(args: {
  estimatedStartDate?: Date | string | null;
  estimatedDurationDays?: number | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}): number {
  if (
    args.estimatedDurationDays != null &&
    Number.isFinite(args.estimatedDurationDays)
  ) {
    return clampProjectDurationDays(args.estimatedDurationDays);
  }
  const start =
    args.startDate ?? args.estimatedStartDate ?? null;
  const fromDates = daysBetweenDates(start, args.endDate);
  if (fromDates != null) return clampProjectDurationDays(fromDates);
  return DEFAULT_PROJECT_DURATION_DAYS;
}

/** Opens dialog to collect real dates + staff, then Planning → In Progress. */
export function useProjectStartAction({
  projectId,
  projectName,
  subCategory,
  estimatedStartDate,
  estimatedDurationDays,
  startDate,
  endDate,
  employees = [],
  assignedEmployeeIds = [],
}: StartArgs) {
  const { t } = useT();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const isContract = isContractSubCategory(subCategory);

  const defaultStart =
    toDateInputValue(startDate) ||
    toDateInputValue(estimatedStartDate) ||
    todayDateInput();

  const [realStartDate, setRealStartDate] = useState(defaultStart);
  const [durationDays, setDurationDays] = useState(() =>
    initialDurationDays({
      estimatedStartDate,
      estimatedDurationDays,
      startDate,
      endDate,
    })
  );

  function openDialog() {
    setRealStartDate(
      toDateInputValue(startDate) ||
        toDateInputValue(estimatedStartDate) ||
        todayDateInput()
    );
    setDurationDays(
      initialDurationDays({
        estimatedStartDate,
        estimatedDurationDays,
        startDate,
        endDate,
      })
    );
    setPickerKey((key) => key + 1);
    setOpen(true);
  }

  function validateDates(): boolean {
    if (!realStartDate) {
      showRejection({ reasons: isContract
          ? t("pages.projects.realContractStartRequired")
          : t("pages.projects.realJobStartRequired") });
      return false;
    }
    const proof = formRef.current?.elements.namedItem("contractProof");
    if (
      !(proof instanceof HTMLInputElement) ||
      !proof.files ||
      proof.files.length === 0
    ) {
      showRejection({ reasons: t("pages.projects.contractProofHint") });
      return false;
    }
    return true;
  }

  function submit(assignStaffLater: boolean) {
    if (!validateDates()) return;

    const formData = formRef.current
      ? new FormData(formRef.current)
      : new FormData();
    formData.set("startDate", realStartDate);

    if (assignStaffLater) {
      formData.delete("employeeIds");
      formData.set("assignStaffLater", "true");
    } else {
      formData.delete("assignStaffLater");
      const selectedIds = formData.getAll("employeeIds").map(String);
      // Empty staff is allowed (assign later) — same rule as create / Excel import.
      if (selectedIds.length === 0) {
        formData.delete("employeeIds");
        formData.set("assignStaffLater", "true");
      }
    }

    startTransition(async () => {
      try {
        await startProject(projectId, formData);
        setOpen(false);
        // Leave Planning so the card cannot linger on a stale RSC payload.
        router.push(PROJECT_LIST_VIEW_PATHS.inProgress);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.moveToInProgressFailed"));
      }
    });
  }

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <EmployeeDialogShell
        icon={Play}
        title={t("pages.projects.moveToInProgress")}
        description={
          isContract
            ? t("pages.projects.moveDialogContract", { name: projectName })
            : t("pages.projects.moveDialogJob", { name: projectName })
        }
        maxWidth="lg"
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
            <EmployeePrimaryButton
              type="button"
              variant="muted"
              disabled={pending}
              onClick={() => submit(true)}
            >
              {t("pages.projects.assignStaffLater")}
            </EmployeePrimaryButton>
            <EmployeePrimaryButton
              type="button"
              disabled={pending}
              onClick={() => submit(false)}
            >
              {pending
                ? t("common.actions.moving")
                : t("pages.projects.moveToInProgress")}
            </EmployeePrimaryButton>
          </div>
        }
      >
        <form
          ref={formRef}
          className={employeeDialogFormClass}
          onSubmit={(event) => {
            event.preventDefault();
            submit(false);
          }}
        >
          {estimatedStartDate ? (
            <p className="text-xs text-subtle">
              {t("pages.projects.planningEstimate")}{" "}
              <span className="text-muted">
                {toDateInputValue(estimatedStartDate)}
              </span>
            </p>
          ) : null}

          {isContract ? (
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-muted">
                {t("pages.projects.realContractStart")}
              </label>
              <Input
                type="date"
                name="startDate"
                required
                value={realStartDate}
                onChange={(event) => setRealStartDate(event.target.value)}
                className={employeeInputClass}
              />
            </div>
          ) : (
            <ProjectTimelineFields
              mode="standard"
              startDate={realStartDate}
              durationDays={durationDays}
              onStartDateChange={setRealStartDate}
              onDurationDaysChange={setDurationDays}
            />
          )}

          <div className={employeeDialogFieldClass}>
            <label
              htmlFor={`contract-proof-${projectId}`}
              className="text-sm font-medium text-text"
            >
              {t("pages.projects.contractProof")}
            </label>
            <Input
              id={`contract-proof-${projectId}`}
              type="file"
              name="contractProof"
              accept="image/*,.pdf,application/pdf"
              required
              className={employeeInputClass}
            />
            <p className="text-xs text-subtle">
              {t("pages.projects.contractProofHint")}
            </p>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs text-subtle">
              {t("pages.projects.moveDialogStaffHelp")}
            </p>
            <ProjectStaffPicker
              key={pickerKey}
              employees={employees}
              defaultCheckedIds={assignedEmployeeIds}
            />
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );

  return { pending, openDialog, dialog };
}

type ReturnArgs = {
  projectId: string;
  projectName: string;
};

/** Confirm + move In Progress → Planning (keeps all dates). */
export function useProjectReturnToPlanningAction({
  projectId,
  projectName,
}: ReturnArgs) {
  const { t } = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const onProjectDetail =
    pathname === `/projects/${projectId}` ||
    pathname.startsWith(`/projects/${projectId}/`);

  function moveBackToPlanning() {
    const confirmed = window.confirm(
      t("pages.projects.backToPlanningConfirm", { name: projectName })
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await moveProjectToPlanning(projectId);
        // Stay on In Progress list (refresh removes the row). From detail,
        // return to In Progress — never jump to the Planning directory.
        if (onProjectDetail) {
          router.push(PROJECT_LIST_VIEW_PATHS.inProgress);
        }
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, "Failed to send project Back to Planning.");
      }
    });
  }

  return { pending, moveBackToPlanning };
}

type StartButtonProps = StartArgs & {
  size?: ActionButtonSize;
};

/** Primary card/detail button: Planning → In Progress (opens date + staff dialog). */
export default function ProjectStartButton({
  projectId,
  projectName,
  subCategory,
  estimatedStartDate,
  estimatedDurationDays,
  startDate,
  endDate,
  employees,
  assignedEmployeeIds,
  size = "sm",
}: StartButtonProps) {
  const { t } = useT();
  const { pending, openDialog, dialog } = useProjectStartAction({
    projectId,
    projectName,
    subCategory,
    estimatedStartDate,
    estimatedDurationDays,
    startDate,
    endDate,
    employees,
    assignedEmployeeIds,
  });
  const isBadge = size === "badge";
  const isBar = size === "bar";
  const controlSize = isBar ? "lg" : size;

  return (
    <>
      <Button
        variant="successBadge"
        size={controlSize}
        disabled={pending}
        onClick={openDialog}
        className={cn(
          isBadge && "whitespace-normal",
          isBar && detailActionBarButtonClassName
        )}
      >
        {isBadge ? (
          pending ? (
            t("common.actions.moving")
          ) : (
            <StackedChipLabel
              lines={[
                t("pages.projects.moveToInProgressChip1"),
                t("pages.projects.moveToInProgressChip2"),
              ]}
            />
          )
        ) : (
          <>
            {pending
              ? t("common.actions.moving")
              : t("pages.projects.moveToInProgress")}
          </>
        )}
      </Button>
      {dialog}
    </>
  );
}

type ReturnButtonProps = ReturnArgs & {
  size?: ActionButtonSize;
};

type BlockedChipProps = {
  size?: ActionButtonSize;
  className?: string;
};

/**
 * Same chip size as Back to Planning, disabled — reason via title/aria.
 * Replaces the overflowing amber banner pill in directory + detail.
 */
export function ProjectReturnToPlanningBlockedChip({
  size = "badge",
  className,
}: BlockedChipProps) {
  const { t } = useT();
  const blockedNote = t("pages.projects.moveBlockedNote");
  const isBadge = size === "badge";
  const isBar = size === "bar";
  const controlSize = isBar ? "lg" : size;

  return (
    <Button
      type="button"
      variant="infoBadge"
      size={controlSize}
      disabled
      title={blockedNote}
      aria-label={blockedNote}
      className={cn(
        isBadge && "whitespace-normal",
        isBar && detailActionBarButtonClassName,
        className
      )}
    >
      {isBadge ? (
        <StackedChipLabel
          lines={[
            t("pages.projects.backToPlanningChip1"),
            t("pages.projects.backToPlanningChip2"),
          ]}
        />
      ) : (
        <>{t("pages.projects.backToPlanning")}</>
      )}
    </Button>
  );
}

/** Primary card button: In Progress → Planning. */
export function ProjectReturnToPlanningButton({
  projectId,
  projectName,
  size = "sm",
}: ReturnButtonProps) {
  const { t } = useT();
  const { pending, moveBackToPlanning } = useProjectReturnToPlanningAction({
    projectId,
    projectName,
  });
  const isBadge = size === "badge";
  const isBar = size === "bar";
  const controlSize = isBar ? "lg" : size;

  return (
    <Button
      variant="infoBadge"
      size={controlSize}
      disabled={pending}
      onClick={moveBackToPlanning}
      className={cn(
        isBadge && "whitespace-normal",
        isBar && detailActionBarButtonClassName
      )}
    >
      {isBadge ? (
        pending ? (
          t("common.actions.moving")
        ) : (
          <StackedChipLabel
            lines={[
              t("pages.projects.backToPlanningChip1"),
              t("pages.projects.backToPlanningChip2"),
            ]}
          />
        )
      ) : (
        <>
          {pending
            ? t("common.actions.moving")
            : t("pages.projects.backToPlanning")}
        </>
      )}
    </Button>
  );
}
