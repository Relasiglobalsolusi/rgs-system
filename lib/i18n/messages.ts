import type { AppLocale } from "@/lib/i18n/locale";
import { en, type EnMessages } from "@/lib/i18n/dictionaries/en";
import { id } from "@/lib/i18n/dictionaries/id";

/** Nested dictionary with string leaves (locales may differ in wording). */
type DeepStringLeaves<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Record<string, unknown>
      ? DeepStringLeaves<T[K]>
      : T[K];
};

export type MessageDictionary = DeepStringLeaves<EnMessages>;

type Join<K, P> = K extends string
  ? P extends string
    ? `${K}${"" extends P ? "" : "."}${P}`
    : never
  : never;

/** Dotted paths to every string leaf in the nested message dictionary. */
export type MessageKey = {
  [K in keyof EnMessages]: EnMessages[K] extends string
    ? K & string
    : EnMessages[K] extends Record<string, unknown>
      ? Join<K & string, MessageKeyFromNode<EnMessages[K]>>
      : never;
}[keyof EnMessages];

type MessageKeyFromNode<T> = {
  [K in keyof T]: T[K] extends string
    ? K & string
    : T[K] extends Record<string, unknown>
      ? Join<K & string, MessageKeyFromNode<T[K]>>
      : never;
}[keyof T];

export const messages: Record<AppLocale, MessageDictionary> = {
  en,
  id,
};
