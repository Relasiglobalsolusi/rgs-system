import Image from "next/image";

import { RGS_ONE_LOGO_SRC } from "@/lib/brand";
import { cn } from "@/lib/utils";

type AuthLogoProps = {
  /** Login hero uses a wider logo treatment. */
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
        "auth-logo-bar",
        isHero && "auth-logo-bar-hero",
        className
      )}
    >
      <Image
        src={RGS_ONE_LOGO_SRC}
        alt="RGS ONE"
        width={1024}
        height={682}
        priority
        unoptimized
        className={cn("h-auto object-contain", isHero ? "w-full" : "w-48")}
      />
    </div>
  );
}
