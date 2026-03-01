import { RELEASE_TAG } from "@/lib/release-tag";

export const siteConfig = {
  name: "Khan Automation Systems",
  version: RELEASE_TAG,
  description:
    "AI Reception + Follow-Up System for service shops. Miss fewer calls, quote faster, and book more jobs.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  apiBase: process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000",
  calendlyUrl: process.env.NEXT_PUBLIC_CALENDLY_URL || "CALENDLY_LINK_HERE",
  demoNumber: process.env.NEXT_PUBLIC_DEMO_NUMBER || "DEMO_NUMBER_HERE"
};

export const navLinks = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/contact", label: "Contact" }
];
