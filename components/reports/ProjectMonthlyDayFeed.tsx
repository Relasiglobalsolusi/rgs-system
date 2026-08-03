"use client";

import Link from "next/link";
import { useState } from "react";
import { Calendar, Camera, Download } from "lucide-react";

import type { ProjectMonthlyDayFeed } from "@/lib/project-monthly-feed";
import ProgressPhotoCarousel from "@/components/progress/ProgressPhotoCarousel";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatDisplayDate,
  formatDisplayTime,
  formatWorkDuration,
} from "@/lib/format-date";
import { localeToBcp47 } from "@/lib/i18n/locale";
import { useT } from "@/lib/i18n/use-t";

const JAKARTA_TZ = "Asia/Jakarta";

type Props = {
  feed: ProjectMonthlyDayFeed;
  periodLabel: string;
  clientId: string;
  projectId: string;
  year: number;
  month: number;
};

export default function ProjectMonthlyDayFeed({
  feed,
  periodLabel,
  clientId,
  projectId,
  year,
  month,
}: Props) {
  const { t, locale } = useT();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const bcp47 = localeToBcp47(locale);

  async function handleDownloadPdf() {
    setExportError(null);
    setExporting(true);
    try {
      const params = new URLSearchParams({
        clientId,
        projectId,
        year: String(year),
        month: String(month),
      });

      const response = await fetch(
        `/api/reports/project-monthly-export?${params.toString()}`
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
        `progress-report-${year}-${String(month).padStart(2, "0")}.pdf`;
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
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-subtle">
            {periodLabel}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-text">
            {feed.projectName}
          </h2>
          <p className="mt-0.5 text-sm text-subtle">{feed.clientName}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="infoBadge"
            size="badgeFlex"
            disabled={exporting}
            onClick={() => void handleDownloadPdf()}
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            {exporting
              ? t("common.actions.processing")
              : t("pages.reports.downloadProgressReport", { period: periodLabel })}
          </Button>
          <Link
            href={`/reports/${clientId}/${projectId}`}
            className={cn(buttonVariants({ variant: "secondary", size: "badge" }), "gap-1.5")}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {t("pages.reports.changePeriod")}
          </Link>
        </div>
      </div>

      {exportError ? (
        <p className="text-right text-xs text-danger">{exportError}</p>
      ) : null}

      <div className="space-y-8">
        {feed.days.map((day) => {
          const dayLabel = formatDisplayDate(day.dateKey, { timeZone: "UTC" }, bcp47);

          return (
            <section key={day.dateKey} className="space-y-4">
              <h3 className="border-b border-border pb-2 text-sm font-semibold uppercase tracking-wider text-subtle">
                {dayLabel}
              </h3>

              {!day.hasActivity ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted">
                  {t("pages.reports.emptyDay")}
                </p>
              ) : (
                <div className="space-y-8">
                  {day.employees.map((employee) => {
                    const hasPr = employee.progressReports.length > 0;
                    const checkIn = employee.cico?.checkIn ?? null;
                    const checkOut = employee.cico?.checkOut ?? null;
                    const hasCico = checkIn != null || checkOut != null;
                    const durationOfWorkValue =
                      checkIn && checkOut
                        ? formatWorkDuration(checkIn, checkOut) ?? "—"
                        : checkIn && !checkOut
                          ? t("pages.reports.cicoInProgress")
                          : "—";

                    return (
                      <section
                        key={employee.employeeId}
                        className="space-y-3 border-l-2 border-accent-cyan/25 pl-4"
                      >
                        <header className="border-b border-border py-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                            <div className="min-w-0">
                              <p className="text-lg font-bold tracking-tight text-text sm:text-xl">
                                {employee.name}
                              </p>
                              <p className="mt-1 text-sm font-medium tabular-nums tracking-wide text-muted">
                                {employee.employeeNo}
                              </p>
                            </div>
                            {hasCico ? (
                              <div className="w-full shrink-0 rounded-lg border border-border/50 bg-inset/40 px-3.5 py-2.5 sm:w-auto sm:self-start">
                                <dl className="grid grid-cols-[auto_auto] items-baseline gap-x-4 gap-y-1 text-sm">
                                  <dt className="whitespace-nowrap text-subtle">
                                    {t("pages.reports.cicoCheckIn")}
                                  </dt>
                                  <dd className="tabular-nums font-medium text-text">
                                    {checkIn
                                      ? formatDisplayTime(
                                          checkIn,
                                          { timeZone: JAKARTA_TZ },
                                          bcp47
                                        )
                                      : "—"}
                                  </dd>
                                  <dt className="whitespace-nowrap text-subtle">
                                    {t("pages.reports.cicoCheckOut")}
                                  </dt>
                                  <dd className="tabular-nums font-medium text-text">
                                    {checkOut
                                      ? formatDisplayTime(
                                          checkOut,
                                          { timeZone: JAKARTA_TZ },
                                          bcp47
                                        )
                                      : "—"}
                                  </dd>
                                  <dt className="whitespace-nowrap text-subtle">
                                    {t("pages.reports.cicoDurationOfWork")}
                                  </dt>
                                  <dd
                                    className={cn(
                                      "tabular-nums",
                                      checkIn && checkOut
                                        ? "font-semibold text-text"
                                        : "text-muted"
                                    )}
                                  >
                                    {durationOfWorkValue}
                                  </dd>
                                </dl>
                              </div>
                            ) : (
                              <p className="text-sm text-muted sm:self-center">
                                {t("pages.reports.noCicoForEmployee")}
                              </p>
                            )}
                          </div>
                        </header>

                        {hasPr ? (
                          employee.progressReports.map((report) => (
                            <article
                              key={report.id}
                              className="overflow-hidden rounded-2xl border border-border bg-card"
                            >
                              <div className="space-y-3 px-4 py-4">
                                {report.photos.length > 0 ? (
                                  <ProgressPhotoCarousel
                                    photos={report.photos}
                                    alt={t("pages.reports.progressPhoto")}
                                    onPhotoClick={setLightboxSrc}
                                    className="aspect-[4/3] w-full rounded-xl"
                                  />
                                ) : (
                                  <div className="flex aspect-[4/3] items-center justify-center gap-2 rounded-xl bg-inset text-muted">
                                    <Camera className="h-5 w-5" />
                                    {t("pages.progress.noPhotos")}
                                  </div>
                                )}

                                <div className="space-y-1">
                                  {report.stageLabel ? (
                                    <p className="text-sm font-medium text-text">
                                      {report.stageLabel}
                                    </p>
                                  ) : null}
                                  {report.notes ? (
                                    <p className="text-sm leading-relaxed text-muted">
                                      {report.notes}
                                    </p>
                                  ) : null}
                                  <p className="text-xs text-subtle">
                                    {formatDisplayTime(report.createdAt, {
                                      timeZone: JAKARTA_TZ,
                                    }, bcp47)}
                                  </p>
                                </div>
                              </div>
                            </article>
                          ))
                        ) : (
                          <p className="text-sm text-muted">
                            {t("pages.reports.noProgressForEmployee")}
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <ImageLightbox
        open={lightboxSrc != null}
        onOpenChange={(open) => {
          if (!open) setLightboxSrc(null);
        }}
        src={lightboxSrc}
        alt={t("pages.reports.progressPhoto")}
      />
    </div>
  );
}
