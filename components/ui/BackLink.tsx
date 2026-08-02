import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  /** Visual direction of the chevron. Default `back`. */
  direction?: "back" | "forward" | "none";
  /** `auth` follows auth-surface tokens; `onDark` is legacy auth dark styling. */
  tone?: "shell" | "onDark" | "auth";
};

/**
 * Page-level back/forward nav as an outline soft-tint badge chip
 * (`infoBadge` + `badgeFlex`) — same language as Edit / Manage Billing / Download PDF.
 * Prefer this over plain gray pills or bare `← Label` text links in the ERP shell.
 */
export default function BackLink({
  href,
  children,
  className,
  direction = "back",
  tone = "shell",
}: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        tone === "shell"
          ? buttonVariants({ variant: "infoBadge", size: "badgeFlex" })
          : cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition",
              "focus-visible:outline-none focus-visible:ring-2",
              tone === "auth"
                ? "border-[color:var(--auth-back-border)] bg-[var(--auth-back-bg)] text-[var(--auth-back-text)] hover:border-accent-cyan/40 hover:bg-[var(--auth-back-hover-bg)] hover:text-[var(--auth-input-text)] focus-visible:border-accent-cyan/40 focus-visible:ring-accent-cyan/25"
                : "border-border bg-elevated text-muted hover:border-accent-cyan/40 hover:bg-card-tint-cyan hover:text-text focus-visible:border-accent-cyan/40 focus-visible:ring-accent-cyan/25"
            ),
        className
      )}
    >
      {direction === "back" ? (
        <ArrowLeft className="size-3.5 shrink-0 opacity-80" aria-hidden />
      ) : null}
      <span>{children}</span>
      {direction === "forward" ? (
        <ArrowRight className="size-3.5 shrink-0 opacity-80" aria-hidden />
      ) : null}
    </Link>
  );
}
