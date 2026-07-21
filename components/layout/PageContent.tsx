"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

type PageContentProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Shared ERP page enter motion. Remounts on pathname change so route
 * transitions get a gentle fade + slight rise (respects reduced motion via CSS).
 */
export default function PageContent({ children, className }: PageContentProps) {
  const pathname = usePathname();

  return (
    <div key={pathname} className={className ?? "page-content-enter"}>
      {children}
    </div>
  );
}
