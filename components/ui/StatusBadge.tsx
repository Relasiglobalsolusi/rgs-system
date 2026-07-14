type StatusType =
  | "active"
  | "inactive"
  | "pending"
  | "success"
  | "warning"
  | "danger";

type StatusBadgeProps = {
  status: StatusType;
  children?: React.ReactNode;
};

const styles: Record<StatusType, string> = {
  active:
    "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
  inactive:
    "bg-slate-500/10 text-slate-400 border border-slate-500/20",
  pending:
    "bg-amber-500/10 text-amber-300 border border-amber-500/20",
  success:
    "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20",
  warning:
    "bg-yellow-500/10 text-yellow-300 border border-yellow-500/20",
  danger:
    "bg-red-500/10 text-red-300 border border-red-500/20",
};

export default function StatusBadge({
  status,
  children,
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${styles[status]}`}
    >
      {children ?? status}
    </span>
  );
}