import type { Metadata } from "next";
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
      <body className="min-h-screen bg-[#0B0F14] font-sans antialiased text-white">
        <Providers session={session} initialLocale={initialLocale}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
