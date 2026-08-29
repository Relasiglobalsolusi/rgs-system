import { formatDisplayDate } from "@/lib/format-date";
import { localizeJobTitle, localizeNavLabel } from "@/lib/i18n/labels";
import { localeToBcp47, type AppLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import {
  CLIENT_FINANCE_MENU_ITEMS,
  getVisibleModules,
  menu,
  MODULES,
  PORTAL_BLOCKED_MODULES,
  type ModuleKey,
} from "@/lib/permissions";
import {
  clientFallbackSystemGuideCopy,
  fallbackSystemGuideCopy,
  fieldStaffFallbackSystemGuideCopy,
  SYSTEM_GUIDE_COPY,
  warehouseFallbackSystemGuideCopy,
} from "@/lib/system-guide/copy";
import { SYSTEM_GUIDE_PERSONA_COPY } from "@/lib/system-guide/copy-personas";
import { liveLeaveHierarchyCopy } from "@/lib/system-guide/leave-hierarchy";
import {
  isFieldSystemGuidePersona,
  personaFallsBackToHeadOfficeCopy,
  personaUsesLeaveApproverCopy,
  resolveSystemGuidePersona,
  type SystemGuidePersona,
} from "@/lib/system-guide/persona";
import type {
  SystemGuideDocument,
  SystemGuideModuleCopy,
  SystemGuideResolvedModule,
} from "@/lib/system-guide/types";

function isModuleKey(value: string): value is ModuleKey {
  return (MODULES as readonly string[]).includes(value);
}

function moduleSidebarLocation(
  module: ModuleKey,
  locale: AppLocale,
  audience: SystemGuideDocument["audience"]
): { section: string; openAt: string } {
  const moduleName = translate(locale, `modules.${module}`);
  const catalog =
    audience === "client"
      ? menu.map((section) =>
          section.title === "Finance"
            ? { ...section, items: CLIENT_FINANCE_MENU_ITEMS }
            : section
        )
      : menu;
  for (const section of catalog) {
    const matches = section.items.filter((item) => item.module === module);
    if (matches.length === 0) continue;
    const sectionLabel = section.bare
      ? ""
      : localizeNavLabel(section.title, locale);
    const itemLabels = matches.map((item) =>
      localizeNavLabel(item.label, locale)
    );
    const uniqueLabels = [...new Set(itemLabels)];
    const openAt = sectionLabel
      ? `${sectionLabel} > ${uniqueLabels.join(" / ")}`
      : uniqueLabels[0] ?? moduleName;
    return { section: sectionLabel || moduleName, openAt };
  }
  return { section: moduleName, openAt: moduleName };
}

export function parseRequestedGuideModules(
  raw: unknown
): ModuleKey[] {
  const visible = new Set(getVisibleModules());
  const values = Array.isArray(raw) ? raw : [];
  const seen = new Set<ModuleKey>();
  const ordered: ModuleKey[] = [];
  for (const value of values) {
    if (typeof value !== "string" || !isModuleKey(value)) continue;
    if (!visible.has(value) || seen.has(value)) continue;
    seen.add(value);
    ordered.push(value);
  }
  return getVisibleModules().filter((module) => seen.has(module));
}

function localeCopy(
  pair: Record<AppLocale, SystemGuideModuleCopy> | undefined,
  locale: AppLocale
): SystemGuideModuleCopy | undefined {
  return pair?.[locale];
}

/**
 * Warehouse may reuse Head Office steps for stock and office work.
 * Billing, payroll, and the user directory stay on the warehouse fallback.
 */
const WAREHOUSE_MAY_USE_HEAD_OFFICE = new Set<ModuleKey>([
  "dashboard",
  "projects",
  "teams",
  "progress",
  "cico",
  "pettyCash",
  "shifts",
  "leaves",
  "approvals",
  "materialRequests",
  "transferOrders",
  "inventory",
  "itemCatalog",
]);

/**
 * One chapter per granted module. Copy is written for this reader only.
 * Client and field crew never inherit Head Office how-to steps.
 * Field crew can share Cleaning Staff chapters when they have no override.
 */
function resolveModuleCopy(
  key: ModuleKey,
  persona: SystemGuidePersona,
  locale: AppLocale,
  moduleName: string
): SystemGuideModuleCopy {
  if (persona === "client") {
    return (
      localeCopy(SYSTEM_GUIDE_PERSONA_COPY.client?.[key], locale) ??
      clientFallbackSystemGuideCopy(moduleName, locale)
    );
  }

  const own = localeCopy(SYSTEM_GUIDE_PERSONA_COPY[persona]?.[key], locale);
  if (own) return own;

  if (isFieldSystemGuidePersona(persona)) {
    return (
      localeCopy(SYSTEM_GUIDE_PERSONA_COPY.cleaningStaff?.[key], locale) ??
      fieldStaffFallbackSystemGuideCopy(moduleName, locale)
    );
  }

  if (persona === "warehouse") {
    if (WAREHOUSE_MAY_USE_HEAD_OFFICE.has(key)) {
      return (
        localeCopy(SYSTEM_GUIDE_COPY[key], locale) ??
        warehouseFallbackSystemGuideCopy(moduleName, locale)
      );
    }
    return warehouseFallbackSystemGuideCopy(moduleName, locale);
  }

  if (personaFallsBackToHeadOfficeCopy(persona)) {
    return (
      localeCopy(SYSTEM_GUIDE_COPY[key], locale) ??
      fallbackSystemGuideCopy(moduleName, locale)
    );
  }

  return fallbackSystemGuideCopy(moduleName, locale);
}

function withLiveLeaveHierarchy(
  key: ModuleKey,
  copy: SystemGuideModuleCopy,
  locale: AppLocale,
  persona: SystemGuidePersona
): SystemGuideModuleCopy {
  if (key !== "approvals" && key !== "leaves") return copy;
  if (!personaUsesLeaveApproverCopy(persona)) return copy;
  if (key === "leaves" && persona !== "director" && persona !== "opsManager") {
    return copy;
  }
  const live = liveLeaveHierarchyCopy(locale);
  if (key === "approvals") {
    return {
      ...copy,
      steps: [...copy.steps, ...live.steps],
      remember: [...(copy.remember ?? []), ...live.remember],
    };
  }
  return {
    ...copy,
    remember: [...(copy.remember ?? []), ...live.remember],
  };
}

export function resolveSystemGuideDocument(input: {
  locale: AppLocale;
  positionName: string;
  departmentLabel: string;
  modules: ModuleKey[];
  audience?: SystemGuideDocument["audience"];
  generatedAt?: Date;
}): SystemGuideDocument {
  const locale = input.locale;
  const audience = input.audience ?? "position";
  const persona = resolveSystemGuidePersona({
    audience,
    positionName: input.positionName,
    departmentLabel: input.departmentLabel,
  });
  const rawName = input.positionName.trim();
  const localizedName =
    audience === "client"
      ? rawName || "-"
      : localizeJobTitle(rawName, locale) || rawName || "-";
  const requestedModules =
    audience === "client"
      ? input.modules.filter(
          (key) => !PORTAL_BLOCKED_MODULES.includes(key)
        )
      : input.modules;
  const modules: SystemGuideResolvedModule[] = requestedModules.map((key) => {
    const name = translate(locale, `modules.${key}`);
    const location = moduleSidebarLocation(key, locale, audience);
    const copy = resolveModuleCopy(key, persona, locale, name);
    return {
      key,
      name,
      section: location.section,
      openAt: location.openAt,
      copy: withLiveLeaveHierarchy(key, copy, locale, persona),
    };
  });

  return {
    locale,
    audience,
    persona,
    positionName: localizedName,
    departmentLabel: input.departmentLabel.trim(),
    generatedOn: formatDisplayDate(
      input.generatedAt ?? new Date(),
      undefined,
      localeToBcp47(locale)
    ),
    modules,
  };
}
