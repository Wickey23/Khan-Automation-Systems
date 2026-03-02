"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { fetchOrgOnboarding, fetchOrgProfile, getBillingStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/app", label: "Overview" },
  { href: "/app/onboarding", label: "Onboarding" },
  { href: "/app/billing", label: "Billing" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/calls", label: "Calls" },
  { href: "/app/messages", label: "Messages" },
  { href: "/app/leads", label: "Leads" },
  { href: "/app/analytics", label: "Analytics" }
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [accessWarning, setAccessWarning] = useState<string | null>(null);
  const [modeBanner, setModeBanner] = useState<{ text: string; ctaLabel: string; ctaHref: string } | null>(null);

  useEffect(() => {
    setAccessWarning(null);
    setModeBanner(null);
    if (pathname === "/app/onboarding") return;
    void Promise.all([fetchOrgOnboarding(), fetchOrgProfile(), getBillingStatus()])
      .then(([onboarding, orgProfile, billing]) => {
        const subStatus = billing.subscription?.status || "";
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

        if (!hasAccess) {
          router.replace("/app/onboarding");
          return;
        }
        if (!onboardingDone) {
          setAccessWarning("Finish onboarding to unlock live configuration and full automation features.");
        }
      })
      .catch(() => {
        setAccessWarning("Could not verify onboarding status. You can still continue, but check your API connection.");
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
