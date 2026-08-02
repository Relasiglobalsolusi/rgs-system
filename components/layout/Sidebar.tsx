"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Suspense } from "react";

import { changeMultiProjectSecurityCode } from "@/app/multi-project-unlock/actions";
import BrandSlogan from "@/components/brand/BrandSlogan";
import SidebarNav, {
  SidebarNavFallback,
} from "@/components/layout/SidebarNav";
import SidebarRearrangeDialog from "@/components/layout/SidebarRearrangeDialog";
import { useLocale } from "@/components/providers/LocaleProvider";
import { RGS_ONE_LOGO_SRC } from "@/lib/brand";
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

  const initials = session?.user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="sidebar-surface max-lg:hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:max-h-screen lg:w-[308px] lg:flex-col lg:overflow-hidden">
      <div className="sidebar-brand-bar flex h-(--app-topbar-height) shrink-0 items-center justify-center px-4 py-3">
        <Link
          href="/dashboard"
          className="flex w-full flex-col items-center justify-center gap-1.5"
          aria-label={t("header.dashboardAria")}
        >
          <div className="mx-auto w-full max-w-[200px]">
            <Image
              src={RGS_ONE_LOGO_SRC}
              alt="RGS ONE"
              width={1024}
              height={682}
              priority
              unoptimized
              className="mx-auto block h-auto w-full max-h-[9rem] object-contain"
            />
          </div>
          <BrandSlogan className="shrink-0 px-1" />
        </Link>
      </div>

      <Suspense fallback={<SidebarNavFallback />}>
        <SidebarNav />
      </Suspense>

      <div className="shrink-0 border-t border-border/70 p-4">
        <div className="sidebar-account-card">
          <div className="flex items-center gap-3.5">
            <div className="sidebar-account-card__avatar" aria-hidden>
              {initials ?? "U"}
            </div>

            <div className="sidebar-account-card__meta min-w-0 flex-1">
              <p className="sidebar-account-card__name">
                {session?.user?.name ?? t("header.user")}
              </p>
              <p className="sidebar-account-card__role">
                {session?.user
                  ? getSessionProfileLabel(session.user, locale)
                  : t("header.guest")}
              </p>
            </div>
          </div>

          <div className="mt-3.5">
            <SidebarRearrangeDialog
              showLabel
              triggerClassName="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-accent-cyan/28 bg-elevated/80 text-sm font-medium text-accent-cyan transition hover:border-accent-cyan/50 hover:bg-[color-mix(in_srgb,var(--color-elevated),var(--color-accent-cyan)_8%)]"
            />
          </div>

          {showChangeSecurityCode ? (
            <form action={changeMultiProjectSecurityCode} className="mt-2">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-elevated/80 py-2.5 text-sm font-medium text-text transition hover:bg-card"
              >
                {t("pages.multiProjectUnlock.changeCode")}
              </button>
            </form>
          ) : null}

          <Link
            href="/api/auth/signout"
            className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-red-500/25 bg-card-tint-red/90 py-2.5 text-sm font-medium text-danger transition hover:bg-[color-mix(in_srgb,var(--color-card-tint-red),var(--color-card-hover)_30%)]"
          >
            <LogOut size={16} />
            {t("header.signOut")}
          </Link>
        </div>
      </div>
    </aside>
  );
}
