import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function PageHeader({
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          {title}
        </h1>

        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
            {description}
          </p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}