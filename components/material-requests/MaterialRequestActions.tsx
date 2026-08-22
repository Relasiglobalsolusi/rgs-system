"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  cancelMaterialRequest,
  reviewMaterialRequest,
} from "@/app/material-requests/actions";
import {
  markTransferOrderNotReceived,
  markTransferOrderReceived,
} from "@/app/transfer-orders/actions";
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
  const [reviewNote, setReviewNote] = useState("");

  function review(decision: "APPROVE" | "REJECT") {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("decision", decision);
    formData.set("reviewNote", reviewNote);
    startTransition(async () => {
      try {
        await reviewMaterialRequest(formData);
        toast.success(
          decision === "APPROVE"
            ? t("pages.materialRequests.approved")
            : t("pages.materialRequests.rejected")
        );
        setReviewNote("");
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.materialRequests.reviewFailed")
        );
      }
    });
  }

  return (
    <div className="flex w-full min-w-[16rem] flex-col gap-2 sm:max-w-sm">
      <textarea
        value={reviewNote}
        onChange={(e) => setReviewNote(e.target.value)}
        rows={2}
        placeholder={t("pages.materialRequests.reviewNotePlaceholder")}
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex flex-wrap justify-end gap-2">
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
    </div>
  );
}

function ReceiveTransferOrderButton({ id }: { id: string }) {
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

function DidNotReceiveTransferOrderButton({ id }: { id: string }) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        const formData = new FormData();
        formData.set("id", id);
        startTransition(async () => {
          try {
            await markTransferOrderNotReceived(formData);
            toast.success(t("pages.transferOrders.didNotReceive"));
          } catch (error) {
            showRejectionFromError(
              error,
              t("pages.transferOrders.didNotReceiveFailed")
            );
          }
        });
      }}
    >
      {t("pages.transferOrders.didNotReceive")}
    </Button>
  );
}

export function SiteTransferReceiveActions({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ReceiveTransferOrderButton id={id} />
      <DidNotReceiveTransferOrderButton id={id} />
    </div>
  );
}
