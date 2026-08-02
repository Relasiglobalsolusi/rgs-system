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
 */
export const compactChipClassName =
  "box-border inline-flex h-[2.75rem] min-h-[2.75rem] w-auto min-w-[7.5rem] max-w-none shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-md px-2.5 py-0 text-xs font-semibold uppercase leading-none tracking-[0.06em]";

/** Larger identity chips — project detail status / cleaning type overview. */
export const largeChipClassName =
  "box-border inline-flex h-[3.5rem] min-h-[3.5rem] w-auto min-w-[9.75rem] max-w-none shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-md px-3.5 py-0 text-sm font-semibold uppercase leading-none tracking-[0.06em]";

/** Alias — same size as compactChipClassName (ERP-wide uniform chips). */
export const chipClassName = compactChipClassName;

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
  "flex flex-col items-center justify-center text-center text-[0.5625rem] font-semibold uppercase leading-[1.15] tracking-[0.04em] text-inherit";

/** Stacked label scale for `size="lg"` chips. */
export const largeStackedChipLabelClassName =
  "flex flex-col items-center justify-center text-center text-xs font-semibold uppercase leading-[1.2] tracking-[0.04em] text-inherit";

/** @deprecated Prefer stackedChipLabelClassName — kept for existing imports. */
export const permanentDeleteLabelClassName = stackedChipLabelClassName;

/**
 * Outline / soft-tint chip tones — colored border + tinted bg + colored text.
 * Shared by StatusBadge, Button *Badge, DirectoryFilterTab, option pills.
 */
export const outlineChipTones = {
  /** Mint — Manage Billing / Restore / Active / Permissions / success. */
  emerald:
    "border border-primary/35 bg-card-tint-emerald font-semibold text-primary-dark shadow-none",
  emeraldInteractive:
    "border border-primary/35 bg-card-tint-emerald font-semibold text-primary-dark shadow-none hover:bg-[color-mix(in_srgb,var(--color-card-tint-emerald),var(--color-primary)_12%)] focus-visible:border-primary focus-visible:ring-primary/25",
  /** Cyan — Edit / info / Back to Planning. */
  cyan:
    "border border-accent-cyan/40 bg-card-tint-cyan font-semibold text-accent-teal shadow-none",
  cyanInteractive:
    "border border-accent-cyan/40 bg-card-tint-cyan font-semibold text-accent-teal shadow-none hover:bg-[color-mix(in_srgb,var(--color-card-tint-cyan),var(--color-accent-cyan)_12%)] focus-visible:border-accent-cyan focus-visible:ring-accent-cyan/25",
  /** Red — Delete / End Contract / Revoke. */
  danger:
    "border border-danger/40 bg-card-tint-red font-semibold text-danger shadow-none",
  dangerInteractive:
    "border border-danger/40 bg-card-tint-red font-semibold text-danger shadow-none hover:bg-[color-mix(in_srgb,var(--color-card-tint-red),var(--color-danger)_10%)] focus-visible:border-danger focus-visible:ring-danger/25",
  /** Amber — warning / pending. */
  warning:
    "border border-warning/40 bg-card-tint-amber font-semibold text-warning shadow-none",
  warningInteractive:
    "border border-warning/40 bg-card-tint-amber font-semibold text-warning shadow-none hover:bg-[color-mix(in_srgb,var(--color-card-tint-amber),var(--color-warning)_10%)] focus-visible:border-warning focus-visible:ring-warning/25",
  /** Slate — inactive. */
  slate:
    "border border-accent-slate/40 bg-card-tint-slate font-semibold text-accent-slate shadow-none",
  slateInteractive:
    "border border-accent-slate/40 bg-card-tint-slate font-semibold text-accent-slate shadow-none hover:bg-[color-mix(in_srgb,var(--color-card-tint-slate),var(--color-accent-slate)_12%)] focus-visible:border-accent-slate focus-visible:ring-accent-slate/25",
  /** Quiet unselected / Clear. */
  muted:
    "border border-border bg-elevated font-semibold text-muted shadow-none",
  mutedInteractive:
    "border border-border bg-elevated font-semibold text-muted shadow-none hover:border-border-strong hover:bg-card-hover hover:text-text focus-visible:border-border-strong focus-visible:ring-ring/40",
} as const;

/** @deprecated Use outlineChipTones — kept so older imports keep working. */
export const solidChipTones = outlineChipTones;

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
  const stacked = Boolean(lines);

  return (
    <span
      className={cn(
        chipSizeClassName[size],
        styles[status],
        stacked && "whitespace-normal",
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
