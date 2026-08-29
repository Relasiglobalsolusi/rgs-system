"use client";

import type { Session } from "next-auth";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

import SessionKickWatcher from "@/components/auth/SessionKickWatcher";

export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <NextAuthSessionProvider
      session={session}
      refetchInterval={60}
      refetchOnWindowFocus
    >
      <SessionKickWatcher />
      {children}
    </NextAuthSessionProvider>
  );
}
