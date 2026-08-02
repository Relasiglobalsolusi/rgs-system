"use client";

import Link from "next/link";
import { LogOut, Menu } from "lucide-react";
import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";

import SidebarNav, {
  SidebarNavFallback,
} from "@/components/layout/SidebarNav";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSessionProfileLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type MobileNavDialogProps = {
  triggerClassName?: string;
};

export default function MobileNavDialog({
  triggerClassName,
}: MobileNavDialogProps) {
  const { data: session } = useSession();
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  const initials = session?.user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const displayName = session?.user?.name ?? t("header.user");
  const profileLabel = session?.user
    ? getSessionProfileLabel(session.user, locale)
    : t("header.guest");

  return (
    <>
      <button
        type="button"
        aria-label={t("nav.openMenu")}
        title={t("nav.openMenu")}
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "header-menu-trigger flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-secondary text-text transition hover:border-accent-cyan/40 hover:bg-elevated hover:text-accent-cyan"
        }
      >
        <Menu size={24} strokeWidth={3} absoluteStrokeWidth aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "fixed inset-y-0 left-0 top-0 z-50 flex h-dvh max-h-dvh w-[min(100vw-3rem,20rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-y-0 border-l-0 border-r border-border bg-panel p-0 text-text shadow-[12px_0_40px_-16px_rgba(0,0,0,0.65)] sm:max-w-none",
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            "data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-left-5 data-open:zoom-in-100 data-open:duration-300",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-left-5 data-closed:zoom-out-100 data-closed:duration-200"
          )}
        >
          <DialogTitle className="sr-only">{t("nav.menuTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("nav.menuDescription")}
          </DialogDescription>

          <Suspense
            fallback={
              <SidebarNavFallback className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4" />
            }
          >
            <SidebarNav
              variant="mobile"
              onNavigate={close}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
            />
          </Suspense>

          {/* Footer: avatar row 1, name/role row 2 + sign out */}
          <div className="shrink-0 border-t border-border bg-strip/80 px-4 py-3.5">
            <div className="mb-3 flex flex-col items-center gap-2 text-center">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold tracking-wide text-[#e8eef5] shadow-[0_0_0_1px_rgba(107,184,200,0.28),0_0_0_3px_rgba(12,20,32,0.8)]"
                style={{
                  background:
                    "linear-gradient(155deg, #2a3d54 0%, #172636 55%, #121c2a 100%)",
                }}
                aria-hidden
              >
                {initials ?? "U"}
              </div>
              <div className="min-w-0 w-full px-1">
                <p className="break-words text-sm font-semibold leading-snug text-text">
                  {displayName}
                </p>
                <p className="mt-0.5 break-words text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-cyan/85">
                  {profileLabel}
                </p>
              </div>
            </div>

            <Link
              href="/api/auth/signout"
              onClick={close}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-500/25 bg-card-tint-red/90 px-3 text-sm font-medium text-danger transition hover:bg-[color-mix(in_srgb,var(--color-card-tint-red),var(--color-card-hover)_30%)]"
            >
              <LogOut size={16} />
              {t("header.signOut")}
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
