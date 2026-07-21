"use client";

import { useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

function errorMessageText(error: unknown): string {
  if (typeof error === "string") return error.trim();
  if (error instanceof Error) return error.message.trim();
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return message.trim();
  }
  return "";
}

export function isNetworkFetchError(error: unknown): boolean {
  const message = errorMessageText(error).toLowerCase();
  if (!message) return false;
  return (
    message === "failed to fetch" ||
    message.includes("failed to fetch") ||
    message === "networkerror when attempting to fetch resource." ||
    message === "load failed" ||
    message === "network request failed" ||
    message.includes("network request failed") ||
    (error instanceof Error &&
      error.name === "TypeError" &&
      message.includes("fetch"))
  );
}

export type ShowRejectionOptions = {
  /** Dialog title. Defaults to localized “Action could not be completed”. */
  title?: string;
  /** Short guidance under the title. */
  description?: string;
  /** One or more reasons — what failed and what to revise. */
  reasons: string | string[];
};

type RejectionNoticeState = {
  open: boolean;
  title?: string;
  description?: string;
  reasons: string[];
};

const EMPTY: RejectionNoticeState = {
  open: false,
  reasons: [],
};

let noticeState: RejectionNoticeState = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function normalizeReasons(reasons: string | string[]): string[] {
  const list = Array.isArray(reasons) ? reasons : [reasons];
  return list
    .map((reason) => reason.trim())
    .filter((reason) => reason.length > 0);
}

/**
 * ERP-wide rejection / validation pop-out.
 * Prefer this over bare error toasts when the user needs to understand what
 * failed and what to revise. Keep field-level inline errors for in-form typing UX.
 */
export function showRejection(options: ShowRejectionOptions) {
  const reasons = normalizeReasons(options.reasons);
  if (reasons.length === 0) {
    const fallback = translate(getLocale(), "ui.rejectionNotice.title");
    noticeState = {
      open: true,
      title: options.title?.trim() || undefined,
      description: options.description?.trim() || undefined,
      reasons: [fallback],
    };
    emit();
    return;
  }

  noticeState = {
    open: true,
    title: options.title?.trim() || undefined,
    description: options.description?.trim() || undefined,
    reasons,
  };
  emit();
}

/** Convenience for `catch` blocks that currently used `showRejection({ reasons: error.message })`. */
export function showRejectionFromError(
  error: unknown,
  fallback: string,
  options?: Omit<ShowRejectionOptions, "reasons">
) {
  const trimmed = errorMessageText(error);
  const message = isNetworkFetchError(error)
    ? translate(getLocale(), "ui.rejectionNotice.serverUnreachable")
    : trimmed
      ? trimmed
      : fallback;
  showRejection({
    ...options,
    reasons: message,
  });
}

export function closeRejectionNotice() {
  if (!noticeState.open) return;
  noticeState = EMPTY;
  emit();
}

/**
 * Host dialog — mount once under app Providers.
 * Uses a high z-index so it can appear above other ERP dialogs.
 */
export function RejectionNoticeHost() {
  const { t } = useT();
  const [state, setState] = useState<RejectionNoticeState>(noticeState);

  useEffect(() => {
    const sync = () => setState({ ...noticeState });
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const title = state.title ?? t("ui.rejectionNotice.title");
  const description =
    state.description ?? t("ui.rejectionNotice.description");

  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) closeRejectionNotice();
      }}
    >
      <DialogContent
        showCloseButton
        overlayClassName="z-[70]"
        className={cn(
          "z-[70] flex w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-panel p-0 text-text shadow-[0_24px_48px_-28px_rgba(0,0,0,0.65)] ring-0 sm:max-w-md"
        )}
      >
        <div className="shrink-0 border-b border-border bg-panel px-5 py-5 pr-12">
          <DialogHeader className="gap-3 text-left">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/12 ring-1 ring-rose-500/25">
              <CircleAlert className="h-5 w-5 text-rose-300" aria-hidden />
            </div>
            <DialogTitle className="text-base font-semibold text-text">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-5 text-muted">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[min(50vh,22rem)] min-h-0 overflow-y-auto px-5 py-4">
          {state.reasons.length === 1 ? (
            <p className="text-sm leading-6 text-text">{state.reasons[0]}</p>
          ) : (
            <ul className="space-y-2.5">
              {state.reasons.map((reason, index) => (
                <li
                  key={`${index}-${reason.slice(0, 48)}`}
                  className="flex gap-2.5 text-sm leading-6 text-text"
                >
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300/80"
                    aria-hidden
                  />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="mt-0 rounded-none border-t border-border bg-strip px-5 py-4 sm:justify-end">
          <Button
            type="button"
            variant="default"
            className="min-w-[7.5rem]"
            onClick={() => closeRejectionNotice()}
          >
            {t("ui.rejectionNotice.acknowledge")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
