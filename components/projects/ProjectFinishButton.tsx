"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import {
  finishProject,
  invoiceCurrentMonth,
  reconcileCurrentMonth,
} from "@/app/projects/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StackedChipLabel } from "@/components/ui/StatusBadge";
import { detailActionBarButtonClassName } from "@/components/projects/detail-action-bar";
import { useT } from "@/lib/i18n/use-t";
import { toDateInputValue } from "@/lib/project-contract";
import { cn } from "@/lib/utils";

type LifecycleArgs = {
  projectId: string;
  projectName: string;
  /** Regular Cleaning contracts invoice a month without ending the project. */
  isRegularContract: boolean;
  /** Regular / Security / Payroll Management End Contract asks for the last day on site. */
  requiresLastDay?: boolean;
  /** Parking End Contract asks for the last calendar month. */
  requiresLastMonth?: boolean;
  plannedEndDate?: Date | string | null;
};

/**
 * Shared confirm/action logic for Reconcile / Submit invoice / End contract / Finish.
 * Used by ProjectFinishButton and ProjectDirectoryActions workflow chips.
 */
export function useProjectLifecycleActions({
  projectId,
  projectName,
  isRegularContract,
  requiresLastDay = false,
  requiresLastMonth = false,
  plannedEndDate = null,
}: LifecycleArgs) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lastDayOpen, setLastDayOpen] = useState(false);
  const [lastDay, setLastDay] = useState(() => {
    const today = toDateInputValue(new Date());
    const planned = toDateInputValue(plannedEndDate);
    if (planned && planned < today) return planned;
    return today;
  });
  const [lastMonth, setLastMonth] = useState(() => lastDay.slice(0, 7));

  function handleInvoiceError(
    result: Awaited<ReturnType<typeof finishProject>>,
    finishedLabel: string
  ) {
    if (!result.invoice.error) return false;
    const billingHint = result.invoice.billingPath
      ? t("pages.projects.finish.billingHintWithPath", {
          path: result.invoice.billingPath,
        })
      : t("pages.projects.finish.billingHintGeneric");
    const goBilling = window.confirm(
      t("pages.projects.finish.invoiceErrorOpenBilling", {
        finishedLabel,
        error: result.invoice.error,
        billingHint,
      })
    );
    if (goBilling && result.invoice.billingPath) {
      router.push(result.invoice.billingPath);
      return true;
    }
    return false;
  }

  function reconcileThisMonth() {
    const confirmed = window.confirm(
      t("pages.projects.finish.confirmReconcileCycle", { name: projectName })
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const result = await reconcileCurrentMonth(projectId);
        if (result.reconcile.error) {
          const billingHint = result.reconcile.billingPath
            ? t("pages.projects.finish.billingHintWithPath", {
                path: result.reconcile.billingPath,
              })
            : t("pages.projects.finish.billingHintGeneric");
          const goBilling = window.confirm(
            `${result.reconcile.error}${billingHint}\n\n${t("pages.projects.finish.openBillingNow")}`
          );
          if (goBilling && result.reconcile.billingPath) {
            router.push(result.reconcile.billingPath);
            return;
          }
        } else if (result.reconcile.reconciled === 0) {
          showRejection({ reasons: t("pages.projects.finish.nothingToReconcile") });
        }
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.finish.reconcilePeriodFailed"));
      }
    });
  }

  function invoiceThisMonth() {
    const confirmed = window.confirm(
      t("pages.projects.finish.confirmInvoiceCycle", { name: projectName })
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const result = await invoiceCurrentMonth(projectId);
        if (handleInvoiceError(result, t("pages.projects.finish.invoiceRequested"))) {
          return;
        }
        if (result.invoice.compiled === 0 && !result.invoice.error) {
          const label = result.invoice.periodLabel;
          showRejection({ reasons: label
              ? t("pages.projects.finish.nothingNewToInvoice", { label })
              : t("pages.projects.finish.noPeriodDue") });
        }
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.finish.invoicePeriodFailed"));
      }
    });
  }

  function submitEndOrFinish(formData?: FormData) {
    startTransition(async () => {
      try {
        const result = await finishProject(projectId, formData);
        if (
          handleInvoiceError(
            result,
            isRegularContract
              ? t("pages.projects.finish.contractEnded")
              : t("pages.projects.finish.completedStatus")
          )
        ) {
          return;
        }
        setLastDayOpen(false);
        router.refresh();
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        const closureReason =
          code === "SETTLE_UNPAID_BEFORE_CLOSE"
            ? t("pages.projects.finish.settleUnpaidBeforeClose")
            : code === "RECONCILE_DUE_BEFORE_CLOSE"
              ? t("pages.projects.finish.reconcileDueBeforeClose")
              : code === "CLIENT_REVIEW_BEFORE_CLOSE"
                ? t("pages.projects.finish.clientReviewBeforeClose")
                : null;
        if (closureReason) {
          showRejection({ reasons: closureReason });
          return;
        }
        showRejectionFromError(
          error,
          isRegularContract
            ? t("pages.projects.finish.endContractFailed")
            : t("pages.projects.finish.finishProjectFailed")
        );
      }
    });
  }

  function endOrFinish() {
    const confirmed = window.confirm(
      isRegularContract
        ? t("pages.projects.finish.confirmEndContract", { name: projectName })
        : t("pages.projects.finish.confirmFinishNamed", { name: projectName })
    );
    if (!confirmed) return;
    if (requiresLastMonth || requiresLastDay) {
      setLastDayOpen(true);
      return;
    }
    submitEndOrFinish();
  }

  function confirmLastDay() {
    const formData = new FormData();
    if (requiresLastMonth) {
      if (!/^\d{4}-\d{2}$/.test(lastMonth)) {
        showRejection({ reasons: t("pages.projects.finish.lastMonthRequired") });
        return;
      }
      formData.set("lastMonth", lastMonth);
    } else {
      if (!lastDay) {
        showRejection({ reasons: t("pages.projects.finish.lastDayRequired") });
        return;
      }
      formData.set("lastDay", lastDay);
    }
    submitEndOrFinish(formData);
  }

  return {
    pending,
    reconcileThisMonth,
    invoiceThisMonth,
    endOrFinish,
    isRegularContract,
    lastDayOpen,
    setLastDayOpen,
    lastDay,
    setLastDay,
    lastMonth,
    setLastMonth,
    confirmLastDay,
  };
}

type ActionButtonSize = "default" | "sm" | "badge" | "bar";

type Props = LifecycleArgs & {
  /**
   * `full` — Reconcile/Invoice + End Contract (contracts) or Finish (non-contracts).
   * `end-only` — End Contract / Finish only (project detail page).
   */
  mode?: "full" | "end-only";
  size?: ActionButtonSize;
  /** When mode=full for Regular Cleaning: which primary billing chip to show. */
  billingAction?: "reconcile" | "invoice" | null;
};

/** Lifecycle finish / end-contract controls. */
export default function ProjectFinishButton({
  projectId,
  projectName,
  isRegularContract,
  requiresLastDay = false,
  requiresLastMonth = false,
  plannedEndDate = null,
  mode = "full",
  size = "sm",
  billingAction = null,
}: Props) {
  const { t } = useT();
  const {
    pending,
    reconcileThisMonth,
    invoiceThisMonth,
    endOrFinish,
    lastDayOpen,
    setLastDayOpen,
    lastDay,
    setLastDay,
    lastMonth,
    setLastMonth,
    confirmLastDay,
  } = useProjectLifecycleActions({
      projectId,
      projectName,
      isRegularContract,
      requiresLastDay,
      requiresLastMonth,
      plannedEndDate,
    });
  const isBadge = size === "badge";
  const isBar = size === "bar";
  const controlSize = isBar ? "lg" : size;

  if (isRegularContract) {
    return (
      <>
        {mode === "full" && billingAction === "reconcile" ? (
          <Button
            variant="warningBadge"
            size={controlSize}
            disabled={pending}
            onClick={reconcileThisMonth}
            className={cn(
              isBadge && "whitespace-normal",
              isBar && detailActionBarButtonClassName
            )}
          >
            {pending
              ? t("pages.projects.finish.reconciling")
              : t("pages.projects.finish.reconcile")}
          </Button>
        ) : null}
        {mode === "full" && billingAction === "invoice" ? (
          <Button
            variant="successBadge"
            size={controlSize}
            disabled={pending}
            onClick={invoiceThisMonth}
            className={cn(
              isBadge && "whitespace-normal",
              isBar && detailActionBarButtonClassName
            )}
          >
            {pending
              ? t("pages.projects.finish.submittingInvoice")
              : t("pages.projects.finish.requestInvoice")}
          </Button>
        ) : null}
        <Button
          variant="destructiveBadge"
          size={controlSize}
          disabled={pending}
          onClick={endOrFinish}
          className={cn(
            isBadge && "whitespace-normal",
            isBar && detailActionBarButtonClassName
          )}
        >
          {isBadge ? (
            pending ? (
              t("pages.projects.finish.finishing")
            ) : (
              <StackedChipLabel
                lines={[
                  t("pages.projects.finish.endContract1"),
                  t("pages.projects.finish.endContract2"),
                ]}
              />
            )
          ) : (
            <>
              {pending
                ? t("pages.projects.finish.finishing")
                : t("pages.projects.finish.endContract")}
            </>
          )}
        </Button>
        {requiresLastDay || requiresLastMonth ? (
          <Dialog open={lastDayOpen} onOpenChange={setLastDayOpen}>
            <EmployeeDialogShell
              icon={CalendarClock}
              title={t("pages.projects.finish.endContract")}
              description={
                requiresLastMonth
                  ? t("pages.projects.finish.lastMonthHint")
                  : t("pages.projects.finish.lastDayHint")
              }
              maxWidth="md"
              footer={
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
                  <EmployeeSecondaryButton
                    disabled={pending}
                    onClick={() => setLastDayOpen(false)}
                  >
                    {t("common.actions.cancel")}
                  </EmployeeSecondaryButton>
                  <EmployeePrimaryButton
                    type="button"
                    disabled={pending}
                    onClick={confirmLastDay}
                  >
                    {pending
                      ? t("pages.projects.finish.finishing")
                      : t("pages.projects.finish.endContract")}
                  </EmployeePrimaryButton>
                </div>
              }
            >
              <div className={employeeDialogFieldClass}>
                <label className="text-sm font-medium text-text">
                  {requiresLastMonth
                    ? t("pages.projects.finish.lastMonth")
                    : t("pages.projects.finish.lastDay")}
                </label>
                {requiresLastMonth ? (
                  <Input
                    type="month"
                    value={lastMonth}
                    max={toDateInputValue(new Date()).slice(0, 7)}
                    onChange={(event) => setLastMonth(event.target.value)}
                    className={employeeInputClass}
                  />
                ) : (
                  <Input
                    type="date"
                    value={lastDay}
                    max={toDateInputValue(new Date())}
                    onChange={(event) => setLastDay(event.target.value)}
                    className={employeeInputClass}
                  />
                )}
                <p className={employeeDialogHintClass}>
                  {requiresLastMonth
                    ? t("pages.projects.finish.lastMonthHint")
                    : t("pages.projects.finish.lastDayHint")}
                </p>
              </div>
            </EmployeeDialogShell>
          </Dialog>
        ) : null}
      </>
    );
  }

  return (
    <Button
      variant="successBadge"
      size={controlSize}
      disabled={pending}
      onClick={endOrFinish}
      className={cn(
        isBadge && "whitespace-normal",
        isBar && detailActionBarButtonClassName
      )}
    >
      {isBadge ? (
        pending ? (
          t("pages.projects.finish.finishing")
        ) : (
          <StackedChipLabel
            lines={[
              t("pages.projects.finish.finishProject1"),
              t("pages.projects.finish.finishProject2"),
            ]}
          />
        )
      ) : (
        <>
          {pending
            ? t("pages.projects.finish.finishing")
            : t("pages.projects.finish.finishProject")}
        </>
      )}
    </Button>
  );
}
