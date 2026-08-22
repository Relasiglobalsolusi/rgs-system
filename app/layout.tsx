import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";

import { Providers } from "@/components/providers/Providers";
import { getCurrentSession } from "@/lib/auth";
import { getServerLocale } from "@/lib/i18n/locale";
import { rgsMetadata } from "@/lib/product-metadata";

import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = rgsMetadata;

/** Phone default is 75% so more of a table fits. Pinch in if you need larger tap targets. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 0.75,
  minimumScale: 0.5,
  maximumScale: 5,
  userScalable: true,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, initialLocale] = await Promise.all([
    getCurrentSession(),
    getServerLocale(),
  ]);

  return (
    <html
      lang={initialLocale}
      className={`${sourceSans.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <Providers session={session} initialLocale={initialLocale}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
