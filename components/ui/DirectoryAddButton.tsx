"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DirectoryAddButtonProps = {
  label: string;
  onClick: () => void;
  className?: string;
  /** Outline soft-tint chip tone. Default: primary Add* (emerald). */
  variant?: "successBadge" | "infoBadge" | "warningBadge";
  /** Leading icon. Default: Plus. */
  icon?: ReactNode;
};

/**
 * Compact directory toolbar action chip (Add Client / Add Bulk / etc.).
 * Uses outline *Badge language — never solid white-on-color.
 */
export default function DirectoryAddButton({
  label,
  onClick,
  className,
  variant = "successBadge",
  icon,
}: DirectoryAddButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size="badgeFlex"
      onClick={onClick}
      className={cn(className)}
    >
      {icon ?? <Plus className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </Button>
  );
}
