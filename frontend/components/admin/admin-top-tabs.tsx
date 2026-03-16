"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { Activity, ArrowLeft, Building2, PlayCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAdminOrgs, getMe } from "@/lib/api";
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
  tone: string;
  tabs: AdminTab[];
};

const adminTabGroups: AdminTabGroup[] = [
  {
    label: "Command",
    icon: Building2,
    tone: "from-white to-zinc-50 border-zinc-200",
    tabs: [
      { label: "Organizations", href: "/admin/orgs", matches: ["/admin/orgs", "/admin/clients"], description: "Tenant readiness and lifecycle." },
      { label: "Calls", href: "/admin/calls", matches: ["/admin/calls"], description: "Inbound call quality and outcomes." },
      { label: "Messages", href: "/admin/messages", matches: ["/admin/messages"], description: "SMS threads and delivery health." },
      { label: "Leads", href: "/admin/leads", matches: ["/admin/leads"], description: "Captured demand and pipeline hygiene." }
    ]
  },
  {
    label: "Diagnostics",
    icon: Activity,
    tone: "from-white to-zinc-50 border-zinc-200",
    tabs: [
      { label: "System", href: "/admin/system", matches: ["/admin/system"], description: "Global reliability and scale gate." },
      { label: "Events", href: "/admin/events", matches: ["/admin/events"], description: "Audit timeline and mutations." },
      { label: "Reports", href: "/admin/reports", matches: ["/admin/reports"], description: "Scheduled internal diagnostics emails." }
    ]
  },
  {
    label: "Tools",
    icon: PlayCircle,
    tone: "from-white to-zinc-50 border-zinc-200",
    tabs: [
      { label: "Demo", href: "/admin/demo", matches: ["/admin/demo"], description: "Public demo number and behavior." },
      { label: "Users", href: "/admin/users", matches: ["/admin/users"], description: "Account access and login activity." },
      { label: "Revenue", href: "/admin/revenue", matches: ["/admin/revenue"], description: "MRR, Stripe paid totals, and plan mix." },
      { label: "Outreach", href: "/admin/outreach", matches: ["/admin/outreach"], description: "Internal outbound email outreach." }
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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    void getMe()
      .then((data) => {
        if (!active) return;
        setIsSuperAdmin(data.user.role === "SUPER_ADMIN");
      })
      .catch(() => {
        if (!active) return;
        setIsSuperAdmin(false);
      });

    return () => {
      active = false;
    };
  }, []);

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

  const visibleGroups = adminTabGroups.map((group) => ({
    ...group,
    tabs: group.tabs.filter((tab) => ((tab.href === "/admin/outreach" || tab.href === "/admin/reports") ? isSuperAdmin : true))
  }));
  const allTabs = visibleGroups.flatMap((group) => group.tabs);
  const activeTab = allTabs.find((tab) => isActive(tab)) || null;

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(backFallbackHref);
  }

  return (
    <div className={cn("mb-5 space-y-3", className)}>
      {banner ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{banner.text}</span>
            <Link href={banner.ctaHref} className="rounded-xl border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-semibold">
              {banner.ctaLabel}
            </Link>
          </div>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-5 py-3 text-white">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Shield className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-wide">Admin Control Plane</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Authorized Personnel Only</p>
            </div>
            {activeTab ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-slate-200">
                {activeTab.label}
              </span>
            ) : null}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleBack} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {activeTab?.description ? (
            <p className="text-xs font-medium text-slate-500">{activeTab.description}</p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
          {visibleGroups.map((group) => {
            if (!group.tabs.length) return null;
            const Icon = group.icon;
            return (
              <div key={group.label} className={cn("rounded-2xl border bg-gradient-to-b p-3", group.tone)}>
                <p className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">
                  <Icon className="h-3.5 w-3.5" />
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.tabs.map((tab) => (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                        isActive(tab)
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
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
    </div>
  );
}
