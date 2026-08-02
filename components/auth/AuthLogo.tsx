import Image from "next/image";

import BrandSlogan from "@/components/brand/BrandSlogan";
import {
  RGS_ONE_LOGO_HEIGHT,
  RGS_ONE_LOGO_SRC,
  RGS_ONE_LOGO_WIDTH,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

type AuthLogoProps = {
  /** Login hero uses a wider logo treatment (same as production). */
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
        "auth-logo-bar flex flex-col items-start gap-4",
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
          /* Exact pre–light-theme / production sizes */
          isHero ? "w-full" : "w-48"
        )}
      />
      <BrandSlogan className="!justify-start" size={isHero ? "hero" : "default"} />
    </div>
  );
}
