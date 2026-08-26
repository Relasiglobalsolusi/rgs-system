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
  columns?: 2 | 3 | 4 | 5;
  /** Fill the last row when a 2-column grid has an odd count. */
  spanLastWhenOdd?: boolean;
  /** When true, pills are display-only (e.g. tax mode derived from client). */
  disabled?: boolean;
};

export default function ProjectOptionPills<T extends string>({
  label,
  value,
  options,
  onChange,
  columns,
  spanLastWhenOdd = true,
  disabled = false,
}: Props<T>) {
  const count = options.length;
  const gridClass =
    count <= 1
      ? "grid-cols-1"
      : count === 3
        ? "grid-cols-1 sm:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2";
  void columns;

  return (
    <div className={cn(employeeDialogFieldClass, "gap-3")}>
      <label className="text-sm font-medium text-muted">{label}</label>
      <div className={cn("grid gap-2.5", gridClass)} role="group" aria-label={label}>
        {options.map((option, index) => {
          const selected = value === option.value;
          const spanFull =
            spanLastWhenOdd &&
            count !== 3 &&
            count % 2 === 1 &&
            index === count - 1;
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
                spanFull && "col-span-2 min-h-12",
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
