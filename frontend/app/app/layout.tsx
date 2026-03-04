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

const navItems: Array<{ href: string; label: string; requiredPlan?: Exclude<PlanTier, null>; requiredRoles?: ClientRole[] }> = [
  { href: "/app", label: "Overview" },
  { href: "/app/calls", label: "Calls" },
  { href: "/app/leads", label: "Leads" },
  { href: "/app/appointments", label: "Appointments", requiredPlan: "STARTER" },
  { href: "/app/messages", label: "Messages", requiredPlan: "PRO" },
  { href: "/app/analytics", label: "Analytics", requiredPlan: "STARTER" },
  { href: "/app/settings", label: "Settings", requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] },
  { href: "/app/billing", label: "Billing", requiredRoles: ["CLIENT_ADMIN"] },
  { href: "/app/team", label: "Team", requiredPlan: "PRO", requiredRoles: ["CLIENT_ADMIN", "CLIENT_STAFF"] }
];

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [accessWarning, setAccessWarning] = useState<string | null>(null);
  const [modeBanner, setModeBanner] = useState<{ text: string; ctaLabel: string; ctaHref: string } | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanTier>(null);
  const [currentRole, setCurrentRole] = useState<ClientRole | null>(null);

  useEffect(() => {
    setAccessWarning(null);
    setModeBanner(null);
    if (pathname === "/app/onboarding") return;
    void Promise.all([fetchOrgOnboarding(), fetchOrgProfile(), getBillingStatus(), getMe()])
      .then(([onboarding, orgProfile, billing, me]) => {
        const subStatus = billing.subscription?.status || "";
        setCurrentPlan((billing.subscription?.plan as PlanTier) || null);
        setCurrentRole(me.user.role);
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
      });
  }, [pathname, router]);

  return (
    <ClientGuard>
      <div className="container py-8">
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <aside className="rounded-lg border bg-white p-3">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client Portal</p>
            <nav className="mt-2 grid gap-1">
              {navItems.map((item) => (
                hasRequiredPlan(currentPlan, item.requiredPlan) && hasRequiredRole(currentRole, item.requiredRoles) ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm",
                      pathname === item.href ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <div
                    key={item.href}
                    title={
                      !hasRequiredPlan(currentPlan, item.requiredPlan)
                        ? `Requires ${item.requiredPlan} plan`
                        : "Role does not have access"
                    }
                    className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground/70"
                  >
                    <span>{item.label}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide">
                      <Lock className="h-3 w-3" />
                      {!hasRequiredPlan(currentPlan, item.requiredPlan) ? item.requiredPlan : "ROLE"}
                    </span>
                  </div>
                )
              ))}
            </nav>
            <Link href="/auth/logout" className="mt-4 inline-block px-3 text-xs text-muted-foreground underline">
              Logout
            </Link>
          </aside>
          <main>
            {modeBanner ? (
              <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{modeBanner.text}</span>
                  <Link href={modeBanner.ctaHref} className="rounded border border-blue-300 bg-white px-2 py-1 text-xs font-medium">
                    {modeBanner.ctaLabel}
                  </Link>
                </div>
              </div>
            ) : null}
            {accessWarning ? (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
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
