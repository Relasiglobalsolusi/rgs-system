import type { AppLocale } from "@/lib/i18n/locale";
import type { ModuleKey } from "@/lib/permissions";

export type SystemGuideModuleCopy = {
  purpose: string;
  steps: readonly string[];
  remember?: readonly string[];
};

export type SystemGuideResolvedModule = {
  key: ModuleKey;
  name: string;
  section: string;
  openAt: string;
  copy: SystemGuideModuleCopy;
};

export type SystemGuideAudience = "position" | "client";

export type SystemGuideDocument = {
  locale: AppLocale;
  audience: SystemGuideAudience;
  /** Position title or client organization name (cover subject). */
  positionName: string;
  departmentLabel: string;
  generatedOn: string;
  modules: SystemGuideResolvedModule[];
};
