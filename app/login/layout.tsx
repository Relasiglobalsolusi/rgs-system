import type { Metadata, Viewport } from "next";

import { RGS_TAB_TITLE } from "@/lib/brand";
import { rgsMetadata } from "@/lib/product-metadata";

export const metadata: Metadata = {
  ...rgsMetadata,
  title: { absolute: RGS_TAB_TITLE },
};

/** Login is a fixed viewport page — do not inherit the ERP table 75% zoom. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 0.5,
  maximumScale: 5,
  userScalable: true,
};

export default function RgsLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
