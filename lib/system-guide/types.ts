import type { AppLocale } from "@/lib/i18n/locale";
import type { ModuleKey } from "@/lib/permissions";
import type { SystemGuidePersona } from "@/lib/system-guide/persona";

export type SystemGuideModuleCopy = {
  purpose: string;
  steps: readonly string[];
  remember?: readonly string[];
};

export type SystemGuideChapterKey = ModuleKey | "firstLogin";

export type SystemGuideResolvedModule = {
  key: SystemGuideChapterKey;
  name: string;
  section: string;
  openAt: string;
  copy: SystemGuideModuleCopy;
};

export type SystemGuideAudience = "position" | "client";

export type SystemGuideDocument = {
  locale: AppLocale;
  audience: SystemGuideAudience;
  /** Who the how-to steps are written for. */
  persona: SystemGuidePersona;
  /** Position title or client organization name (cover subject). */
  positionName: string;
  departmentLabel: string;
  generatedOn: string;
  modules: SystemGuideResolvedModule[];
};
