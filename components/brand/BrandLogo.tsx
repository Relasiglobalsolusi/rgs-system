"use client";

import type { SyntheticEvent } from "react";

import {
  RGS_ONE_LOGO_HEIGHT,
  RGS_ONE_LOGO_ON_LIGHT_SRC,
  RGS_ONE_LOGO_SRC,
  RGS_ONE_LOGO_WIDTH,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  width?: number;
  height?: number;
};

const DARK_FALLBACK = "/brand/rgs-one-logo.png";
const LIGHT_FALLBACK = "/brand/rgs-one-logo-on-light.png";

function fallbackLogoSrc(
  event: SyntheticEvent<HTMLImageElement>,
  fallbackSrc: string
) {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === "1") return;
  img.dataset.fallbackApplied = "1";
  img.src = fallbackSrc;
}

/**
 * Theme-aware RGS ONE mark. Visibility follows `html.dark` (the painted theme),
 * not React theme state — so the mark never goes blank during hydration.
 * Dark document: white/cyan asset. Light document: charcoal/cyan asset.
 */
export default function BrandLogo({
  className,
  imageClassName,
  priority = false,
  width = RGS_ONE_LOGO_WIDTH,
  height = RGS_ONE_LOGO_HEIGHT,
}: BrandLogoProps) {
  const imgClass = cn(
    "brand-logo-img h-auto w-full object-contain",
    imageClassName
  );

  return (
    <span className={cn("brand-logo", className)}>
      <img
        src={RGS_ONE_LOGO_SRC}
        alt="RGS ONE"
        width={width}
        height={height}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className={cn(imgClass, "brand-logo-img-on-dark")}
        onError={(event) => fallbackLogoSrc(event, DARK_FALLBACK)}
      />
      <img
        src={RGS_ONE_LOGO_ON_LIGHT_SRC}
        alt=""
        width={width}
        height={height}
        decoding="async"
        className={cn(imgClass, "brand-logo-img-on-light")}
        aria-hidden
        onError={(event) => fallbackLogoSrc(event, LIGHT_FALLBACK)}
      />
    </span>
  );
}
