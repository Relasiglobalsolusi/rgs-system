"use client";

import type { LucideIcon } from "lucide-react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { uploadWebsiteImage } from "@/app/website/actions";
import { cn } from "@/lib/utils";
import { formatDisplayDateTime } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const cmsInputClass =
  "h-11 w-full rounded-xl border border-border bg-elevated px-4 text-sm text-text shadow-none placeholder:text-subtle focus-visible:border-cyan-400/50 focus-visible:ring-2 focus-visible:ring-cyan-400/10";

export const cmsTextareaClass =
  "min-h-[88px] w-full rounded-xl border border-border bg-elevated px-4 py-3 text-sm leading-6 text-text shadow-none placeholder:text-subtle focus-visible:border-cyan-400/50 focus-visible:ring-2 focus-visible:ring-cyan-400/10";

type CmsFieldProps = {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
};

export function CmsField({ label, hint, children, className }: CmsFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="block text-sm font-medium text-muted">{label}</label>
      {children}
      {hint && <p className="text-xs leading-5 text-subtle">{hint}</p>}
    </div>
  );
}

type CmsSectionHeaderProps = {
  title: string;
  description?: string;
};

export function CmsSectionHeader({ title, description }: CmsSectionHeaderProps) {
  return (
    <div className="border-b border-border pb-5">
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-subtle">
          {description}
        </p>
      )}
    </div>
  );
}

type CmsContentBlockProps = {
  index?: number;
  title: string;
  children: React.ReactNode;
};

export function CmsContentBlock({ index, title, children }: CmsContentBlockProps) {
  return (
    <div className="rounded-2xl border border-border bg-elevated p-5">
      <div className="mb-4 flex items-center gap-3">
        {index !== undefined && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card-tint-cyan text-sm font-semibold text-cyan-400">
            {index + 1}
          </span>
        )}
        <h4 className="text-sm font-semibold text-text">{title}</h4>
      </div>
      {children}
    </div>
  );
}

type CmsNavItemProps = {
  icon: LucideIcon;
  label: string;
  description?: string;
  active: boolean;
  onClick: () => void;
};

export function CmsNavItem({
  icon: Icon,
  label,
  description,
  active,
  onClick,
}: CmsNavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition",
        active
          ? "border-accent-cyan/35 bg-card-tint-cyan"
          : "border-transparent bg-elevated hover:border-border hover:bg-card-hover"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          active
            ? "bg-elevated text-cyan-400"
            : "bg-inset text-subtle ring-1 ring-border"
        )}
      >
        <Icon size={16} />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-sm font-medium",
            active ? "text-cyan-300" : "text-muted"
          )}
        >
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs leading-5 text-subtle">
            {description}
          </span>
        )}
      </span>
    </button>
  );
}

type CmsPublishedToggleProps = {
  published: boolean;
  onChange: (published: boolean) => void;
};

export function CmsPublishedToggle({ published, onChange }: CmsPublishedToggleProps) {
  const { t } = useT();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={published}
      onClick={() => onChange(!published)}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-2.5 transition",
        published
          ? "border-emerald-500/25 bg-card-tint-emerald"
          : "border-border bg-elevated"
      )}
    >
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          published ? "bg-emerald-500" : "bg-slate-700"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
            published ? "left-[22px]" : "left-0.5"
          )}
        />
      </span>
      <span className="text-left">
        <span className="block text-sm font-medium text-text">
          {published ? t("pages.website.published") : t("pages.website.draft")}
        </span>
        <span className="block text-xs text-subtle">
          {published
            ? t("pages.website.publishedHint")
            : t("pages.website.draftHint")}
        </span>
      </span>
    </button>
  );
}

type CmsToolbarProps = {
  published: boolean;
  updatedAt: string | null;
  pending: boolean;
  saved: boolean;
  onPublishedChange: (published: boolean) => void;
  onSave: () => void;
};

export function CmsToolbar({
  published,
  updatedAt,
  pending,
  saved,
  onPublishedChange,
  onSave,
}: CmsToolbarProps) {
  const { t } = useT();
  return (
    <div className="sticky top-0 z-20 -mx-1 rounded-2xl border border-border bg-panel px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={published ? "active" : "inactive"}>
            {published ? t("pages.website.live") : t("pages.website.draft")}
          </StatusBadge>
          {updatedAt && (
            <span className="text-xs text-subtle">
              {t("pages.website.lastSaved", {
                datetime: formatDisplayDateTime(updatedAt),
              })}
            </span>
          )}
          <a
            href="https://www.rgs.co.id"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-cyan-400 transition hover:text-cyan-300"
          >
            {t("pages.website.viewLiveSite")}
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <CmsPublishedToggle published={published} onChange={onPublishedChange} />
          <Button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="h-11 px-5"
          >
            {pending
              ? t("common.actions.saving")
              : saved
                ? t("pages.website.saved")
                : t("pages.website.saveChanges")}
          </Button>
        </div>
      </div>
    </div>
  );
}

type CmsImageUploadProps = {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  defaultImage?: string;
};

export function CmsImageUpload({
  label,
  hint,
  value,
  onChange,
  defaultImage,
}: CmsImageUploadProps) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [previewError, setPreviewError] = useState(false);

  const previewSrc = value || defaultImage || "";

  function handleUpload(file: File) {
    startUpload(async () => {
      try {
        const formData = new FormData();
        formData.set("file", file);
        const url = await uploadWebsiteImage(formData);
        onChange(url);
        setPreviewError(false);
        toast.success(t("pages.website.imageUploaded"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("pages.website.imageUploadFailed")
        );
      }
    });
  }

  function handleRemove() {
    onChange("");
    setPreviewError(false);
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-muted">{label}</label>
        {hint && <p className="mt-1 text-xs leading-5 text-subtle">{hint}</p>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative aspect-video w-full max-w-[18rem] shrink-0 overflow-hidden rounded-lg border border-border bg-inset">
          {previewSrc && !previewError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setPreviewError(true)}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-subtle">
              <ImageIcon className="h-7 w-7 text-muted" />
              <span className="text-xs text-subtle">
                {t("pages.website.noImage")}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <Input
            className={cmsInputClass}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setPreviewError(false);
            }}
            placeholder={defaultImage ?? "/uploads/website/..."}
            aria-label={t("pages.website.imageUrlAria", { label })}
          />

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleUpload(file);
                }
                e.target.value = "";
              }}
            />

            <Button
              type="button"
              variant="successBadge"
              size="badge"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="!w-auto !min-w-[7.5rem] !max-w-none gap-1.5 px-3"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading
                ? t("common.actions.uploading")
                : t("common.actions.upload")}
            </Button>

            {value && (
              <Button
                type="button"
                variant="destructiveBadge"
                size="badge"
                disabled={uploading}
                onClick={handleRemove}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("common.actions.remove")}
              </Button>
            )}

            <span className="text-xs text-subtle">
              {t("pages.website.imageFormats")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
