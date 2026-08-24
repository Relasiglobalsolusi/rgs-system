/** Persist sidebar nav scroll so opening a module does not jump to the top. */

const STORAGE_KEY = "rgs-sidebar-nav-scroll";

export function readSidebarNavScroll(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function writeSidebarNavScroll(scrollTop: number) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(Math.max(0, scrollTop)));
  } catch {
    // Ignore quota / private mode.
  }
}

export function persistSidebarNavScrollFrom(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return;
  const scroller = target.closest<HTMLElement>("[data-sidebar-nav-scroll]");
  if (scroller) writeSidebarNavScroll(scroller.scrollTop);
}
