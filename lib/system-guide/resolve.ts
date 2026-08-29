import { formatDisplayDate } from "@/lib/format-date";
import { localizeJobTitle, localizeNavLabel } from "@/lib/i18n/labels";
import { localeToBcp47, type AppLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import {
  getVisibleModules,
  menu,
  MODULES,
  type ModuleKey,
} from "@/lib/permissions";
import {
  fallbackSystemGuideCopy,
  SYSTEM_GUIDE_COPY,
} from "@/lib/system-guide/copy";
import { liveLeaveHierarchyCopy } from "@/lib/system-guide/leave-hierarchy";
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
  locale: AppLocale
): { section: string; openAt: string } {
  const moduleName = translate(locale, `modules.${module}`);
  for (const section of menu) {
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

function withLiveLeaveHierarchy(
  key: ModuleKey,
  copy: SystemGuideModuleCopy,
  locale: AppLocale
): SystemGuideModuleCopy {
  if (key !== "approvals" && key !== "leaves") return copy;
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
  const rawName = input.positionName.trim();
  const localizedName =
    audience === "client"
      ? rawName || "-"
      : localizeJobTitle(rawName, locale) || rawName || "-";
  const modules: SystemGuideResolvedModule[] = input.modules.map((key) => {
    const name = translate(locale, `modules.${key}`);
    const location = moduleSidebarLocation(key, locale);
    const pair = SYSTEM_GUIDE_COPY[key];
    const copy = pair?.[locale] ?? fallbackSystemGuideCopy(name, locale);
    return {
      key,
      name,
      section: location.section,
      openAt: location.openAt,
      copy: withLiveLeaveHierarchy(key, copy, locale),
    };
  });

  return {
    locale,
    audience,
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
