"use client";

import { useT } from "@/lib/i18n/use-t";
import type { TranslateParams } from "@/lib/i18n/translate";

/** Client-side translated text for use inside server-rendered pages. */
export default function T({
  k,
  params,
}: {
  k: string;
  params?: TranslateParams;
}) {
  const { t } = useT();
  return <>{t(k, params)}</>;
}
