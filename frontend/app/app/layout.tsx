"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Lock, MessageSquareText, PhoneCall, Settings2, Users2, Wallet, LayoutDashboard, ClipboardCheck, CalendarClock, UserRoundSearch, Megaphone } from "lucide-react";
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
  const [setupOverlay, setSetupOverlay] = useState<{
    title: string;
    body: string;
    steps: Array<{ label: string; done: boolean }>;
  } | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanTier>(null);
  const [currentRole, setCurrentRole] = useState<ClientRole | null>(null);
  const [features, setFeatures] = useState<OrgFeatureState>({
    appointmentsEnabled: false
  });

  useEffect(() => {
    setAccessWarning(null);
    setModeBanner(null);
    setSetupOverlay(null);
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
          setSetupOverlay({
            title: "Almost there! Just a few more steps to go.",
            body: "Your Front Desk OS is currently inactive. Complete the remaining setup steps before the system starts handling calls, messages, and booking requests.",
            steps: [
              { label: "Provision a business phone number", done: Boolean(orgProfile.assignedPhoneNumber) },
              { label: "Configure AI response personality", done: onboardingDone },
              { label: "Account creation", done: true }
            ]
          });
        }
      })
      .catch(() => {
        setAccessWarning("Could not verify onboarding status. You can still continue, but check your API connection.");
        setSetupOverlay({
          title: "Configuration check could not complete.",
          body: "We could not verify whether this workspace finished setup. Review onboarding before using live runtime workflows.",
          steps: [
            { label: "Provision a business phone number", done: false },
            { label: "Configure AI response personality", done: false },
            { label: "Account creation", done: true }
          ]
        });
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

  return (
    <ClientGuard>
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="app-portal-shell">
          <div className="relative grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
          <aside className="app-sidebar-shell xl:sticky xl:top-24">
            <div className="rounded-[12px] border border-slate-800 bg-slate-950 px-4 py-4 text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Client portal</p>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-white">Front Desk OS</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Calls, texts, bookings, and follow-up work in one workspace.
              </p>
            </div>
            <div className="px-3 pb-1 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Live work</p>
            </div>
            <nav className="mt-2 space-y-4">
              <div className="grid gap-1">
                {primaryNavItems.filter((item) => !item.comingSoon).map(renderNavItem)}
              </div>
              <div className="border-t pt-4">
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Upcoming</p>
                <div className="grid gap-1">
                  {primaryNavItems.filter((item) => item.comingSoon).map(renderNavItem)}
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Setup & management</p>
                <div className="grid gap-1">
                  {secondaryNavItems.map(renderNavItem)}
                </div>
              </div>
            </nav>
            <div className="mt-5 rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">How work flows</p>
              <p className="mt-2 text-sm font-medium text-slate-950">Work the live queue, then move the request forward.</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                Start in Front Desk for the clearest priorities, switch into the queue that owns the next step, then finish the request as booked or resolved.
              </p>
            </div>
            <div className="mt-5 border-t border-slate-200/80 pt-4">
              <Link href="/auth/logout" className="inline-flex w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50 hover:text-slate-950">
                Logout
              </Link>
            </div>
          </aside>
          <main className="app-main-shell">
            {modeBanner ? (
              <div className="app-banner app-banner-primary">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{modeBanner.text}</span>
                  <Link href={modeBanner.ctaHref} className="rounded-[10px] border border-blue-300/90 bg-white/90 px-3 py-1.5 text-xs font-semibold text-blue-950 shadow-none">
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
            <div className="relative">
              {setupOverlay ? <div className="pointer-events-none opacity-40 blur-[1px]">{children}</div> : children}
              {setupOverlay ? (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-100/30 p-6 backdrop-blur-[2px]">
                  <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50 px-6 py-4">
                      <span className="material-symbols-outlined text-amber-500">warning</span>
                      <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-800">Operations are Paused</p>
                    </div>
                    <div className="p-8 md:p-12">
                      <div className="flex flex-col items-center gap-8 lg:flex-row">
                        <div className="flex-1 space-y-4">
                          <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-slate-950">{setupOverlay.title}</h2>
                          <p className="text-lg text-slate-600">{setupOverlay.body}</p>
                          <div className="space-y-3 pt-4">
                            {setupOverlay.steps.map((step) => (
                              <div key={step.label} className="flex items-center gap-3 text-slate-700">
                                <div className={`flex h-6 w-6 items-center justify-center rounded-full ${step.done ? "bg-green-100" : "bg-slate-100"}`}>
                                  <span className={`material-symbols-outlined text-sm ${step.done ? "text-green-500" : "text-slate-400"}`}>
                                    {step.done ? "check" : "close"}
                                  </span>
                                </div>
                                <span className={`text-sm font-medium ${step.done ? "text-slate-400 line-through" : ""}`}>{step.label}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-col gap-4 pt-6 sm:flex-row">
                            <Link
                              href="/app/onboarding"
                              className="inline-flex items-center justify-center rounded-xl bg-primary px-8 py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
                            >
                              Complete Setup Wizard
                              <span className="material-symbols-outlined ml-2">arrow_forward</span>
                            </Link>
                            <Link
                              href="/app/settings"
                              className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-8 py-4 font-bold text-slate-700 transition-all hover:bg-slate-200"
                            >
                              Contact Support
                            </Link>
                          </div>
                        </div>
                        <div className="hidden h-64 w-64 flex-shrink-0 lg:block">
                          <div className="relative flex h-full w-full items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/30">
                            <div className="absolute -right-4 -top-4 rounded-xl border border-slate-100 bg-white p-3 shadow-xl">
                              <span className="material-symbols-outlined text-4xl text-primary">phone_in_talk</span>
                            </div>
                            <div className="absolute -bottom-4 -left-4 rounded-xl border border-slate-100 bg-white p-3 shadow-xl">
                              <span className="material-symbols-outlined text-4xl text-amber-500">robot_2</span>
                            </div>
                            <div className="flex flex-col items-center p-6 text-center">
                              <span className="material-symbols-outlined mb-2 text-6xl text-slate-400">construction</span>
                              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Awaiting Setup</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50 px-8 py-4 text-center">
                      <p className="text-xs text-slate-500">
                        Setup usually takes less than 5 minutes. Need help? Check the <Link href="/app/onboarding" className="text-primary hover:underline">setup wizard</Link>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </main>
          </div>
        </div>
      </div>
    </ClientGuard>
  );
}
