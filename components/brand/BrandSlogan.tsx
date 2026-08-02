import { RGS_ONE_SLOGAN } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandSloganProps = {
  className?: string;
  /** Compact treatment for the mobile header logo cell. */
  size?: "default" | "compact";
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
  const compact = size === "compact";

  return (
    <div
      className={cn(
        "flex w-full max-w-full items-center justify-center gap-3",
        className
      )}
      lang="en"
      translate="no"
      aria-hidden="true"
    >
      <span
        className={cn(
          "auth-tagline-rule h-px shrink-0",
          compact ? "w-6" : "w-10 sm:w-12"
        )}
      />
      <p
        className={cn(
          "m-0 min-w-0 font-sans font-medium uppercase text-subtle",
          compact
            ? "text-[6.5px] leading-tight tracking-[0.28em] sm:text-[7.5px] sm:tracking-[0.32em]"
            : "text-[9px] leading-none tracking-[0.32em] sm:text-[10px] sm:tracking-[0.36em]"
        )}
      >
        {RGS_ONE_SLOGAN}
      </p>
    </div>
  );
}
