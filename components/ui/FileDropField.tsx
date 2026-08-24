"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { Upload, X } from "lucide-react";

import { showRejection } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export const DOCUMENT_FILE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,image/*,.pdf";

function isFileDrag(event: { dataTransfer?: DataTransfer | null }) {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes("Files");
}

/** Stops the browser from opening a dropped file instead of handing it to the form. */
export function preventBrowserFileNavigation(event: DragEvent) {
  if (!isFileDrag(event)) return;
  event.preventDefault();
}

function fileMatchesAccept(file: File, accept: string) {
  const tokens = accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  return tokens.some((token) => {
    if (token === "*/*") return true;
    if (token.endsWith("/*")) {
      const prefix = token.slice(0, -1);
      return type.startsWith(prefix);
    }
    if (token.startsWith(".")) {
      return name.endsWith(token);
    }
    return type === token;
  });
}

export function assignFilesToInput(input: HTMLInputElement, files: File[]) {
  if (files.length === 0) {
    input.value = "";
    return;
  }
  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }
  input.files = transfer.files;
}

type FileDropFieldProps = {
  id: string;
  name?: string;
  label?: ReactNode;
  required?: boolean;
  fileName?: string | null;
  onPick?: (file: File | null) => void;
  onPickMany?: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
  emptyLabel?: string;
  capture?: boolean | "user" | "environment";
  invalidMessage?: string;
};

export function FileDropField({
  id,
  name,
  label,
  required,
  fileName,
  onPick,
  onPickMany,
  multiple = false,
  accept = DOCUMENT_FILE_ACCEPT,
  disabled,
  emptyLabel,
  capture,
  invalidMessage,
}: FileDropFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragActive, setDragActive] = useState(false);
  const [internalName, setInternalName] = useState<string | null>(null);
  const { t } = useT();

  const displayName = fileName !== undefined ? fileName : internalName;
  const placeholder =
    emptyLabel ??
    t(multiple ? "common.labels.dropFilesOrBrowse" : "common.labels.dropFileOrBrowse");

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!form || fileName !== undefined) return;

    function handleReset() {
      setInternalName(null);
      dragDepth.current = 0;
      setDragActive(false);
    }

    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [fileName]);

  function rejectInvalid() {
    showRejection({
      reasons: invalidMessage ?? t("common.labels.fileMustBeImageOrPdf"),
    });
  }

  function applyFiles(files: File[]) {
    const usable = files.filter((file) => file.size > 0);
    if (usable.length === 0) return;

    const accepted = usable.filter((file) => fileMatchesAccept(file, accept));
    if (accepted.length === 0) {
      rejectInvalid();
      return;
    }

    if (multiple) {
      onPickMany?.(accepted);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    const file = accepted[0];
    if (inputRef.current) {
      assignFilesToInput(inputRef.current, [file]);
    }
    if (fileName === undefined) {
      setInternalName(file.name);
    }
    onPick?.(file);
  }

  function clearFile() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    if (fileName === undefined) {
      setInternalName(null);
    }
    onPick?.(null);
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    preventBrowserFileNavigation(event);
    event.stopPropagation();
    if (disabled || !isFileDrag(event)) return;
    dragDepth.current += 1;
    setDragActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    preventBrowserFileNavigation(event);
    event.stopPropagation();
    if (disabled || !isFileDrag(event)) return;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setDragActive(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    preventBrowserFileNavigation(event);
    event.stopPropagation();
    dragDepth.current = 0;
    setDragActive(false);
    if (disabled) return;
    applyFiles(Array.from(event.dataTransfer.files ?? []));
  }

  return (
    <div
      className="space-y-2"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {label ? (
        <label htmlFor={id} className="text-sm font-semibold text-text">
          {label}
          {required ? <span className="text-red-400"> *</span> : null}
        </label>
      ) : null}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border border-dashed bg-elevated px-4 py-4 text-sm transition",
            "hover:border-primary/40 hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50",
            dragActive
              ? "border-primary/60 bg-primary/10 text-text"
              : "border-border",
            displayName ? "pr-11 text-text" : "text-muted"
          )}
        >
          <Upload className="h-4 w-4 shrink-0" />
          <span className="truncate">{displayName ?? placeholder}</span>
        </button>
        {displayName && !multiple ? (
          <button
            type="button"
            disabled={disabled}
            onClick={clearFile}
            aria-label={t("common.actions.remove")}
            className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-card-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        capture={capture}
        required={Boolean(required && name && !displayName)}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          applyFiles(Array.from(event.target.files ?? []));
          if (multiple && event.target) {
            event.target.value = "";
          }
        }}
      />
    </div>
  );
}
