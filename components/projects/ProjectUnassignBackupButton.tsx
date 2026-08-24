"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { unassignBackupEmployee } from "@/app/projects/actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";

export default function ProjectUnassignBackupButton({
  projectId,
  employeeId,
}: {
  projectId: string;
  employeeId: string;
}) {
  const { t } = useT();
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    const confirmed = await confirm({
      title: t("pages.projects.removeBackup"),
      description: t("pages.projects.removeBackupConfirm"),
      confirmLabel: t("common.actions.remove"),
      tone: "danger",
    });
    if (!confirmed) return;
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("employeeId", employeeId);
    setPending(true);
    try {
      await unassignBackupEmployee(formData);
      router.refresh();
    } catch (error) {
      showRejectionFromError(error, t("pages.projects.removeBackup"));
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
        ? t("pages.projects.removeBackupSaving")
        : t("pages.projects.removeBackup")}
    </Button>
  );
}
