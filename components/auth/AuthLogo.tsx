import Image from "next/image";

import BrandSlogan from "@/components/brand/BrandSlogan";
import {
  RGS_ONE_LOGO_HEIGHT,
  RGS_ONE_LOGO_SRC,
  RGS_ONE_LOGO_WIDTH,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

type AuthLogoProps = {
  /** Login hero uses a wider logo treatment. */
  variant?: "hero" | "compact";
  className?: string;
  /** Show brand tagline under the wordmark (login mock layout). */
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
        "auth-logo-bar flex flex-col items-start gap-3",
        isHero && "auth-logo-bar-hero w-full max-w-[420px]",
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
          isHero ? "w-full max-w-[360px]" : "w-44"
        )}
      />
      {showSlogan ? (
        <div className="flex w-full items-center gap-3">
          <span className="auth-tagline-rule h-px w-10 shrink-0" aria-hidden />
          <BrandSlogan
            className={cn(
              "!text-left text-subtle",
              isHero
                ? "text-[10px] tracking-[0.22em] sm:text-[11px]"
                : "text-[8px] tracking-[0.16em]"
            )}
          />
        </div>
      ) : null}
    </div>
  );
}
