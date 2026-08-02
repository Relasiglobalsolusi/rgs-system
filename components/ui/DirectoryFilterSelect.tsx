"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectOptionLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DirectoryFilterSelectOption = {
  value: string;
  label: string;
  count?: number;
};

/** Matches adjacent DirectoryFilterTab / manage chips (h-9, elevated surface). */
export const directoryFilterSelectTriggerClass =
  "h-9 min-h-9 rounded-xl border border-border bg-elevated px-3.5 pr-2.5 text-sm font-semibold text-text shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-colors hover:border-border-strong hover:bg-card-hover focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/10 data-[size=default]:h-9 data-[size=sm]:h-9";

type Props = {
  id?: string;
  value: string;
  allValue?: string;
  allLabel: string;
  allCount?: number;
  options: DirectoryFilterSelectOption[];
  ariaLabel: string;
  className?: string;
  onValueChange: (value: string) => void;
};

function renderOptionLabel(label: string, count?: number) {
  return <SelectOptionLabel count={count}>{label}</SelectOptionLabel>;
}

function resolveSelection(
  value: string | null,
  allValue: string,
  allLabel: string,
  allCount: number | undefined,
  options: DirectoryFilterSelectOption[]
) {
  if (!value || value === allValue) {
    return { label: allLabel, count: allCount };
  }

  const option = options.find((item) => item.value === value);
  return option ?? { label: allLabel, count: allCount };
}

export default function DirectoryFilterSelect({
  id,
  value,
  allValue = "all",
  allLabel,
  allCount,
  options,
  ariaLabel,
  className,
  onValueChange,
}: Props) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next == null) return;
        onValueChange(next);
      }}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          directoryFilterSelectTriggerClass,
          "w-full min-w-[12rem] sm:w-[18rem]",
          className
        )}
      >
        <SelectValue>
          {(currentValue) => {
            const selected = resolveSelection(
              currentValue,
              allValue,
              allLabel,
              allCount,
              options
            );
            return renderOptionLabel(selected.label, selected.count);
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={allValue}>
          {renderOptionLabel(allLabel, allCount)}
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {renderOptionLabel(option.label, option.count)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
