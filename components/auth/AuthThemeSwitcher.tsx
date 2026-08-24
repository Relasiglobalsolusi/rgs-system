"use client";

import { Check, ChevronDown, Moon, Sun } from "lucide-react";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
} from "@/components/ui/menu";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import type { AppTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: {
  value: AppTheme;
  labelKey: "header.light" | "header.dark";
}[] = [
  { value: "light", labelKey: "header.light" },
  { value: "dark", labelKey: "header.dark" },
];

export default function AuthThemeSwitcher() {
  const { t } = useLocale();
  const { theme, setTheme } = useTheme();
  const current = OPTIONS.find((option) => option.value === theme) ?? OPTIONS[1];
  const currentLabel = t(current.labelKey);
  const ThemeIcon = theme === "light" ? Sun : Moon;

  return (
    <div className="auth-lang-module">
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            className="auth-lang-module__trigger"
            aria-label={`${t("header.theme")}: ${currentLabel}`}
          >
            <ThemeIcon size={16} strokeWidth={2} aria-hidden />
            <span className="auth-lang-module__text">
              <span className="auth-lang-module__label">
                {t("header.theme")}
              </span>
              <span className="auth-lang-module__value">{currentLabel}</span>
            </span>
            <ChevronDown
              className="auth-lang-module__chevron"
              size={16}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        </MenuTrigger>

        <MenuContent
          align="end"
          sideOffset={8}
          className="auth-lang-menu min-w-[12.5rem] p-1.5"
        >
          {OPTIONS.map((option) => {
            const selected = theme === option.value;
            const fullLabel = t(option.labelKey);
            return (
              <MenuItem
                key={option.value}
                className={cn(
                  "auth-lang-menu__item",
                  selected && "auth-lang-menu__item--active"
                )}
                onClick={() => {
                  if (!selected) setTheme(option.value);
                }}
              >
                <span className="auth-lang-menu__name">{fullLabel}</span>
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
