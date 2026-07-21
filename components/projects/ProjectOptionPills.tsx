"use client";

import { employeeDialogFieldClass } from "@/components/employees/employee-dialog-ui";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

type Option<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  columns?: 2 | 3 | 5;
  /** When true, pills are display-only (e.g. tax mode derived from client). */
  disabled?: boolean;
};

export default function ProjectOptionPills<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 3,
  disabled = false,
}: Props<T>) {
  const gridClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 5
        ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        : "grid-cols-1 sm:grid-cols-3";

  return (
    <div className={cn(employeeDialogFieldClass, "gap-3")}>
      <label className="text-sm font-medium text-muted">{label}</label>
      <div className={cn("grid gap-2.5", gridClass)} role="group" aria-label={label}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              aria-disabled={disabled || undefined}
              onClick={() => {
                if (disabled) return;
                onChange(option.value);
              }}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-xl border px-3 py-3 text-sm font-medium transition",
                selected
                  ? cn(
                      outlineChipTones.emeraldInteractive,
                      "shadow-[inset_0_0_0_1px_rgba(69,179,164,0.12)]"
                    )
                  : "border-border bg-elevated text-muted",
                disabled
                  ? "cursor-default opacity-90"
                  : selected
                    ? null
                    : "hover:border-border-strong hover:text-text"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
