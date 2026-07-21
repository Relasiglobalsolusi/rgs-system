"use client";

import { Check, ChevronDown, Languages } from "lucide-react";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
} from "@/components/ui/menu";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

const OPTIONS: {
  value: AppLocale;
  short: string;
  compact: string;
  labelKey: "header.english" | "header.bahasaIndonesia";
}[] = [
  { value: "en", short: "EN", compact: "English", labelKey: "header.english" },
  {
    value: "id",
    short: "ID",
    compact: "Bahasa Indonesia",
    labelKey: "header.bahasaIndonesia",
  },
];

export default function AuthLanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  const current = OPTIONS.find((option) => option.value === locale) ?? OPTIONS[0];
  const currentLabel = t(current.labelKey);

  return (
    <div className="auth-lang-module">
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            className="auth-lang-module__trigger"
            aria-label={`${t("header.language")}: ${currentLabel}`}
          >
            <span className="auth-lang-module__icon" aria-hidden>
              <Languages size={15} strokeWidth={1.75} />
            </span>
            <span className="auth-lang-module__copy">
              <span className="auth-lang-module__label">
                {t("header.language")}
              </span>
              <span className="auth-lang-module__value">
                <span className="auth-lang-module__value-short">
                  {current.short}
                </span>
                <span className="auth-lang-module__value-full">
                  {current.compact}
                </span>
                <ChevronDown
                  className="auth-lang-module__chevron"
                  size={13}
                  strokeWidth={2}
                  aria-hidden
                />
              </span>
            </span>
          </button>
        </MenuTrigger>

        <MenuContent
          align="end"
          sideOffset={8}
          className="auth-lang-menu min-w-[12.5rem] p-1.5"
        >
          {OPTIONS.map((option) => {
            const selected = locale === option.value;
            const fullLabel = t(option.labelKey);
            return (
              <MenuItem
                key={option.value}
                className={cn(
                  "auth-lang-menu__item",
                  selected && "auth-lang-menu__item--active"
                )}
                onClick={() => {
                  if (!selected) setLocale(option.value);
                }}
              >
                <span className="auth-lang-menu__meta">
                  <span className="auth-lang-menu__code">{option.short}</span>
                  <span className="auth-lang-menu__name">{fullLabel}</span>
                </span>
                <Check
                  className={cn(
                    "auth-lang-menu__check",
                    selected
                      ? "auth-lang-menu__check--visible"
                      : "auth-lang-menu__check--hidden"
                  )}
                  size={14}
                  strokeWidth={2.25}
                  aria-hidden
                />
              </MenuItem>
            );
          })}
        </MenuContent>
      </Menu>
    </div>
  );
}
