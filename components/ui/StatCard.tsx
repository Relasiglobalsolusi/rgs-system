import { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
}: StatCardProps) {
  return (
    <div className="rounded-3xl border border-white/5 bg-[#151b22] p-6 shadow-lg transition-all duration-200 hover:border-[#54bfb4]/20 hover:bg-[#18212a]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>

          <h2 className="mt-4 text-4xl font-bold tracking-tight text-white">
            {value}
          </h2>

          {subtitle && (
            <p className="mt-2 text-sm text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {icon && (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#54bfb4]/15 to-[#586bb7]/15 text-[#54bfb4]">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}