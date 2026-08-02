"use client";

import Image from "next/image";

import { useTheme } from "@/components/providers/ThemeProvider";
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

/**
 * Theme-aware RGS ONE mark — exactly one Image.
 * Dark theme: white-on-dark asset. Light theme: charcoal-on-light asset.
 */
export default function BrandLogo({
  className,
  imageClassName,
  priority = false,
  width = RGS_ONE_LOGO_WIDTH,
  height = RGS_ONE_LOGO_HEIGHT,
}: BrandLogoProps) {
  const { theme } = useTheme();
  const src = theme === "light" ? RGS_ONE_LOGO_ON_LIGHT_SRC : RGS_ONE_LOGO_SRC;

  return (
    <span className={cn("brand-logo", className)}>
      <Image
        key={src}
        src={src}
        alt="RGS ONE"
        width={width}
        height={height}
        priority={priority}
        unoptimized
        className={cn("h-auto w-full object-contain", imageClassName)}
      />
    </span>
  );
}
