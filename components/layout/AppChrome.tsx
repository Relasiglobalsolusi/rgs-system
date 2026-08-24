"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import MultiProjectUnlockActivity from "@/components/clients/MultiProjectUnlockActivity";
import Sidebar from "@/components/layout/Sidebar";

const BARE_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/first-login",
  "/set-password",
  "/set-recovery-email",
  "/sign-out",
  "/multi-project-unlock",
];

function isBareRoute(pathname: string) {
  if (pathname === "/") return true;
  return BARE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

type Props = {
  children: ReactNode;
  showChangeSecurityCode?: boolean;
};

/** Sidebar stays mounted across ERP modules so it does not jump on navigation. */
export default function AppChrome({
  children,
  showChangeSecurityCode = false,
}: Props) {
  const pathname = usePathname();

  if (isBareRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-background text-text lg:h-dvh lg:overflow-hidden">
      <MultiProjectUnlockActivity enabled={showChangeSecurityCode} />
      <div className="flex min-h-dvh w-full min-w-0 lg:h-full">
        <Sidebar showChangeSecurityCode={showChangeSecurityCode} />
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
          {children}
        </div>
      </div>
    </main>
  );
}
