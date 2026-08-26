"use client";

import { ChevronLeft, LogOut, Menu, Settings2 } from "lucide-react";
import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";

import SignOutConfirmDialog from "@/components/auth/SignOutConfirmDialog";
import SidebarNav, {
  SidebarNavFallback,
} from "@/components/layout/SidebarNav";
import SidebarRearrangeDialog from "@/components/layout/SidebarRearrangeDialog";
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
  const [rearrangeOpen, setRearrangeOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  function openRearrange() {
    setOpen(false);
    window.setTimeout(() => {
      setRearrangeOpen(true);
    }, 180);
  }

  function openSignOut() {
    setOpen(false);
    window.setTimeout(() => {
      setSignOutOpen(true);
    }, 180);
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

      <Dialog skipUnsavedGuard open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "fixed inset-y-0 left-0 top-0 z-50 flex h-dvh max-h-dvh w-[min(100vw-3rem,20rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-visible rounded-none border-y-0 border-l-0 border-r border-border bg-panel p-0 text-text shadow-[12px_0_40px_-16px_rgba(0,0,0,0.65)] sm:max-w-none",
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            "data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-left-5 data-open:zoom-in-100 data-open:duration-300",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-left-5 data-closed:zoom-out-100 data-closed:duration-200"
          )}
        >
          <DialogTitle className="sr-only">{t("nav.menuTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("nav.menuDescription")}
          </DialogDescription>
          <button
            type="button"
            aria-label={t("nav.closeMenu")}
            title={t("nav.closeMenu")}
            onClick={close}
            className="absolute top-1/2 right-0 z-[60] flex h-20 w-9 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-r-xl border border-l-0 border-border bg-panel text-text shadow-[6px_0_18px_-8px_rgba(0,0,0,0.7)] transition hover:bg-elevated hover:text-accent-cyan"
          >
            <ChevronLeft size={22} strokeWidth={2.75} aria-hidden />
          </button>

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

          <div className="shrink-0 border-t border-border/50 px-4 py-3">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="sidebar-account-avatar" aria-hidden>
                {initials ?? "U"}
              </div>
              <div className="min-w-0 w-full">
                <p className="truncate text-sm font-semibold leading-tight text-text">
                  {displayName}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-cyan/85">
                  {profileLabel}
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex flex-col gap-1.5">
              <button
                type="button"
                aria-label={t("nav.rearrange")}
                onClick={openRearrange}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-accent-cyan/28 bg-transparent text-sm font-medium text-accent-cyan transition hover:border-accent-cyan/50 hover:bg-elevated"
              >
                <Settings2 size={15} aria-hidden />
                {t("nav.rearrangeShort")}
              </button>
              <button
                type="button"
                onClick={openSignOut}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-red-500/25 bg-transparent text-sm font-medium text-danger transition hover:bg-card-tint-red/70"
              >
                <LogOut size={15} />
                {t("header.signOut")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SidebarRearrangeDialog
        hideTrigger
        open={rearrangeOpen}
        onOpenChange={setRearrangeOpen}
      />
      <SignOutConfirmDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </>
  );
}
