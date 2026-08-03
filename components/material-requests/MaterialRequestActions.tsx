"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import {
  cancelMaterialRequest,
  reviewMaterialRequest,
} from "@/app/material-requests/actions";
import { markTransferOrderReceived } from "@/app/transfer-orders/actions";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";

export function CancelMaterialRequestButton({ id }: { id: string }) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => {
        const formData = new FormData();
        formData.set("id", id);
        startTransition(async () => {
          try {
            await cancelMaterialRequest(formData);
            toast.success(t("pages.materialRequests.cancelled"));
          } catch (error) {
            showRejectionFromError(
              error,
              t("pages.materialRequests.cancelFailed")
            );
          }
        });
      }}
    >
      {t("common.actions.cancel")}
    </Button>
  );
}

export function ReviewMaterialRequestButtons({ id }: { id: string }) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();

  function review(decision: "APPROVE" | "REJECT") {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("decision", decision);
    startTransition(async () => {
      try {
        await reviewMaterialRequest(formData);
        toast.success(
          decision === "APPROVE"
            ? t("pages.materialRequests.approved")
            : t("pages.materialRequests.rejected")
        );
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.materialRequests.reviewFailed")
        );
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => review("APPROVE")}
      >
        {t("common.actions.approve")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => review("REJECT")}
      >
        {t("common.actions.reject")}
      </Button>
    </div>
  );
}

export function ReceiveTransferOrderButton({ id }: { id: string }) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() => {
        const formData = new FormData();
        formData.set("id", id);
        startTransition(async () => {
          try {
            await markTransferOrderReceived(formData);
            toast.success(t("pages.transferOrders.received"));
          } catch (error) {
            showRejectionFromError(
              error,
              t("pages.transferOrders.receiveFailed")
            );
          }
        });
      }}
    >
      {t("pages.transferOrders.confirmReceived")}
    </Button>
  );
}
