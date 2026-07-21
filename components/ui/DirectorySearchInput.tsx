"use client";

import { Search, X } from "lucide-react";

import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type DirectorySearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
};

/** Case-insensitive substring match across optional string fields. */
export function matchesDirectorySearch(
  query: string,
  ...fields: Array<string | null | undefined>
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return fields.some((field) => field?.toLowerCase().includes(normalized));
}

export default function DirectorySearchInput({
  value,
  onChange,
  placeholder,
  className,
}: DirectorySearchInputProps) {
  const { t } = useT();
  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-border bg-inset py-2 pr-10 pl-9 text-sm text-text placeholder:text-subtle outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-primary/10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value.trim() !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("ui.clearSearch")}
          className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-subtle transition hover:bg-elevated hover:text-text"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
