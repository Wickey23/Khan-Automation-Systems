"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/outreach", label: "Overview" },
  { href: "/admin/outreach/leads", label: "Leads" },
  { href: "/admin/outreach/sequences", label: "Sequences" },
  { href: "/admin/outreach/caller", label: "Caller AI" },
  { href: "/admin/outreach/events", label: "Logs" }
];

export function OutreachSubnav() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-2">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors",
            pathname === tab.href
              ? "border-primary/80 bg-primary text-primary-foreground shadow-[0_10px_18px_-14px_rgba(37,99,235,0.75)]"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
