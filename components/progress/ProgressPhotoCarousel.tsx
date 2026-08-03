"use client";

import Image from "next/image";
import { useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";

type Photo = { id: string; url: string };

type Props = {
  photos: Photo[];
  alt: string;
  onPhotoClick?: (url: string) => void;
  className?: string;
};

/**
 * One-at-a-time photo viewer with prev/next arrows for progress report cards.
 */
export default function ProgressPhotoCarousel({
  photos,
  alt,
  onPhotoClick,
  className,
}: Props) {
  const { t } = useT();
  const [index, setIndex] = useState(0);
  const count = photos.length;

  if (count === 0) return null;

  const safeIndex = ((index % count) + count) % count;
  const photo = photos[safeIndex]!;
  const showArrows = count > 1;

  function goPrev(e: MouseEvent) {
    e.stopPropagation();
    setIndex((i) => (i - 1 + count) % count);
  }

  function goNext(e: MouseEvent) {
    e.stopPropagation();
    setIndex((i) => (i + 1) % count);
  }

  return (
    <div className={cn("relative overflow-hidden bg-inset", className)}>
      <button
        type="button"
        onClick={() => onPhotoClick?.(photo.url)}
        className="relative h-full w-full"
      >
        <Image
          src={photo.url}
          alt={alt}
          fill
          className="object-cover"
          unoptimized
          priority={safeIndex === 0}
        />
      </button>

      {showArrows ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            onClick={goPrev}
            aria-label={t("ui.previousPhoto")}
            className="absolute top-1/2 left-2 z-10 -translate-y-1/2 border-border/80 bg-card/90 text-text shadow-sm backdrop-blur-sm hover:bg-elevated"
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            onClick={goNext}
            aria-label={t("ui.nextPhoto")}
            className="absolute top-1/2 right-2 z-10 -translate-y-1/2 border-border/80 bg-card/90 text-text shadow-sm backdrop-blur-sm hover:bg-elevated"
          >
            <ChevronRight />
          </Button>
        </>
      ) : null}
    </div>
  );
}
