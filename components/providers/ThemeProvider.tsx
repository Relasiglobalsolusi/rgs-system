"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useServerInsertedHTML } from "next/navigation";

import { getThemeInitScript } from "@/lib/theme-script";
import {
  applyDocumentTheme,
  DEFAULT_THEME,
  parseAppTheme,
  persistTheme,
  readClientCookieTheme,
  readClientStorageTheme,
  THEME_STORAGE_KEY,
  type AppTheme,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(DEFAULT_THEME);

  useServerInsertedHTML(() => (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: getThemeInitScript() }}
    />
  ));

  // Align React state with cookie/localStorage after mount (script already painted).
  useEffect(() => {
    const cookieTheme = readClientCookieTheme();
    const storageTheme = readClientStorageTheme();

    if (!cookieTheme && storageTheme) {
      setThemeState(storageTheme);
      persistTheme(storageTheme);
      return;
    }

    const resolved = cookieTheme ?? storageTheme ?? DEFAULT_THEME;
    setThemeState(resolved);
    applyDocumentTheme(resolved);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, resolved);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const setTheme = useCallback((next: AppTheme) => {
    const resolved = parseAppTheme(next);
    setThemeState((current) => (current === resolved ? current : resolved));
    persistTheme(resolved);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme }),
    [theme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
