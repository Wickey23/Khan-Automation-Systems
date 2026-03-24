"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PhoneCall } from "lucide-react";
import { RELEASE_TAG } from "@/lib/release-tag";

const navItems = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" }
];

export function PublicNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/70 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-blue-300/35">
            <PhoneCall size={18} />
          </div>
          <div className="flex items-start gap-2">
            <div className="flex flex-col -space-y-1">
              <span className="text-xl font-black leading-none tracking-tight text-slate-900">
                Front Desk <span className="text-sky-600">OS</span>
              </span>
              <span className="ml-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">by Khan Systems</span>
            </div>
            <span className="mt-0.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {RELEASE_TAG}
            </span>
          </div>
        </Link>

        <div className="hidden items-center gap-2 rounded-full border border-slate-200/70 bg-white/85 p-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 md:flex">
          {navItems.map((item) => {
            const href = isHome || !item.href.startsWith("/#") ? item.href : `/${item.href}`;
            return (
              <Link
                key={item.href}
                href={href}
                className="rounded-full px-4 py-2 transition-colors hover:bg-sky-50 hover:text-sky-700"
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="hidden text-sm font-semibold text-slate-600 transition-colors hover:text-sky-700 sm:inline-flex">
            Log In
          </Link>
          <Link
            href="/app/onboarding"
            className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_24px_-16px_rgba(14,116,214,0.9)] transition-all duration-200 hover:brightness-105"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
