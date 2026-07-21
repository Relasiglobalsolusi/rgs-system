import type { Metadata } from "next";

import { RGS_ONE_PRODUCT_NAME } from "@/lib/brand";
import { rgsMetadata } from "@/lib/product-metadata";

export const metadata: Metadata = {
  ...rgsMetadata,
  title: { absolute: RGS_ONE_PRODUCT_NAME },
};

export default function RgsLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
