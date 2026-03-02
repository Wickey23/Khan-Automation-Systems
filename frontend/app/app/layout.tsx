"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { fetchOrgOnboarding, getBillingStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/app", label: "Overview" },
  { href: "/app/onboarding", label: "Onboarding" },
  { href: "/app/billing", label: "Billing" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/calls", label: "Calls" },
  { href: "/app/messages", label: "Messages" },
  { href: "/app/leads", label: "Leads" }
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [accessWarning, setAccessWarning] = useState<string | null>(null);

  useEffect(() => {
    setAccessWarning(null);
    if (pathname === "/app/onboarding") return;
    void Promise.all([fetchOrgOnboarding(), getBillingStatus()])
      .then(([onboarding, billing]) => {
        const subStatus = billing.subscription?.status || "";
        const onboardingStatus = onboarding.submission?.status || "DRAFT";
        const hasAccess = ["active", "trialing"].includes(subStatus) || !billing.subscription;
        const onboardingDone = ["SUBMITTED", "REVIEWED", "APPROVED"].includes(onboardingStatus);
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
