"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import DirectorySearchInput from "@/components/ui/DirectorySearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROJECT_SUB_CATEGORIES } from "@/lib/project-subcategory";
import { localizeSubCategoryShort } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import type { ProjectSubCategory } from "@prisma/client";

type Props = {
  year: number;
  month: number;
  subCategory?: ProjectSubCategory;
  q?: string;
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

const filterFieldClass = "min-w-0 w-full";

export default function MonthlyReportFilters({
  year,
  month,
  subCategory,
  q = "",
}: Props) {
  const { t, locale } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(q);
  const filtersRef = useRef({
    year,
    month,
    subCategory,
    search,
  });
  filtersRef.current = {
    year,
    month,
    subCategory,
    search,
  };

  useEffect(() => {
    setSearch(q);
  }, [q]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const yearOptions = Array.from(
    new Set([
      ...Array.from({ length: 8 }, (_, i) => currentYear - 5 + i),
      year,
    ])
  ).sort((a, b) => a - b);

  function navigate(next: {
    year?: number;
    month?: number;
    subCategory?: ProjectSubCategory | null;
    q?: string | null;
  }) {
    const current = filtersRef.current;
    const params = new URLSearchParams();
    params.set("year", String(next.year ?? current.year));
    params.set("month", String(next.month ?? current.month));

    const nextSubCategory =
      next.subCategory === null
        ? undefined
        : (next.subCategory ?? current.subCategory);
    if (nextSubCategory) params.set("subCategory", nextSubCategory);

    const nextQ =
      next.q === null ? "" : (next.q ?? current.search).trim();
    if (nextQ) params.set("q", nextQ);

    startTransition(() => {
      router.push(`/reports?${params.toString()}`);
    });
  }

  useEffect(() => {
    const trimmed = search.trim();
    const current = q.trim();
    if (trimmed === current) return;

    const timer = window.setTimeout(() => {
      navigate({ q: trimmed || null });
    }, 300);

    return () => window.clearTimeout(timer);
    // Debounced URL sync for search only; navigate reads latest filters via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, q]);

  return (
    <div
      className={cn(
        "mb-6 space-y-4 no-print",
        pending && "pointer-events-none"
      )}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-xl">
        <div className="space-y-1.5">
          <label
            htmlFor="monthly-filter-month"
            className="block text-xs font-medium uppercase tracking-wider text-subtle"
          >
            {t("common.labels.month")}
          </label>
          <Select
            value={String(month)}
            onValueChange={(value) => {
              if (value == null) return;
              navigate({ month: Number(value) });
            }}
          >
            <SelectTrigger
              id="monthly-filter-month"
              className={cn(employeeSelectTriggerClass, filterFieldClass)}
            >
              <SelectValue>
                {(value) =>
                  value
                    ? t(`pages.reports.months.${value}`)
                    : t("common.labels.month")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {t(`pages.reports.months.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="monthly-filter-year"
            className="block text-xs font-medium uppercase tracking-wider text-subtle"
          >
            {t("common.labels.year")}
          </label>
          <Select
            value={String(year)}
            onValueChange={(value) => {
              if (value == null) return;
              navigate({ year: Number(value) });
            }}
          >
            <SelectTrigger
              id="monthly-filter-year"
              className={cn(employeeSelectTriggerClass, filterFieldClass)}
            >
              <SelectValue>
                {(value) => value ?? t("common.labels.year")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <p className="block text-xs font-medium uppercase tracking-wider text-subtle">
            {t("common.actions.search")}
          </p>
          <DirectorySearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("pages.reports.searchProjects")}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <DirectoryFilterTab
            active={!subCategory}
            onClick={() => navigate({ subCategory: null })}
          >
            {t("common.actions.all")}
          </DirectoryFilterTab>
          {PROJECT_SUB_CATEGORIES.map((value) => (
            <DirectoryFilterTab
              key={value}
              active={subCategory === value}
              onClick={() => navigate({ subCategory: value })}
            >
              {localizeSubCategoryShort(value, locale)}
            </DirectoryFilterTab>
          ))}
        </div>
      </div>
    </div>
  );
}
