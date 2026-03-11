"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/outreach", label: "Overview" },
  { href: "/admin/outreach/leads", label: "Leads" },
  { href: "/admin/outreach/sequences", label: "Sequences" },
  { href: "/admin/outreach/events", label: "Events" }
];

export function OutreachSubnav() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm font-medium",
            pathname === tab.href ? "border-primary bg-primary text-primary-foreground" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
