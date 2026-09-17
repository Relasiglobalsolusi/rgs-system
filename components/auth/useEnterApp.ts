"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { revealWelcome } from "@/components/auth/auth-welcome-store";

export type EnterAppPhase = "idle" | "shrink";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * After a successful sign-in: shrink the auth page, show Welcome + name,
 * then continue into the ERP.
 */
export function useEnterApp() {
  const router = useRouter();
  const [phase, setPhase] = useState<EnterAppPhase>("idle");

  const enterApp = useCallback(
    async (href: string, name: string) => {
      const displayName = name.trim();
      const path = href.trim() || "/dashboard";
      const reduceMotion = prefersReducedMotion();

      if (!reduceMotion) {
        setPhase("shrink");
        await wait(720);
      }

      const welcomeDone = revealWelcome(displayName);
      if (!reduceMotion) {
        await wait(280);
      }
      router.push(path);
      router.refresh();
      await welcomeDone;
    },
    [router]
  );

  return { phase, enterApp };
}
