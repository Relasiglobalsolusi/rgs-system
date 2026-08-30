"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

import {
  AUTH_SESSION_REPLACED_ERROR,
  AUTH_SESSION_REPLACED_REASON,
} from "@/lib/auth-session";

const SKIP_WATCH_PATHS = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/sign-out",
]);

function loginAfterKick(status: "replaced" | "revoked") {
  return status === "replaced"
    ? `/login?reason=${AUTH_SESSION_REPLACED_REASON}`
    : "/login";
}

/**
 * When another device claims the login, drop this tab to /login immediately.
 * Does not wait for a click or the NextAuth 60s refetch.
 */
export default function SessionKickWatcher() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const kicking = useRef(false);

  useEffect(() => {
    if (kicking.current) return;
    if (pathname && SKIP_WATCH_PATHS.has(pathname)) return;

    const kick = (kind: "replaced" | "revoked" = "replaced") => {
      if (kicking.current) return;
      kicking.current = true;
      const url = loginAfterKick(kind);
      window.location.replace(url);
      void signOut({ redirect: false });
    };

    if (session?.error === AUTH_SESSION_REPLACED_ERROR) {
      kick("replaced");
      return;
    }

    if (status !== "authenticated") return;

    let stopped = false;
    let pollTimer: number | undefined;
    let source: EventSource | null = null;

    const handleStatus = (value: unknown) => {
      if (value === "replaced" || value === "revoked") {
        kick(value);
      }
    };

    const pollOnce = async () => {
      try {
        const res = await fetch("/api/session/live", { cache: "no-store" });
        if (!res.ok || stopped) return;
        const data = (await res.json()) as { status?: string };
        handleStatus(data.status);
      } catch {
        // retry on the next tick
      }
    };

    void pollOnce();

    try {
      source = new EventSource("/api/session/watch");
      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { status?: string };
          handleStatus(data.status);
        } catch {
          // ignore malformed events
        }
      };
    } catch {
      source = null;
    }

    pollTimer = window.setInterval(() => {
      void pollOnce();
    }, 1000);

    return () => {
      stopped = true;
      if (pollTimer) window.clearInterval(pollTimer);
      source?.close();
    };
  }, [pathname, session?.error, status]);

  return null;
}
