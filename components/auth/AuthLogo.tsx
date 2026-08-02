import Image from "next/image";

import BrandSlogan from "@/components/brand/BrandSlogan";
import {
  RGS_ONE_LOGO_HEIGHT,
  RGS_ONE_LOGO_SRC,
  RGS_ONE_LOGO_WIDTH,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

type AuthLogoProps = {
  /** Login hero uses a slightly larger logo treatment. */
  variant?: "hero" | "compact";
  className?: string;
};

export default function AuthLogo({
  variant = "compact",
  className,
}: AuthLogoProps) {
  const isHero = variant === "hero";

  return (
    <div
      className={cn(
        "auth-logo-bar flex flex-col items-start gap-3",
        isHero && "auth-logo-bar-hero",
        className
      )}
    >
      <Image
        src={RGS_ONE_LOGO_SRC}
        alt="RGS ONE"
        width={RGS_ONE_LOGO_WIDTH}
        height={RGS_ONE_LOGO_HEIGHT}
        priority
        unoptimized
        className={cn(
          "h-auto object-contain object-left",
          /* Keep logo modest — previous hero max-width was far too large. */
          isHero ? "w-40 sm:w-44" : "w-36"
        )}
      />
      <BrandSlogan
        className="!justify-start"
        size={isHero ? "default" : "compact"}
      />
    </div>
  );
}
