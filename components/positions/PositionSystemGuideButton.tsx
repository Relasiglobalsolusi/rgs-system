"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { showRejection, showRejectionFromError } from "@/components/ui/rejection-notice";
import { downloadSystemGuidePdf } from "@/components/system-guide/download-guide";
import { useT } from "@/lib/i18n/use-t";
import { type ModuleKey } from "@/lib/permissions";
import { enabledGuideModules } from "@/lib/system-guide/access";

type Props = {
  formId: string;
  fallbackName: string;
  departmentLabel: string;
  moduleAccess: Record<ModuleKey, boolean>;
  disabled?: boolean;
};

function readPositionName(formId: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const input = document.querySelector<HTMLInputElement>(
    `#${formId} input[name="name"]`
  );
  const typed = input?.value.trim() ?? "";
  return typed || fallback;
}

export default function PositionSystemGuideButton({
  formId,
  fallbackName,
  departmentLabel,
  moduleAccess,
  disabled = false,
}: Props) {
  const { t } = useT();
  const [pending, setPending] = useState(false);
  const enabledModules = enabledGuideModules(moduleAccess);

  async function download() {
    const positionName = readPositionName(formId, fallbackName);
    if (!positionName) {
      showRejection({
        reasons: t("pages.employees.positionDialog.positionName"),
      });
      return;
    }
    if (enabledModules.length === 0) {
      showRejection({
        reasons: t("pages.employees.positionDialog.downloadSystemGuideEmpty"),
      });
      return;
    }

    setPending(true);
    try {
      await downloadSystemGuidePdf({
        url: "/api/positions/system-guide",
        body: {
          positionName,
          departmentLabel,
          modules: enabledModules,
        },
        fallbackFilename: "RGS-ONE-System-Guide.pdf",
        failedMessage: t(
          "pages.employees.positionDialog.downloadSystemGuideFailed"
        ),
      });
    } catch (error) {
      showRejectionFromError(
        error,
        t("pages.employees.positionDialog.downloadSystemGuideFailed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="successBadge"
      size="badgeFlex"
      disabled={disabled || pending}
      className="w-full sm:w-auto"
      onClick={() => {
        void download();
      }}
    >
      <FileDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {pending
        ? t("pages.employees.positionDialog.downloadingSystemGuide")
        : t("pages.employees.positionDialog.downloadSystemGuide")}
    </Button>
  );
}
