"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { StackedChipLabel } from "@/components/ui/StatusBadge";
import { detailActionBarButtonClassName } from "@/components/projects/detail-action-bar";
import NoPortalProgressSentDialog from "@/components/billing/NoPortalProgressSentDialog";
import { useT } from "@/lib/i18n/use-t";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { submitProjectForApproval } from "@/app/projects/actions";

type Props = {
  projectId: string;
  projectName: string;
  hasPortalAccess?: boolean;
  size?: "bar" | "badge" | "default";
};

export default function ProjectSubmitForApprovalButton({
  projectId,
  projectName,
  hasPortalAccess = true,
  size = "bar",
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [noPortalSentOpen, setNoPortalSentOpen] = useState(false);

  async function handleSubmit() {
    const confirmed = await confirm({
      title: t("pages.projects.submitForApproval.confirmTitle"),
      description: t("pages.projects.submitForApproval.confirmDesc", {
        name: projectName,
      }),
      confirmLabel: t("pages.projects.submitForApproval.confirm"),
    });
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await submitProjectForApproval(projectId);
        router.refresh();
        if (!hasPortalAccess) setNoPortalSentOpen(true);
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.projects.submitForApproval.failed")
        );
      }
    });
  }

  const isBar = size === "bar";
  const buttonSize = size === "badge" ? "badge" : "lg";

  return (
    <>
      <Button
        type="button"
        variant="warningBadge"
        size={buttonSize}
        className={isBar ? detailActionBarButtonClassName : undefined}
        onClick={handleSubmit}
        disabled={pending}
        aria-label={t("pages.projects.submitForApproval.button")}
      >
        {isBar ? (
          t("pages.projects.submitForApproval.button")
        ) : (
          <StackedChipLabel
            lines={[
              t("pages.projects.submitForApproval.chip1"),
              t("pages.projects.submitForApproval.chip2"),
            ]}
          />
        )}
      </Button>
      <NoPortalProgressSentDialog
        open={noPortalSentOpen}
        onOpenChange={setNoPortalSentOpen}
      />
    </>
  );
}
