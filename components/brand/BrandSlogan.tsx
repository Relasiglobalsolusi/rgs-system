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
 */
export default function BrandSlogan({
  className,
  size = "default",
}: BrandSloganProps) {
  const compact = size === "compact";

  return (
    <p
      className={cn(
        "m-0 max-w-full text-center font-sans font-normal uppercase text-accent-slate/70",
        compact
          ? "text-[6.5px] leading-tight tracking-[0.1em] sm:text-[7.5px] sm:tracking-[0.12em]"
          : "text-[8.5px] leading-none tracking-[0.18em]",
        className
      )}
      lang="en"
      translate="no"
      aria-hidden="true"
    >
      {RGS_ONE_SLOGAN}
    </p>
  );
}
