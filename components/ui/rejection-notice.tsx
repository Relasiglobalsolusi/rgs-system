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

function isNetworkFetchError(error: unknown): boolean {
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
function fieldRequiredLabel(form: HTMLFormElement, element: Element): string {
  const labelled =
    element instanceof HTMLElement && element.id
      ? form.querySelector(`label[for="${CSS.escape(element.id)}"]`)
      : null;
  const wrapping = element.closest("label");
  return (
    element.getAttribute("data-required-label") ??
    labelled?.textContent ??
    wrapping?.textContent ??
    element.getAttribute("aria-label") ??
    (element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
      ? element.name
      : "") ??
    ""
  )
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmptyRequiredControl(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): boolean {
  if (element instanceof HTMLInputElement && element.type === "file") {
    return !element.files || element.files.length === 0;
  }
  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    return !element.checked;
  }
  const raw = String(element.value ?? "").trim();
  if (!raw) return true;
  if (element.getAttribute("data-required-nonzero") === "true") {
    const digits = raw.replace(/\D/g, "");
    return digits.length === 0 || /^0+$/.test(digits);
  }
  return false;
}

export function missingRequiredFieldLabels(form: HTMLFormElement): string[] {
  const labels: string[] = [];
  const seen = new Set<Element>();

  function consider(element: Element) {
    if (seen.has(element)) return;
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      )
    ) {
      return;
    }
    seen.add(element);
    const requiredLabel = element.getAttribute("data-required-label");
    const treatHidden = element.type === "hidden" && Boolean(requiredLabel);
    if (
      element.disabled ||
      element.type === "submit" ||
      element.type === "button"
    ) {
      return;
    }
    const ariaRequired = element.getAttribute("aria-required") === "true";
    if (!element.required && !treatHidden && !ariaRequired) {
      return;
    }
    if (element.type === "hidden" && !treatHidden) return;
    if (!isEmptyRequiredControl(element)) return;
    const text = fieldRequiredLabel(form, element);
    if (text) labels.push(text);
  }

  for (const element of Array.from(form.elements)) {
    consider(element);
  }
  for (const element of Array.from(
    form.querySelectorAll(
      "[required], [aria-required='true'], [data-required-label]"
    )
  )) {
    consider(element);
  }

  for (const label of Array.from(form.querySelectorAll("label"))) {
    if (!/\*/.test(label.textContent ?? "")) continue;
    const forId = label.getAttribute("for");
    const control = forId
      ? form.querySelector(`#${CSS.escape(forId)}`)
      : label.querySelector("input, select, textarea");
    if (
      !(
        control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement ||
        control instanceof HTMLTextAreaElement
      )
    ) {
      continue;
    }
    if (control.disabled) continue;
    if (!isEmptyRequiredControl(control)) continue;
    const text = (label.textContent ?? "")
      .replace(/\*/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) labels.push(text);
  }

  return [...new Set(labels)];
}

export function showMissingRequiredFields(
  form: HTMLFormElement | null,
  extraFields: string[] = []
): boolean {
  const fields = [
    ...(form ? missingRequiredFieldLabels(form) : []),
    ...extraFields.filter((field) => field.trim().length > 0),
  ];
  const unique = [...new Set(fields)];
  if (unique.length === 0) return false;
  showRejection({
    reasons: translate(getLocale(), "ui.rejectionNotice.fieldsStillMissing", {
      fields: unique.join(", "),
    }),
  });
  return true;
}

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

function closeRejectionNotice() {
  if (!noticeState.open) return;
  noticeState = EMPTY;
  emit();
}

/**
 * Host dialog — mount once under app Providers.
 * Uses a high z-index so it can appear above other ERP dialogs.
 */
function markFormsNoValidate(root: ParentNode) {
  root.querySelectorAll("form").forEach((form) => {
    if (form.dataset.allowNativeRequired === "true") return;
    form.noValidate = true;
  });
}

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

  useEffect(() => {
    markFormsNoValidate(document);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLFormElement) {
            if (node.dataset.allowNativeRequired !== "true") {
              node.noValidate = true;
            }
          } else if (node instanceof HTMLElement) {
            markFormsNoValidate(node);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    function onSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.dataset.skipRequiredPopup === "true") return;
      if (showMissingRequiredFields(form)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
    document.addEventListener("submit", onSubmit, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  const title = state.title ?? t("ui.rejectionNotice.title");
  const description =
    state.description ?? t("ui.rejectionNotice.description");

  return (
    <Dialog
      skipUnsavedGuard
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
