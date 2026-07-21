import type { Metadata } from "next";

import { rgsMetadata } from "@/lib/product-metadata";

export const metadata: Metadata = rgsMetadata;

export default function RgsSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
