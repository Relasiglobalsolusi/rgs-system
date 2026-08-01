import type { Metadata } from "next";

import { rgsMetadata } from "@/lib/product-metadata";

export const metadata: Metadata = rgsMetadata;

export default function ShiftsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
