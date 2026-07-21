"use client";

import { useSession } from "next-auth/react";
import { CalendarDays } from "lucide-react";
import HeaderLanguageSwitcher from "@/components/layout/HeaderLanguageSwitcher";
import MobileNavDialog from "@/components/layout/MobileNavDialog";
import { useLocale } from "@/components/providers/LocaleProvider";
import { formatHeaderDate } from "@/lib/format-date";
import type { MessageKey } from "@/lib/i18n/messages";
import { getSessionProfileLabel } from "@/lib/permissions";

type HeaderProps = {
  title?: string;
  titleKey?: MessageKey | string;
  description?: string;
  descriptionKey?: MessageKey | string;
  /** When set, shows a personalized greeting with integrated date on the left. */
  greetingName?: string;
};

function getTimeGreetingKey(hour: number) {
  if (hour < 12) return "header.goodMorning" as const;
  if (hour < 17) return "header.goodAfternoon" as const;
  return "header.goodEvening" as const;
}

export default function Header({
  title,
  titleKey,
  description,
  descriptionKey,
  greetingName,
}: HeaderProps) {
  const { data: session } = useSession();
  const { bcp47, locale, t } = useLocale();
  const welcomeMode = Boolean(greetingName);
  const resolvedTitle = titleKey ? t(titleKey) : title ?? "";
  const resolvedDescription = descriptionKey
    ? t(descriptionKey)
    : description;

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
  const timeGreeting = t(getTimeGreetingKey(today.getHours()));

  return (
    <header className="header-surface sticky top-0 z-40 w-full">
      {/*
       * Mobile/tablet: greeting + actions only (no header brand lockup).
       * Desktop (lg+): sidebar brand bar owns the mark.
       */}
      <div className="flex min-h-[7.5rem] w-full items-center gap-3 px-2.5 py-5 sm:min-h-[8.45rem] sm:gap-3.5 sm:px-[0.7rem] sm:py-[1.625rem] md:gap-4 md:px-[1.05rem] lg:h-(--app-topbar-height) lg:min-h-(--app-topbar-height) lg:justify-between lg:gap-8 lg:px-10 lg:py-0 xl:px-12">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 lg:overflow-hidden lg:pr-3">
          {welcomeMode ? (
            <>
              <h1 className="text-[0.9375rem] font-bold leading-tight tracking-tight text-text break-words sm:text-base md:text-lg lg:truncate lg:text-xl lg:leading-tight">
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
              {resolvedDescription && (
                <p className="mt-0.5 hidden max-w-full text-xs leading-snug text-subtle sm:line-clamp-2 sm:block md:text-sm lg:max-w-none lg:truncate lg:leading-snug">
                  {resolvedDescription}
                </p>
              )}
            </>
          ) : (
            <>
              <h1 className="text-[0.9375rem] font-bold leading-tight tracking-tight text-text break-words sm:text-base md:text-lg lg:truncate lg:text-xl lg:leading-tight">
                {resolvedTitle}
              </h1>
              {resolvedDescription && (
                <p className="mt-0.5 max-w-full text-[11px] leading-snug text-subtle line-clamp-2 sm:text-xs md:text-sm lg:max-w-none lg:truncate">
                  {resolvedDescription}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-2.5 md:gap-3 lg:gap-3.5">
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

          <HeaderLanguageSwitcher />

          <MobileNavDialog
            triggerClassName="header-menu-trigger flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-secondary text-text transition hover:border-accent-cyan/40 hover:bg-elevated hover:text-accent-cyan lg:hidden"
          />

          {/* Avatar only below lg — full name/role live in the mobile drawer footer */}
          <div
            className="header-profile-module max-lg:gap-0 max-lg:border-0 max-lg:bg-transparent max-lg:p-0 max-lg:shadow-none"
            aria-label={`${session?.user?.name ?? t("header.user")}, ${profileLabel}`}
          >
            <div className="header-profile-module__avatar" aria-hidden>
              {initials ?? "U"}
            </div>

            <div className="header-profile-module__meta max-lg:hidden">
              <p className="header-profile-module__name">
                {session?.user?.name ?? t("header.user")}
              </p>
              <p className="header-profile-module__role">{profileLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
