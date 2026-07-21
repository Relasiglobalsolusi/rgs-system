"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter, useServerInsertedHTML } from "next/navigation";

import { getLocaleInitScript } from "@/lib/i18n/locale-script";
import {
  LocaleContext,
  useLocaleContext,
  type LocaleContextValue,
} from "@/lib/i18n/locale-context";
import {
  applyDocumentLocale,
  DEFAULT_LOCALE,
  localeToBcp47,
  LOCALE_STORAGE_KEY,
  parseAppLocale,
  persistLocale,
  readClientCookieLocale,
  readClientStorageLocale,
  type AppLocale,
} from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  translate,
  type TranslateParams,
} from "@/lib/i18n/translate";

export function LocaleProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  /** From `rgs-locale` cookie via root layout — must match SSR. */
  initialLocale?: AppLocale;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  useServerInsertedHTML(() => (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: getLocaleInitScript() }}
    />
  ));

  // Keep React state + storage aligned with the cookie-backed SSR locale.
  // If only localStorage has a preference (legacy), promote it to the cookie.
  useEffect(() => {
    const cookieLocale = readClientCookieLocale();
    const storageLocale = readClientStorageLocale();

    if (!cookieLocale && storageLocale) {
      setLocaleState(storageLocale);
      persistLocale(storageLocale);
      applyDocumentLocale(storageLocale);
      startTransition(() => {
        router.refresh();
      });
      return;
    }

    setLocaleState(initialLocale);
    applyDocumentLocale(initialLocale);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, initialLocale);
    } catch {
      /* ignore quota / private mode */
    }
  }, [initialLocale, router, startTransition]);

  const setLocale = useCallback(
    (next: AppLocale) => {
      const resolved = parseAppLocale(next);
      setLocaleState((current) => (current === resolved ? current : resolved));
      persistLocale(resolved);
      applyDocumentLocale(resolved);
      // Cookie is updated; refresh RSCs that used getServerLocale()/server t().
      startTransition(() => {
        router.refresh();
      });
    },
    [router, startTransition]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      bcp47: localeToBcp47(locale),
      setLocale,
      t: (key: MessageKey | string, params?: TranslateParams) =>
        translate(locale, key, params),
    }),
    [locale, setLocale]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  return useLocaleContext();
}
