"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { ArrowLeft, ClipboardList, MessageSquare, Settings, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAdminOrgs } from "@/lib/api";
import { cn } from "@/lib/utils";

type AdminTab = {
  label: string;
  href: string;
  matches?: string[];
  description?: string;
};

type AdminTabGroup = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  tabs: AdminTab[];
};

const adminTabGroups: AdminTabGroup[] = [
  {
    label: "Revenue",
    icon: ClipboardList,
    tabs: [
      { label: "Leads", href: "/admin/leads", matches: ["/admin/leads"], description: "Captured demand and pipeline hygiene." },
      { label: "Prospects", href: "/admin/prospects", matches: ["/admin/prospects"], description: "Outbound pipeline and sourcing." }
    ]
  },
  {
    label: "Conversations",
    icon: MessageSquare,
    tabs: [
      { label: "Calls", href: "/admin/calls", matches: ["/admin/calls"], description: "Inbound call quality and outcomes." },
      { label: "Messages", href: "/admin/messages", matches: ["/admin/messages"], description: "SMS threads and delivery health." },
      { label: "Demo", href: "/admin/demo", matches: ["/admin/demo"], description: "Public demo number and behavior." }
    ]
  },
  {
    label: "Operations",
    icon: Settings,
    tabs: [
      { label: "Organizations", href: "/admin/orgs", matches: ["/admin/orgs", "/admin/clients"], description: "Tenant readiness and lifecycle." },
      { label: "Users", href: "/admin/users", matches: ["/admin/users"], description: "Account access and login activity." },
      { label: "System", href: "/admin/system", matches: ["/admin/system"], description: "Global reliability and scale gate." },
      { label: "Events", href: "/admin/events", matches: ["/admin/events"], description: "Audit timeline and mutations." }
    ]
  }
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

  const allTabs = adminTabGroups.flatMap((group) => group.tabs);
  const activeTab = allTabs.find((tab) => isActive(tab)) || null;

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
      <div className="rounded-xl border bg-white/90 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Admin Control Center</p>
            {activeTab ? (
              <span className="rounded-md border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                {activeTab.label}
              </span>
            ) : null}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </div>

        {activeTab?.description ? (
          <p className="mb-3 text-xs text-muted-foreground">{activeTab.description}</p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          {adminTabGroups.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.label} className="rounded-lg border bg-white p-2">
                <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.tabs.map((tab) => (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                        isActive(tab)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-zinc-200 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {tab.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
