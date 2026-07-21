"use client";

import Image from "next/image";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  title?: string;
};

function filePathname(url: string): string {
  try {
    return new URL(url, "http://local").pathname.toLowerCase();
  } catch {
    return url.toLowerCase().split("?")[0] ?? "";
  }
}

function isPdfUrl(url: string): boolean {
  return filePathname(url).endsWith(".pdf");
}

/**
 * Large in-app viewer for leave/permission proofs (image or PDF).
 * Escape, backdrop click, and the close control all dismiss — no new tab.
 * Panel chrome matches Add Employee / Add Client dialogs (opaque bg-panel + border).
 */
export default function ProofLightbox({
  open,
  onOpenChange,
  src,
  title,
}: Props) {
  const { t } = useT();
  const label = title ?? t("pages.leaves.proof");
  const pdf = src ? isPdfUrl(src) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        overlayClassName="z-[60]"
        className="z-[60] flex max-h-[min(96vh,56rem)] w-[calc(100%-1.5rem)] max-w-[min(96vw,56rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-panel p-0 text-text shadow-[0_24px_48px_-28px_rgba(0,0,0,0.65)] ring-0 sm:max-w-[min(96vw,56rem)]"
      >
        <div className="shrink-0 border-b border-border bg-panel px-5 py-4 pr-12">
          <DialogHeader className="gap-1 text-left">
            <DialogTitle className="text-base font-semibold text-text">
              {label}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("ui.proofPreview.description")}
            </DialogDescription>
          </DialogHeader>
        </div>

        {src ? (
          pdf ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <iframe
                src={src}
                title={label}
                className="h-[min(72vh,42rem)] w-full bg-elevated"
              />
              <div className="flex shrink-0 justify-end border-t border-border bg-strip px-5 py-3">
                <a
                  href={src}
                  download
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  {t("common.actions.download")}
                </a>
              </div>
            </div>
          ) : (
            <div className="relative flex min-h-[12rem] max-h-[min(80vh,48rem)] flex-1 items-center justify-center overflow-auto bg-elevated p-4">
              <Image
                src={src}
                alt={label}
                width={1920}
                height={1080}
                className="h-auto max-h-[min(76vh,46rem)] w-auto max-w-full object-contain"
                unoptimized
                priority
              />
            </div>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
