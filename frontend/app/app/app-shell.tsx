"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Calendar,
  ConciergeBell,
  CreditCard,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  PhoneCall,
  Rocket,
  Search,
  Settings,
  Users
} from "lucide-react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { fetchOrgOnboarding, fetchOrgProfile, getBillingStatus, getMe } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { AccessSummaryProvider } from "@/context/access-summary";
import { clientBadgeClass } from "@/lib/client-badges";
import { cn } from "@/lib/utils";
import type { AccessFeatureKey, AccessStatus, AuthUser, OrgAccessSummary } from "@/lib/types";

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
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/activation", label: "Activation", icon: Shield, requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] },
  { href: "/app/calls", label: "Calls", icon: PhoneCall },
  { href: "/app/leads", label: "Leads", icon: Users },
  { href: "/app/appointments", label: "Appointments", icon: Calendar, requiredPlan: "STARTER", requiredFeature: "appointmentsEnabled" },
  { href: "/app/messages", label: "Messages", icon: MessageSquare },
  { href: "/app/outreach", label: "Outreach", icon: Rocket, comingSoon: true },
  { href: "/app/team", label: "Team", icon: Users, requiredPlan: "PRO", requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] },
  { href: "/app/billing", label: "Billing", icon: CreditCard, requiredRoles: ["CLIENT_ADMIN"] },
  { href: "/app/settings", label: "Settings", icon: Settings, requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] }
];

const navFeatureAccess: Record<string, AccessFeatureKey | undefined> = {
  "/app/calls": "calls",
  "/app/messages": "sms",
  "/app/outreach": "outreach",
  "/app/appointments": "appointments"
};

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

function currentLabel(pathname: string) {
  const match =
    navItems.find((item) => pathname === item.href || (item.href !== "/app" && pathname.startsWith(`${item.href}/`))) || null;
  return match?.label || "Dashboard";
}

function formatAccessStatus(status?: AccessStatus) {
  if (!status) return "Unknown";
  return status.replace(/_/g, " ");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [accessWarning, setAccessWarning] = useState<string | null>(null);
  const [modeBanner, setModeBanner] = useState<{ text: string; ctaLabel: string; ctaHref: string } | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanTier>(null);
  const [currentRole, setCurrentRole] = useState<ClientRole | null>(null);
  const [features, setFeatures] = useState<OrgFeatureState>({ appointmentsEnabled: false });
  const [accessSummary, setAccessSummary] = useState<OrgAccessSummary | null>(null);

  useEffect(() => {
    setAccessWarning(null);
    setModeBanner(null);
    if (pathname === "/app/onboarding") return;
    void Promise.all([fetchOrgOnboarding(), fetchOrgProfile(), getBillingStatus(), getMe()])
      .then(([onboarding, orgProfile, billing, me]) => {
        const subStatus = billing.subscription?.status || "";
        setCurrentPlan((billing.subscription?.plan as PlanTier) || null);
        setCurrentRole(me.user.role);
        setFeatures({ appointmentsEnabled: orgProfile.features?.appointmentsEnabled === true });
        const profileAccess = orgProfile.access || null;
        setAccessSummary(profileAccess);
        const demo = billing.demo;
        const onboardingStatus = onboarding.submission?.status || "DRAFT";
        const orgStatus = orgProfile.organization?.status || "";
        const hasAccess = ["active", "trialing"].includes(subStatus) || !billing.subscription;
        const onboardingDone = ["SUBMITTED", "REVIEWED", "APPROVED"].includes(onboardingStatus);

        if (subStatus === "past_due" || subStatus === "unpaid" || subStatus === "incomplete" || subStatus === "payment_failed") {
          setModeBanner({ text: "Payment failed. Billing is inactive until resolved.", ctaLabel: "Fix Billing", ctaHref: "/app/billing" });
        } else if (orgStatus === "TESTING") {
          setModeBanner({ text: "Testing Mode is active. Validate calls and messages before go-live.", ctaLabel: "Run Tests", ctaHref: "/app/calls" });
        } else if (orgStatus === "PAUSED") {
          setModeBanner({ text: "This workspace is paused. Runtime automation is currently limited.", ctaLabel: "Fix Billing", ctaHref: "/app/billing" });
        } else if (
          !["LIVE", "TESTING"].includes(orgStatus) &&
          (pathname.startsWith("/app/calls") || pathname.startsWith("/app/messages") || pathname.startsWith("/app/leads"))
        ) {
          setModeBanner({
            text: "Setup mode. Complete activation before full runtime features.",
            ctaLabel: "Open Activation",
            ctaHref: "/app/activation"
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
        const readinessIssue = profileAccess?.readinessChecklist?.find((check) => check.status !== "ready") || null;
        let nextAccessWarning: string | null = null;
        if (!onboardingDone) {
          nextAccessWarning = "Finish activation to unlock live configuration and full automation features.";
        } else if (readinessIssue) {
          nextAccessWarning = `${readinessIssue.label}: ${readinessIssue.description}`;
        }
        setAccessWarning(nextAccessWarning);
      })
      .catch(() => {
        setAccessWarning("Could not verify onboarding status. You can still continue, but check your API connection.");
        setCurrentPlan(null);
        setCurrentRole(null);
        setFeatures({ appointmentsEnabled: false });
        setAccessSummary(null);
      });
  }, [pathname, router]);

  const pageLabel = useMemo(() => currentLabel(pathname), [pathname]);

  const renderNavItem = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(`${item.href}/`));
    const featureKey = navFeatureAccess[item.href];
    const featureStatus = featureKey ? accessSummary?.features[featureKey] : undefined;
    const lockedByFeature = Boolean(featureStatus && featureStatus.status !== "ready");
    const locked =
      !hasRequiredPlan(currentPlan, item.requiredPlan) ||
      !hasRequiredRole(currentRole, item.requiredRoles) ||
      !hasRequiredFeature(features, item.requiredFeature) ||
      lockedByFeature;

    if (locked) {
      return (
        <div key={item.href} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold text-slate-400">
          <span className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-slate-500" />
            <span>{item.label}</span>
          </span>
          {lockedByFeature && featureStatus ? (
            <StatusBadge kind="feature" state={featureStatus.status} label={formatAccessStatus(featureStatus.status)} size="xs" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all",
          active ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-600 hover:bg-primary/5 hover:text-primary"
        )}
      >
        <Icon className={cn("h-5 w-5", active ? "text-white" : "text-slate-400 group-hover:text-primary")} />
        <span>{item.label}</span>
        {item.comingSoon ? (
          <Badge className={cn("ml-auto", active ? "bg-white/20 text-white" : clientBadgeClass("pending"))}>
            Soon
          </Badge>
        ) : null}
      </Link>
    );
  };

  return ClientGuard({
    children: (
      <AccessSummaryProvider value={accessSummary}>
        <div className="flex h-screen overflow-hidden bg-background-light">
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white xl:flex">
            <div className="flex flex-col gap-6 p-6">
              <div className="flex items-center gap-3 px-2">
                <div className="rounded-xl bg-primary p-2 text-white shadow-lg shadow-primary/20">
                  <ConciergeBell className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-base font-extrabold leading-none tracking-tight text-slate-900">Front Desk OS</h1>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Reception Manager</p>
                </div>
              </div>

              <nav className="flex flex-col gap-1">{navItems.map(renderNavItem)}</nav>
            </div>

            <div className="border-t border-slate-200 p-6">
              <Link
                href="/app/appointments"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
              >
                <Calendar className="h-4 w-4" />
                <span>New Booking</span>
              </Link>
              <Link
                href="/auth/logout"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Link>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8">
              <div className="flex max-w-xl flex-1 items-center gap-4">
                <div className="relative w-full">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    readOnly
                    value=""
                    placeholder="Search leads, bookings, or calls..."
                    className="h-10 w-full rounded-xl bg-slate-100 py-2 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button className="relative rounded-lg p-2 text-slate-600 transition-all hover:bg-slate-100 hover:text-primary">
                  <Bell className="h-5 w-5" />
                  <div className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
                </button>
                <button className="rounded-lg p-2 text-slate-600 transition-all hover:bg-slate-100 hover:text-primary">
                  <MessageSquare className="h-5 w-5" />
                </button>
                <div className="mx-1 h-8 w-px bg-slate-200" />
                <div className="hidden items-center gap-3 pl-2 sm:flex">
                  <div className="text-right">
                    <p className="text-sm font-bold leading-none text-slate-900">Workspace User</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {currentRole?.replaceAll("_", " ") || "Reception Manager"}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xs font-bold text-slate-600">
                    {currentRole?.slice(0, 1) || "A"}
                  </div>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto">
              <div className="px-4 py-6 sm:px-6 lg:px-8">
                <div className="mb-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-end justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Front Desk Workspace</p>
                      <h1 className="mt-2 text-[30px] font-black tracking-[-0.04em] text-slate-900">{pageLabel}</h1>
                    </div>
                    <span className="hidden items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 md:inline-flex">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      System Live
                    </span>
                  </div>
                </div>
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
                    {accessWarning} <Link href="/app/activation" className="font-medium underline">Go to activation flow</Link>
                  </div>
                ) : null}
                {children}
              </div>
            </main>
          </div>
        </div>
      </AccessSummaryProvider>
    )
  });
}
