"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { useT } from "@/lib/i18n/use-t";
import {
  getAdminPasswordDisplayState,
  type AdminPasswordDisplayState,
} from "@/lib/user-account";
import { cn } from "@/lib/utils";

type SetupContext = {
  mustSetPassword?: boolean;
  email?: string | null;
  passwordSetupCompletedAt?: Date | string | null;
  isLinkedPortalLogin?: boolean;
};

type Props = {
  password: string | null | undefined;
  /** When omitted, empty password is treated as pending (legacy callers). */
  setup?: SetupContext;
  /** Compact inline style for directory cards. */
  compact?: boolean;
  className?: string;
};

function resolveDisplayState(
  password: string | null | undefined,
  setup?: SetupContext
): AdminPasswordDisplayState {
  if (!setup) {
    return password?.trim() ? "recoverable" : "pending";
  }

  return getAdminPasswordDisplayState({
    passwordDisplay: password,
    mustSetPassword: setup.mustSetPassword,
    email: setup.email,
    passwordSetupCompletedAt: setup.passwordSetupCompletedAt
      ? new Date(setup.passwordSetupCompletedAt)
      : null,
    isLinkedPortalLogin: setup.isLinkedPortalLogin,
  });
}

/**
 * Admin-only recoverable password display. Masked by default; reveal on demand.
 * Does not log or copy the value automatically.
 */
export default function AdminPasswordDisplay({
  password,
  setup,
  compact = false,
  className,
}: Props) {
  const { t } = useT();
  const [revealed, setRevealed] = useState(false);
  const value = password?.trim() || null;
  const state = resolveDisplayState(password, setup);

  if (state === "pending") {
    return (
      <span className={cn("text-subtle", className)}>
        {compact
          ? t("pages.users.passwordNotSet")
          : t("pages.users.noPasswordOnFile")}
      </span>
    );
  }

  if (state === "hidden") {
    return (
      <span className={cn("text-subtle", className)}>
        {compact
          ? t("pages.users.passwordHiddenCompact")
          : t("pages.users.passwordHiddenOnFile")}
      </span>
    );
  }

  if (!value) {
    return null;
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
        aria-label={
          revealed ? t("auth.hidePassword") : t("auth.showPassword")
        }
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
