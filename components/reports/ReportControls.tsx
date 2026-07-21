"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, Lock, Printer } from "lucide-react";

import { lockMonthlyReport } from "@/app/reports/actions";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  year: number;
  month: number;
  canLock: boolean;
  locked: boolean;
  subCategory?: string;
  q?: string;
};

export default function ReportControls({
  year,
  month,
  canLock,
  locked,
  subCategory,
  q,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  function handleLock() {
    if (!confirm(t("pages.reports.confirmLock"))) {
      return;
    }
    startTransition(async () => {
      try {
        await lockMonthlyReport(year, month);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.reports.lockFailed"));
      }
    });
  }

  async function handleExportPdf() {
    setExportError(null);
    setExporting(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      if (subCategory) params.set("subCategory", subCategory);
      if (q) params.set("q", q);

      const response = await fetch(
        `/api/reports/monthly-export?${params.toString()}`
      );
      if (!response.ok) {
        let message = t("pages.reports.exportPdfFailed");
        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // ignore non-JSON error bodies
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      anchor.href = url;
      anchor.download =
        match?.[1] ??
        `monthly-report-${year}-${String(month).padStart(2, "0")}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("pages.reports.exportPdfFailed");
      setExportError(message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 no-print">
      {locked ? (
        <StatusBadge status="warning" compact>
          {t("pages.reports.locked")}
        </StatusBadge>
      ) : null}

      {canLock && !locked ? (
        <Button
          type="button"
          variant="warningBadge"
          size="badgeFlex"
          disabled={pending}
          onClick={handleLock}
        >
          <Lock className="h-3.5 w-3.5 shrink-0" />
          {pending
            ? t("pages.reports.locking")
            : t("pages.reports.lockReport")}
        </Button>
      ) : null}

      <Button
        type="button"
        variant="infoBadge"
        size="badgeFlex"
        disabled={exporting}
        onClick={() => void handleExportPdf()}
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        {exporting
          ? t("common.actions.processing")
          : t("pages.reports.downloadPdf")}
      </Button>

      <Button
        type="button"
        variant="mutedBadge"
        size="badgeFlex"
        onClick={() => window.print()}
      >
        <Printer className="h-3.5 w-3.5 shrink-0" />
        {t("common.actions.print")}
      </Button>

      {exportError ? (
        <p className="basis-full text-right text-xs text-danger">{exportError}</p>
      ) : null}
    </div>
  );
}
