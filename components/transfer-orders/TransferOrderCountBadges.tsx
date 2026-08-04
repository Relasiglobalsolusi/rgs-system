"use client";

import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  pendingSendCount: number;
  inTransitCount?: number;
  className?: string;
  /** Compact pills for directory cards. */
  compact?: boolean;
};

export default function TransferOrderCountBadges({
  pendingSendCount,
  inTransitCount = 0,
  className,
  compact = true,
}: Props) {
  const { t } = useT();

  if (pendingSendCount <= 0 && inTransitCount <= 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {pendingSendCount > 0 ? (
        <span
          className={cn(
            "rounded-md border border-amber-500/30 bg-amber-500/10 font-semibold tabular-nums text-amber-200",
            compact ? "px-2 py-0.5 text-[0.6875rem]" : "px-2.5 py-1 text-xs"
          )}
        >
          {compact
            ? t("pages.transferOrders.badgePending", { count: pendingSendCount })
            : t("pages.transferOrders.statPending", { count: pendingSendCount })}
        </span>
      ) : null}
      {inTransitCount > 0 ? (
        <span
          className={cn(
            "rounded-md border border-cyan-500/30 bg-cyan-500/10 font-semibold tabular-nums text-cyan-200",
            compact ? "px-2 py-0.5 text-[0.6875rem]" : "px-2.5 py-1 text-xs"
          )}
        >
          {compact
            ? t("pages.transferOrders.badgeInTransit", {
                count: inTransitCount,
              })
            : t("pages.transferOrders.statSent", { count: inTransitCount })}
        </span>
      ) : null}
    </div>
  );
}
