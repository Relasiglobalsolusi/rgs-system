/**
 * Shared wash for KPI / summary cards. Goods Catalog is the reference —
 * every directory and report card should use this same intensity.
 */
export type CardTintAccent =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

export const cardTintWash: Record<CardTintAccent, string> = {
  primary: "border-primary/20 bg-card-tint-emerald",
  success: "border-primary/20 bg-card-tint-emerald",
  warning: "border-warning/25 bg-card-tint-amber",
  danger: "border-danger/25 bg-card-tint-red",
  info: "border-accent-cyan/25 bg-card-tint-cyan",
  muted: "border-accent-slate/25 bg-card-tint-slate",
};

/** Same fill as `cardTintWash`, slightly stronger border for a selected filter. */
export const cardTintWashSelected: Record<CardTintAccent, string> = {
  primary: "border-primary/35 bg-card-tint-emerald",
  success: "border-primary/35 bg-card-tint-emerald",
  warning: "border-warning/40 bg-card-tint-amber",
  danger: "border-danger/40 bg-card-tint-red",
  info: "border-accent-cyan/40 bg-card-tint-cyan",
  muted: "border-accent-slate/40 bg-card-tint-slate",
};

export const cardTintIcon: Record<CardTintAccent, string> = {
  primary: "bg-elevated text-primary",
  success: "bg-elevated text-primary",
  warning: "bg-elevated text-warning",
  danger: "bg-elevated text-danger",
  info: "bg-elevated text-accent-teal",
  muted: "bg-elevated text-accent-slate",
};
