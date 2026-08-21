"use client";

import { useEffect } from "react";

import { invoicePeriodElementId } from "@/lib/project-directory-rows";

/** Scroll a billing / project period row into view when opened from the directory. */
export default function ScrollToInvoicePeriod({
  periodId,
}: {
  periodId?: string | null;
}) {
  useEffect(() => {
    if (!periodId) return;
    const node = document.getElementById(invoicePeriodElementId(periodId));
    if (!node) return;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [periodId]);

  return null;
}
