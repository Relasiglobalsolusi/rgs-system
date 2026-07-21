"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  password: string | null | undefined;
  /** Compact inline style for directory cards. */
  compact?: boolean;
  className?: string;
};

/**
 * Admin-only recoverable password display. Masked by default; reveal on demand.
 * Does not log or copy the value automatically.
 */
export default function AdminPasswordDisplay({
  password,
  compact = false,
  className,
}: Props) {
  const { t } = useT();
  const [revealed, setRevealed] = useState(false);
  const value = password?.trim() || null;

  if (!value) {
    return (
      <span className={cn("text-subtle", className)}>
        {compact
          ? t("pages.users.passwordNotSet")
          : "No password on file (first-login pending or cleared)."}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1.5",
        className
      )}
    >
      <span
        className={cn(
          "min-w-0 break-all font-mono text-text",
          compact ? "text-sm" : "text-sm"
        )}
      >
        {revealed ? value : "••••••••"}
      </span>
      <button
        type="button"
        aria-label={revealed ? "Hide password" : "Show password"}
        onClick={(event) => {
          event.stopPropagation();
          setRevealed((current) => !current);
        }}
        className="shrink-0 text-subtle transition hover:text-text"
      >
        {revealed ? (
          <EyeOff size={compact ? 14 : 16} />
        ) : (
          <Eye size={compact ? 14 : 16} />
        )}
      </button>
    </span>
  );
}
