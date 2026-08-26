"use client";

import { outlineChipTones } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

type Tone = "emerald" | "warning" | "danger";

export type ReviewChoiceOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  tone: Tone;
};

const toneClass: Record<Tone, string> = {
  emerald: outlineChipTones.emeraldInteractive,
  warning: outlineChipTones.warningInteractive,
  danger: outlineChipTones.dangerInteractive,
};

type Props<T extends string> = {
  value: T | null;
  onChange: (value: T) => void;
  options: readonly ReviewChoiceOption<T>[];
  labelledBy?: string;
  disabled?: boolean;
};

export default function ReviewChoiceCards<T extends string>({
  value,
  onChange,
  options,
  labelledBy,
  disabled = false,
}: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={disabled || undefined}
            disabled={disabled}
            onClick={() => {
              if (!disabled) onChange(option.value);
            }}
            className={cn(
              "flex min-h-24 flex-col items-start justify-center rounded-2xl border px-5 py-4 text-left transition",
              active
                ? cn(
                    toneClass[option.tone],
                    "shadow-[inset_0_0_0_1px_rgba(69,179,164,0.12)]"
                  )
                : "border-border bg-elevated text-muted hover:border-border-strong hover:text-text",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <span className="text-base font-semibold tracking-tight">
              {option.label}
            </span>
            {option.hint ? (
              <span
                className={cn(
                  "mt-1.5 text-xs leading-5",
                  active ? "opacity-80" : "text-subtle"
                )}
              >
                {option.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
