"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Fills the login panel. Fluid CSS sizes the page to the window; this only
 * shrinks the column when a short laptop still cannot fit the form.
 */
export default function AuthViewportFit({ children, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const inner = innerRef.current;
    if (!host || !inner) return;

    const apply = () => {
      inner.style.zoom = "1";
      if (!window.matchMedia("(min-width: 1024px)").matches) return;

      const avail = host.clientHeight;
      const need = inner.scrollHeight;
      const next =
        avail > 0 && need > avail + 2
          ? Math.max(0.72, avail / need)
          : 1;
      inner.style.zoom = String(next);
    };

    const observer = new ResizeObserver(apply);
    observer.observe(host);

    const images = Array.from(inner.querySelectorAll("img"));
    images.forEach((img) => img.addEventListener("load", apply));
    window.addEventListener("resize", apply);
    apply();

    return () => {
      observer.disconnect();
      images.forEach((img) => img.removeEventListener("load", apply));
      window.removeEventListener("resize", apply);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="flex h-full min-h-0 w-full items-center overflow-hidden"
    >
      <div ref={innerRef} className={cn("w-full", className)}>
        {children}
      </div>
    </div>
  );
}
