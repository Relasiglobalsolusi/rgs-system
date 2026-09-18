import BrandLogo from "@/components/brand/BrandLogo";
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
      <BrandLogo
        priority
        imageClassName={cn(
          "h-auto object-contain",
          isHero ? "w-full" : "w-48"
        )}
      />
    </div>
  );
}
