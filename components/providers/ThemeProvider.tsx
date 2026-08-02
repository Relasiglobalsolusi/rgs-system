"use client";

import { getThemeInitScript } from "@/lib/theme-script";
import { useServerInsertedHTML } from "next/navigation";
import { useEffect, type ReactNode } from "react";

function applyDarkTheme() {
  const root = document.documentElement;
  root.classList.add("dark");
  root.style.colorScheme = "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useServerInsertedHTML(() => (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: getThemeInitScript() }}
    />
  ));

  useEffect(() => {
    applyDarkTheme();
  }, []);

  return <>{children}</>;
}
