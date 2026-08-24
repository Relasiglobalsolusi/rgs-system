"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { LogOut, Settings2 } from "lucide-react";
import { Suspense, useState } from "react";

import { changeMultiProjectSecurityCode } from "@/app/multi-project-unlock/actions";
import SignOutConfirmDialog from "@/components/auth/SignOutConfirmDialog";
import BrandLogo from "@/components/brand/BrandLogo";
import BrandSlogan from "@/components/brand/BrandSlogan";
import SidebarNav, {
  SidebarNavFallback,
} from "@/components/layout/SidebarNav";
import SidebarRearrangeDialog from "@/components/layout/SidebarRearrangeDialog";
import { useLocale } from "@/components/providers/LocaleProvider";
import { getSessionProfileLabel } from "@/lib/permissions";

type SidebarProps = {
  /** When true, show Change Security Code (Multi-Project Access effectively on). */
  showChangeSecurityCode?: boolean;
};

export default function Sidebar({
  showChangeSecurityCode = false,
}: SidebarProps) {
  const { data: session } = useSession();
  const { locale, t } = useLocale();
  const [rearrangeOpen, setRearrangeOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const initials = session?.user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="sidebar-surface max-lg:hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:max-h-screen lg:w-(--app-sidebar-width) lg:min-w-(--app-sidebar-width) lg:flex-none lg:flex-col lg:overflow-hidden [overflow-anchor:none]">
      <div className="sidebar-brand-bar flex h-(--app-topbar-height) shrink-0 items-center justify-center px-4 py-3">
        <Link
          href="/dashboard"
          className="flex w-full flex-col items-center justify-center gap-1.5"
          aria-label={t("header.dashboardAria")}
        >
          <div className="mx-auto w-full max-w-(--app-sidebar-logo-max-width)">
            <BrandLogo
              priority
              className="mx-auto block w-full"
              imageClassName="mx-auto block h-auto w-full max-h-[9rem] min-h-[5.25rem] object-contain"
            />
          </div>
          <BrandSlogan className="shrink-0 px-1" />
        </Link>
      </div>

      <Suspense fallback={<SidebarNavFallback />}>
        <SidebarNav />
      </Suspense>

      <div className="relative z-10 shrink-0 border-t border-border/50 px-4 pb-3 pt-3">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="sidebar-account-avatar" aria-hidden>
            {initials ?? "U"}
          </div>
          <div className="min-w-0 w-full">
            <p className="truncate text-sm font-semibold leading-tight text-text">
              {session?.user?.name ?? t("header.user")}
            </p>
            <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-cyan/85">
              {session?.user
                ? getSessionProfileLabel(session.user, locale)
                : t("header.guest")}
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-col gap-1.5">
          <button
            type="button"
            aria-label={t("nav.rearrange")}
            onClick={() => setRearrangeOpen(true)}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-accent-cyan/28 bg-elevated/80 text-sm font-medium text-accent-cyan transition hover:border-accent-cyan/50 hover:bg-[color-mix(in_srgb,var(--color-elevated),var(--color-accent-cyan)_8%)]"
          >
            <Settings2 size={16} aria-hidden />
            {t("nav.rearrangeShort")}
          </button>

          {showChangeSecurityCode ? (
            <form action={changeMultiProjectSecurityCode}>
              <button
                type="submit"
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-transparent text-sm font-medium text-text transition hover:bg-elevated"
              >
                {t("pages.multiProjectUnlock.changeCode")}
              </button>
            </form>
          ) : null}

          <button
            type="button"
            onClick={() => setSignOutOpen(true)}
            className="relative z-10 flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-red-500/25 bg-transparent text-sm font-medium text-danger transition hover:bg-card-tint-red/70"
          >
            <LogOut size={15} />
            {t("header.signOut")}
          </button>
        </div>
      </div>
      <SidebarRearrangeDialog
        hideTrigger
        open={rearrangeOpen}
        onOpenChange={setRearrangeOpen}
      />
      <SignOutConfirmDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </aside>
  );
}
