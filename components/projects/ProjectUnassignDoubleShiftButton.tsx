"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { unassignDoubleShift } from "@/app/projects/actions";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";

export default function ProjectUnassignDoubleShiftButton({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    const confirmed = window.confirm(t("pages.projects.removeDoubleShiftConfirm"));
    if (!confirmed) return;
    const formData = new FormData();
    formData.set("assignmentId", assignmentId);
    setPending(true);
    try {
      await unassignDoubleShift(formData);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="destructiveBadge"
      size="badgeFlex"
      disabled={pending}
      onClick={handleClick}
    >
      {pending
        ? t("pages.projects.removeDoubleShiftSaving")
        : t("pages.projects.removeDoubleShift")}
    </Button>
  );
}
