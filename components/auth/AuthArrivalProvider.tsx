"use client";

import { useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import AuthWelcomeLayer from "@/components/auth/AuthWelcomeLayer";
import {
  getAuthWelcomeState,
  hydrateAuthWelcome,
  subscribeAuthWelcome,
} from "@/components/auth/auth-welcome-store";

/** Hosts the post-login Welcome overlay. Triggered via `revealWelcome` in the store. */
export function AuthArrivalProvider({ children }: { children: ReactNode }) {
  const welcome = useSyncExternalStore(
    subscribeAuthWelcome,
    getAuthWelcomeState,
    getAuthWelcomeState
  );

  useLayoutEffect(() => {
    hydrateAuthWelcome();
  }, []);

  return (
    <>
      {children}
      {typeof document !== "undefined" && welcome.open
        ? createPortal(
            <div className="auth-surface">
              <AuthWelcomeLayer
                open
                name={welcome.name}
                leaving={welcome.leaving}
              />
            </div>,
            document.body
          )
        : null}
    </>
  );
}
