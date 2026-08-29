import {
  getVisibleModules,
  PORTAL_BLOCKED_MODULES,
  type ModuleKey,
} from "@/lib/permissions";

/**
 * Chapters for a position or employee handbook.
 * One chapter per module that is currently on. Turn a flag off and
 * that chapter is omitted from the next download.
 */
export function enabledGuideModules(
  flags: Partial<Record<string, boolean>> | null | undefined
): ModuleKey[] {
  return getVisibleModules().filter((module) => flags?.[module] === true);
}

/**
 * Chapters for a client-portal handbook.
 * Follows the granted flags and never includes Head Office-only modules.
 */
export function enabledClientGuideModules(
  flags: Partial<Record<string, boolean>> | null | undefined
): ModuleKey[] {
  const blocked = new Set<string>(PORTAL_BLOCKED_MODULES);
  return enabledGuideModules(flags).filter((module) => !blocked.has(module));
}
