"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  finishProject,
  invoiceCurrentMonth,
  reconcileCurrentMonth,
} from "@/app/projects/actions";
import { Button } from "@/components/ui/button";
import { StackedChipLabel } from "@/components/ui/StatusBadge";
import { detailActionBarButtonClassName } from "@/components/projects/detail-action-bar";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type LifecycleArgs = {
  projectId: string;
  projectName: string;
  /** Regular Cleaning contracts invoice a month without ending the project. */
  isRegularContract: boolean;
};

/**
 * Shared confirm/action logic for Reconcile / Submit invoice / End contract / Finish.
 * Used by ProjectFinishButton and ProjectDirectoryActions workflow chips.
 */
export function useProjectLifecycleActions({
  projectId,
  projectName,
  isRegularContract,
}: LifecycleArgs) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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

  function endOrFinish() {
    const confirmed = window.confirm(
      isRegularContract
        ? t("pages.projects.finish.confirmEndContract", { name: projectName })
        : t("pages.projects.finish.confirmFinishNamed", { name: projectName })
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const result = await finishProject(projectId);
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

  return {
    pending,
    reconcileThisMonth,
    invoiceThisMonth,
    endOrFinish,
    isRegularContract,
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
  mode = "full",
  size = "sm",
  billingAction = null,
}: Props) {
  const { t } = useT();
  const { pending, reconcileThisMonth, invoiceThisMonth, endOrFinish } =
    useProjectLifecycleActions({
      projectId,
      projectName,
      isRegularContract,
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
