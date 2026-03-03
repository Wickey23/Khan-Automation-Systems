"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/site/brand-mark";
import { navLinks, siteConfig } from "@/lib/config";
import { getBillingStatus, getMe } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

type HeaderNavItem = {
  href: string;
  label: string;
};

export function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [planTone, setPlanTone] = useState<"default" | "starter" | "pro">("default");

  useEffect(() => {
    let active = true;
    void getMe()
      .then((data) => {
        if (!active) return;
        setUser(data.user);
        const isAdminUser = data.user.role === "SUPER_ADMIN" || data.user.role === "ADMIN";
        if (!isAdminUser) {
          void getBillingStatus()
            .then((billing) => {
              if (!active) return;
              const plan = billing.subscription?.plan || null;
              if (plan === "STARTER") setPlanTone("starter");
              else if (plan === "PRO") setPlanTone("pro");
              else setPlanTone("default");
            })
            .catch(() => {
              if (!active) return;
              setPlanTone("default");
            });
        } else {
          setPlanTone("default");
        }
        setAuthResolved(true);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setPlanTone("default");
        setAuthResolved(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const homeHref = user ? (isAdmin ? "/admin/orgs" : "/app") : "/";
  const username = user?.email?.split("@")[0] || "Account";

  const portalNav = useMemo<HeaderNavItem[]>(() => {
    if (!user) return navLinks.map((item) => ({ href: item.href, label: item.label }));
    if (isAdmin) {
      return [
        { href: "/admin/orgs", label: "Clients" },
        { href: "/admin/calls", label: "Calls" },
        { href: "/admin/messages", label: "Messages" },
        { href: "/admin/leads", label: "Leads" },
        { href: "/admin/prospects", label: "Prospects" }
      ];
    }
    return [
      { href: "/app", label: "Overview" },
      { href: "/app/onboarding", label: "Onboarding" },
      { href: "/app/calls", label: "Calls" },
      { href: "/app/messages", label: "Messages" },
      { href: "/app/leads", label: "Leads" }
    ];
  }, [isAdmin, user]);

  function handleAnchorNavClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!href.startsWith("/#")) return;
    if (pathname !== "/") return;
    const targetId = href.slice(2);
    if (!targetId) return;
    const element = document.getElementById(targetId);
    if (!element) return;
    event.preventDefault();
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `/#${targetId}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          <BrandMark href={homeHref} size="sm" iconTone={planTone} />
          <span className="hidden text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground lg:inline-flex">
            v{siteConfig.version}
          </span>
        </div>
        <nav className="hidden items-center gap-6 md:flex">
          {portalNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={(event) => handleAnchorNavClick(event, item.href)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {!authResolved ? null : user ? (
            <>
              <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                <Link href={isAdmin ? "/admin/orgs" : "/app"}>{username}</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/auth/logout">Logout</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link href="/auth/login">Login</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                <Link href="/auth/signup">Sign Up</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/book">Book a 15-min Call</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
