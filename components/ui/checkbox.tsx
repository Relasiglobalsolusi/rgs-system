"use client";

import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  "aria-label"?: string;
  className?: string;
};

export function Checkbox({
  checked,
  indeterminate = false,
  disabled = false,
  onCheckedChange,
  "aria-label": ariaLabel,
  className,
}: Props) {
  const isSelected = checked || indeterminate;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center p-2 -m-2"
      onClick={(event) => {
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={indeterminate ? "mixed" : checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          if (!disabled) {
            onCheckedChange?.(!checked);
          }
        }}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          isSelected
            ? "border-primary/50 bg-card-tint-emerald text-primary-dark"
            : "border-border bg-inset text-transparent hover:border-border-strong",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        {indeterminate ? (
          <Minus size={14} aria-hidden />
        ) : checked ? (
          <Check size={14} aria-hidden />
        ) : null}
      </button>
    </span>
  );
}
