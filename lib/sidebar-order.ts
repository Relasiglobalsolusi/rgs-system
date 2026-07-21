import { prisma } from "@/lib/prisma";
import type { MenuChildItem, MenuSection } from "@/lib/permissions";
import {
  EXTRA_MENU_NAV_KEYS,
  MODULES,
  getMenuItemNavKey,
  menu,
} from "@/lib/permissions";

/**
 * Persisted sidebar preferences (User.sidebarOrder JSON).
 *
 * New shape:
 *   {
 *     sectionOrder: ["Overview", "Administration", …],
 *     sections: { "Operations": ["projects", …] },
 *     children: { projects: ["/projects", …] }
 *   }
 *
 * Legacy shape (still accepted on read):
 *   { "Operations": ["projects", "dashboard", …] }
 *
 * Section item keys are nav keys (`module`, or explicit `navKey` when multiple
 * items share a module — e.g. `taxInvoices`).
 */
export type SidebarOrder = {
  /** Ordered section titles (Overview, Administration, …). */
  sectionOrder: string[];
  sections: Record<string, string[]>;
  /** Nav/module key → ordered child hrefs within that parent. */
  children: Record<string, string[]>;
};

/** Default category order from the canonical menu definition. */
export const DEFAULT_SECTION_ORDER: string[] = menu.map(
  (section) => section.title
);

const KNOWN_SECTION_TITLES = new Set(DEFAULT_SECTION_ORDER);

/** Nav keys that moved from Operations → Human Resources. */
const HR_NAV_KEYS = new Set(["attendance", "leaves", "approvals"]);

const NAV_KEY_SET = new Set<string>([...MODULES, ...EXTRA_MENU_NAV_KEYS]);

/** Pull HR nav keys out of a legacy Operations list into Human Resources. */
function migrateHrSectionItems(
  sections: Record<string, string[]>
): Record<string, string[]> {
  const operations = sections.Operations;
  if (!operations?.length) return sections;

  const moved: string[] = [];
  const remaining: string[] = [];
  for (const key of operations) {
    if (HR_NAV_KEYS.has(key)) moved.push(key);
    else remaining.push(key);
  }
  if (moved.length === 0) return sections;

  const next = { ...sections };
  if (remaining.length > 0) next.Operations = remaining;
  else delete next.Operations;

  const existingHr = next["Human Resources"] ?? [];
  const seen = new Set(existingHr);
  const mergedHr = [...existingHr];
  for (const key of moved) {
    if (!seen.has(key)) {
      mergedHr.push(key);
      seen.add(key);
    }
  }
  next["Human Resources"] = mergedHr;
  return next;
}

function cleanNavKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  return keys.filter(
    (key): key is string => typeof key === "string" && NAV_KEY_SET.has(key)
  );
}

function cleanHrefList(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const key of keys) {
    if (typeof key !== "string" || !key.trim() || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(key);
  }
  return cleaned;
}

function cleanSectionTitles(titles: unknown): string[] {
  if (!Array.isArray(titles)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const title of titles) {
    if (typeof title !== "string" || !KNOWN_SECTION_TITLES.has(title)) continue;
    if (seen.has(title)) continue;
    seen.add(title);
    cleaned.push(title);
  }
  return cleaned;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Detect legacy flat map: section title → module key arrays. */
function isLegacySidebarOrder(
  value: Record<string, unknown>
): value is Record<string, unknown[]> {
  // New format always has a `sections` object (and usually `children`).
  if (isPlainObject(value.sections)) return false;
  if (Array.isArray(value.sectionOrder)) return false;

  const entries = Object.entries(value);
  if (entries.length === 0) return false;
  return entries.every(([, keys]) => Array.isArray(keys));
}

export function parseSidebarOrder(value: unknown): SidebarOrder | null {
  if (!isPlainObject(value)) return null;

  if (isLegacySidebarOrder(value)) {
    const sections: Record<string, string[]> = {};
    for (const [section, keys] of Object.entries(value)) {
      const cleaned = cleanNavKeys(keys);
      if (cleaned.length > 0) sections[section] = cleaned;
    }
    if (Object.keys(sections).length === 0) return null;
    return {
      sectionOrder: [],
      sections: migrateHrSectionItems(sections),
      children: {},
    };
  }

  const sectionsRaw = value.sections;
  const childrenRaw = value.children;
  const sectionOrder = cleanSectionTitles(value.sectionOrder);
  let sections: Record<string, string[]> = {};
  const children: Record<string, string[]> = {};

  if (isPlainObject(sectionsRaw)) {
    for (const [section, keys] of Object.entries(sectionsRaw)) {
      const cleaned = cleanNavKeys(keys);
      if (cleaned.length > 0) sections[section] = cleaned;
    }
  }

  sections = migrateHrSectionItems(sections);

  if (isPlainObject(childrenRaw)) {
    for (const [moduleKey, hrefs] of Object.entries(childrenRaw)) {
      if (!NAV_KEY_SET.has(moduleKey)) continue;
      const cleaned = cleanHrefList(hrefs);
      if (cleaned.length > 0) children[moduleKey] = cleaned;
    }
  }

  if (
    sectionOrder.length === 0 &&
    Object.keys(sections).length === 0 &&
    Object.keys(children).length === 0
  ) {
    return null;
  }

  return { sectionOrder, sections, children };
}

/** Keep only known modules / hrefs / section titles; drop empty maps. */
export function sanitizeSidebarOrder(order: SidebarOrder): SidebarOrder | null {
  return parseSidebarOrder(order);
}

function orderChildren(
  children: MenuChildItem[] | undefined,
  preferredHrefs: string[] | undefined
): MenuChildItem[] | undefined {
  if (!children?.length) return children;
  if (!preferredHrefs?.length) return children;

  const byHref = new Map(children.map((child) => [child.href, child]));
  const ordered: MenuChildItem[] = [];
  const seen = new Set<string>();

  for (const href of preferredHrefs) {
    const child = byHref.get(href);
    if (child && !seen.has(child.href)) {
      ordered.push(child);
      seen.add(child.href);
    }
  }

  for (const child of children) {
    if (!seen.has(child.href)) {
      ordered.push(child);
    }
  }

  return ordered;
}

function reorderSections(
  sections: MenuSection[],
  preferredTitles: string[] | undefined
): MenuSection[] {
  if (!preferredTitles?.length) return sections;

  const byTitle = new Map(sections.map((section) => [section.title, section]));
  const ordered: MenuSection[] = [];
  const seen = new Set<string>();

  for (const title of preferredTitles) {
    const section = byTitle.get(title);
    if (section && !seen.has(section.title)) {
      ordered.push(section);
      seen.add(section.title);
    }
  }

  for (const section of sections) {
    if (!seen.has(section.title)) {
      ordered.push(section);
      seen.add(section.title);
    }
  }

  return ordered;
}

/**
 * Reorder sections, items within each section, and children within each parent
 * module using saved preferences. Unknown/new entries append at the end.
 * Permissions-filtered sections stay intact — only visible ones are reordered.
 */
export function applySidebarOrder(
  sections: MenuSection[],
  order: SidebarOrder | null | undefined
): MenuSection[] {
  if (!order) return sections;

  const itemOrderBySection = order.sections ?? {};
  const childOrder = order.children ?? {};

  const withOrderedItems = sections.map((section) => {
    const preferred = itemOrderBySection[section.title];
    let items = section.items;

    if (preferred?.length) {
      const byNavKey = new Map(
        section.items.map((item) => [getMenuItemNavKey(item), item])
      );
      const ordered: typeof section.items = [];
      const seen = new Set<string>();

      for (const key of preferred) {
        const item = byNavKey.get(key);
        if (item) {
          const navKey = getMenuItemNavKey(item);
          if (!seen.has(navKey)) {
            ordered.push(item);
            seen.add(navKey);
          }
        }
      }

      for (const item of section.items) {
        const navKey = getMenuItemNavKey(item);
        if (!seen.has(navKey)) {
          ordered.push(item);
          seen.add(navKey);
        }
      }

      items = ordered;
    }

    items = items.map((item) => {
      const nextChildren = orderChildren(
        item.children,
        childOrder[getMenuItemNavKey(item)] ?? childOrder[item.module]
      );
      if (nextChildren === item.children) return item;
      return { ...item, children: nextChildren };
    });

    return { ...section, items };
  });

  return reorderSections(withOrderedItems, order.sectionOrder);
}

export async function fetchUserSidebarOrder(
  userId: string
): Promise<SidebarOrder | null> {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sidebarOrder: true },
  });

  if (!user) return null;
  return parseSidebarOrder(user.sidebarOrder);
}

/** Single DB round-trip for JWT refresh (moduleOverrides + sidebarOrder). */
export async function fetchUserNavPreferences(userId: string): Promise<{
  moduleOverrides: Record<string, boolean> | null;
  sidebarOrder: SidebarOrder | null;
}> {
  if (!userId) {
    return { moduleOverrides: null, sidebarOrder: null };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { moduleOverrides: true, sidebarOrder: true },
  });

  if (!user) {
    return { moduleOverrides: null, sidebarOrder: null };
  }

  const moduleOverrides =
    user.moduleOverrides &&
    typeof user.moduleOverrides === "object" &&
    !Array.isArray(user.moduleOverrides)
      ? (user.moduleOverrides as Record<string, boolean>)
      : null;

  return {
    moduleOverrides,
    sidebarOrder: parseSidebarOrder(user.sidebarOrder),
  };
}
