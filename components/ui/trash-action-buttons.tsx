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

/**
 * Outer box — identical for Delete, Restore, Permanently Delete,
 * Permissions, Assign, Cannot delete, and Button size="badge".
 * Important overrides beat any leftover content-sized badge utilities.
 */
export const trashActionChipClassName =
  "!box-border !inline-flex !h-[2.75rem] !min-h-[2.75rem] !w-auto !min-w-0 !max-w-full shrink-0 !items-center !justify-center !overflow-visible !px-2 !py-0 sm:!w-[7.5rem] sm:!min-w-[7.5rem] sm:!max-w-[7.5rem]";

/**
 * Toolbar CTAs that keep the shared chip height but may grow wider
 * (e.g. "Generate Portal Login", "Assign Selected").
 *
 * Prefer Button `size="badgeFlex"` for new icon+label chips (e.g. Download PDF):
 * twMerge does not drop `w-[7.5rem]` when `!w-auto` is added later, so overrides
 * of size="badge" are unreliable.
 */
export const flexibleBadgeChipClassName =
  "!box-border !inline-flex !h-[2.75rem] !min-h-[2.75rem] !w-auto !min-w-0 !max-w-full shrink-0 !items-center !justify-center !gap-1.5 !overflow-visible !px-3.5 !py-0 sm:!min-w-[7.5rem]";

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

/** Stacked action chips (Delete / Restore / Permissions) + cell pad. */
export const ACTIONS_SINGLE_CHIP_COLUMN_WIDTH = "12.5rem";

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
