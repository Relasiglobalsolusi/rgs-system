"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { markTransferOrderSent } from "@/app/transfer-orders/actions";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";

export function SendTransferOrderButton({ id }: { id: string }) {
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
            await markTransferOrderSent(formData);
            toast.success(t("pages.transferOrders.sent"));
          } catch (error) {
            showRejectionFromError(
              error,
              t("pages.transferOrders.sendFailed")
            );
          }
        });
      }}
    >
      {t("pages.transferOrders.markSent")}
    </Button>
  );
}
