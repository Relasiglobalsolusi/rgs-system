"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { markThrPaymentPaid } from "@/app/billing/thr/actions";
import { Button } from "@/components/ui/button";
import { showRejectionFromError } from "@/components/ui/rejection-notice";

type Props = {
  id: string;
  label: string;
  pendingLabel: string;
  errorLabel: string;
};

export default function ThrMarkPaidButton({
  id,
  label,
  pendingLabel,
  errorLabel,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="badge"
      variant="infoBadge"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            await markThrPaymentPaid(id);
            router.refresh();
          } catch (error) {
            showRejectionFromError(error, errorLabel);
          }
        });
      }}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
