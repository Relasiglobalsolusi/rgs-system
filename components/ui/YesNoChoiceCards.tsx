"use client";

import {
  employeeDialogChoiceChipClass,
  employeeDialogChoiceGridClass,
} from "@/components/employees/employee-dialog-ui";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type YesNoChoice = "Yes" | "No";

type Props = {
  id: string;
  value: YesNoChoice;
  onChange: (value: YesNoChoice) => void;
  /** Optional id of the visible question label for aria-labelledby. */
  labelledBy?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Side-by-side Yes/No choice cards (Yes left, No right).
 * Selected Yes: mint outline. Selected No: danger outline.
 * Values stay English for form submission; labels follow locale.
 */
export default function YesNoChoiceCards({
  id,
  value,
  onChange,
  labelledBy,
  className,
  disabled = false,
}: Props) {
  const { t } = useT();
  const labels: Record<YesNoChoice, string> = {
    Yes: t("common.actions.yes"),
    No: t("common.actions.no"),
  };

  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={cn(employeeDialogChoiceGridClass, className)}
    >
      {(["Yes", "No"] as const).map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={disabled || undefined}
            disabled={disabled}
            onClick={() => {
              if (!disabled) onChange(option);
            }}
            className={cn(
              employeeDialogChoiceChipClass,
              "gap-1.5 duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              active && option === "Yes" && outlineChipTones.emeraldInteractive,
              active && option === "No" && outlineChipTones.dangerInteractive,
              !active &&
                "border border-border bg-elevated text-muted hover:border-border-strong hover:bg-card-hover hover:text-text",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            {labels[option]}
          </button>
        );
      })}
    </div>
  );
}
