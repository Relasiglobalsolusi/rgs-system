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
  recoverableStoredAtRest?: boolean;
  decryptFailed?: boolean;
  /** When omitted, empty password is treated as pending (legacy callers). */
  setup?: SetupContext;
  /** Compact inline style for directory cards. */
  compact?: boolean;
  className?: string;
};

function resolveDisplayState(
  password: string | null | undefined,
  setup?: SetupContext,
  options?: { recoverableStoredAtRest?: boolean; decryptFailed?: boolean }
): AdminPasswordDisplayState {
  if (!setup) {
    if (options?.decryptFailed) {
      return "decrypt_failed";
    }
    if (password?.trim() || options?.recoverableStoredAtRest) {
      return "recoverable";
    }
    return "pending";
  }

  return getAdminPasswordDisplayState({
    passwordDisplay: password,
    recoverableStoredAtRest: options?.recoverableStoredAtRest,
    decryptFailed: options?.decryptFailed,
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
  recoverableStoredAtRest,
  decryptFailed,
  setup,
  compact = false,
  className,
}: Props) {
  const { t } = useT();
  const [revealed, setRevealed] = useState(false);
  const value = password?.trim() || null;
  const state = resolveDisplayState(password, setup, {
    recoverableStoredAtRest,
    decryptFailed,
  });

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

  if (state === "decrypt_failed") {
    return (
      <span className={cn("text-subtle", className)}>
        {compact
          ? t("pages.users.passwordDecryptFailedCompact")
          : t("pages.users.passwordDecryptFailedOnFile")}
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
