import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description: string;
};

export default function EmptyState({
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-[#151b22] px-10 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1c242d]">
        <Inbox size={30} className="text-slate-500" />
      </div>

      <h3 className="mt-6 text-xl font-semibold text-white">
        {title}
      </h3>

      <p className="mt-3 max-w-md text-sm leading-7 text-slate-500">
        {description}
      </p>
    </div>
  );
}