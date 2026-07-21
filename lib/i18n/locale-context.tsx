"use client";

import { createContext, useContext } from "react";

import type { AppLocale } from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/messages";
import type { TranslateParams } from "@/lib/i18n/translate";

export type LocaleContextValue = {
  locale: AppLocale;
  bcp47: string;
  setLocale: (locale: AppLocale) => void;
  t: (key: MessageKey | string, params?: TranslateParams) => string;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
