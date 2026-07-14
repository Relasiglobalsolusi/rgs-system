import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RGS ONE",
    template: "%s | RGS ONE",
  },
  description:
    "Enterprise Resource Planning platform for Relasi Global Solusi.",
  applicationName: "RGS ONE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-[#0B0F14] font-sans antialiased text-white">
        {children}
      </body>
    </html>
  );
}