import Link from "next/link";
import type { ReactNode } from "react";

import { outlineChipTones } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

type DirectoryFilterTabProps = {
  active: boolean;
  children: ReactNode;
  count?: number | string;
  size?: "md" | "sm";
  className?: string;
  /** Render as a Next.js link (for URL-driven filters). */
  href?: string;
  onClick?: () => void;
};

export default function DirectoryFilterTab({
  active,
  onClick,
  href,
  children,
  count,
  size = "md",
  className,
}: DirectoryFilterTabProps) {
  const classes = cn(
    "inline-flex shrink-0 items-center whitespace-nowrap rounded-xl font-semibold tracking-wide transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
    size === "md"
      ? "min-h-11 gap-2 px-5 py-3 text-sm"
      : "min-h-8 gap-1.5 px-3 py-1.5 text-xs",
    // !text-* beats global `a { color: inherit }` when rendered as <Link>.
    active
      ? cn(
          outlineChipTones.emeraldInteractive,
          "!text-primary-dark shadow-[inset_0_0_0_1px_rgba(69,179,164,0.12)]"
        )
      : "border border-border bg-elevated !text-muted hover:border-border-strong hover:bg-card-hover hover:!text-text",
    className
  );

  const content = (
    <>
      {children}
      {count !== undefined ? (
        <span
          className={cn(
            "font-semibold tabular-nums",
            size === "md"
              ? "rounded-md px-2 py-0.5 text-xs"
              : "rounded px-1.5 py-px text-[10px]",
            active
              ? "bg-primary/15 !text-primary-dark"
              : "bg-inset !text-subtle"
          )}
        >
          {count}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}
