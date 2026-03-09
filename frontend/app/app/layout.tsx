"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
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
  requiredPlan?: Exclude<PlanTier, null>;
  requiredRoles?: ClientRole[];
  requiredFeature?: FeatureKey;
}> = [
  { href: "/app", label: "Overview" },
  { href: "/app/calls", label: "Conversations" },
  { href: "/app/leads", label: "Leads" },
  { href: "/app/appointments", label: "Appointments", requiredPlan: "STARTER", requiredFeature: "appointmentsEnabled" },
  { href: "/app/messages", label: "Messages" },
  { href: "/app/analytics", label: "Analytics", requiredPlan: "STARTER" },
  { href: "/app/settings", label: "Assistant Settings", requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] },
  { href: "/app/billing", label: "Billing", requiredRoles: ["CLIENT_ADMIN"] },
  { href: "/app/team", label: "Team & Routing", requiredPlan: "PRO", requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] }
];
const primaryNavHrefs = new Set(["/app", "/app/calls", "/app/leads", "/app/appointments", "/app/messages", "/app/analytics"]);

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
          className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-muted-foreground/85"
        >
          <span>{item.label}</span>
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
          "rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
          pathname === item.href
            ? "bg-primary text-primary-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_8px_20px_rgba(31,58,138,0.12)]"
            : "text-foreground/88 hover:bg-muted/90 hover:text-foreground"
        )}
      >
        {item.label}
      </Link>
    );
  };

  const primaryNavItems = navItems.filter((item) => primaryNavHrefs.has(item.href));
  const secondaryNavItems = navItems.filter((item) => !primaryNavHrefs.has(item.href));

  return (
    <ClientGuard>
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid gap-6 xl:grid-cols-[248px_minmax(0,1fr)] xl:items-start">
          <aside className="h-fit rounded-[28px] border border-border/90 bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:sticky xl:top-24">
            <div className="px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Client Portal</p>
              <p className="mt-1 text-xs text-muted-foreground">Workspace navigation</p>
            </div>
            <nav className="mt-2 space-y-4">
              <div className="grid gap-1">
                {primaryNavItems.map(renderNavItem)}
              </div>
              <div className="border-t pt-4">
                <div className="grid gap-1">
                  {secondaryNavItems.map(renderNavItem)}
                </div>
              </div>
            </nav>
            <div className="mt-4 border-t pt-4">
              <Link href="/auth/logout" className="inline-flex w-full rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground/90 transition-colors hover:bg-muted/80 hover:text-foreground">
                Logout
              </Link>
            </div>
          </aside>
          <main className="min-w-0 space-y-4">
            {modeBanner ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{modeBanner.text}</span>
                  <Link href={modeBanner.ctaHref} className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium">
                    {modeBanner.ctaLabel}
                  </Link>
                </div>
              </div>
            ) : null}
            {accessWarning ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {accessWarning} <Link href="/app/onboarding" className="font-medium underline">Go to onboarding</Link>
              </div>
            ) : null}
            {children}
          </main>
        </div>
      </div>
    </ClientGuard>
  );
}
