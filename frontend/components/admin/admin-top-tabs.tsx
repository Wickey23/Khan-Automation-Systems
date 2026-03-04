"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAdminOrgs } from "@/lib/api";
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
  { label: "Messages", href: "/admin/messages", matches: ["/admin/messages"] },
  { label: "Demo", href: "/admin/demo", matches: ["/admin/demo"] },
  { label: "Clients", href: "/admin/orgs", matches: ["/admin/orgs", "/admin/clients"] },
  { label: "Users", href: "/admin/users", matches: ["/admin/users"] },
  { label: "System", href: "/admin/system", matches: ["/admin/system"] },
  { label: "Events", href: "/admin/events", matches: ["/admin/events"] }
];

type AdminTopTabsProps = {
  className?: string;
  backFallbackHref?: string;
  hideSystemBanner?: boolean;
};

export function AdminTopTabs({ className, backFallbackHref = "/admin", hideSystemBanner = false }: AdminTopTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [banner, setBanner] = useState<{ text: string; ctaLabel: string; ctaHref: string } | null>(null);

  useEffect(() => {
    if (hideSystemBanner) {
      setBanner(null);
      return;
    }

    let active = true;
    void fetchAdminOrgs()
      .then((data) => {
        if (!active) return;
        const orgs = data.orgs || [];

        const paymentFailed = orgs.find((org) => {
          const status = String((org as { subscriptionStatus?: string | null }).subscriptionStatus || "").toLowerCase();
          return ["past_due", "unpaid", "incomplete"].includes(status);
        });
        if (paymentFailed) {
          setBanner({
            text: "Payment failed detected for at least one organization. Runtime may be inactive.",
            ctaLabel: "Fix Billing",
            ctaHref: "/admin/orgs"
          });
          return;
        }

        const testing = orgs.find((org) => String(org.status || "").toUpperCase() === "TESTING");
        if (testing) {
          setBanner({
            text: "Testing mode is active for one or more organizations.",
            ctaLabel: "Run Tests",
            ctaHref: "/admin/orgs"
          });
          return;
        }

        const paused = orgs.find((org) => String(org.status || "").toUpperCase() === "PAUSED");
        if (paused) {
          setBanner({
            text: "Paused organizations detected. Runtime features may be limited.",
            ctaLabel: "Review Orgs",
            ctaHref: "/admin/orgs"
          });
          return;
        }

        const setupMode = orgs.find((org) => {
          const status = String(org.status || "").toUpperCase();
          return !["LIVE", "TESTING"].includes(status);
        });
        if (setupMode) {
          setBanner({
            text: "Setup mode detected. Complete onboarding and readiness before go-live.",
            ctaLabel: "Complete Onboarding",
            ctaHref: "/admin/orgs"
          });
          return;
        }

        setBanner(null);
      })
      .catch(() => {
        if (!active) return;
        setBanner(null);
      });

    return () => {
      active = false;
    };
  }, [hideSystemBanner]);

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
    <div className={cn("mb-4 space-y-3", className)}>
      {banner ? (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{banner.text}</span>
            <Link href={banner.ctaHref} className="rounded border border-blue-300 bg-white px-2 py-1 text-xs font-medium">
              {banner.ctaLabel}
            </Link>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
    </div>
  );
}
