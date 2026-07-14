import { ReactNode } from "react";

type SectionCardProps = {
  children: ReactNode;
  className?: string;
};

export default function SectionCard({
  children,
  className = "",
}: SectionCardProps) {
  return (
    <section
      className={`
        rounded-3xl
        border
        border-white/5
        bg-[#151b22]
        p-8
        shadow-xl
        ${className}
      `}
    >
      {children}
    </section>
  );
}