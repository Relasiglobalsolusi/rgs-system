import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import {
  compactChipClassName,
  largeChipClassName,
  outlineChipTones,
} from "@/components/ui/StatusBadge"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // No text-sm / padding here — those live on size variants so size="badge"
  // can use compactChipClassName without fighting base typography.
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive/50 aria-invalid:ring-3 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary font-semibold text-primary-foreground shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.1)] hover:bg-primary-dark",
        outline:
          "border-border-strong bg-elevated font-semibold text-text hover:border-primary/45 hover:bg-card-hover aria-expanded:border-primary/45 aria-expanded:bg-card-hover",
        accent: outlineChipTones.emeraldInteractive,
        edit:
          "bg-neutral-100 font-bold text-neutral-900 shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.15)] hover:bg-white",
        // Affirmative solid — same emerald family as primary / Active (form CTAs).
        permissions:
          "bg-primary font-bold text-primary-foreground shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.12)] hover:bg-primary-dark",
        success:
          "bg-primary font-bold text-primary-foreground shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.12)] hover:bg-primary-dark",
        secondary:
          "border border-border-strong bg-secondary font-medium text-secondary-foreground hover:border-border-strong hover:bg-card-hover hover:text-text aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "font-medium text-muted hover:bg-elevated hover:text-text aria-expanded:bg-elevated aria-expanded:text-text",
        destructive:
          "bg-danger font-bold text-neutral-950 shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.12)] hover:bg-[color-mix(in_srgb,var(--color-danger),black_12%)] focus-visible:border-danger focus-visible:ring-danger/25",
        // Colors only — sizing comes from size="badge" (= StatusBadge).
        // Soft emerald — Permissions / Assign / Manage Billing / Restore.
        permissionsBadge: outlineChipTones.emeraldInteractive,
        successBadge: outlineChipTones.emeraldInteractive,
        destructiveBadge: outlineChipTones.dangerInteractive,
        mutedBadge: outlineChipTones.mutedInteractive,
        revokeBadge: outlineChipTones.dangerInteractive,
        warningBadge: outlineChipTones.warningInteractive,
        warning:
          "border-warning/50 bg-elevated font-semibold text-warning hover:border-warning/65 hover:bg-card-tint-amber",
        // Cool info — cyan (Edit / Back to Planning).
        infoBadge: outlineChipTones.cyanInteractive,
        info:
          "border-accent-cyan/50 bg-elevated font-semibold text-accent-cyan hover:border-accent-cyan/65 hover:bg-card-tint-cyan",
        link: "font-medium text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 text-sm has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg]:size-3.5",
        // Identical to StatusBadge md — shared compactChipClassName (min 7.5rem, grows).
        badge: cn(
          compactChipClassName,
          "justify-center gap-0 whitespace-nowrap shadow-none in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg]:size-3.5"
        ),
        // Identical to StatusBadge lg — shared largeChipClassName (min 9.75rem, grows).
        badgeLg: cn(
          largeChipClassName,
          "justify-center gap-0 whitespace-normal shadow-none in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg]:size-4"
        ),
        // Same chip chrome as badge, but no min-width lock (icon+label CTAs).
        // Prefer over size="badge" + width overrides; twMerge fights w-* utilities.
        badgeFlex:
          "box-border h-[2.75rem] min-h-[2.75rem] w-auto min-w-0 max-w-none justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md px-3.5 py-0 text-xs font-semibold uppercase leading-none tracking-[0.06em] shadow-none in-data-[slot=button-group]:rounded-md [&_svg]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 text-sm has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8 text-sm",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
