"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { navLinks, siteConfig } from "@/lib/config";
import { getMe } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

type HeaderNavItem = {
  href: string;
  label: string;
};

export function Header() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    let active = true;
    void getMe()
      .then((data) => {
        if (!active) return;
        setUser(data.user);
        setAuthResolved(true);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
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
        { href: "/admin/leads", label: "Leads" },
        { href: "/admin/prospects", label: "Prospects" }
      ];
    }
    return [
      { href: "/app", label: "Overview" },
      { href: "/app/onboarding", label: "Onboarding" },
      { href: "/app/calls", label: "Calls" },
      { href: "/app/leads", label: "Leads" }
    ];
  }, [isAdmin, user]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href={homeHref} className="text-sm font-semibold tracking-wide">
          {siteConfig.name} <span className="text-xs text-muted-foreground">{siteConfig.version}</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {portalNav.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-muted-foreground hover:text-foreground">
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
