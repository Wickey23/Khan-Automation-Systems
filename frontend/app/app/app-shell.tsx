"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Calendar,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PhoneCall,
  Rocket,
  Search,
  Settings,
  Shield,
  Users
} from "lucide-react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { fetchOrgOnboarding, fetchOrgProfile, getBillingStatus, getMe } from "@/lib/api";
import { AccessSummaryProvider } from "@/context/access-summary";
import type { AccessFeatureKey, AuthUser, OrgAccessSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type ClientRole = AuthUser["role"];
type ActivationStage = "not_started" | "in_progress" | "ready";
type FirstSuccessSignal = { at: string; type: "call" | "sms" | "booking" } | null;

const navItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/activation", label: "Activation", icon: Shield },
  { href: "/app/calls", label: "Calls", icon: PhoneCall },
  { href: "/app/messages", label: "Messages", icon: MessageSquare },
  { href: "/app/appointments", label: "Appointments", icon: Calendar },
  { href: "/app/leads", label: "Leads", icon: Users },
  { href: "/app/customer-base", label: "Customer Base", icon: Users },
  { href: "/app/outreach", label: "Outreach", icon: Rocket },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/team", label: "Team", icon: Users }
];

function isCoreFeatureReady(access: OrgAccessSummary | null) {
  if (!access) return false;
  return ["calls", "sms", "appointments"].every((key) => access.features[key as AccessFeatureKey]?.status === "ready");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [accessWarning, setAccessWarning] = useState<string | null>(null);
  const [modeBanner, setModeBanner] = useState<{ text: string; ctaLabel: string; ctaHref: string } | null>(null);
  const [activationBanner, setActivationBanner] = useState<{ stage: ActivationStage; text: string; ctaLabel: string; ctaHref: string } | null>(null);
  const [currentRole, setCurrentRole] = useState<ClientRole | null>(null);
  const [accessSummary, setAccessSummary] = useState<OrgAccessSummary | null>(null);
  const [workspaceLive, setWorkspaceLive] = useState(false);
  const [firstSuccess, setFirstSuccess] = useState<FirstSuccessSignal>(null);

  useEffect(() => {
    setAccessWarning(null);
    setModeBanner(null);
    setActivationBanner(null);
    setWorkspaceLive(false);
    setFirstSuccess(null);
    if (pathname === "/app/onboarding") return;
    void Promise.all([fetchOrgOnboarding(), fetchOrgProfile(), getBillingStatus(), getMe()])
      .then(([onboarding, orgProfile, billing, me]) => {
        const subStatus = billing.subscription?.status || "";
        setCurrentRole(me.user.role);
        const profileAccess = orgProfile.access || null;
        setAccessSummary(profileAccess);
        const milestoneType = orgProfile.organization?.firstSuccessType;
        const milestoneAt = orgProfile.organization?.firstSuccessAt;
        if (milestoneAt && (milestoneType === "call" || milestoneType === "sms" || milestoneType === "booking")) {
          setFirstSuccess({ at: milestoneAt, type: milestoneType });
        } else {
          setFirstSuccess(null);
        }
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
        const readinessTotal = profileAccess?.readinessChecklist?.length || 0;
        const readinessCompleted = (profileAccess?.readinessChecklist || []).filter((check) => check.status === "ready").length;
        const totalSteps = readinessTotal + 1;
        const completedSteps = readinessCompleted + (onboardingDone ? 1 : 0);
        const remainingSteps = Math.max(totalSteps - completedSteps, 0);
        const activationStage: ActivationStage =
          remainingSteps === 0 ? "ready" : completedSteps === 0 ? "not_started" : "in_progress";
        const nextWorkspaceLive = activationStage === "ready" && isCoreFeatureReady(profileAccess);
        setWorkspaceLive(nextWorkspaceLive);
        if (activationStage === "not_started") {
          setActivationBanner({
            stage: "not_started",
            text: `Activation not started: ${completedSteps}/${totalSteps} steps complete.`,
            ctaLabel: "Start activation",
            ctaHref: "/app/activation"
          });
        } else if (activationStage === "in_progress") {
          setActivationBanner({
            stage: "in_progress",
            text: `Activation in progress: ${completedSteps}/${totalSteps} complete, ${remainingSteps} remaining.`,
            ctaLabel: "Continue activation",
            ctaHref: "/app/activation"
          });
        } else {
          setActivationBanner(
            nextWorkspaceLive
              ? null
              : {
                  stage: "ready",
                  text: "Activation complete. Final confidence checks are still resolving.",
                  ctaLabel: "Open activation",
                  ctaHref: "/app/activation"
                }
          );
        }
        setAccessWarning(activationStage === "ready" ? null : nextAccessWarning);
      })
      .catch(() => {
        setAccessWarning("Could not verify onboarding status. You can still continue, but check your API connection.");
        setCurrentRole(null);
        setAccessSummary(null);
        setActivationBanner(null);
        setWorkspaceLive(false);
        setFirstSuccess(null);
      });
  }, [pathname, router]);

  const liveStatus = useMemo(
    () => (workspaceLive ? (firstSuccess ? "Proven Live" : "Live") : "Setup"),
    [firstSuccess, workspaceLive]
  );

  return ClientGuard({
    children: (
      <AccessSummaryProvider value={accessSummary}>
        <div className="flex min-h-screen bg-[#f1f3f6] text-slate-800">
          <aside className="hidden w-[276px] shrink-0 border-r border-slate-200 bg-[#e8edf3] p-6 xl:flex xl:flex-col">
            <div className="mb-8">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#2f54d8] text-white shadow-sm">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <p className="text-[33px] font-semibold tracking-[-0.02em] text-slate-900">The Silent Orchestrator</p>
              <p className="mt-1 text-[26px] text-slate-600">Premium Operations</p>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium",
                      active ? "bg-white text-blue-700 shadow-sm" : "text-slate-700 hover:bg-white/70"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto space-y-3 pt-6">
              <Link
                href="/app/appointments"
                className="flex w-full items-center justify-center rounded-lg bg-[#3051d3] px-4 py-3 text-sm font-semibold text-white shadow-sm"
              >
                New Request
              </Link>
              <Link
                href="/auth/logout"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Link>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-[#f1f3f6] px-8">
              <div className="relative w-full max-w-[460px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  readOnly
                  value=""
                  placeholder="Command Center Search..."
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-[#e6ebf1] pl-10 pr-4 text-sm outline-none"
                />
              </div>
              <div className="flex items-center gap-4">
                <Bell className="h-5 w-5 text-slate-700" />
                <Settings className="h-5 w-5 text-slate-700" />
                <div className={cn("rounded-md border border-slate-200 bg-[#dbe4ea] px-3 py-1 text-xs font-semibold text-slate-700", workspaceLive ? "text-emerald-700" : "text-slate-700")}>
                  {liveStatus}
                </div>
                <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">Alex Khan</p>
                    <p className="text-xs text-slate-500">System Admin</p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#efc8b3] text-xs font-semibold text-slate-900">
                    {String((currentRole?.[0] || "A")).toUpperCase()}
                  </div>
                </div>
              </div>
            </header>

            <div className="px-6 py-6">
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
              {!modeBanner && activationBanner ? (
                <div className={activationBanner.stage === "not_started" ? "app-banner app-banner-warning" : "app-banner app-banner-primary"}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{activationBanner.text}</span>
                    <Link href={activationBanner.ctaHref} className="rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800">
                      {activationBanner.ctaLabel}
                    </Link>
                  </div>
                </div>
              ) : null}
              {!modeBanner && workspaceLive ? (
                <div className="app-banner app-banner-primary">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {firstSuccess
                        ? `System proven live. First ${firstSuccess.type} interaction recorded on ${new Date(firstSuccess.at).toLocaleString()}.`
                        : "System ready and listening. Inbound calls, SMS automation, and booking workflows are operational."}
                    </span>
                    <Link href="/app/calls" className="rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800">
                      View live calls
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
          </div>
        </div>
      </AccessSummaryProvider>
    )
  });
}
