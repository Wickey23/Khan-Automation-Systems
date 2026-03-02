"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminTab = {
  label: string;
  href: string;
  matches?: string[];
};

const adminTabs: AdminTab[] = [
  { label: "Leads", href: "/admin/leads", matches: ["/admin/leads"] },
  { label: "Prospects", href: "/admin/prospects", matches: ["/admin/prospects"] },
  { label: "Calls", href: "/admin/calls", matches: ["/admin/calls"] },
  { label: "Clients", href: "/admin/orgs", matches: ["/admin/orgs", "/admin/clients"] },
  { label: "Events", href: "/admin/events", matches: ["/admin/events"] }
];

type AdminTopTabsProps = {
  className?: string;
  backFallbackHref?: string;
};

export function AdminTopTabs({ className, backFallbackHref = "/admin" }: AdminTopTabsProps) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(tab: AdminTab) {
    const matches = tab.matches?.length ? tab.matches : [tab.href];
    return matches.some((match) => pathname === match || pathname.startsWith(`${match}/`));
  }

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(backFallbackHref);
  }

  return (
    <div className={cn("mb-4 flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="inline-flex rounded-lg border bg-white p-1">
        {adminTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              isActive(tab)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={handleBack}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back
      </Button>
    </div>
  );
}
