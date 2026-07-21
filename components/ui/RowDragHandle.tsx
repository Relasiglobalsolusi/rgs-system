"use client";

import { GripVertical } from "lucide-react";
import type { DragEventHandler } from "react";

import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  dragging?: boolean;
  className?: string;
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLButtonElement>;
  onDragEnd?: DragEventHandler<HTMLButtonElement>;
};

/** Classic grip affordance for directory row reordering. */
export default function RowDragHandle({
  label,
  dragging = false,
  className,
  draggable = true,
  onDragStart,
  onDragEnd,
}: Props) {
  const { t } = useT();
  const resolvedLabel = label ?? t("ui.dragToReorder");
  return (
    <button
      type="button"
      draggable={draggable}
      aria-label={resolvedLabel}
      title={resolvedLabel}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      className={cn(
        "inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-subtle transition",
        "hover:bg-inset hover:text-muted active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/35",
        dragging && "cursor-grabbing text-accent-cyan",
        className
      )}
    >
      <GripVertical className="h-4 w-4" strokeWidth={2} aria-hidden />
    </button>
  );
}
