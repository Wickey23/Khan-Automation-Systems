"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  BrainCircuit,
  Calendar,
  CircleHelp,
  ClipboardCheck,
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
  Shield,
  Users
} from "lucide-react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { fetchOrgOnboarding, fetchOrgProfile, getBillingStatus, getMe } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { AccessSummaryProvider } from "@/context/access-summary";
import { clientBadgeClass } from "@/lib/client-badges";
import { RELEASE_TAG } from "@/lib/release-tag";
import { cn } from "@/lib/utils";
import type { AccessFeatureKey, AccessStatus, AuthUser, OrgAccessSummary } from "@/lib/types";
import { SectionDisclosure } from "@/components/ops";

type PlanTier = "STARTER" | "PRO" | null;
type ClientRole = AuthUser["role"];
type FeatureKey = "appointmentsEnabled";
type OrgFeatureState = Record<FeatureKey, boolean>;
type ActivationStage = "not_started" | "in_progress" | "ready";
type LiveBadge = { label: string; classes: string };
type FirstSuccessSignal = { at: string; type: "call" | "sms" | "booking" } | null;

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
  { href: "/app/attention", label: "Attention", icon: AlertTriangle, requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] },
  { href: "/app/approvals", label: "Approvals", icon: ClipboardCheck, requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] },
  { href: "/app/follow-up", label: "Follow-up", icon: ClipboardCheck, requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] },
  { href: "/app/calls", label: "Calls", icon: PhoneCall },
  { href: "/app/leads", label: "Leads", icon: Users },
  { href: "/app/messages", label: "Messages", icon: MessageSquare },
  { href: "/app/insights", label: "Insights", icon: BrainCircuit, requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] },
  { href: "/app/settings", label: "Settings", icon: Settings, requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] },
  { href: "/app/activation", label: "Activation", icon: Shield, requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] },
  { href: "/app/appointments", label: "Appointments", icon: Calendar, requiredPlan: "STARTER", requiredFeature: "appointmentsEnabled" },
  { href: "/app/outreach", label: "Outreach", icon: Rocket, comingSoon: true },
  { href: "/app/team", label: "Team", icon: Users, requiredPlan: "PRO", requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] },
  { href: "/app/billing", label: "Billing", icon: CreditCard, requiredRoles: ["CLIENT_ADMIN"] },
  { href: "/app/analytics", label: "Analytics", icon: BrainCircuit, requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] }
];

const navFeatureAccess: Record<string, AccessFeatureKey | undefined> = {
  "/app/calls": "calls",
  "/app/messages": "sms",
  "/app/outreach": "outreach",
  "/app/appointments": "appointments"
};

const workflowSequence = [
  "/app/activation",
  "/app/settings",
  "/app",
  "/app/attention",
  "/app/approvals",
  "/app/follow-up",
  "/app/leads",
  "/app/messages",
  "/app/calls",
  "/app/appointments",
  "/app/insights",
  "/app/analytics",
  "/app/team",
  "/app/billing"
] as const;

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
  const [currentPlan, setCurrentPlan] = useState<PlanTier>(null);
  const [currentRole, setCurrentRole] = useState<ClientRole | null>(null);
  const [features, setFeatures] = useState<OrgFeatureState>({ appointmentsEnabled: false });
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
        setCurrentPlan((billing.subscription?.plan as PlanTier) || null);
        setCurrentRole(me.user.role);
        setFeatures({ appointmentsEnabled: orgProfile.features?.appointmentsEnabled === true });
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
        setCurrentPlan(null);
        setCurrentRole(null);
        setFeatures({ appointmentsEnabled: false });
        setAccessSummary(null);
        setActivationBanner(null);
        setWorkspaceLive(false);
        setFirstSuccess(null);
      });
  }, [pathname, router]);

  const pageLabel = useMemo(() => currentLabel(pathname), [pathname]);
  const liveBadge = useMemo<LiveBadge>(() => {
    if (workspaceLive) {
      return {
        label: firstSuccess ? "Proven Live" : "Live",
        classes: "bg-emerald-100 text-emerald-700"
      };
    }
    return {
      label: "Setup",
      classes: "bg-amber-100 text-amber-700"
    };
  }, [firstSuccess, workspaceLive]);
  const readinessSnapshot = useMemo(() => {
    if (!accessSummary) {
      return {
        readyFeatures: 0,
        totalFeatures: 0,
        remainingChecks: 0
      };
    }
    const featureList = Object.values(accessSummary.features);
    const readyFeatures = featureList.filter((feature) => feature.status === "ready").length;
    const remainingChecks = accessSummary.readinessChecklist.filter((check) => check.status !== "ready").length;
    return {
      readyFeatures,
      totalFeatures: featureList.length,
      remainingChecks
    };
  }, [accessSummary]);
  const hasWorkspaceNotice = Boolean(modeBanner || activationBanner || accessWarning || (!modeBanner && workspaceLive));
  const workflowSteps = useMemo(() => {
    return workflowSequence
      .map((href) => navItems.find((item) => item.href === href) || null)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => {
        const featureKey = navFeatureAccess[item.href];
        const featureStatus = featureKey ? accessSummary?.features[featureKey] : undefined;
        const lockedByFeature = Boolean(featureStatus && featureStatus.status !== "ready");
        const locked =
          !hasRequiredPlan(currentPlan, item.requiredPlan) ||
          !hasRequiredRole(currentRole, item.requiredRoles) ||
          !hasRequiredFeature(features, item.requiredFeature) ||
          lockedByFeature;
        return {
          href: item.href,
          label: item.label,
          locked
        };
      });
  }, [accessSummary, currentPlan, currentRole, features]);
  const activeWorkflowIndex = useMemo(() => {
    return workflowSteps.findIndex((step) => pathname === step.href || (step.href !== "/app" && pathname.startsWith(`${step.href}/`)));
  }, [pathname, workflowSteps]);
  const nextWorkflowStep = useMemo(() => {
    if (activeWorkflowIndex < 0) return workflowSteps.find((step) => !step.locked) || null;
    for (let i = activeWorkflowIndex + 1; i < workflowSteps.length; i += 1) {
      if (!workflowSteps[i].locked) return workflowSteps[i];
    }
    return null;
  }, [activeWorkflowIndex, workflowSteps]);

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
        <div key={item.href} className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-400">
          <span className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5" />
            <span>{item.label}</span>
          </span>
          {lockedByFeature && featureStatus ? (
            <StatusBadge kind="feature" state={featureStatus.status} label={formatAccessStatus(featureStatus.status)} size="xs" />
          ) : (
            <Lock className="h-3 w-3" />
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
          active
            ? "bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-[0_10px_18px_-12px_rgba(14,116,214,0.72)]"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:translate-x-0.5"
        )}
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-white" : "text-slate-400 group-hover:text-slate-700")} />
        <span>{item.label}</span>
        {item.comingSoon ? (
          <Badge className={cn("ml-auto text-[10px]", active ? "bg-white/20 text-white border-white/20" : clientBadgeClass("pending"))}>
            Soon
          </Badge>
        ) : null}
      </Link>
    );
  };

  return ClientGuard({
    children: (
      <AccessSummaryProvider value={accessSummary}>
        <div className="relative flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_48%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-sky-200/30 via-transparent to-blue-200/30" />
          {/* Sidebar */}
          <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col overflow-hidden border-r border-slate-200/70 bg-white/85 backdrop-blur lg:flex">
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Brand */}
              <div className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_10px_18px_-10px_rgba(14,116,214,0.7)]">
                  <ConciergeBell className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none tracking-tight text-slate-900">Front Desk OS</p>
                  <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">Operational Console</p>
                </div>
              </div>

              {/* Nav */}
              <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2">{navItems.map(renderNavItem)}</nav>
            </div>

            {/* Sidebar Footer */}
            <div className="border-t border-slate-200 px-2 py-2 space-y-1">
              <Link
                href="/app/appointments"
                className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>New Booking</span>
              </Link>
              <div className="grid grid-cols-2 gap-1">
                <Link
                  href="/app/settings"
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Settings</span>
                </Link>
                <Link
                  href="/auth/logout"
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Logout</span>
                </Link>
              </div>
            </div>
          </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* Top bar */}
            <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/82 px-4 py-2.5 backdrop-blur-xl sm:px-6">
              <div className="flex flex-1 items-center gap-3">
                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    readOnly
                    value=""
                    placeholder="Quick search..."
                    className="h-8 w-full rounded-md border border-slate-200 bg-white/95 py-1.5 pl-9 pr-4 text-sm outline-none placeholder:text-slate-400 transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-sky-300"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:inline-flex"
                  title={`Frontend release ${RELEASE_TAG}`}
                >
                  {RELEASE_TAG}
                </span>
                <button
                  aria-label="Notifications"
                  className="relative rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 shadow-[0_10px_16px_-14px_rgba(15,23,42,0.5)] transition-colors hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <Bell className="h-4 w-4" />
                  <div className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                </button>
                <button
                  aria-label="Help"
                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 shadow-[0_10px_16px_-14px_rgba(15,23,42,0.5)] transition-colors hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <CircleHelp className="h-4 w-4" />
                </button>
                {/* Mobile nav shortcuts */}
                <div className="flex items-center gap-1.5 lg:hidden">
                  <Link href="/app/settings" className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50" aria-label="Settings">
                    <Settings className="h-4 w-4" />
                  </Link>
                  <Link href="/auth/logout" className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50" aria-label="Logout">
                    <LogOut className="h-4 w-4" />
                  </Link>
                </div>
                <div className="hidden h-6 w-px bg-slate-200 sm:block" />
                <div className="hidden items-center gap-2 sm:flex">
                  <div className="text-right">
                    <p className="text-xs font-semibold leading-none text-slate-900">Workspace</p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {currentRole?.replaceAll("_", " ") || "Manager"}
                    </p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700">
                    {currentRole?.slice(0, 1) || "A"}
                  </div>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto">
              <div className="space-y-3 px-4 py-3 sm:px-6 lg:px-8">
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/90 bg-white/94 px-3 py-2 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.55)] backdrop-blur">
                  <p className="text-sm font-semibold text-slate-900">{pageLabel}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]", liveBadge.classes)}>
                      <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", workspaceLive ? "bg-emerald-500" : "bg-amber-500")}>
                        {workspaceLive ? <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/80" /> : null}
                      </span>
                      {liveBadge.label}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                      {readinessSnapshot.totalFeatures > 0
                        ? `${readinessSnapshot.readyFeatures}/${readinessSnapshot.totalFeatures} ready`
                        : "checking"}
                    </span>
                  </div>
                </div>
                <SectionDisclosure title="Workflow flow" storageKey="shell-workflow-flow" defaultCollapsed className="border-slate-200/90 bg-white/94 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.55)] backdrop-blur">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-600">Use this to move screen-to-screen without losing context.</p>
                      {nextWorkflowStep ? (
                        <Link
                          href={nextWorkflowStep.href}
                          className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 transition-colors hover:border-sky-300 hover:bg-sky-100"
                        >
                          Next: {nextWorkflowStep.label}
                        </Link>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Flow complete</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {workflowSteps.map((step, index) => {
                        const active = index === activeWorkflowIndex;
                        if (step.locked) {
                          return (
                            <span
                              key={step.href}
                              className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                            >
                              {step.label}
                            </span>
                          );
                        }
                        return (
                          <Link
                            key={step.href}
                            href={step.href}
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                              active
                                ? "border-sky-300 bg-sky-100 text-sky-800"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                            )}
                          >
                            {step.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </SectionDisclosure>

                {hasWorkspaceNotice ? (
                <SectionDisclosure title="Workspace notices" storageKey="shell-workspace-notices" defaultCollapsed className="border-slate-200/90 bg-white/94 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.55)] backdrop-blur">
                  {modeBanner ? (
                    <div className="app-banner app-banner-primary">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>{modeBanner.text}</span>
                        <Link href={modeBanner.ctaHref} className="rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 transition-colors hover:border-sky-300 hover:bg-sky-50">
                          {modeBanner.ctaLabel}
                        </Link>
                      </div>
                    </div>
                  ) : null}
                  {!modeBanner && activationBanner ? (
                    <div className={activationBanner.stage === "not_started" ? "app-banner app-banner-warning" : "app-banner app-banner-primary"}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>{activationBanner.text}</span>
                        <Link href={activationBanner.ctaHref} className="rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 transition-colors hover:border-sky-300 hover:bg-sky-50">
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
                        <Link href="/app/calls" className="rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 transition-colors hover:border-sky-300 hover:bg-sky-50">
                          View live calls
                        </Link>
                      </div>
                    </div>
                  ) : null}
                  {accessWarning ? (
                    <div className="app-banner app-banner-warning">
                      {accessWarning}{" "}
                      <Link href="/app/activation" className="font-semibold underline decoration-1 underline-offset-2">
                        Go to activation flow
                      </Link>
                    </div>
                  ) : null}
                </SectionDisclosure>
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
