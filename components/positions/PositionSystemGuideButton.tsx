"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { showRejection, showRejectionFromError } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import { getVisibleModules, type ModuleKey } from "@/lib/permissions";

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
  const enabledModules = getVisibleModules().filter(
    (module) => moduleAccess[module]
  );

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
      const response = await fetch("/api/positions/system-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionName,
          departmentLabel,
          modules: enabledModules,
        }),
      });
      if (!response.ok) {
        let message = t("pages.employees.positionDialog.downloadSystemGuideFailed");
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          /* keep default */
        }
        showRejection({ reasons: message });
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const header = response.headers.get("Content-Disposition") ?? "";
      const match = header.match(/filename="([^"]+)"/);
      link.href = url;
      link.download = match?.[1] ?? "RGS-ONE-System-Guide.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
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
