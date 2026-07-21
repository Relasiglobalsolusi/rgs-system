import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionCardProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

export default function SectionCard({
  children,
  className = "",
  id,
}: SectionCardProps) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-2xl border border-border bg-card transition duration-300",
        "p-6 shadow-[0_14px_32px_-26px_rgba(0,0,0,0.55)] sm:p-7",
        className
      )}
    >
      {children}
    </section>
  );
}
