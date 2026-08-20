import {
  DEFAULT_LOCALE,
  localeToBcp47,
  type AppLocale,
} from "@/lib/i18n/locale";

export function formatMonthLabel(
  year: number,
  month: number,
  locale: AppLocale = DEFAULT_LOCALE
) {
  return new Date(year, month - 1, 1).toLocaleDateString(localeToBcp47(locale), {
    month: "long",
    year: "numeric",
  });
}
