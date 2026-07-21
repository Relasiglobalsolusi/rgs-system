"use client";

import { useLocaleContext } from "@/lib/i18n/locale-context";
import type { AppLocale } from "@/lib/i18n/locale";

/**
 * Reactive app locale for client components.
 * Uses LocaleProvider (cookie-backed `initialLocale`) so SSR and hydration match.
 */
export function useLocale(): AppLocale {
  return useLocaleContext().locale;
}
