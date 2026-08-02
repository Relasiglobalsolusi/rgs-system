import { RGS_ONE_SLOGAN } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandSloganProps = {
  className?: string;
  /** hero = login (matches production tagline); default = sidebar; compact = mobile */
  size?: "hero" | "default" | "compact";
};

/**
 * Slogan under the RGS ONE mark — part of the logo lockup, not UI copy.
 * Always English via `RGS_ONE_SLOGAN`; never wire through `t()` / i18n.
 * Layout: horizontal rule + widely spaced uppercase tagline.
 */
export default function BrandSlogan({
  className,
  size = "default",
}: BrandSloganProps) {
  return (
    <div
      className={cn(
        "flex w-full max-w-full items-center justify-center gap-4",
        className
      )}
      lang="en"
      translate="no"
      aria-hidden="true"
    >
      <span
        className={cn(
          "auth-tagline-rule h-px shrink-0",
          size === "compact" ? "w-8" : "w-12"
        )}
      />
      <p
        className={cn(
          "m-0 min-w-0 font-sans font-medium uppercase text-subtle",
          size === "hero" &&
            "text-[11px] leading-none tracking-[0.3em]",
          size === "default" &&
            "text-[8.5px] leading-none tracking-[0.28em] sm:text-[9px] sm:tracking-[0.3em]",
          size === "compact" &&
            "text-[6.5px] leading-tight tracking-[0.24em] sm:text-[7.5px] sm:tracking-[0.28em]"
        )}
      >
        {RGS_ONE_SLOGAN}
      </p>
    </div>
  );
}
