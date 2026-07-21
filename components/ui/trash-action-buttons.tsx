"use client";

import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import {
  permanentDeleteLabelClassName,
  stackedChipLabelClassName,
} from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export { permanentDeleteLabelClassName, stackedChipLabelClassName };

/** Fixed outer box — ERP-wide for all directory action chips. */
export const TRASH_CHIP_HEIGHT = "2.75rem";
export const TRASH_CHIP_WIDTH = "7.5rem";

/**
 * Outer box — identical for Delete, Restore, Permanently Delete,
 * Permissions, Assign, Cannot delete, and Button size="badge".
 * Important overrides beat any leftover content-sized badge utilities.
 */
export const trashActionChipClassName =
  "!box-border !inline-flex !h-[2.75rem] !min-h-[2.75rem] !w-[7.5rem] !min-w-[7.5rem] !max-w-[7.5rem] shrink-0 !items-center !justify-center !overflow-visible !px-2 !py-0";

/**
 * Toolbar CTAs that keep the shared chip height but may grow wider
 * (e.g. "Generate Portal Login", "Assign Selected").
 *
 * Prefer Button `size="badgeFlex"` for new icon+label chips (e.g. Download PDF):
 * twMerge does not drop `w-[7.5rem]` when `!w-auto` is added later, so overrides
 * of size="badge" are unreliable.
 */
export const flexibleBadgeChipClassName =
  "!box-border !inline-flex !h-[2.75rem] !min-h-[2.75rem] !w-auto !min-w-[7.5rem] !max-w-none shrink-0 !items-center !justify-center !gap-1.5 !overflow-visible !px-3.5 !py-0";

/**
 * "Permissions" label only — smaller type inside the same 7.5×2.75 chip box.
 * Do not apply to Assign / Finish / other successBadge labels.
 */
export const permissionsChipTextClassName = "!text-[10px]";

/**
 * Status column: 7.5rem chip + cell padding (DataTable last-col pr-10 buffer).
 * Must stay ≥ chip so ACTIVE / DELETED never crush or ellipsis.
 */
export const STATUS_COLUMN_WIDTH = "10rem";

/** One action chip (Delete / Assign) + pl-4 + pr-10 edge gap. */
export const ACTIONS_SINGLE_CHIP_COLUMN_WIDTH = "12.5rem";

/**
 * Two chips side-by-side (Assign+Delete, Permissions+Delete) + gap-2 + edge pad.
 * 7.5 + 7.5 + 0.5 + 1 + 2.5 = 19rem; 20rem leaves breathing room.
 */
export const ACTIONS_DUAL_CHIP_COLUMN_WIDTH = "20rem";

/**
 * Three chips side-by-side (Permissions+Revoke Access+Delete) + gaps + edge pad.
 * 7.5×3 + 0.5×2 + 1 + 2.5 = 27.5rem → 28rem.
 */
export const ACTIONS_TRIPLE_CHIP_COLUMN_WIDTH = "28rem";

/**
 * Actions column: Restore + Permanently Delete + gap-2 + edge pad.
 * 7.5 + 7.5 + 0.5 + 1 + 2.5 = 19rem; 22rem leaves edge breathing room.
 */
export const TRASH_ACTIONS_COLUMN_WIDTH = "22rem";

/**
 * Users trash: Permissions + Restore + Permanently Delete + edge pad.
 */
export const TRASH_ACTIONS_WITH_PERMISSIONS_COLUMN_WIDTH = "30rem";

type ChipButtonProps = Omit<
  ComponentProps<typeof Button>,
  "size" | "variant" | "children"
>;

/** Restore chip — same fixed outer box as Permanently Delete. */
export function TrashRestoreChip({ className, ...props }: ChipButtonProps) {
  const { t } = useT();

  return (
    <Button
      type="button"
      size="badge"
      variant="successBadge"
      className={cn(trashActionChipClassName, className)}
      {...props}
    >
      {t("common.actions.restore")}
    </Button>
  );
}

/**
 * Revoked Access restore chip — stacked "Restore / Access", same outer box
 * as Revoke Access / Permanently Delete (Deleted trash keeps TrashRestoreChip).
 */
export function TrashRestoreAccessChip({
  className,
  ...props
}: ChipButtonProps) {
  const { t } = useT();

  return (
    <Button
      type="button"
      size="badge"
      variant="successBadge"
      className={cn(trashActionChipClassName, "whitespace-normal", className)}
      {...props}
    >
      <span className={permanentDeleteLabelClassName}>
        <span>{t("pages.users.restore1")}</span>
        <span>{t("pages.users.restore2")}</span>
      </span>
    </Button>
  );
}

/** Permanently Delete chip — smaller stacked label, same outer box as Restore. */
export function TrashPermanentDeleteChip({
  className,
  ...props
}: ChipButtonProps) {
  const { t } = useT();

  return (
    <Button
      type="button"
      size="badge"
      variant="destructiveBadge"
      className={cn(trashActionChipClassName, "whitespace-normal", className)}
      {...props}
    >
      <span className={permanentDeleteLabelClassName}>
        <span>{t("common.actions.permanentlyDelete1")}</span>
        <span>{t("common.actions.permanentlyDelete2")}</span>
      </span>
    </Button>
  );
}

/**
 * Full-width edit-dialog "Cannot / delete" — same danger tint as Delete,
 * non-interactive (no disabled opacity washout).
 */
export const cannotDeleteFullWidthClassName =
  "pointer-events-none flex h-11 w-full items-center justify-center rounded-xl border border-danger/40 bg-card-tint-red text-danger";

/**
 * Non-deletable affordance — stacked "Cannot / Delete" (EN) or
 * "Tidak bisa / dihapus" (ID), same fixed outer box as Hapus / Delete.
 * Non-interactive via aria-disabled + pointer-events-none (not disabled).
 */
export function CannotDeleteChip({
  className,
  title,
  ...props
}: ChipButtonProps) {
  const { t } = useT();
  const resolvedTitle = title ?? t("common.actions.cannotDeleteTitle");

  return (
    <Button
      type="button"
      size="badge"
      variant="destructiveBadge"
      title={resolvedTitle}
      aria-disabled="true"
      tabIndex={-1}
      className={cn(
        trashActionChipClassName,
        "pointer-events-none whitespace-normal",
        className
      )}
      {...props}
    >
      <span className={permanentDeleteLabelClassName}>
        <span>{t("common.actions.cannotDelete1")}</span>
        <span>{t("common.actions.cannotDelete2")}</span>
      </span>
    </Button>
  );
}
