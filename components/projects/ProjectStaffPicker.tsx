"use client";

import { useMemo, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectOptionLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { buttonVariants } from "@/components/ui/button";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import { translate } from "@/lib/i18n/translate";
import { useT } from "@/lib/i18n/use-t";

export type ProjectStaffEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
  category?: { slug?: string | null; name: string; prefix: string } | null;
};

type Props = {
  employees: ProjectStaffEmployee[];
  /** When set, those employees start checked (edit mode). */
  defaultCheckedIds?: Set<string> | string[];
};

type DepartmentOption = {
  key: string;
  label: string;
  count: number;
};

const UNCATEGORIZED_KEY = "__uncategorized__";

function toIdSet(ids?: Set<string> | string[]): Set<string> {
  if (!ids) return new Set();
  return ids instanceof Set ? new Set(ids) : new Set(ids);
}

function departmentKey(employee: ProjectStaffEmployee) {
  return employee.category?.name ?? UNCATEGORIZED_KEY;
}

function departmentLabel(
  employee: ProjectStaffEmployee,
  locale: ReturnType<typeof useT>["locale"]
) {
  return employee.category
    ? localizeDepartmentLabel(
        employee.category.slug,
        employee.category.name,
        locale
      )
    : translate(locale, "common.labels.unknown");
}

function employeeLabel(employee: ProjectStaffEmployee) {
  return `${employee.firstName} ${employee.lastName}`;
}

function buildDepartments(
  employees: ProjectStaffEmployee[],
  locale: ReturnType<typeof useT>["locale"]
): DepartmentOption[] {
  const counts = new Map<string, DepartmentOption>();

  for (const employee of employees) {
    const key = departmentKey(employee);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, {
        key,
        label: departmentLabel(employee, locale),
        count: 1,
      });
    }
  }

  return Array.from(counts.values()).sort((a, b) => {
    if (a.key === UNCATEGORIZED_KEY) return 1;
    if (b.key === UNCATEGORIZED_KEY) return -1;
    return a.label.localeCompare(b.label);
  });
}

export default function ProjectStaffPicker({
  employees,
  defaultCheckedIds,
}: Props) {
  const { t, locale } = useT();
  const departments = useMemo(
    () => buildDepartments(employees, locale),
    [employees, locale]
  );
  const [departmentKeyState, setDepartmentKeyState] = useState(
    () => departments[0]?.key ?? ""
  );
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    toIdSet(defaultCheckedIds)
  );

  const employeeById = useMemo(() => {
    const map = new Map<string, ProjectStaffEmployee>();
    for (const employee of employees) {
      map.set(employee.id, employee);
    }
    return map;
  }, [employees]);

  const selectedEmployees = useMemo(
    () =>
      Array.from(selectedIds)
        .map((id) => employeeById.get(id))
        .filter((employee): employee is ProjectStaffEmployee => Boolean(employee))
        .sort((a, b) => {
          const deptCmp = departmentLabel(a, locale).localeCompare(
            departmentLabel(b, locale)
          );
          if (deptCmp !== 0) return deptCmp;
          return employeeLabel(a).localeCompare(employeeLabel(b));
        }),
    [selectedIds, employeeById, locale]
  );

  const activeDepartmentKey =
    departments.some((dept) => dept.key === departmentKeyState)
      ? departmentKeyState
      : (departments[0]?.key ?? "");

  const departmentStaff = useMemo(() => {
    if (!activeDepartmentKey) return [];
    return employees.filter(
      (employee) => departmentKey(employee) === activeDepartmentKey
    );
  }, [employees, activeDepartmentKey]);

  const visibleStaff = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return departmentStaff;
    return departmentStaff.filter((employee) => {
      const name = employeeLabel(employee).toLowerCase();
      return (
        name.includes(q) || employee.employeeNo.toLowerCase().includes(q)
      );
    });
  }, [departmentStaff, query]);

  const activeDepartment = departments.find(
    (dept) => dept.key === activeDepartmentKey
  );

  const selectedInDepartment = departmentStaff.filter((employee) =>
    selectedIds.has(employee.id)
  ).length;

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function remove(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleDepartmentChange(value: string | null) {
    if (!value) return;
    setDepartmentKeyState(value);
    setQuery("");
  }

  return (
    <div className="space-y-4">
      {/* Persist all selections across department switches */}
      {Array.from(selectedIds).map((id) => (
        <input key={id} type="hidden" name="employeeIds" value={id} />
      ))}

      <div className="flex items-end justify-between gap-3">
        <div>
          <label className="text-sm font-medium text-muted">
            {t("pages.projects.assignStaff")}
          </label>
          <p className="mt-1 text-xs text-subtle">
            {t("pages.projects.staffPicker.selectStaffPrompt")}
          </p>
        </div>
        <span
          className={cn(
            buttonVariants({ variant: "successBadge", size: "badge" }),
            "pointer-events-none gap-1"
          )}
          aria-live="polite"
        >
          <Users />
          {selectedIds.size} {t("pages.projects.assigned")}
        </span>
      </div>

      {selectedEmployees.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-inset p-3">
          <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
            {t("pages.projects.detail.staff")}
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedEmployees.map((employee) => (
              <button
                key={employee.id}
                type="button"
                onClick={() => remove(employee.id)}
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                  outlineChipTones.emeraldInteractive
                )}
                title={t("pages.projects.staffPicker.removeFromAssignment")}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold normal-case tracking-normal">
                    {employeeLabel(employee)}
                  </span>
                  <span className="block truncate text-[11px] font-medium normal-case tracking-normal text-primary-dark/70">
                    {departmentLabel(employee, locale)} · {employee.employeeNo}
                  </span>
                </span>
                <X className="h-3.5 w-3.5 shrink-0 text-primary-dark/60" />
              </button>
            ))}
          </div>
        </div>
      )}

      {employees.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-inset px-4 py-8 text-center">
          <Users className="h-5 w-5 text-muted" />
          <p className="text-sm text-subtle">
            {t("pages.projects.staffPicker.noActiveStaff")}
          </p>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-inset p-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-subtle">
              {t("pages.projects.staffPicker.department")}
            </label>
            <Select
              value={activeDepartmentKey || undefined}
              onValueChange={handleDepartmentChange}
            >
              <SelectTrigger className={employeeSelectTriggerClass}>
              <SelectValue
                placeholder={t("pages.projects.staffPicker.selectDepartment")}
              >
                  {(value) => {
                    if (!value) return null;
                    const dept = departments.find((item) => item.key === value);
                    return dept ? (
                      <SelectOptionLabel count={dept.count}>
                        {dept.label}
                      </SelectOptionLabel>
                    ) : null;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.key} value={dept.key}>
                    <SelectOptionLabel count={dept.count}>
                      {dept.label}
                    </SelectOptionLabel>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("pages.projects.staffPicker.searchDepartment")}
              className={`${employeeInputClass} h-10 pl-9`}
              disabled={!activeDepartmentKey}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-subtle">
            <span>
              {activeDepartment
                ? `${t("common.labels.showingCount", {
                    count: visibleStaff.length,
                  })} ${t("common.labels.ofTotal", {
                    total: activeDepartment.count,
                  })}`
                : t("pages.projects.staffPicker.selectDepartment")}
            </span>
            {selectedInDepartment > 0 && (
              <span className="text-primary">
                {t("common.labels.selectedCount", {
                  count: selectedInDepartment,
                })}
              </span>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto rounded-lg border border-border/80 bg-elevated">
            {!activeDepartmentKey ? (
              <p className="px-4 py-6 text-center text-sm text-subtle">
                {t("pages.projects.staffPicker.selectStaffPrompt")}
              </p>
            ) : visibleStaff.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-subtle">
                {query.trim()
                  ? t("pages.projects.staffPicker.noStaffSearch")
                  : t("pages.projects.staffPicker.noStaffDepartment")}
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {visibleStaff.map((employee) => {
                  const checked = selectedIds.has(employee.id);
                  return (
                    <li key={employee.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 px-3 py-3 text-sm transition-colors",
                          checked
                            ? "bg-card-tint-emerald text-primary-dark"
                            : "text-muted hover:bg-elevated"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(employee.id)}
                          className="h-4 w-4 rounded border-slate-600 bg-elevated text-primary focus:ring-primary/30"
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {employeeLabel(employee)}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-subtle">
                          {employee.employeeNo}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
