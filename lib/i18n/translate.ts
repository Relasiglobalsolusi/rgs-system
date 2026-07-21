import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { messages, type MessageDictionary, type MessageKey } from "@/lib/i18n/messages";

export type TranslateParams = Record<string, string | number | boolean | null | undefined>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Resolve a dotted path against a nested message dictionary. */
export function resolveMessage(
  dictionary: MessageDictionary,
  key: string
): string | undefined {
  const parts = key.split(".");
  let current: unknown = dictionary;

  for (const part of parts) {
    if (!isPlainObject(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }

  return typeof current === "string" ? current : undefined;
}

/** Replace `{name}` placeholders in a message template. */
export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

/**
 * Translate a message key for the given locale.
 * Missing keys fall back to English, then to the key itself.
 */
export function translate(
  locale: AppLocale,
  key: MessageKey | string,
  params?: TranslateParams
): string {
  const primary = resolveMessage(messages[locale], key);
  const fallback =
    locale === DEFAULT_LOCALE
      ? undefined
      : resolveMessage(messages[DEFAULT_LOCALE], key);
  const template = primary ?? fallback ?? key;
  return interpolate(template, params);
}

/** Bound translator for a fixed locale (handy in server components). */
export function createTranslator(locale: AppLocale) {
  return (key: MessageKey | string, params?: TranslateParams) =>
    translate(locale, key, params);
}
