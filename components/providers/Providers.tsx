"use client";

import type { Session } from "next-auth";
import type { ReactNode } from "react";

import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { RejectionNoticeHost } from "@/components/ui/rejection-notice";
import type { AppLocale } from "@/lib/i18n/locale";

export function Providers({
  children,
  session,
  initialLocale,
}: {
  children: ReactNode;
  session: Session | null;
  initialLocale: AppLocale;
}) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider>
        <LocaleProvider initialLocale={initialLocale}>
          {children}
          <RejectionNoticeHost />
        </LocaleProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
