"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Bell, Lock, LogOut, MessageSquareText, PhoneCall, Search, Settings2, Users2, Wallet, LayoutDashboard, ClipboardCheck, CalendarClock, UserRoundSearch, Megaphone } from "lucide-react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { fetchOrgOnboarding, fetchOrgProfile, getBillingStatus, getMe } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { clientBadgeClass } from "@/lib/client-badges";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/lib/types";

type PlanTier = "STARTER" | "PRO" | null;
type ClientRole = AuthUser["role"];
type FeatureKey = "appointmentsEnabled";
type OrgFeatureState = Record<FeatureKey, boolean>;

const navItems: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  requiredPlan?: Exclude<PlanTier, null>;
  requiredRoles?: ClientRole[];
  requiredFeature?: FeatureKey;
  comingSoon?: boolean;
}> = [
  { href: "/app", label: "Front Desk", icon: LayoutDashboard },
  { href: "/app/onboarding", label: "Setup Wizard", icon: ClipboardCheck },
  { href: "/app/calls", label: "Call Queue", icon: PhoneCall },
  { href: "/app/leads", label: "Lead Queue", icon: UserRoundSearch },
  { href: "/app/appointments", label: "Booking Queue", icon: CalendarClock, requiredPlan: "STARTER", requiredFeature: "appointmentsEnabled" },
  { href: "/app/messages", label: "Inbox", icon: MessageSquareText },
  { href: "/app/outreach", label: "Outreach", icon: Megaphone, comingSoon: true },
  { href: "/app/analytics", label: "Performance", icon: BarChart3, requiredPlan: "STARTER" },
  { href: "/app/settings", label: "Receptionist Setup", icon: Settings2, requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] },
  { href: "/app/billing", label: "Billing", icon: Wallet, requiredRoles: ["CLIENT_ADMIN"] },
  { href: "/app/team", label: "Team & Routing", icon: Users2, requiredPlan: "PRO", requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] }
];
const primaryNavHrefs = new Set(["/app", "/app/onboarding", "/app/calls", "/app/leads", "/app/appointments", "/app/messages", "/app/outreach", "/app/analytics"]);

function hasRequiredPlan(currentPlan: PlanTier, requiredPlan?: "STARTER" | "PRO") {
  if (!requiredPlan) return true;
  if (!currentPlan) return false;
  if (requiredPlan === "STARTER") return currentPlan === "STARTER" || currentPlan === "PRO";
  return currentPlan === "PRO";
}

function hasRequiredRole(currentRole: ClientRole | null, requiredRoles?: ClientRole[]) {
  if (!requiredRoles?.length) return true;
  if (!currentRole) return false;
  return requiredRoles.includes(currentRole);
}

function hasRequiredFeature(features: OrgFeatureState, requiredFeature?: FeatureKey) {
  if (!requiredFeature) return true;
  return features[requiredFeature] === true;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [accessWarning, setAccessWarning] = useState<string | null>(null);
  const [modeBanner, setModeBanner] = useState<{ text: string; ctaLabel: string; ctaHref: string } | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanTier>(null);
  const [currentRole, setCurrentRole] = useState<ClientRole | null>(null);
  const [features, setFeatures] = useState<OrgFeatureState>({
    appointmentsEnabled: false
  });

  useEffect(() => {
    setAccessWarning(null);
    setModeBanner(null);
    if (pathname === "/app/onboarding") return;
    void Promise.all([fetchOrgOnboarding(), fetchOrgProfile(), getBillingStatus(), getMe()])
      .then(([onboarding, orgProfile, billing, me]) => {
        const subStatus = billing.subscription?.status || "";
        setCurrentPlan((billing.subscription?.plan as PlanTier) || null);
        setCurrentRole(me.user.role);
        setFeatures({
          appointmentsEnabled: orgProfile.features?.appointmentsEnabled === true
        });
        const demo = billing.demo;
        const onboardingStatus = onboarding.submission?.status || "DRAFT";
        const orgStatus = orgProfile.organization?.status || "";
        const hasAccess = ["active", "trialing"].includes(subStatus) || !billing.subscription;
        const onboardingDone = ["SUBMITTED", "REVIEWED", "APPROVED"].includes(onboardingStatus);

        if (subStatus === "past_due" || subStatus === "unpaid" || subStatus === "incomplete" || subStatus === "payment_failed") {
          setModeBanner({
            text: "Payment failed. Billing is inactive until resolved.",
            ctaLabel: "Fix Billing",
            ctaHref: "/app/billing"
          });
        } else if (orgStatus === "TESTING") {
          setModeBanner({
            text: "Testing Mode is active. Validate calls and messages before go-live.",
            ctaLabel: "Run Tests",
            ctaHref: "/app/calls"
          });
        } else if (orgStatus === "PAUSED") {
          setModeBanner({
            text: "This workspace is paused. Runtime automation is currently limited.",
            ctaLabel: "Fix Billing",
            ctaHref: "/app/billing"
          });
        } else if (
          !["LIVE", "TESTING"].includes(orgStatus) &&
          (pathname.startsWith("/app/calls") || pathname.startsWith("/app/messages") || pathname.startsWith("/app/leads"))
        ) {
          setModeBanner({
            text: "Setup mode. Complete onboarding before full runtime features.",
            ctaLabel: "Complete Onboarding",
            ctaHref: "/app/onboarding"
          });
        }

        if (!billing.subscription && demo?.mode === "GUIDED_DEMO") {
          if (demo.state === "ACTIVE") {
            setModeBanner({
              text: `Guided demo active: ${demo.callsUsed}/${demo.callCap} AI demo calls used.${demo.windowEndsAt ? ` Window ends ${new Date(demo.windowEndsAt).toLocaleDateString()}.` : ""}`,
              ctaLabel: "Upgrade Plan",
              ctaHref: "/app/billing"
            });
          } else if (demo.state === "OVER_CAP") {
            setModeBanner({
              text: `Guided demo cap reached (${demo.callsUsed}/${demo.callCap}). Upgrade to continue AI call handling.`,
              ctaLabel: "Upgrade Plan",
              ctaHref: "/app/billing"
            });
          } else if (demo.state === "EXPIRED") {
            setModeBanner({
              text: `Guided demo expired. Usage summary: ${demo.callsUsed}/${demo.callCap} calls. Activate a paid plan to continue.`,
              ctaLabel: "Activate Plan",
              ctaHref: "/app/billing"
            });
          }
        }

        if (!hasAccess) {
          router.replace("/app/onboarding");
          return;
        }
        if (me.user.role === "CLIENT_STAFF" && pathname.startsWith("/app/billing")) {
          router.replace("/app");
          return;
        }
        if (me.user.role === "CLIENT" && (pathname.startsWith("/app/billing") || pathname.startsWith("/app/settings") || pathname.startsWith("/app/team"))) {
          router.replace("/app");
          return;
        }
        if (!onboardingDone) {
          setAccessWarning("Finish onboarding to unlock live configuration and full automation features.");
        }
      })
      .catch(() => {
        setAccessWarning("Could not verify onboarding status. You can still continue, but check your API connection.");
        setCurrentPlan(null);
        setCurrentRole(null);
        setFeatures({
          appointmentsEnabled: false
        });
      });
  }, [pathname, router]);

  const renderNavItem = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;

    if (
      !hasRequiredPlan(currentPlan, item.requiredPlan) ||
      !hasRequiredRole(currentRole, item.requiredRoles) ||
      !hasRequiredFeature(features, item.requiredFeature)
    ) {
      return (
        <div
          key={item.href}
          title={
            !hasRequiredPlan(currentPlan, item.requiredPlan)
              ? `Requires ${item.requiredPlan} plan`
              : !hasRequiredRole(currentRole, item.requiredRoles)
                ? "Role does not have access"
                : "Feature is not enabled for this workspace"
          }
          className="flex items-center justify-between rounded-2xl border border-transparent px-3 py-2.5 text-sm text-slate-600"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white/80 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex items-center gap-2">
              <span>{item.label}</span>
              {item.comingSoon ? <Badge className={clientBadgeClass("pending")}>Coming soon</Badge> : null}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide">
            <Lock className="h-3 w-3" />
            {!hasRequiredPlan(currentPlan, item.requiredPlan)
              ? item.requiredPlan
              : !hasRequiredRole(currentRole, item.requiredRoles)
                ? "ROLE"
                : "OFF"}
          </span>
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors duration-150",
          pathname === item.href
            ? "border-blue-200 bg-blue-50 text-blue-950 shadow-[inset_3px_0_0_0_rgb(30,64,175)]"
            : "border-slate-200 bg-slate-50 text-slate-800 shadow-none hover:border-slate-300 hover:bg-white hover:text-slate-950"
        )}
      >
        <span
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
            pathname === item.href
              ? "border-blue-200 bg-white text-blue-700"
              : "border-slate-200 bg-white text-slate-500"
          )}
        >
          <Icon className={cn("h-4 w-4", pathname === item.href && item.href === "/app/messages" ? "scale-110" : "")} />
        </span>
        <span className="truncate">{item.label}</span>
        {item.comingSoon ? <Badge className={`ml-auto hidden shrink-0 sm:inline-flex ${clientBadgeClass("pending")}`}>Soon</Badge> : null}
      </Link>
    );
  };

  const primaryNavItems = navItems.filter((item) => primaryNavHrefs.has(item.href));
  const secondaryNavItems = navItems.filter((item) => !primaryNavHrefs.has(item.href));
  const currentPageLabel =
    navItems.find((item) => pathname === item.href || (item.href !== "/app" && pathname.startsWith(`${item.href}/`)))?.label || "Front Desk";

  return (
    <ClientGuard>
      <div className="min-h-screen bg-[#f5f7f8]">
        <div className="flex min-h-screen">
          <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white xl:flex xl:flex-col">
            <div className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-sky-200/70">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-base font-bold leading-none text-slate-900">Front Desk OS</h1>
                  <p className="text-xs font-medium text-slate-500">Reception Manager</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-6">
              <div className="pb-2">
                <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
              </div>
              {primaryNavItems.filter((item) => !item.comingSoon).map(renderNavItem)}
              <div className="border-t border-slate-200 pt-4">
                <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Upcoming</p>
              </div>
              {primaryNavItems.filter((item) => item.comingSoon).map(renderNavItem)}
              <div className="border-t border-slate-200 pt-4">
                <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Administration</p>
              </div>
              {secondaryNavItems.map(renderNavItem)}
            </nav>

            <div className="border-t border-slate-200 p-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-xs font-bold text-slate-600">
                    {currentRole?.slice(0, 1) || "A"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">Workspace User</p>
                    <p className="truncate text-xs text-slate-500">{currentRole?.replaceAll("_", " ") || "Operator"}</p>
                  </div>
                </div>
                <Link
                  href="/auth/logout"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Link>
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur lg:px-8">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900">{currentPageLabel}</h2>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Front Desk Workspace</p>
                </div>
                <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 md:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  System Live
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden md:block">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      readOnly
                      value=""
                      placeholder="Search leads, calls, customers..."
                      className="w-64 rounded-xl border-none bg-slate-100 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                    />
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 md:flex">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div className="hidden items-center gap-3 pl-2 md:flex">
                  <div className="text-right">
                    <p className="text-sm font-bold leading-none text-slate-900">Workspace User</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {currentRole?.replaceAll("_", " ") || "Operator"}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xs font-bold text-slate-600">
                    {currentRole?.slice(0, 1) || "A"}
                  </div>
                </div>
              </div>
            </header>

            <main className="flex-1 space-y-4 px-4 py-6 sm:px-6 lg:px-8">
              {modeBanner ? (
                <div className="app-banner app-banner-primary">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{modeBanner.text}</span>
                    <Link href={modeBanner.ctaHref} className="rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800">
                      {modeBanner.ctaLabel}
                    </Link>
                  </div>
                </div>
              ) : null}
              {accessWarning ? (
                <div className="app-banner app-banner-warning">
                  {accessWarning} <Link href="/app/onboarding" className="font-medium underline">Go to onboarding</Link>
                </div>
              ) : null}
              {children}
            </main>
          </div>
        </div>
      </div>
    </ClientGuard>
  );
}
