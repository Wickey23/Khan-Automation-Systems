"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Lock, MessageSquareText, PhoneCall, Settings2, Users2, Wallet, LayoutDashboard, ClipboardCheck, CalendarClock, UserRoundSearch } from "lucide-react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { fetchOrgOnboarding, fetchOrgProfile, getBillingStatus, getMe } from "@/lib/api";
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
}> = [
  { href: "/app", label: "Front Desk", icon: LayoutDashboard },
  { href: "/app/onboarding", label: "Setup Wizard", icon: ClipboardCheck },
  { href: "/app/calls", label: "Call Queue", icon: PhoneCall },
  { href: "/app/leads", label: "Lead Queue", icon: UserRoundSearch },
  { href: "/app/appointments", label: "Booking Queue", icon: CalendarClock, requiredPlan: "STARTER", requiredFeature: "appointmentsEnabled" },
  { href: "/app/messages", label: "Inbox", icon: MessageSquareText },
  { href: "/app/analytics", label: "Performance", icon: BarChart3, requiredPlan: "STARTER" },
  { href: "/app/settings", label: "Receptionist Setup", icon: Settings2, requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] },
  { href: "/app/billing", label: "Billing", icon: Wallet, requiredRoles: ["CLIENT_ADMIN"] },
  { href: "/app/team", label: "Team & Routing", icon: Users2, requiredPlan: "PRO", requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] }
];
const primaryNavHrefs = new Set(["/app", "/app/onboarding", "/app/calls", "/app/leads", "/app/appointments", "/app/messages", "/app/analytics"]);

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
          className="flex items-center justify-between rounded-2xl border border-transparent px-3 py-2.5 text-sm text-slate-500/95"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white/80 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <Icon className="h-4 w-4" />
            </span>
            <span>{item.label}</span>
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
          "flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-all duration-200",
          pathname === item.href
            ? "border-blue-300/80 bg-[linear-gradient(135deg,rgba(30,64,175,0.97)_0%,rgba(37,99,235,0.95)_64%,rgba(14,165,233,0.90)_100%)] text-primary-foreground shadow-[0_18px_34px_rgba(37,99,235,0.26)]"
            : "border-transparent bg-white/[0.55] text-slate-700 hover:border-slate-200/90 hover:bg-white/[0.92] hover:text-slate-950 hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
        )}
      >
        <span
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
            pathname === item.href
              ? "border-white/20 bg-white/[0.12] text-primary-foreground"
              : "border-slate-200/90 bg-white/90 text-slate-500"
          )}
        >
          <Icon className={cn("h-4 w-4", pathname === item.href && item.href === "/app/messages" ? "scale-110" : "")} />
        </span>
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const primaryNavItems = navItems.filter((item) => primaryNavHrefs.has(item.href));
  const secondaryNavItems = navItems.filter((item) => !primaryNavHrefs.has(item.href));

  return (
    <ClientGuard>
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="app-portal-shell">
          <div className="relative grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
          <aside className="app-sidebar-shell xl:sticky xl:top-24">
            <div className="rounded-[24px] border border-slate-200/90 bg-[linear-gradient(135deg,rgba(30,64,175,0.96)_0%,rgba(37,99,235,0.94)_55%,rgba(14,165,233,0.90)_100%)] px-4 py-4 text-white shadow-[0_18px_38px_rgba(30,64,175,0.28)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/90">Client Portal</p>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-white">Front Desk OS</h2>
              <p className="mt-2 text-sm leading-6 text-blue-50/90">
                Calls, texts, bookings, and follow-up work in one operator workspace.
              </p>
            </div>
            <div className="px-3 pb-1 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace navigation</p>
            </div>
            <nav className="mt-2 space-y-4">
              <div className="grid gap-1">
                {primaryNavItems.map(renderNavItem)}
              </div>
              <div className="border-t pt-4">
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Setup & management</p>
                <div className="grid gap-1">
                  {secondaryNavItems.map(renderNavItem)}
                </div>
              </div>
            </nav>
            <div className="mt-5 rounded-[22px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(243,248,252,0.96)_100%)] px-4 py-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">How work flows</p>
              <p className="mt-2 text-sm font-medium text-slate-950">Calls and texts create front-desk work.</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Start in Front Desk, work the Call Queue or Inbox, move booking-ready requests into the Booking Queue, then finish them as booked or resolved.
              </p>
            </div>
            <div className="mt-5 border-t border-slate-200/80 pt-4">
              <Link href="/auth/logout" className="inline-flex w-full rounded-2xl border border-slate-200/90 bg-white/[0.85] px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950">
                Logout
              </Link>
            </div>
          </aside>
          <main className="app-main-shell">
            {modeBanner ? (
              <div className="app-banner app-banner-primary">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{modeBanner.text}</span>
                  <Link href={modeBanner.ctaHref} className="rounded-xl border border-blue-300/90 bg-white/90 px-3 py-1.5 text-xs font-semibold text-blue-950 shadow-[0_8px_18px_rgba(37,99,235,0.12)]">
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
