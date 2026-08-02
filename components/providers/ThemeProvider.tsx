"use client";

import { getThemeInitScript } from "@/lib/theme-script";
import { useServerInsertedHTML } from "next/navigation";
import { useEffect, type ReactNode } from "react";

function applyLightTheme() {
  const root = document.documentElement;
  root.classList.remove("dark");
  root.style.colorScheme = "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useServerInsertedHTML(() => (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: getThemeInitScript() }}
    />
  ));

  useEffect(() => {
    applyLightTheme();
  }, []);

  return <>{children}</>;
}
