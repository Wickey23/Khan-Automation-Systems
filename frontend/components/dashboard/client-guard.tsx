"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMe } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

export function ClientGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await getMe();
        if (!active) return;
        if (!["CLIENT", "CLIENT_ADMIN", "CLIENT_STAFF"].includes(data.user.role)) {
          setUser(null);
          return;
        }
        setUser(data.user);
      } catch {
        setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="container py-12 text-sm text-muted-foreground">Loading dashboard...</div>;
  if (!user) {
    return (
      <div className="container py-12">
        <p className="text-sm text-muted-foreground">You must log in as a client user.</p>
        <Link href="/login" className="mt-2 inline-block text-sm font-medium text-primary">
          Go to login
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
