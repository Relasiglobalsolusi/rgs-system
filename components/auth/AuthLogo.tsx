import Image from "next/image";

import BrandSlogan from "@/components/brand/BrandSlogan";
import {
  RGS_ONE_LOGO_HEIGHT,
  RGS_ONE_LOGO_SRC,
  RGS_ONE_LOGO_WIDTH,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

type AuthLogoProps = {
  /** Login hero uses a wider centered logo treatment. */
  variant?: "hero" | "compact";
  className?: string;
  /** Show brand tagline under the wordmark. */
  showSlogan?: boolean;
};

export default function AuthLogo({
  variant = "compact",
  className,
  showSlogan = true,
}: AuthLogoProps) {
  const isHero = variant === "hero";

  return (
    <div
      className={cn(
        "auth-logo-bar flex flex-col items-center",
        isHero ? "auth-logo-bar-hero gap-5" : "gap-3",
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
          "auth-logo-img h-auto object-contain object-center",
          isHero ? "w-full max-w-[468px]" : "w-48"
        )}
      />
      {showSlogan ? (
        <div className="flex w-full items-center justify-center gap-4">
          <span
            className={cn(
              "auth-tagline-rule h-px shrink-0",
              isHero ? "w-12" : "w-10"
            )}
            aria-hidden
          />
          <BrandSlogan
            className={cn(
              "text-subtle",
              isHero
                ? "text-[11px] tracking-[0.3em]"
                : "text-[8.5px] tracking-[0.18em]"
            )}
          />
        </div>
      ) : null}
    </div>
  );
}
