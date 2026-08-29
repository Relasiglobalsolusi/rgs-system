"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";

import {
  AUTH_SESSION_REPLACED_ERROR,
  AUTH_SESSION_REPLACED_REASON,
} from "@/lib/auth-session";

/**
 * When another device claims the login, NextAuth marks the JWT with
 * SessionReplaced. Redirect this device to login with a clear reason banner.
 */
export default function SessionKickWatcher() {
  const { data: session } = useSession();
  const signingOut = useRef(false);

  useEffect(() => {
    if (signingOut.current) return;
    if (session?.error !== AUTH_SESSION_REPLACED_ERROR) return;

    signingOut.current = true;
    void signOut({
      callbackUrl: `/login?reason=${AUTH_SESSION_REPLACED_REASON}`,
    });
  }, [session?.error]);

  return null;
}
