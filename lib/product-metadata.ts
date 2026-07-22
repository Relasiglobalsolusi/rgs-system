import type { Metadata } from "next";

import { RGS_ONE_PRODUCT_NAME } from "@/lib/brand";

/** RGS ONE tab / home-screen mark (teal site-plate). */
export const RGS_FAVICON_SRC = "/favicon-rgs.png?v=3";
export const RGS_APPLE_ICON_SRC = "/apple-touch-icon-rgs.png?v=3";

/** Browser chrome for RGS ONE ERP (cleaning / Relasi Global Solusi). */
export const rgsMetadata: Metadata = {
  title: {
    default: RGS_ONE_PRODUCT_NAME,
    template: `%s | ${RGS_ONE_PRODUCT_NAME}`,
  },
  description:
    "Enterprise Resource Planning platform for Relasi Global Solusi.",
  applicationName: RGS_ONE_PRODUCT_NAME,
  icons: {
    icon: [{ url: RGS_FAVICON_SRC, type: "image/png" }],
    apple: [{ url: RGS_APPLE_ICON_SRC, type: "image/png" }],
  },
};
