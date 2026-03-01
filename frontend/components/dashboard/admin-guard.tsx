"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMe } from "@/lib/api";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const data = await getMe();
        if (!active) return;
        setAllowed(data.user.role === "SUPER_ADMIN" || data.user.role === "ADMIN");
      } catch {
        if (!active) return;
        setAllowed(false);
      }
    }
    void check();
    return () => {
      active = false;
    };
  }, []);

  if (allowed === null) return <div className="container py-12 text-sm text-muted-foreground">Loading admin...</div>;
  if (!allowed) {
    return (
      <div className="container py-12">
        <p className="text-sm text-muted-foreground">Admin access required.</p>
        <Link href="/login" className="mt-2 inline-block text-sm font-medium text-primary">
          Go to login
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
