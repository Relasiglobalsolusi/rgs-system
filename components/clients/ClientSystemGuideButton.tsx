"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { downloadSystemGuidePdf } from "@/components/system-guide/download-guide";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  disabled?: boolean;
};

export default function ClientSystemGuideButton({ disabled = false }: Props) {
  const { t } = useT();
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    try {
      await downloadSystemGuidePdf({
        url: "/api/clients/system-guide",
        body: {},
        fallbackFilename: t("pages.clients.systemGuideFileName"),
        failedMessage: t("pages.clients.downloadSystemGuideFailed"),
      });
    } catch (error) {
      showRejectionFromError(
        error,
        t("pages.clients.downloadSystemGuideFailed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <DirectoryAddButton
      label={
        pending
          ? t("pages.clients.downloadingSystemGuide")
          : t("pages.clients.downloadSystemGuide")
      }
      variant="warningBadge"
      icon={<FileDown className="h-3.5 w-3.5 shrink-0" />}
      disabled={disabled || pending}
      onClick={() => {
        void download();
      }}
    />
  );
}
