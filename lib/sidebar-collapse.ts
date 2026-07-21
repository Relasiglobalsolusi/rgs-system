/** Persist sidebar expand/collapse; missing keys default to expanded. */

const STORAGE_KEY = "rgs-sidebar-collapse";

type SidebarCollapseState = {
  items: Record<string, boolean>;
  sections: Record<string, boolean>;
};

function emptyState(): SidebarCollapseState {
  return { items: {}, sections: {} };
}

function readState(): SidebarCollapseState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<SidebarCollapseState>;
    return {
      items:
        parsed.items && typeof parsed.items === "object" ? parsed.items : {},
      sections:
        parsed.sections && typeof parsed.sections === "object"
          ? parsed.sections
          : {},
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: SidebarCollapseState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / private mode.
  }
}

/** `null` = no saved preference → treat as expanded. */
export function getSidebarItemExpanded(navKey: string): boolean | null {
  const value = readState().items[navKey];
  return typeof value === "boolean" ? value : null;
}

export function setSidebarItemExpanded(navKey: string, expanded: boolean) {
  const state = readState();
  state.items[navKey] = expanded;
  writeState(state);
}

/** `null` = no saved preference → treat as expanded. */
export function getSidebarSectionExpanded(sectionTitle: string): boolean | null {
  const value = readState().sections[sectionTitle];
  return typeof value === "boolean" ? value : null;
}

export function setSidebarSectionExpanded(
  sectionTitle: string,
  expanded: boolean
) {
  const state = readState();
  state.sections[sectionTitle] = expanded;
  writeState(state);
}
