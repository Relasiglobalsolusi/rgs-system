"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { verifyInvoicePeriodPayment } from "@/app/projects/invoice-actions";
import PaymentReceivedDialog from "@/components/billing/PaymentReceivedDialog";
import { Button } from "@/components/ui/button";
import { StackedChipLabel } from "@/components/ui/StatusBadge";
import { flexibleBadgeChipClassName } from "@/components/ui/trash-action-buttons";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  periodId: string;
  projectName: string;
  /** Only ended (COMPLETED) contracts move to Completed Projects when fully paid. */
  movesToHistoryWhenFullyPaid?: boolean;
  /** receive = admin marks paid; verify = confirm client payment proof. */
  mode?: "receive" | "verify";
  size?: "default" | "sm" | "badge";
};

export default function ProjectMarkPaidButton({
  periodId,
  projectName,
  movesToHistoryWhenFullyPaid = false,
  mode = "receive",
  size: _size = "badge",
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const isVerify = mode === "verify";

  function handleVerify() {
    const confirmed = window.confirm(
      movesToHistoryWhenFullyPaid
        ? t("pages.projects.verifyPaymentHistory", { name: projectName })
        : t("pages.projects.verifyPaymentActive", { name: projectName })
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const result = await verifyInvoicePeriodPayment(periodId);
        if (result.movedToHistory) {
          router.push("/projects?view=completed");
          router.refresh();
          return;
        }
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.verifyPaymentFailed"));
      }
    });
  }

  function handleReceiveSuccess(result: { movedToHistory: boolean }) {
    if (result.movedToHistory) {
      router.push("/projects?view=completed");
    }
    router.refresh();
  }

  return (
    <>
      <Button
        variant="successBadge"
        size="badge"
        disabled={pending}
        onClick={() => {
          if (isVerify) {
            handleVerify();
            return;
          }
          setDialogOpen(true);
        }}
        className={cn(flexibleBadgeChipClassName, "whitespace-normal")}
      >
        {pending
          ? isVerify
            ? t("pages.projects.verifying")
            : t("common.actions.saving")
          : isVerify
            ? t("pages.projects.verifyPayment")
            : (
                <StackedChipLabel
                  lines={[
                    t("pages.billing.paymentReceived1"),
                    t("pages.billing.paymentReceived2"),
                  ]}
                />
              )}
      </Button>

      {!isVerify ? (
        <PaymentReceivedDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          periodId={periodId}
          projectName={projectName}
          movesToHistoryWhenFullyPaid={movesToHistoryWhenFullyPaid}
          onSuccess={handleReceiveSuccess}
        />
      ) : null}
    </>
  );
}
