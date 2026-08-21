"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  isClosedCalendarDay,
  isClosedCalendarMonth,
} from "@/lib/closed-report-period";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type ProgressFeedViewMode = "day" | "month";

type Props = {
  projectId: string;
  clientId: string | null;
  viewMode: ProgressFeedViewMode;
  selectedDate: string;
  year: number;
  month: number;
  className?: string;
};

async function downloadPdf(
  url: string,
  fallbackName: string,
  failedMessage: string
) {
  const response = await fetch(url);
  if (!response.ok) {
    let message = failedMessage;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore non-JSON bodies
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  anchor.href = objectUrl;
  anchor.download = match?.[1] ?? fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export default function ProgressProjectExports({
  projectId,
  clientId,
  viewMode,
  selectedDate,
  year,
  month,
  className,
}: Props) {
  const { t } = useT();
  const [pending, setPending] = useState<"progress" | "attendance" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const dayClosed = isClosedCalendarDay(selectedDate);
  const monthClosed = isClosedCalendarMonth(year, month);
  const periodClosed = viewMode === "day" ? dayClosed : monthClosed;
  const canDownloadAttendance = periodClosed;
  const canDownloadProgress = Boolean(clientId) && periodClosed;

  const closedHint =
    viewMode === "day" && !dayClosed
      ? t("pages.progress.dayNotClosedHint")
      : viewMode === "month" && !monthClosed
        ? t("pages.progress.closedMonthHint")
        : null;

  async function handleProgress() {
    if (!clientId) return;
    setError(null);
    setPending("progress");
    try {
      const params = new URLSearchParams({
        clientId,
        projectId,
        mode: viewMode,
      });
      if (viewMode === "day") {
        params.set("date", selectedDate);
      } else {
        params.set("year", String(year));
        params.set("month", String(month));
      }
      const stamp =
        viewMode === "day"
          ? selectedDate
          : `${year}-${String(month).padStart(2, "0")}`;
      await downloadPdf(
        `/api/reports/project-monthly-export?${params.toString()}`,
        `progress-report-${stamp}.pdf`,
        t("pages.progress.errors.exportFailed")
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("pages.progress.errors.exportFailed")
      );
    } finally {
      setPending(null);
    }
  }

  async function handleAttendance() {
    setError(null);
    setPending("attendance");
    try {
      const params = new URLSearchParams({ projectId, mode: viewMode });
      if (viewMode === "day") {
        params.set("date", selectedDate);
      } else {
        params.set("year", String(year));
        params.set("month", String(month));
      }
      const stamp =
        viewMode === "day"
          ? selectedDate
          : `${year}-${String(month).padStart(2, "0")}`;
      await downloadPdf(
        `/api/reports/attendance-export?${params.toString()}`,
        `attendance-${stamp}.pdf`,
        t("pages.progress.errors.exportFailed")
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("pages.progress.errors.exportFailed")
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={cn("flex flex-col items-start gap-1.5", className)}>
      <div className="flex w-auto flex-wrap items-center justify-start gap-2">
        <Button
          type="button"
          variant="secondary"
          size="badgeFlex"
          className="h-11 w-auto shrink-0 items-center gap-2"
          disabled={!canDownloadAttendance || pending != null}
          onClick={() => void handleAttendance()}
        >
          <Download className="h-3.5 w-3.5 shrink-0" />
          {pending === "attendance"
            ? t("common.actions.processing")
            : t("pages.progress.downloadAttendance")}
        </Button>
        {clientId ? (
          <Button
            type="button"
            variant="infoBadge"
            size="badgeFlex"
            className="h-11 w-auto shrink-0 items-center gap-2"
            disabled={!canDownloadProgress || pending != null}
            onClick={() => void handleProgress()}
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            {pending === "progress"
              ? t("common.actions.processing")
              : t("pages.progress.downloadProgressReport")}
          </Button>
        ) : null}
      </div>
      {closedHint ? (
        <p className="max-w-xs text-left text-xs text-subtle">{closedHint}</p>
      ) : null}
      {error ? (
        <p className="max-w-xs text-left text-xs text-danger">{error}</p>
      ) : null}
    </div>
  );
}
