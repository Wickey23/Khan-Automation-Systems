import type { Metadata } from "next";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { ToastProvider } from "@/components/site/toast-provider";
import { siteConfig } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Khan Automation Systems | AI Reception + Follow-Up",
    template: "%s | Khan Automation Systems"
  },
  description: siteConfig.description,
  openGraph: {
    title: "Khan Automation Systems",
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: "Khan Automation Systems",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Khan Automation Systems" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Khan Automation Systems",
    description: siteConfig.description
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ToastProvider>
          <Header />
          {children}
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
