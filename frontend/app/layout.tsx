import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { RootShell } from "@/components/site/root-shell";
import { ToastProvider } from "@/components/site/toast-provider";
import { siteConfig } from "@/lib/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Front Desk OS by Khan Systems",
    template: "%s | Front Desk OS"
  },
  description: siteConfig.description,
  openGraph: {
    title: "Front Desk OS by Khan Systems",
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: "Front Desk OS",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Front Desk OS by Khan Systems" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Front Desk OS by Khan Systems",
    description: siteConfig.description
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-surface text-on-surface antialiased overflow-x-hidden font-body">
        <ToastProvider>
          <RootShell>{children}</RootShell>
        </ToastProvider>
      </body>
    </html>
  );
}
