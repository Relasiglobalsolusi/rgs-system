"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import {
  daysInMonth,
  jakartaTodayKey,
  shiftYearMonth,
  yearMonthKey,
} from "@/lib/operations-team-calendar";

export type TeamAvailabilityRow = {
  id: string;
  name: string;
  typeLabel: string;
  occupiedProjectName: string | null;
  occupiedDayKeys: string[];
};

type Props = {
  year: number;
  month: number;
  monthLabel: string;
  teams: TeamAvailabilityRow[];
};

export default function TeamAvailabilityBoard({
  year,
  month,
  monthLabel,
  teams,
}: Props) {
  const { t } = useT();
  const days = daysInMonth(year, month);
  const todayKey = jakartaTodayKey();
  const prev = shiftYearMonth(year, month, -1);
  const next = shiftYearMonth(year, month, 1);

  if (teams.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          title={t("pages.teams.noAvailability")}
          description={t("pages.teams.noAvailabilityDesc")}
        />
        <div className="mt-4 flex justify-center">
          <Link
            href="/teams"
            className={cn(
              buttonVariants({ variant: "successBadge", size: "badgeFlex" })
            )}
          >
            {t("pages.teams.openAssignment")}
          </Link>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/teams/availability?month=${yearMonthKey(prev.year, prev.month)}`}
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
            aria-label={t("pages.teams.previousMonth")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <p className="min-w-[10rem] text-center text-base font-semibold text-text">
            {monthLabel}
          </p>
          <Link
            href={`/teams/availability?month=${yearMonthKey(next.year, next.month)}`}
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
            aria-label={t("pages.teams.nextMonth")}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-warning/70" />
            {t("pages.teams.occupiedLegend")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-elevated ring-1 ring-border" />
            {t("pages.teams.availableLegend")}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {teams.map((team) => {
          const occupied = new Set(team.occupiedDayKeys);
          return (
            <SectionCard key={team.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-text">{team.name}</p>
                  <p className="text-sm text-muted">{team.typeLabel}</p>
                </div>
                {team.occupiedProjectName ? (
                  <div className="flex min-w-0 max-w-[16rem] flex-col items-end gap-2.5">
                    <StatusBadge status="warning" compact className="w-fit shrink-0">
                      {t("pages.teams.statusOnSite")}
                    </StatusBadge>
                    <span className="max-w-full break-words text-right text-sm font-medium leading-snug text-text">
                      {team.occupiedProjectName}
                    </span>
                  </div>
                ) : (
                  <StatusBadge
                    status="active"
                    compact
                    className="min-w-0 w-fit px-1.5"
                  >
                    {t("pages.teams.statusAvailable")}
                  </StatusBadge>
                )}
              </div>
              <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <div
                className="grid min-w-[36rem] gap-1"
                style={{
                  gridTemplateColumns: `repeat(${days.length}, minmax(1.75rem, 1fr))`,
                }}
              >
                {days.map((day) => {
                  const isOccupied = occupied.has(day.key);
                  const isToday = day.key === todayKey;
                  return (
                    <div
                      key={day.key}
                      title={`${day.day}`}
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md text-[10px] tabular-nums",
                        isOccupied
                          ? "bg-warning/25 text-text"
                          : "bg-elevated text-muted",
                        isToday && "ring-1 ring-primary"
                      )}
                    >
                      {day.day}
                    </div>
                  );
                })}
              </div>
              </div>
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
