"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import InHouseVerifyPaymentDialog from "@/components/billing/InHouseVerifyPaymentDialog";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const isVerify = mode === "verify";

  function handleVerifySuccess(result: { movedToHistory: boolean }) {
    if (result.movedToHistory) {
      router.push("/projects?view=completed");
    }
    router.refresh();
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
        onClick={() => setDialogOpen(true)}
        className={cn(flexibleBadgeChipClassName, "whitespace-normal")}
      >
        {isVerify
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

      {isVerify ? (
        <InHouseVerifyPaymentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          periodId={periodId}
          projectName={projectName}
          onSuccess={handleVerifySuccess}
        />
      ) : (
        <PaymentReceivedDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          periodId={periodId}
          projectName={projectName}
          movesToHistoryWhenFullyPaid={movesToHistoryWhenFullyPaid}
          onSuccess={handleReceiveSuccess}
        />
      )}
    </>
  );
}
