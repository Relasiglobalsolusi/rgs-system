"use client";

import { useSession } from "next-auth/react";
import { CalendarDays } from "lucide-react";
import HeaderLanguageSwitcher from "@/components/layout/HeaderLanguageSwitcher";
import HeaderThemeSwitcher from "@/components/layout/HeaderThemeSwitcher";
import MobileNavDialog from "@/components/layout/MobileNavDialog";
import { useLocale } from "@/components/providers/LocaleProvider";
import { formatHeaderDate } from "@/lib/format-date";
import type { MessageKey } from "@/lib/i18n/messages";
import { appMinutesOfDay } from "@/lib/operating-hours";
import { getSessionProfileLabel } from "@/lib/permissions";

type HeaderProps = {
  title?: string;
  titleKey?: MessageKey | string;
  /** When set, shows a personalized greeting with integrated date on the left. */
  greetingName?: string;
};

/** Asia/Jakarta: morning midnight–noon, afternoon noon–6 PM, evening 6 PM–midnight. */
function getTimeGreetingKey(now: Date) {
  const hour = Math.floor(appMinutesOfDay(now) / 60);
  if (hour < 12) return "header.goodMorning" as const;
  if (hour < 18) return "header.goodAfternoon" as const;
  return "header.goodEvening" as const;
}

export default function Header({
  title,
  titleKey,
  greetingName,
}: HeaderProps) {
  const { data: session } = useSession();
  const { bcp47, locale, t } = useLocale();
  const welcomeMode = Boolean(greetingName);
  const resolvedTitle = titleKey ? t(titleKey) : title ?? "";

  const initials = session?.user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const profileLabel = session?.user
    ? getSessionProfileLabel(session.user, locale)
    : t("header.guest");

  const today = new Date();
  const greetingDate = formatHeaderDate(today, bcp47);
  const headerDateLong = formatHeaderDate(today, bcp47);
  const timeGreeting = t(getTimeGreetingKey(today));

  return (
    <header className="header-surface sticky top-0 z-40 w-full shrink-0">
      {/*
       * Mobile/tablet: action row first (menu | theme + language | name), then title.
       * Desktop (lg+): sidebar brand bar owns the mark; title left, controls right.
       */}
      <div className="flex min-h-0 w-full flex-wrap items-center gap-x-3 gap-y-3 px-4 py-4 sm:gap-x-3.5 sm:px-7 sm:py-5 md:gap-x-4 md:px-9 lg:h-(--app-topbar-height) lg:min-h-(--app-topbar-height) lg:flex-nowrap lg:justify-between lg:gap-8 lg:px-10 lg:py-0 xl:px-12">
        <div className="order-2 flex w-full min-w-0 items-center lg:order-1 lg:w-auto lg:flex-1 lg:overflow-hidden lg:pr-3">
          <div className="min-w-0 flex-1">
            {welcomeMode ? (
              <>
                <h1 className="text-[0.9375rem] font-bold leading-snug tracking-tight text-text sm:text-base md:text-lg lg:truncate lg:text-xl lg:leading-tight">
                  {timeGreeting}, {greetingName}
                </h1>
                <div className="flex min-w-0 items-center gap-1.5 text-[11px] sm:text-xs md:text-sm">
                  <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-accent-cyan">
                    <CalendarDays
                      size={13}
                      strokeWidth={2}
                      className="shrink-0 opacity-85"
                    />
                    <span className="truncate tracking-wide">{greetingDate}</span>
                  </span>
                </div>
              </>
            ) : (
              <h1 className="text-[0.9375rem] font-bold leading-snug tracking-tight text-text sm:text-base md:text-lg lg:truncate lg:text-xl lg:leading-tight">
                {resolvedTitle}
              </h1>
            )}
          </div>
        </div>

        <div className="header-controls-row order-1 flex w-full shrink-0 items-center lg:order-2 lg:w-auto lg:justify-end lg:gap-3.5">
          <div className="header-controls-row__menu shrink-0 lg:hidden">
            <MobileNavDialog
              triggerClassName="header-menu-trigger flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-secondary text-text transition hover:border-accent-cyan/40 hover:bg-elevated hover:text-accent-cyan sm:h-10 sm:w-10"
            />
          </div>

          <div className="header-controls-row__mid flex items-center gap-1.5 sm:gap-2 md:gap-2.5 lg:gap-3.5">
            {!welcomeMode && (
              <div className="header-date-module" aria-label={headerDateLong}>
                <div className="header-date-module__icon" aria-hidden>
                  <CalendarDays size={15} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="header-date-module__label">{t("header.today")}</p>
                  <p className="header-date-module__value">{headerDateLong}</p>
                </div>
              </div>
            )}

            <HeaderThemeSwitcher />
            <HeaderLanguageSwitcher />
          </div>

          <div
            className="header-profile-module header-controls-row__profile"
            aria-label={`${session?.user?.name ?? t("header.user")}, ${profileLabel}`}
          >
            <div className="header-profile-module__avatar" aria-hidden>
              {initials ?? "U"}
            </div>

            <div className="header-profile-module__meta">
              <p className="header-profile-module__name truncate">
                {session?.user?.name ?? t("header.user")}
              </p>
              <p className="header-profile-module__role max-lg:hidden">
                {profileLabel}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
