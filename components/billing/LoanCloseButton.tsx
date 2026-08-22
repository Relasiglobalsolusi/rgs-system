"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { closeLoanFacilityAction } from "@/app/billing/loans/actions";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";

export default function LoanCloseButton({
  facilityId,
  disabled,
}: {
  facilityId: string;
  disabled: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClose() {
    if (disabled) return;
    if (!window.confirm(t("pages.loans.closeLoanConfirm"))) return;
    setError(null);
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("facilityId", facilityId);
      await closeLoanFacilityAction(formData);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.loans.closeFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || pending}
        onClick={handleClose}
      >
        {pending ? t("pages.loans.saving") : t("pages.loans.closeLoan")}
      </Button>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
