import type { Metadata } from "next";

import { RGS_TAB_TITLE } from "@/lib/brand";
import { rgsMetadata } from "@/lib/product-metadata";

export const metadata: Metadata = {
  ...rgsMetadata,
  title: { absolute: RGS_TAB_TITLE },
};

export default function RgsLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
