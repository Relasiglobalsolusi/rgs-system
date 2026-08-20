export type AppTheme = "light" | "dark";

export const DEFAULT_THEME: AppTheme = "dark";
export const THEME_STORAGE_KEY = "rgs-theme";
export const THEME_COOKIE_NAME = "rgs-theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
/** Dispatched on `window` after `persistTheme` so client UI can re-render. */
export const THEME_CHANGE_EVENT = "rgs-theme-change";

export function isAppTheme(value: unknown): value is AppTheme {
  return value === "light" || value === "dark";
}

export function parseAppTheme(value: unknown): AppTheme {
  return isAppTheme(value) ? value : DEFAULT_THEME;
}

/** Client-only: theme from the `rgs-theme` cookie. */
export function readClientCookieTheme(): AppTheme | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${THEME_COOKIE_NAME}=([^;]*)`)
  );
  const fromCookie = match?.[1] ? decodeURIComponent(match[1]) : null;
  return isAppTheme(fromCookie) ? fromCookie : null;
}

/** Client-only: theme from localStorage (mirror of cookie). */
export function readClientStorageTheme(): AppTheme | null {
  if (typeof window === "undefined") return null;

  try {
    const fromStorage = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isAppTheme(fromStorage) ? fromStorage : null;
  } catch {
    return null;
  }
}

export function applyDocumentTheme(theme: AppTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  if (theme === "light") {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  } else {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  }
}

export function persistTheme(theme: AppTheme) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }

  const secure =
    typeof window.location !== "undefined" &&
    window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(theme)}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;

  applyDocumentTheme(theme);
  window.dispatchEvent(
    new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } })
  );
}
