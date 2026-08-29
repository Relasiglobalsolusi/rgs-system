import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StatusType =
  | "active"
  | "inactive"
  | "pending"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "revoked";

type StatusBadgeSize = "md" | "lg";

type StatusBadgeProps = {
  status: StatusType;
  children?: ReactNode;
  /**
   * Two-line label inside the chip box (same type scale as
   * Permanently Delete / Revoked Access). Prefer this for multi-word labels
   * (In Progress, Awaiting Payment). Single long locale words grow the chip
   * width instead of spilling past the border.
   */
  lines?: readonly [string, string];
  /** Kept for API compat — default chips use the shared md size. */
  compact?: boolean;
  /**
   * Chip scale. `md` is the ERP-wide default (min 7.5rem × 2.75rem).
   * `lg` is for primary identity chips (project detail overview strip).
   */
  size?: StatusBadgeSize;
  className?: string;
};

/**
 * Single source of truth for StatusBadge + Button `size="badge"` chips.
 * Min box matches trash / directory action chips (7.5rem × 2.75rem).
 * Width grows with content (badgeFlex-style) so long locale labels like
 * PERENCANAAN stay inside the border — never ellipsis mid-word.
 * Multi-word labels should still stack via `lines` or StackedChipLabel.
 *
 * Centering: plain inline-flex + items-center + justify-center + leading-none.
 * No optical pb nudges or display-mode swaps — those fight Inter caps.
 */
export const compactChipClassName =
  "box-border inline-flex h-[2.75rem] min-h-[2.75rem] w-fit min-w-0 max-w-full shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-md px-2.5 py-0 text-xs font-bold uppercase leading-none tracking-[0.04em] sm:min-w-[7.5rem] sm:max-w-none";

/** Larger identity chips — project detail status / cleaning type overview. */
export const largeChipClassName =
  "box-border inline-flex h-[3.5rem] min-h-[3.5rem] w-fit min-w-0 max-w-full shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-md px-3.5 py-0 text-sm font-bold uppercase leading-none tracking-[0.04em] sm:min-w-[9.75rem] sm:max-w-none";

const chipSizeClassName: Record<StatusBadgeSize, string> = {
  md: compactChipClassName,
  lg: largeChipClassName,
};

/**
 * Stacked two-line label inside the fixed chip box
 * (Permanently/Delete, Awaiting/Payment, Regular/Cleaning).
 * Inherits parent chip text color.
 */
export const stackedChipLabelClassName =
  "flex h-full w-full flex-col items-center justify-center text-center text-[0.5625rem] font-bold uppercase leading-[1.15] tracking-[0.04em] text-inherit";

/** Stacked label scale for `size="lg"` chips. */
export const largeStackedChipLabelClassName =
  "flex h-full w-full flex-col items-center justify-center text-center text-xs font-bold uppercase leading-[1.2] tracking-[0.04em] text-inherit";

/** @deprecated Prefer stackedChipLabelClassName — kept for existing imports. */
export const permanentDeleteLabelClassName = stackedChipLabelClassName;

/**
 * Light same-hue wash + deep same-hue ink. Hue tokens stay put;
 * contrast is the fill/ink gap, not a different color family.
 * Shared by StatusBadge, Button *Badge, DirectoryFilterTab, option pills.
 */
export const outlineChipTones = {
  emerald:
    "border border-chip-ink-emerald/35 bg-chip-fill-emerald font-bold text-chip-ink-emerald shadow-none",
  emeraldInteractive:
    "border border-chip-ink-emerald/35 bg-chip-fill-emerald font-bold text-chip-ink-emerald shadow-none hover:bg-[color-mix(in_srgb,var(--color-chip-emerald)_92%,white)] focus-visible:border-chip-emerald focus-visible:ring-chip-emerald/25",
  cyan:
    "border border-chip-ink-cyan/35 bg-chip-fill-cyan font-bold text-chip-ink-cyan shadow-none",
  cyanInteractive:
    "border border-chip-ink-cyan/35 bg-chip-fill-cyan font-bold text-chip-ink-cyan shadow-none hover:bg-[color-mix(in_srgb,var(--color-chip-cyan)_92%,white)] focus-visible:border-chip-cyan focus-visible:ring-chip-cyan/25",
  danger:
    "border border-chip-ink-rose/35 bg-chip-fill-rose font-bold text-chip-ink-rose shadow-none",
  dangerInteractive:
    "border border-chip-ink-rose/35 bg-chip-fill-rose font-bold text-chip-ink-rose shadow-none hover:bg-[color-mix(in_srgb,var(--color-chip-rose)_92%,white)] focus-visible:border-chip-rose focus-visible:ring-chip-rose/25",
  warning:
    "border border-chip-ink-amber/35 bg-chip-fill-amber font-bold text-chip-ink-amber shadow-none",
  warningInteractive:
    "border border-chip-ink-amber/35 bg-chip-fill-amber font-bold text-chip-ink-amber shadow-none hover:bg-[color-mix(in_srgb,var(--color-chip-amber)_92%,white)] focus-visible:border-chip-amber focus-visible:ring-chip-amber/25",
  muted:
    "border border-chip-ink-slate/35 bg-chip-fill-slate font-bold text-chip-ink-slate shadow-none",
  mutedInteractive:
    "border border-chip-ink-slate/35 bg-chip-fill-slate font-bold text-chip-ink-slate shadow-none hover:bg-[color-mix(in_srgb,var(--color-chip-slate)_92%,white)] focus-visible:border-chip-slate focus-visible:ring-chip-slate/25",
} as const;

/**
 * Semantic chip tones (dark ERP) — outline / soft tint:
 * - active / success → mint emerald
 * - info → cyan
 * - warning / pending → amber
 * - danger / revoked → red
 * - inactive → slate
 */
const styles: Record<StatusType, string> = {
  active: outlineChipTones.emerald,
  inactive: outlineChipTones.muted,
  pending: outlineChipTones.warning,
  success: outlineChipTones.emerald,
  warning: outlineChipTones.warning,
  danger: outlineChipTones.danger,
  info: outlineChipTones.cyan,
  revoked: outlineChipTones.danger,
};

/** Two-line chip label for action buttons and StatusBadge. */
export function StackedChipLabel({
  lines,
  className,
}: {
  lines: readonly [string, string];
  className?: string;
}) {
  return (
    <span className={cn(stackedChipLabelClassName, className)}>
      <span>{lines[0]}</span>
      <span>{lines[1]}</span>
    </span>
  );
}

export default function StatusBadge({
  status,
  children,
  lines,
  size = "md",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        chipSizeClassName[size],
        styles[status],
        lines ? "whitespace-normal" : null,
        className
      )}
    >
      {lines ? (
        <StackedChipLabel
          lines={lines}
          className={size === "lg" ? largeStackedChipLabelClassName : undefined}
        />
      ) : (
        (children ?? status)
      )}
    </span>
  );
}
