"use client";

import { useLocale } from "@/components/providers/LocaleProvider";

/**
 * Reactive translator bound to the active UI locale.
 * Re-renders when the language switcher changes locale.
 */
export function useT() {
  const { t, locale, bcp47 } = useLocale();
  return { t, locale, bcp47 };
}
