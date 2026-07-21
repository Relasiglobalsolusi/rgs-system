"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { localizeNavLabel } from "@/lib/i18n/labels";
import {
  getMenuForUser,
  getMenuItemNavKey,
  type MenuChildItem,
  type MenuItem,
  type MenuSection,
} from "@/lib/permissions";
import {
  getSidebarItemExpanded,
  getSidebarSectionExpanded,
  setSidebarItemExpanded,
  setSidebarSectionExpanded,
} from "@/lib/sidebar-collapse";
import { applySidebarOrder } from "@/lib/sidebar-order";
import type { EmployeeType, UserRole } from "@prisma/client";

/** True when pathname belongs to this item, not a more-specific sibling href. */
function isTopLevelPathActive(
  itemHref: string,
  pathname: string,
  allItemHrefs: string[]
) {
  if (pathname === itemHref) return true;
  if (!pathname.startsWith(`${itemHref}/`)) return false;

  return !allItemHrefs.some(
    (href) =>
      href !== itemHref &&
      href.startsWith(`${itemHref}/`) &&
      (pathname === href || pathname.startsWith(`${href}/`))
  );
}

/** Top-level items may include query params (vendor Finance views). */
function isMenuItemActive(
  itemHref: string,
  pathname: string,
  searchParams: URLSearchParams,
  allItemHrefs: string[]
) {
  const item = getHrefParts(itemHref);
  const hasQuery = [...item.params.keys()].length > 0;

  if (hasQuery) {
    return isChildActive(itemHref, pathname, searchParams);
  }

  const pathOnlyHrefs = allItemHrefs.map((href) => getHrefParts(href).pathname);
  if (!isTopLevelPathActive(item.pathname, pathname, pathOnlyHrefs)) {
    return false;
  }

  // Shared pathname with view= siblings (e.g. vendor purchase views).
  const hasViewSiblings = allItemHrefs.some((href) => {
    const parts = getHrefParts(href);
    return parts.pathname === item.pathname && parts.params.get("view");
  });
  if (hasViewSiblings) {
    return !searchParams.get("view");
  }

  return true;
}

function getHrefParts(href: string): {
  pathname: string;
  params: URLSearchParams;
} {
  const queryIndex = href.indexOf("?");
  if (queryIndex === -1) {
    return { pathname: href, params: new URLSearchParams() };
  }
  return {
    pathname: href.slice(0, queryIndex),
    params: new URLSearchParams(href.slice(queryIndex + 1)),
  };
}

function isChildActive(
  childHref: string,
  pathname: string,
  searchParams: URLSearchParams
) {
  const child = getHrefParts(childHref);
  const hasQuery = [...child.params.keys()].length > 0;

  // Query-param children (e.g. /projects?view=payment-due).
  if (hasQuery) {
    if (pathname !== child.pathname) return false;

    const childView = child.params.get("view");
    const currentView = searchParams.get("view");

    if (childView) {
      return currentView === childView;
    }

    return !currentView;
  }

  // Path-only children (e.g. /billing, /billing/tax-invoices).
  if (pathname !== child.pathname) return false;

  // Path roots that share the URL with `?view=` siblings — only highlight
  // the unfiltered child when no view filter is active.
  if (
    child.pathname === "/projects" ||
    child.pathname === "/billing/purchase-invoices"
  ) {
    return !searchParams.get("view");
  }

  // Reconciliation uses ?tab=approved|revised — highlight for any tab on that path.
  if (child.pathname === "/billing/reconciliation") {
    return true;
  }

  return true;
}

function usePersistedExpanded(
  storageKey: string,
  active: boolean,
  getSaved: (key: string) => boolean | null,
  setSaved: (key: string, expanded: boolean) => void
) {
  // Default expanded; hydrate saved preference after mount (avoid SSR mismatch).
  const [expanded, setExpanded] = useState(true);
  const [wasActive, setWasActive] = useState(active);

  useEffect(() => {
    const saved = getSaved(storageKey);
    // No saved state → expanded. Active route under this group → expanded.
    setExpanded(active || saved === null ? true : saved);
    // Intentionally omit `active`: route changes use the sync below so a
    // manual collapse while still active is not overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate per key
  }, [storageKey, getSaved]);

  if (active !== wasActive) {
    setWasActive(active);
    if (active) setExpanded(true);
  }

  function toggleExpanded() {
    setExpanded((value) => {
      const next = !value;
      setSaved(storageKey, next);
      return next;
    });
  }

  return { expanded, toggleExpanded };
}

function MenuChildLink({
  child,
  pathname,
  searchParams,
  onNavigate,
  mobile,
}: {
  child: MenuChildItem;
  pathname: string;
  searchParams: URLSearchParams;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const { locale } = useLocale();
  const childIsActive = isChildActive(child.href, pathname, searchParams);
  const isPrimary = Boolean(child.primary);
  const label = localizeNavLabel(child.label, locale);

  return (
    <div className={isPrimary ? undefined : "ml-2"}>
      <Link
        href={child.href}
        onClick={onNavigate}
        className={`block rounded-lg transition duration-300 ${
          isPrimary
            ? `px-3 text-sm font-semibold ${
                mobile ? "min-h-11 py-2.5 flex items-center" : "py-2.5"
              } ${
                childIsActive
                  ? "bg-card-tint-cyan text-accent-teal"
                  : "text-muted hover:bg-elevated hover:text-text"
              }`
            : `px-3 text-xs ${
                mobile ? "min-h-10 py-2 flex items-center" : "py-1.5"
              } ${
                childIsActive
                  ? "bg-card-tint-teal font-medium text-primary-dark"
                  : "text-subtle hover:bg-elevated hover:text-text"
              }`
        }`}
      >
        {label}
      </Link>
    </div>
  );
}

function MenuItemRow({
  item,
  allItemHrefs,
  onNavigate,
  mobile,
}: {
  item: MenuItem;
  allItemHrefs: string[];
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale, t } = useLocale();
  const Icon = item.icon;
  const label = localizeNavLabel(item.label, locale);
  const navKey = getMenuItemNavKey(item);
  const hasChildren = Boolean(item.children?.length);
  const pathActive = isMenuItemActive(
    item.href,
    pathname,
    searchParams,
    allItemHrefs
  );
  const childActive =
    hasChildren &&
    item.children!.some((child) =>
      isChildActive(child.href, pathname, searchParams)
    );
  const active = pathActive || childActive;
  const { expanded, toggleExpanded } = usePersistedExpanded(
    navKey,
    active,
    getSidebarItemExpanded,
    setSidebarItemExpanded
  );

  return (
    <div>
      <div
        className={`group relative flex items-center justify-between rounded-xl transition-all duration-300 ${
          mobile ? "min-h-11 px-3 py-1.5" : "px-3.5 py-2.5"
        } ${
          active
            ? "border border-accent-cyan/35 bg-card-tint-cyan shadow-[inset_3px_0_0_0_var(--color-accent-cyan)]"
            : "border border-transparent hover:border-border hover:bg-elevated"
        }`}
      >
        <Link
          href={item.href}
          onClick={onNavigate}
          className={`flex min-w-0 flex-1 items-center ${mobile ? "gap-3" : "gap-3.5"}`}
        >
          <div
            className={`flex shrink-0 items-center justify-center rounded-lg transition duration-300 ${
              mobile ? "h-8 w-8" : "h-9 w-9"
            } ${
              active
                ? "bg-elevated text-accent-teal"
                : "bg-inset text-subtle group-hover:bg-elevated group-hover:text-accent-teal"
            }`}
          >
            <Icon size={mobile ? 17 : 18} />
          </div>

          <span
            className={`truncate text-sm font-medium transition-colors duration-300 ${
              active
                ? "text-text"
                : "text-muted group-hover:text-text"
            }`}
          >
            {label}
          </span>
        </Link>

        {hasChildren ? (
          <button
            type="button"
            aria-label={
              expanded
                ? t("nav.collapse", { label })
                : t("nav.expand", { label })
            }
            aria-expanded={expanded}
            onClick={toggleExpanded}
            className={`ml-1 rounded-lg transition duration-300 ${
              mobile ? "flex h-10 w-10 items-center justify-center" : "p-1"
            } ${
              active
                ? "text-accent-teal hover:bg-elevated"
                : "text-subtle hover:bg-elevated hover:text-muted"
            }`}
          >
            <ChevronDown
              size={18}
              className={`transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                expanded ? "rotate-0" : "-rotate-90"
              }`}
            />
          </button>
        ) : (
          active && <ChevronRight size={18} className="text-accent-cyan" />
        )}
      </div>

      {hasChildren ? (
        <div className="sidebar-submenu" data-open={expanded ? "true" : "false"}>
          <div className="sidebar-submenu-inner">
            <div
              className={`border-l border-accent-cyan/25 pb-0.5 ${
                mobile
                  ? "ml-5 mt-1.5 space-y-0.5 pl-3"
                  : "ml-7 mt-2 space-y-1 pl-4"
              }`}
            >
              {item.children!.map((child) => (
                <MenuChildLink
                  key={child.href}
                  child={child}
                  pathname={pathname}
                  searchParams={searchParams}
                  onNavigate={onNavigate}
                  mobile={mobile}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isSectionActive(
  section: MenuSection,
  pathname: string,
  searchParams: URLSearchParams,
  allItemHrefs: string[]
) {
  return section.items.some((item) => {
    const pathActive = isMenuItemActive(
      item.href,
      pathname,
      searchParams,
      allItemHrefs
    );
    const childActive =
      Boolean(item.children?.length) &&
      item.children!.some((child) =>
        isChildActive(child.href, pathname, searchParams)
      );
    return pathActive || childActive;
  });
}

function MenuSectionBlock({
  section,
  allItemHrefs,
  onNavigate,
  mobile,
}: {
  section: MenuSection;
  allItemHrefs: string[];
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale, t } = useLocale();
  const title = localizeNavLabel(section.title, locale);
  const active = isSectionActive(
    section,
    pathname,
    searchParams,
    allItemHrefs
  );
  const { expanded, toggleExpanded } = usePersistedExpanded(
    section.title,
    active,
    getSidebarSectionExpanded,
    setSidebarSectionExpanded
  );

  return (
    <div className={mobile ? "mb-5" : "mb-7"}>
      <button
        type="button"
        aria-label={
          expanded
            ? t("nav.collapse", { label: title })
            : t("nav.expand", { label: title })
        }
        aria-expanded={expanded}
        onClick={toggleExpanded}
        className={`group mb-2 flex w-full items-center justify-between gap-2 rounded-lg px-3 transition duration-300 hover:bg-elevated/60 ${
          mobile ? "min-h-9 py-1.5" : "mb-2.5 py-1"
        }`}
      >
        <span
          className={
            mobile
              ? "text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle"
              : "text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-blue/70"
          }
        >
          {title}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-subtle transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:text-muted ${
            expanded ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>

      <div className="sidebar-submenu" data-open={expanded ? "true" : "false"}>
        <div className="sidebar-submenu-inner">
          <div className={mobile ? "space-y-0.5" : "space-y-1"}>
            {section.items.map((item) => (
              <MenuItemRow
                key={getMenuItemNavKey(item)}
                item={item}
                allItemHrefs={allItemHrefs}
                onNavigate={onNavigate}
                mobile={mobile}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type SidebarNavProps = {
  onNavigate?: () => void;
  className?: string;
  /** Mobile drawer density — taller touch targets; desktop unchanged. */
  variant?: "desktop" | "mobile";
};

export function SidebarNavFallback({
  className = "min-h-0 flex-1 overflow-y-auto px-4 py-5",
}: {
  className?: string;
}) {
  return <div className={className} />;
}

export default function SidebarNav({
  onNavigate,
  className = "min-h-0 flex-1 overflow-y-auto px-4 py-5",
  variant = "desktop",
}: SidebarNavProps) {
  const { data: session } = useSession();
  const mobile = variant === "mobile";

  const role = (session?.user?.role ?? "ADMIN") as UserRole;
  const employeeType = (session?.user?.employeeType ?? null) as EmployeeType | null;
  const menu = applySidebarOrder(
    getMenuForUser({
      role,
      employeeType,
      moduleOverrides: session?.user?.moduleOverrides ?? null,
      clientId: session?.user?.clientId ?? null,
      vendorId: session?.user?.vendorId ?? null,
      username: session?.user?.username,
    }),
    session?.user?.sidebarOrder ?? null
  );

  const allItemHrefs = menu.flatMap((section) =>
    section.items.map((item) => item.href)
  );

  return (
    <div className={className}>
      {menu.map((section) => (
        <MenuSectionBlock
          key={section.title}
          section={section}
          allItemHrefs={allItemHrefs}
          onNavigate={onNavigate}
          mobile={mobile}
        />
      ))}
    </div>
  );
}
