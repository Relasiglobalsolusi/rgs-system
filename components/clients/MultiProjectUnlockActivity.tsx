"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

import { touchMultiProjectUnlockActivity } from "@/app/multi-project-unlock/actions";

type Props = {
  /** Only ping when Multi-Project Access is effectively active for this client. */
  enabled?: boolean;
};

/**
 * Client portal: ping Server Action on focus/activity to reset the 30 min
 * Multi-Project unlock idle window (cookie writes cannot run in RSC).
 */
export default function MultiProjectUnlockActivity({ enabled = false }: Props) {
  const { data: session } = useSession();
  const clientId = session?.user?.clientId;

  useEffect(() => {
    if (!enabled || !clientId) return;

    let last = 0;
    const ping = () => {
      const now = Date.now();
      if (now - last < 60_000) return;
      last = now;
      void touchMultiProjectUnlockActivity();
    };

    ping();
    window.addEventListener("focus", ping);
    window.addEventListener("pointerdown", ping);
    return () => {
      window.removeEventListener("focus", ping);
      window.removeEventListener("pointerdown", ping);
    };
  }, [clientId, enabled]);

  return null;
}
