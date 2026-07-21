"use client";

import Image from "next/image";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  alt?: string;
};

/**
 * Full-viewport image viewer for in-app photo previews (no new tab).
 * Uses the shared Dialog primitives so Escape / backdrop click / X all close it.
 */
export default function ImageLightbox({
  open,
  onOpenChange,
  src,
  alt = "Photo",
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        overlayClassName="z-[60] bg-black/85"
        className="z-[60] max-h-[min(96vh,56rem)] w-auto max-w-[min(96vw,80rem)] border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[min(96vw,80rem)] [&_[data-slot=dialog-close]]:top-3 [&_[data-slot=dialog-close]]:right-3 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:border [&_[data-slot=dialog-close]]:border-white/20 [&_[data-slot=dialog-close]]:bg-black/50 [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-black/70 [&_[data-slot=dialog-close]]:hover:text-white"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">
          Full-size photo preview. Press Escape or click outside to close.
        </DialogDescription>
        {src ? (
          <div className="relative flex max-h-[min(92vh,54rem)] min-h-[12rem] w-[min(96vw,80rem)] items-center justify-center overflow-hidden">
            <Image
              src={src}
              alt={alt}
              width={1920}
              height={1080}
              className="h-auto max-h-[min(92vh,54rem)] w-auto max-w-full object-contain"
              unoptimized
              priority
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
