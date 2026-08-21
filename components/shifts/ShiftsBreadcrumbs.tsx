"use client";

import BackLink from "@/components/ui/BackLink";
import { useT } from "@/lib/i18n/use-t";

type Crumb = {
  label?: string;
  labelKey?: string;
  href?: string;
};

export default function ShiftsBreadcrumbs({ items }: { items: Crumb[] }) {
  const { t } = useT();
  const parent = [...items].reverse().find((item) => item.href);

  if (!parent?.href) return null;

  const label = parent.labelKey ? t(parent.labelKey) : (parent.label ?? "");

  return (
    <nav aria-label={t("pages.shifts.breadcrumbAria")} className="mb-5">
      <BackLink href={parent.href}>{label}</BackLink>
    </nav>
  );
}
