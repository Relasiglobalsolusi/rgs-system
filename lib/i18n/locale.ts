export type AppLocale = "en" | "id";

export const DEFAULT_LOCALE: AppLocale = "en";
export const LOCALE_STORAGE_KEY = "rgs-locale";
export const LOCALE_COOKIE_NAME = "rgs-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
/** Dispatched on `window` after `persistLocale` so client UI can re-render. */
export const LOCALE_CHANGE_EVENT = "rgs-locale-change";

/**
 * Read locale from the `rgs-locale` cookie (for Server Components / RSC).
 * Falls back to English when the cookie is missing or invalid.
 */
export async function getServerLocale(): Promise<AppLocale> {
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    return parseAppLocale(jar.get(LOCALE_COOKIE_NAME)?.value);
  } catch {
    return DEFAULT_LOCALE;
  }
}

export const APP_LOCALES: readonly AppLocale[] = ["en", "id"] as const;

export function isAppLocale(value: unknown): value is AppLocale {
  return value === "en" || value === "id";
}

/** BCP 47 tag used for Intl date/number formatting. */
export function localeToBcp47(locale: AppLocale): string {
  return locale === "id" ? "id-ID" : "en-GB";
}

export function parseAppLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE;
}

/** Client-only: locale from the `rgs-locale` cookie (SSR source of truth). */
export function readClientCookieLocale(): AppLocale | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=([^;]*)`)
  );
  const fromCookie = match?.[1] ? decodeURIComponent(match[1]) : null;
  return isAppLocale(fromCookie) ? fromCookie : null;
}

/** Client-only: locale from localStorage (legacy / mirror of cookie). */
export function readClientStorageLocale(): AppLocale | null {
  if (typeof window === "undefined") return null;

  try {
    const fromStorage = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isAppLocale(fromStorage) ? fromStorage : null;
  } catch {
    return null;
  }
}

/**
 * Client-only stored locale. Cookie wins so client matches SSR (`getServerLocale`).
 * Falls back to localStorage when the cookie is missing (pre-cookie installs).
 */
export function readStoredLocale(): AppLocale | null {
  if (typeof window === "undefined") return null;
  return readClientCookieLocale() ?? readClientStorageLocale();
}

/**
 * Active UI locale: cookie/localStorage → `document.documentElement.lang` → default `en`.
 * On the server, always returns `DEFAULT_LOCALE` — prefer `getServerLocale()` in RSC.
 */
export function getLocale(): AppLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  const stored = readStoredLocale();
  if (stored) return stored;

  const fromHtml = document.documentElement.lang?.slice(0, 2);
  return parseAppLocale(fromHtml);
}

export function persistLocale(locale: AppLocale) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }

  const secure =
    typeof window.location !== "undefined" &&
    window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;

  applyDocumentLocale(locale);
  window.dispatchEvent(
    new CustomEvent(LOCALE_CHANGE_EVENT, { detail: { locale } })
  );
}

export function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}
