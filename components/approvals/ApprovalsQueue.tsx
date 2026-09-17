import type { ReactNode } from "react";

import SectionCard from "@/components/ui/SectionCard";

export function ApprovalsQueue({
  title,
  description,
  countLabel,
  children,
}: {
  title: string;
  description: string;
  countLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <p className="mt-1 text-sm text-subtle">{description}</p>
        </div>
        {countLabel ? (
          <p className="text-sm tabular-nums text-muted">{countLabel}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function ApprovalsEmptyCard({ children }: { children: ReactNode }) {
  return <SectionCard className="p-5 sm:p-6">{children}</SectionCard>;
}
