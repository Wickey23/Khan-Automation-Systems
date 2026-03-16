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
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3caff6]">
            <PhoneCall className="text-white" size={18} />
          </div>
          <div className="flex items-start gap-2">
            <div className="flex flex-col -space-y-1">
              <span className="text-xl font-black leading-none tracking-tight text-slate-900">
                Front Desk <span className="text-[#3caff6]">OS</span>
              </span>
              <span className="ml-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                by Khan Systems
              </span>
            </div>
            <span className="mt-0.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {RELEASE_TAG}
            </span>
          </div>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-bold uppercase tracking-widest text-slate-600 md:flex">
          {navItems.map((item) => {
            const href = isHome || !item.href.startsWith("/#") ? item.href : `/${item.href}`;
            return (
              <Link key={item.href} href={href} className="transition-colors hover:text-[#3caff6]">
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <Link href="/app" className="text-sm font-bold text-slate-600 transition-colors hover:text-[#3caff6]">
            Log In
          </Link>
          <Link
            href="/app/onboarding"
            className="rounded-xl bg-[#3caff6] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-200 transition-all hover:bg-sky-500"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
