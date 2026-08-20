"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { removeProjectShift } from "@/app/shifts/actions";
import { Button } from "@/components/ui/button";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import { formatProjectShiftLabel } from "@/lib/project-shifts";

export default function ShiftsRemoveShiftChip({
  shiftId,
  number,
  startTime,
  endTime,
}: {
  shiftId: string;
  number: number;
  startTime?: string | null;
  endTime?: string | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const label = formatProjectShiftLabel({ number, startTime, endTime });

  async function handleClick() {
    if (pending) return;
    const confirmed = window.confirm(
      t("pages.shifts.removeShiftConfirm", { shift: label })
    );
    if (!confirmed) return;
    const formData = new FormData();
    formData.set("shiftId", shiftId);
    setPending(true);
    try {
      await removeProjectShift(formData);
      router.refresh();
    } catch (error) {
      showRejectionFromError(error, t("pages.shifts.removeShiftFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="destructiveBadge"
      size="badge"
      disabled={pending}
      onClick={handleClick}
    >
      {pending ? t("pages.shifts.removeShiftSaving") : t("pages.shifts.remove")}
    </Button>
  );
}
