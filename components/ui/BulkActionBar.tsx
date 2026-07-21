"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { flexibleBadgeChipClassName } from "@/components/ui/trash-action-buttons";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type ActionVariant = "destructive" | "neutral" | "success";

type Props = {
  selectedCount: number;
  actionLabel: ReactNode;
  pending?: boolean;
  onClear: () => void;
  onAction: () => void;
  actionVariant?: ActionVariant;
  /**
   * Shown between Clear and the primary action
   * (e.g. Permanently Remove Login on Users → Active).
   */
  middleActionLabel?: ReactNode;
  onMiddleAction?: () => void;
  middlePending?: boolean;
  middleActionVariant?: ActionVariant;
  /**
   * Shown after the primary action
   * (e.g. Delete selected on Active, or Permanently delete on trash).
   */
  secondaryActionLabel?: ReactNode;
  onSecondaryAction?: () => void;
  secondaryPending?: boolean;
  secondaryActionVariant?: ActionVariant;
};

function actionBadgeVariant(actionVariant: ActionVariant) {
  if (actionVariant === "destructive") return "destructiveBadge" as const;
  if (actionVariant === "success") return "successBadge" as const;
  return "mutedBadge" as const;
}

export default function BulkActionBar({
  selectedCount,
  actionLabel,
  pending = false,
  onClear,
  onAction,
  actionVariant = "destructive",
  middleActionLabel,
  onMiddleAction,
  middlePending = false,
  middleActionVariant = "destructive",
  secondaryActionLabel,
  onSecondaryAction,
  secondaryPending = false,
  secondaryActionVariant = "destructive",
}: Props) {
  const { t } = useT();

  if (selectedCount === 0) {
    return null;
  }

  const anyPending = pending || middlePending || secondaryPending;

  function renderActionLabel(isPending: boolean, label: ReactNode) {
    return isPending ? t("common.actions.processing") : label;
  }

  return (
    <div className="mb-4 rounded-xl border border-primary/25 bg-card-tint-emerald px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-primary-dark">
          {t("common.labels.selectedCount", { count: selectedCount })}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="badge"
            variant="mutedBadge"
            disabled={anyPending}
            onClick={onClear}
          >
            {t("common.actions.clear")}
          </Button>

          {middleActionLabel && onMiddleAction && (
            <Button
              type="button"
              size="badge"
              variant={actionBadgeVariant(middleActionVariant)}
              disabled={anyPending}
              onClick={onMiddleAction}
              className={cn(flexibleBadgeChipClassName, "whitespace-normal")}
            >
              {renderActionLabel(middlePending, middleActionLabel)}
            </Button>
          )}

          <Button
            type="button"
            size="badge"
            variant={actionBadgeVariant(actionVariant)}
            disabled={anyPending}
            onClick={onAction}
            className={cn(flexibleBadgeChipClassName, "whitespace-normal")}
          >
            {renderActionLabel(pending, actionLabel)}
          </Button>

          {secondaryActionLabel && onSecondaryAction && (
            <Button
              type="button"
              size="badge"
              variant={actionBadgeVariant(secondaryActionVariant)}
              disabled={anyPending}
              onClick={onSecondaryAction}
              className={cn(flexibleBadgeChipClassName, "whitespace-normal")}
            >
              {renderActionLabel(secondaryPending, secondaryActionLabel)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
