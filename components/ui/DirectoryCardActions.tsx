"use client";

import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type DirectoryCardMenuItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
};

type DirectoryCardActionsProps = {
  /** Primary workflow action (visible text button / link). */
  primary?: ReactNode;
  /**
   * Optional secondary actions in a ⋯ overflow menu.
   * Prefer omitting when row click / detail already covers Edit/Delete.
   */
  items?: DirectoryCardMenuItem[];
  className?: string;
};

/**
 * Action cluster for directory tables/cards:
 * compact badge chips (workflow primary) + optional ⋯ overflow menu.
 */
export default function DirectoryCardActions({
  primary,
  items = [],
  className,
}: DirectoryCardActionsProps) {
  const { t } = useT();
  const visibleItems = items.filter(Boolean);
  if (!primary && visibleItems.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex max-w-full min-w-0 items-center justify-center gap-2.5",
        className
      )}
    >
      {primary}

      {visibleItems.length > 0 ? (
        <Menu>
          <MenuTrigger asChild>
            <Button
              type="button"
              variant="mutedBadge"
              size="badge"
              aria-label={t("ui.moreActions")}
              className="!h-[2.75rem] !min-h-[2.75rem] !w-auto !min-w-[1.75rem] !max-w-none px-1.5"
            >
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent className="max-w-64" align="end">
            {visibleItems.map((item) => (
              <div key={item.id}>
                {item.separatorBefore ? <MenuSeparator /> : null}
                <MenuItem
                  disabled={item.disabled}
                  variant={item.destructive ? "destructive" : "default"}
                  onClick={() => {
                    if (!item.disabled) item.onSelect();
                  }}
                  title={item.label}
                >
                  {item.icon ? <item.icon /> : null}
                  <span className="min-w-0 truncate">{item.label}</span>
                </MenuItem>
              </div>
            ))}
          </MenuContent>
        </Menu>
      ) : null}
    </div>
  );
}
